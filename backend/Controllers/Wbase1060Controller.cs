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
    public class Wbase1060Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "recitem";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "recitem";
        private const string KeyField = "itemno";

        public Wbase1060Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // GET: api/wbase1060?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.FeeCode.ToLower().Contains(kw) ||
                        f.FeeName.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                var list = rawList.Select(f => new FeeItemMaster
                {
                    FeeCode = f.FeeCode?.Trim() ?? string.Empty,
                    FeeName = f.FeeName?.Trim() ?? string.Empty,
                    Price = f.Price,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                    RecordNumber = f.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1060 GetList error: {ex.Message}");
                return Ok(new List<FeeItemMaster>());
            }
        }

        // GET: api/wbase1060/{feeCode}
        [HttpGet("{feeCode}")]
        public async Task<ActionResult<FeeItemMaster>> GetByCode(string feeCode)
        {
            if (string.IsNullOrWhiteSpace(feeCode)) return BadRequest("代號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var targetCode = feeCode.Trim().ToUpper();
            var item = await _context.FeeItemMasters.FirstOrDefaultAsync(f => f.FeeCode.Trim() == targetCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{feeCode}' 的收費項目" });
            }

            item.FeeCode = item.FeeCode.Trim();
            item.FeeName = item.FeeName?.Trim() ?? string.Empty;
            item.Guid = item.Guid?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1060
        [HttpPost]
        public async Task<ActionResult<FeeItemMaster>> Create([FromBody] FeeItemMaster model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.FeeCode))
            {
                return BadRequest(new { message = "收費項目代號不得為空" });
            }

            var code = model.FeeCode.Trim().ToUpper();
            model.FeeCode = code;
            model.FeeName = model.FeeName?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            var existing = await _context.FeeItemMasters.FirstOrDefaultAsync(f => f.FeeCode.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["itemno"] = code,
                ["item"] = model.FeeName,
                ["amt"] = model.Price
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
                existing.FeeName = model.FeeName;
                existing.Price = model.Price;
                existing.Guid = model.Guid;
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
            _context.FeeItemMasters.Add(model);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { feeCode = model.FeeCode }, model);
        }

        // PUT: api/wbase1060/{feeCode}
        [HttpPut("{feeCode}")]
        public async Task<IActionResult> Update(string feeCode, [FromBody] FeeItemMaster model)
        {
            if (string.IsNullOrWhiteSpace(feeCode)) return BadRequest("代號不可為空");

            var targetCode = feeCode.Trim().ToUpper();
            model.FeeCode = targetCode;
            model.FeeName = model.FeeName?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            var existing = await _context.FeeItemMasters.FirstOrDefaultAsync(f => f.FeeCode.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["itemno"] = targetCode,
                ["item"] = model.FeeName,
                ["amt"] = model.Price
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
                if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
                _context.FeeItemMasters.Add(model);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(model);
            }

            existing.FeeName = model.FeeName;
            existing.Price = model.Price;
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

        // DELETE: api/wbase1060/{feeCode}
        [HttpDelete("{feeCode}")]
        public async Task<IActionResult> Delete(string feeCode)
        {
            if (string.IsNullOrWhiteSpace(feeCode)) return BadRequest("代號不可為空");

            var targetCode = feeCode.Trim().ToUpper();
            var existing = await _context.FeeItemMasters.FirstOrDefaultAsync(f => f.FeeCode.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"欲刪除的收費項目 [{targetCode}] 不存在" });
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
            _context.FeeItemMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = "刪除成功" });
        }

        // POST: api/wbase1060/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<FeeItemMaster> list)
        {
            if (list == null) return BadRequest(new { message = "無效的提交資料" });

            var validItems = list
                .Where(x => !string.IsNullOrWhiteSpace(x.FeeCode))
                .Select(x => new FeeItemMaster
                {
                    FeeCode = x.FeeCode.Trim().ToUpper(),
                    FeeName = x.FeeName?.Trim() ?? string.Empty,
                    Price = x.Price,
                    Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                }).ToList();

            // 依序寫入 DBF (DBF 絕對權威)
            foreach (var item in validItems)
            {
                var existing = await _context.FeeItemMasters.FirstOrDefaultAsync(f => f.FeeCode.Trim() == item.FeeCode);
                var op = existing != null ? "UPDATE" : "INSERT";
                var fields = new Dictionary<string, object?>
                {
                    ["itemno"] = item.FeeCode,
                    ["item"] = item.FeeName,
                    ["amt"] = item.Price
                };

                var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, op, KeyField, item.FeeCode, fields);
                if (!dbfRes.Success)
                {
                    if (dbfRes.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfRes.Error,
                            message = $"項目 [{item.FeeCode}] 正被地端其他工作站編輯中，批次存檔取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfRes.Error,
                        message = $"地端 DBF 寫入失敗 [{item.FeeCode}]: " + (dbfRes.Message ?? dbfRes.Error)
                    });
                }
                if (dbfRes.Recno > 0) item.RecordNumber = dbfRes.Recno;
            }

            var currentDbList = await _context.FeeItemMasters.ToListAsync();
            _context.FeeItemMasters.RemoveRange(currentDbList);
            await _context.FeeItemMasters.AddRangeAsync(validItems);
            await _context.SaveChangesAsync();

            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return Ok(new { message = "批次儲存成功", count = validItems.Count });
        }

        public class PrintRangeQuery
        {
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase1060/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => f.FeeCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => f.FeeCode.Trim().CompareTo(end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1060 Print error: {ex.Message}");
                return Ok(new List<FeeItemMaster>());
            }
        }

        // GET: api/wbase1060/print-preview?codeStart=xxx&codeEnd=yyy
        [HttpGet("print-preview")]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> GetPrintPreview([FromQuery] string? codeStart, [FromQuery] string? codeEnd)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(codeStart))
                {
                    queryable = queryable.Where(f => string.Compare(f.FeeCode, codeStart.Trim().ToUpper()) >= 0);
                }
                if (!string.IsNullOrWhiteSpace(codeEnd))
                {
                    queryable = queryable.Where(f => string.Compare(f.FeeCode, codeEnd.Trim().ToUpper()) <= 0);
                }

                var list = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得預覽資料失敗: {ex.Message}" });
            }
        }
    }
}
