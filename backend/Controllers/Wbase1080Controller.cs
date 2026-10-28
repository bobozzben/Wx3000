using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1080Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "recmemo";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "recmemo";
        private const string KeyField = "mno";

        public Wbase1080Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // GET: api/wbase1080?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FeeSummaryMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeSummaryMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.Mno.ToLower().Contains(kw) ||
                        f.Tx.ToLower().Contains(kw) ||
                        f.Memo.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(f => f.Mno).ToListAsync();
                var list = rawList.Select(f => new FeeSummaryMaster
                {
                    Seq = f.Seq,
                    Mno = f.Mno?.Trim() ?? string.Empty,
                    Tx = f.Tx?.Trim() ?? string.Empty,
                    Memo = f.Memo?.Trim() ?? string.Empty,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                    RecordNumber = f.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1080 GetList error: {ex.Message}");
                return Ok(new List<FeeSummaryMaster>());
            }
        }

        // GET: api/wbase1080/{summaryCode}
        [HttpGet("{summaryCode}")]
        public async Task<ActionResult<FeeSummaryMaster>> GetByCode(string summaryCode)
        {
            if (string.IsNullOrWhiteSpace(summaryCode)) return BadRequest("摘要代號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var trimmedCode = summaryCode.Trim().ToUpper();
            var item = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.Mno.Trim() == trimmedCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{summaryCode}' 的收費摘要資料" });
            }

            item.Mno = item.Mno?.Trim() ?? string.Empty;
            item.Tx = item.Tx?.Trim() ?? string.Empty;
            item.Memo = item.Memo?.Trim() ?? string.Empty;
            item.Guid = item.Guid?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1080
        [HttpPost]
        public async Task<ActionResult<FeeSummaryMaster>> Create([FromBody] FeeSummaryMaster model)
        {
            var rawCode = !string.IsNullOrWhiteSpace(model?.Mno) ? model.Mno : model?.SummaryCode;
            if (model == null || string.IsNullOrWhiteSpace(rawCode))
            {
                return BadRequest(new { message = "摘要代號不得為空" });
            }

            var code = rawCode.Trim().ToUpper();
            model.Mno = code;
            model.Tx = (model.Tx ?? model.SummaryName ?? string.Empty).Trim();
            model.Memo = (model.Memo ?? model.Content ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.Mno.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單 (recmemo: mno, tx, memo)
            var fields = new Dictionary<string, object?>
            {
                ["mno"] = code,
                ["tx"] = model.Tx,
                ["memo"] = model.Memo
            };

            // 2. 核心原則：DBF 絕對權威！先寫 DBF
            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, operation, KeyField, code, fields);
            if (!dbfResult.Success)
            {
                if (dbfResult.ErrorType == "LOCK_TIMEOUT")
                {
                    return StatusCode(StatusCodes.Status409Conflict, new
                    {
                        error = dbfResult.Error,
                        message = dbfResult.Message ?? "資料正被地端其他工作站編輯中，存檔取消"
                    });
                }
                return BadRequest(new
                {
                    error = dbfResult.Error,
                    message = "地端 DBF 寫入失敗: " + (dbfResult.Message ?? dbfResult.Error)
                });
            }

            // 3. DBF 成功後才寫入 PostgreSQL
            if (existing != null)
            {
                existing.Tx = model.Tx;
                existing.Memo = model.Memo;
                if (!string.IsNullOrWhiteSpace(model.Guid)) existing.Guid = model.Guid.Trim();
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
            _context.FeeSummaryMasters.Add(model);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { summaryCode = model.Mno }, model);
        }

        // PUT: api/wbase1080/{summaryCode}
        [HttpPut("{summaryCode}")]
        public async Task<IActionResult> Update(string summaryCode, [FromBody] FeeSummaryMaster model)
        {
            if (string.IsNullOrWhiteSpace(summaryCode)) return BadRequest("代號不可為空");

            var targetCode = summaryCode.Trim().ToUpper();
            model.Mno = targetCode;
            model.Tx = (model.Tx ?? model.SummaryName ?? string.Empty).Trim();
            model.Memo = (model.Memo ?? model.Content ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.Mno.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單 (recmemo: mno, tx, memo)
            var fields = new Dictionary<string, object?>
            {
                ["mno"] = targetCode,
                ["tx"] = model.Tx,
                ["memo"] = model.Memo
            };

            // 2. 核心原則：DBF 絕對權威！先寫 DBF
            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, operation, KeyField, targetCode, fields);
            if (!dbfResult.Success)
            {
                if (dbfResult.ErrorType == "LOCK_TIMEOUT")
                {
                    return StatusCode(StatusCodes.Status409Conflict, new
                    {
                        error = dbfResult.Error,
                        message = dbfResult.Message ?? "資料正被地端其他工作站編輯中，存檔取消"
                    });
                }
                return BadRequest(new
                {
                    error = dbfResult.Error,
                    message = "地端 DBF 寫入失敗: " + (dbfResult.Message ?? dbfResult.Error)
                });
            }

            // 3. DBF 成功後才寫入 PostgreSQL
            if (existing == null && dbfResult.Recno > 0)
            {
                existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.RecordNumber == dbfResult.Recno);
            }

            if (existing == null)
            {
                if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
                _context.FeeSummaryMasters.Add(model);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(model);
            }

            existing.Mno = targetCode;
            existing.Tx = model.Tx;
            existing.Memo = model.Memo;
            if (!string.IsNullOrWhiteSpace(model.Guid))
            {
                existing.Guid = model.Guid.Trim();
            }
            if (existing.RecordNumber <= 0 && dbfResult.Recno > 0)
            {
                existing.RecordNumber = dbfResult.Recno;
            }

            await _context.SaveChangesAsync();
            var updatedChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(updatedChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, updatedChecksum);

            return Ok(existing);
        }

        // DELETE: api/wbase1080/{summaryCode}
        [HttpDelete("{summaryCode}")]
        public async Task<IActionResult> Delete(string summaryCode)
        {
            if (string.IsNullOrWhiteSpace(summaryCode)) return BadRequest("代號不可為空");

            var targetCode = summaryCode.Trim().ToUpper();
            var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.Mno.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"欲刪除的收費摘要 [{targetCode}] 不存在" });
            }

            // 1. 核心原則：DBF 絕對權威！先刪除 DBF
            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "DELETE", KeyField, targetCode, new Dictionary<string, object?>());
            if (!dbfResult.Success)
            {
                if (dbfResult.ErrorType == "LOCK_TIMEOUT")
                {
                    return StatusCode(StatusCodes.Status409Conflict, new
                    {
                        error = dbfResult.Error,
                        message = dbfResult.Message ?? "資料正被地端其他工作站編輯中，刪除取消"
                    });
                }
                return BadRequest(new
                {
                    error = dbfResult.Error,
                    message = "地端 DBF 刪除失敗: " + (dbfResult.Message ?? dbfResult.Error)
                });
            }

            // 2. DBF 成功刪除後才刪除 PostgreSQL
            _context.FeeSummaryMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = "刪除成功" });
        }

        // POST: api/wbase1080/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<FeeSummaryMaster> list)
        {
            if (list == null) return BadRequest(new { message = "無效的提交資料" });

            var validItems = list
                .Where(x => !string.IsNullOrWhiteSpace(x.Mno) || !string.IsNullOrWhiteSpace(x.SummaryCode))
                .Select(x => new FeeSummaryMaster
                {
                    Seq = x.Seq,
                    Mno = (!string.IsNullOrWhiteSpace(x.Mno) ? x.Mno : x.SummaryCode).Trim().ToUpper(),
                    Tx = (x.Tx ?? x.SummaryName ?? string.Empty).Trim(),
                    Memo = (x.Memo ?? x.Content ?? string.Empty).Trim(),
                    Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                })
                .ToList();

            // 依序寫入 DBF (DBF 絕對權威)
            foreach (var item in validItems)
            {
                var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.Mno.Trim() == item.Mno);
                var op = existing != null ? "UPDATE" : "INSERT";
                var fields = new Dictionary<string, object?>
                {
                    ["mno"] = item.Mno,
                    ["tx"] = item.Tx,
                    ["memo"] = item.Memo
                };

                var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, op, KeyField, item.Mno, fields);
                if (!dbfRes.Success)
                {
                    if (dbfRes.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfRes.Error,
                            message = $"收費摘要 [{item.Mno}] 正被地端其他工作站編輯中，批次存檔取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfRes.Error,
                        message = $"地端 DBF 寫入失敗 [{item.Mno}]: " + (dbfRes.Message ?? dbfRes.Error)
                    });
                }
                if (dbfRes.Recno > 0) item.RecordNumber = dbfRes.Recno;

                if (existing != null)
                {
                    existing.Tx = item.Tx;
                    existing.Memo = item.Memo;
                    existing.RecordNumber = item.RecordNumber;
                }
                else
                {
                    _context.FeeSummaryMasters.Add(item);
                }
            }

            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = "批次儲存成功", count = validItems.Count });
        }

        public class PrintRangeQuery
        {
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase1080/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<FeeSummaryMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeSummaryMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query?.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => string.Compare(f.Mno.Trim(), start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query?.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => string.Compare(f.Mno.Trim(), end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.Mno).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1080 PrintRange error: {ex.Message}");
                return Ok(new List<FeeSummaryMaster>());
            }
        }
    }
}
