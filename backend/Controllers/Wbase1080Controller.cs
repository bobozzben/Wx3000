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
        private const string DbfName = "recnote";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "recnote";
        private const string KeyField = "noteno";

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
                        f.SummaryCode.ToLower().Contains(kw) ||
                        f.SummaryName.ToLower().Contains(kw) ||
                        f.Content.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(f => f.SummaryCode).ToListAsync();
                var list = rawList.Select(f => new FeeSummaryMaster
                {
                    Seq = f.Seq,
                    SummaryCode = f.SummaryCode?.Trim() ?? string.Empty,
                    SummaryName = f.SummaryName?.Trim() ?? string.Empty,
                    Content = f.Content?.Trim() ?? string.Empty,
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
            var item = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == trimmedCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{summaryCode}' 的收費摘要資料" });
            }

            item.SummaryCode = item.SummaryCode?.Trim() ?? string.Empty;
            item.SummaryName = item.SummaryName?.Trim() ?? string.Empty;
            item.Content = item.Content?.Trim() ?? string.Empty;
            item.Guid = item.Guid?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1080
        [HttpPost]
        public async Task<ActionResult<FeeSummaryMaster>> Create([FromBody] FeeSummaryMaster model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.SummaryCode))
            {
                return BadRequest(new { message = "收費摘要代號不得為空" });
            }

            var code = model.SummaryCode.Trim().ToUpper();
            model.SummaryCode = code;
            model.SummaryName = model.SummaryName?.Trim() ?? string.Empty;
            model.Content = model.Content?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            if (!model.Seq.HasValue || model.Seq.Value == 0)
            {
                var maxSeq = await _context.FeeSummaryMasters.MaxAsync(f => (int?)f.Seq) ?? 0;
                model.Seq = maxSeq + 1;
            }

            var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["noteno"] = code,
                ["note"] = model.SummaryName
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
                existing.SummaryName = model.SummaryName;
                existing.Content = model.Content;
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

            return CreatedAtAction(nameof(GetByCode), new { summaryCode = model.SummaryCode }, model);
        }

        // PUT: api/wbase1080/{summaryCode}
        [HttpPut("{summaryCode}")]
        public async Task<IActionResult> Update(string summaryCode, [FromBody] FeeSummaryMaster model)
        {
            if (string.IsNullOrWhiteSpace(summaryCode)) return BadRequest("代號不可為空");

            var targetCode = summaryCode.Trim().ToUpper();
            model.SummaryCode = targetCode;
            model.SummaryName = model.SummaryName?.Trim() ?? string.Empty;
            model.Content = model.Content?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["noteno"] = targetCode,
                ["note"] = model.SummaryName
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
            if (existing == null)
            {
                if (!model.Seq.HasValue || model.Seq.Value == 0)
                {
                    var maxSeq = await _context.FeeSummaryMasters.MaxAsync(f => (int?)f.Seq) ?? 0;
                    model.Seq = maxSeq + 1;
                }
                if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
                _context.FeeSummaryMasters.Add(model);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(model);
            }

            existing.SummaryName = model.SummaryName;
            existing.Content = model.Content;
            if (!string.IsNullOrWhiteSpace(model.Guid))
            {
                existing.Guid = model.Guid.Trim();
            }
            if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

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
            var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == targetCode);
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
                .Where(x => !string.IsNullOrWhiteSpace(x.SummaryCode))
                .Select(x => new FeeSummaryMaster
                {
                    Seq = x.Seq,
                    SummaryCode = x.SummaryCode.Trim().ToUpper(),
                    SummaryName = x.SummaryName?.Trim() ?? string.Empty,
                    Content = x.Content?.Trim() ?? string.Empty,
                    Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                })
                .ToList();

            // 依序寫入 DBF (DBF 絕對權威)
            foreach (var item in validItems)
            {
                var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == item.SummaryCode);
                var op = existing != null ? "UPDATE" : "INSERT";
                var fields = new Dictionary<string, object?>
                {
                    ["noteno"] = item.SummaryCode,
                    ["note"] = item.SummaryName
                };

                var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, op, KeyField, item.SummaryCode, fields);
                if (!dbfRes.Success)
                {
                    if (dbfRes.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfRes.Error,
                            message = $"摘要 [{item.SummaryCode}] 正被地端其他工作站編輯中，批次存檔取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfRes.Error,
                        message = $"地端 DBF 寫入失敗 [{item.SummaryCode}]: " + (dbfRes.Message ?? dbfRes.Error)
                    });
                }
                if (dbfRes.Recno > 0) item.RecordNumber = dbfRes.Recno;

                if (existing != null)
                {
                    existing.SummaryName = item.SummaryName;
                    existing.Content = item.Content;
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

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => f.SummaryCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => f.SummaryCode.Trim().CompareTo(end) <= 0);
                }

                var rawList = await queryable.OrderBy(f => f.SummaryCode).ToListAsync();
                var list = rawList.Select(f => new FeeSummaryMaster
                {
                    Seq = f.Seq,
                    SummaryCode = f.SummaryCode?.Trim() ?? string.Empty,
                    SummaryName = f.SummaryName?.Trim() ?? string.Empty,
                    Content = f.Content?.Trim() ?? string.Empty,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                    RecordNumber = f.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1080 Print error: {ex.Message}");
                return Ok(new List<FeeSummaryMaster>());
            }
        }
    }
}
