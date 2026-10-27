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
    public class Wbase3010Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "place";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "place";
        private const string KeyField = "no";

        public Wbase3010Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // GET: api/wbase3010?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TicketPlaceMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.TicketPlaceMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.PlaceCode.ToLower().Contains(kw) ||
                        f.PlaceName.ToLower().Contains(kw) ||
                        f.ContactPerson.ToLower().Contains(kw) ||
                        f.ContactTel.ToLower().Contains(kw) ||
                        f.PlaceAddress.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(f => f.PlaceCode).ToListAsync();
                var list = rawList.Select(f => new TicketPlaceMaster
                {
                    PlaceCode = f.PlaceCode?.Trim() ?? string.Empty,
                    PlaceName = f.PlaceName?.Trim() ?? string.Empty,
                    ContactPerson = f.ContactPerson?.Trim() ?? string.Empty,
                    ContactTel = f.ContactTel?.Trim() ?? string.Empty,
                    PlaceAddress = f.PlaceAddress?.Trim() ?? string.Empty,
                    RecordNumber = f.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3010 GetList error: {ex.Message}");
                return Ok(new List<TicketPlaceMaster>());
            }
        }

        // GET: api/wbase3010/{placeCode}
        [HttpGet("{placeCode}")]
        public async Task<ActionResult<TicketPlaceMaster>> GetByCode(string placeCode)
        {
            if (string.IsNullOrWhiteSpace(placeCode)) return BadRequest("代號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var trimmedCode = placeCode.Trim().ToUpper();
            var item = await _context.TicketPlaceMasters.FirstOrDefaultAsync(f => f.PlaceCode.Trim() == trimmedCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{placeCode}' 的購票地點資料" });
            }

            item.PlaceCode = item.PlaceCode?.Trim() ?? string.Empty;
            item.PlaceName = item.PlaceName?.Trim() ?? string.Empty;
            item.ContactPerson = item.ContactPerson?.Trim() ?? string.Empty;
            item.ContactTel = item.ContactTel?.Trim() ?? string.Empty;
            item.PlaceAddress = item.PlaceAddress?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase3010
        [HttpPost]
        public async Task<ActionResult<TicketPlaceMaster>> Create([FromBody] TicketPlaceMaster model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.PlaceCode))
            {
                return BadRequest(new { message = "購票地點代號不得為空" });
            }

            var code = model.PlaceCode.Trim().ToUpper();
            model.PlaceCode = code;
            model.PlaceName = model.PlaceName?.Trim() ?? string.Empty;
            model.ContactPerson = model.ContactPerson?.Trim() ?? string.Empty;
            model.ContactTel = model.ContactTel?.Trim() ?? string.Empty;
            model.PlaceAddress = model.PlaceAddress?.Trim() ?? string.Empty;

            var existing = await _context.TicketPlaceMasters.FirstOrDefaultAsync(f => f.PlaceCode.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = code,
                ["place"] = model.PlaceName,
                ["addr"] = model.PlaceAddress,
                ["linkman"] = model.ContactPerson,
                ["linktel"] = model.ContactTel
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
                existing.PlaceName = model.PlaceName;
                existing.ContactPerson = model.ContactPerson;
                existing.ContactTel = model.ContactTel;
                existing.PlaceAddress = model.PlaceAddress;
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
            _context.TicketPlaceMasters.Add(model);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { placeCode = model.PlaceCode }, model);
        }

        // PUT: api/wbase3010/{placeCode}
        [HttpPut("{placeCode}")]
        public async Task<IActionResult> Update(string placeCode, [FromBody] TicketPlaceMaster model)
        {
            if (string.IsNullOrWhiteSpace(placeCode)) return BadRequest("代號不可為空");

            var targetCode = placeCode.Trim().ToUpper();
            model.PlaceCode = targetCode;
            model.PlaceName = model.PlaceName?.Trim() ?? string.Empty;
            model.ContactPerson = model.ContactPerson?.Trim() ?? string.Empty;
            model.ContactTel = model.ContactTel?.Trim() ?? string.Empty;
            model.PlaceAddress = model.PlaceAddress?.Trim() ?? string.Empty;

            var existing = await _context.TicketPlaceMasters.FirstOrDefaultAsync(f => f.PlaceCode.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = targetCode,
                ["place"] = model.PlaceName,
                ["addr"] = model.PlaceAddress,
                ["linkman"] = model.ContactPerson,
                ["linktel"] = model.ContactTel
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
                _context.TicketPlaceMasters.Add(model);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(model);
            }

            existing.PlaceName = model.PlaceName;
            existing.ContactPerson = model.ContactPerson;
            existing.ContactTel = model.ContactTel;
            existing.PlaceAddress = model.PlaceAddress;
            if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

            await _context.SaveChangesAsync();
            var updatedChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(updatedChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, updatedChecksum);

            return Ok(existing);
        }

        // DELETE: api/wbase3010/{placeCode}
        [HttpDelete("{placeCode}")]
        public async Task<IActionResult> Delete(string placeCode)
        {
            if (string.IsNullOrWhiteSpace(placeCode)) return BadRequest("代號不可為空");

            var targetCode = placeCode.Trim().ToUpper();
            var existing = await _context.TicketPlaceMasters.FirstOrDefaultAsync(f => f.PlaceCode.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"欲刪除的購票地點 [{targetCode}] 不存在" });
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
            _context.TicketPlaceMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = "刪除成功" });
        }

        // POST: api/wbase3010/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<TicketPlaceMaster> list)
        {
            if (list == null) return BadRequest(new { message = "無效的提交資料" });

            var validItems = list
                .Where(x => !string.IsNullOrWhiteSpace(x.PlaceCode))
                .Select(x => new TicketPlaceMaster
                {
                    PlaceCode = x.PlaceCode.Trim().ToUpper(),
                    PlaceName = x.PlaceName?.Trim() ?? string.Empty,
                    ContactPerson = x.ContactPerson?.Trim() ?? string.Empty,
                    ContactTel = x.ContactTel?.Trim() ?? string.Empty,
                    PlaceAddress = x.PlaceAddress?.Trim() ?? string.Empty,
                }).ToList();

            // 依序寫入 DBF (DBF 絕對權威)
            foreach (var item in validItems)
            {
                var existing = await _context.TicketPlaceMasters.FirstOrDefaultAsync(f => f.PlaceCode.Trim() == item.PlaceCode);
                var op = existing != null ? "UPDATE" : "INSERT";
                var fields = new Dictionary<string, object?>
                {
                    ["no"] = item.PlaceCode,
                    ["place"] = item.PlaceName,
                    ["addr"] = item.PlaceAddress,
                    ["linkman"] = item.ContactPerson,
                    ["linktel"] = item.ContactTel
                };

                var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, op, KeyField, item.PlaceCode, fields);
                if (!dbfRes.Success)
                {
                    if (dbfRes.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfRes.Error,
                            message = $"購票地點 [{item.PlaceCode}] 正被地端其他工作站編輯中，批次存檔取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfRes.Error,
                        message = $"地端 DBF 寫入失敗 [{item.PlaceCode}]: " + (dbfRes.Message ?? dbfRes.Error)
                    });
                }
                if (dbfRes.Recno > 0) item.RecordNumber = dbfRes.Recno;

                if (existing != null)
                {
                    existing.PlaceName = item.PlaceName;
                    existing.ContactPerson = item.ContactPerson;
                    existing.ContactTel = item.ContactTel;
                    existing.PlaceAddress = item.PlaceAddress;
                    existing.RecordNumber = item.RecordNumber;
                }
                else
                {
                    _context.TicketPlaceMasters.Add(item);
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

        // POST: api/wbase3010/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<TicketPlaceMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.TicketPlaceMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => f.PlaceCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => f.PlaceCode.Trim().CompareTo(end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.PlaceCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3010 Print error: {ex.Message}");
                return Ok(new List<TicketPlaceMaster>());
            }
        }

        // GET: api/wbase3010/print-preview?codeStart=xxx&codeEnd=yyy
        [HttpGet("print-preview")]
        public async Task<ActionResult<IEnumerable<TicketPlaceMaster>>> GetPrintPreview([FromQuery] string? codeStart, [FromQuery] string? codeEnd)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.TicketPlaceMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(codeStart))
                {
                    queryable = queryable.Where(f => string.Compare(f.PlaceCode, codeStart.Trim().ToUpper()) >= 0);
                }
                if (!string.IsNullOrWhiteSpace(codeEnd))
                {
                    queryable = queryable.Where(f => string.Compare(f.PlaceCode, codeEnd.Trim().ToUpper()) <= 0);
                }

                var list = await queryable.OrderBy(f => f.PlaceCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得預覽資料失敗: {ex.Message}" });
            }
        }
    }
}
