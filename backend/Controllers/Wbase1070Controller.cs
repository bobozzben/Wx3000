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
    public class Wbase1070Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "recnote";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "recnote";
        private const string KeyField = "noteno";

        public Wbase1070Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // GET: api/wbase1070/inspect
        [HttpGet("inspect")]
        public async Task<IActionResult> Inspect()
        {
            var list = await _context.NoteMasters.AsNoTracking().ToListAsync();
            return Ok(list);
        }

        // GET: api/wbase1070?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<NoteMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.NoteMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.Noteno.ToLower().Contains(kw) ||
                        f.Note.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(f => f.Noteno).ToListAsync();
                var list = rawList.Select(f => new NoteMaster
                {
                    Seq = f.Seq,
                    Noteno = f.Noteno?.Trim() ?? string.Empty,
                    Note = f.Note?.Trim() ?? string.Empty,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                    RecordNumber = f.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1070 GetList error: {ex.Message}");
                return Ok(new List<NoteMaster>());
            }
        }

        // GET: api/wbase1070/{noteCode}
        [HttpGet("{noteCode}")]
        public async Task<ActionResult<NoteMaster>> GetByCode(string noteCode)
        {
            if (string.IsNullOrWhiteSpace(noteCode)) return BadRequest("編號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var trimmedCode = noteCode.Trim().ToUpper();
            var item = await _context.NoteMasters.FirstOrDefaultAsync(f => f.Noteno.Trim() == trimmedCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到編號為 '{noteCode}' 的收費備註資料" });
            }

            item.Noteno = item.Noteno?.Trim() ?? string.Empty;
            item.Note = item.Note?.Trim() ?? string.Empty;
            item.Guid = item.Guid?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1070
        [HttpPost]
        public async Task<ActionResult<NoteMaster>> Create([FromBody] NoteMaster model)
        {
            var rawCode = !string.IsNullOrWhiteSpace(model?.Noteno) ? model.Noteno : model?.NoteCode;
            if (model == null || string.IsNullOrWhiteSpace(rawCode))
            {
                return BadRequest(new { message = "編號不得為空" });
            }

            var code = rawCode.Trim().ToUpper();
            model.Noteno = code;
            model.Note = (model.Note ?? model.Content ?? model.NoteName ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.Noteno.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單 (recnote: noteno, note)
            var fields = new Dictionary<string, object?>
            {
                ["noteno"] = code,
                ["note"] = model.Note
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
                existing.Note = model.Note;
                if (!string.IsNullOrWhiteSpace(model.Guid)) existing.Guid = model.Guid.Trim();
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
            _context.NoteMasters.Add(model);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { noteCode = model.Noteno }, model);
        }

        // PUT: api/wbase1070/{noteCode}
        [HttpPut("{noteCode}")]
        public async Task<IActionResult> Update(string noteCode, [FromBody] NoteMaster model)
        {
            if (string.IsNullOrWhiteSpace(noteCode)) return BadRequest("編號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var targetCode = noteCode.Trim().ToUpper();
            model.Noteno = targetCode;
            model.Note = (model.Note ?? model.Content ?? model.NoteName ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }

            var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.Noteno.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單 (recnote: noteno, note)
            var fields = new Dictionary<string, object?>
            {
                ["noteno"] = targetCode,
                ["note"] = model.Note
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
                existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.RecordNumber == dbfResult.Recno);
            }

            if (existing == null)
            {
                if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
                _context.NoteMasters.Add(model);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(model);
            }

            existing.Noteno = targetCode;
            existing.Note = model.Note;
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

        // DELETE: api/wbase1070/{noteCode}
        [HttpDelete("{noteCode}")]
        public async Task<IActionResult> Delete(string noteCode)
        {
            if (string.IsNullOrWhiteSpace(noteCode)) return BadRequest("編號不可為空");

            var targetCode = noteCode.Trim().ToUpper();
            var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.Noteno.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"欲刪除的收費備註 [{targetCode}] 不存在" });
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
            _context.NoteMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = "刪除成功" });
        }

        // POST: api/wbase1070/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<NoteMaster> list)
        {
            if (list == null) return BadRequest(new { message = "無效的提交資料" });

            var validItems = list
                .Where(x => !string.IsNullOrWhiteSpace(x.Noteno) || !string.IsNullOrWhiteSpace(x.NoteCode))
                .Select(x => new NoteMaster
                {
                    Seq = x.Seq,
                    Noteno = (!string.IsNullOrWhiteSpace(x.Noteno) ? x.Noteno : x.NoteCode).Trim().ToUpper(),
                    Note = (x.Note ?? x.Content ?? x.NoteName ?? string.Empty).Trim(),
                    Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                })
                .ToList();

            // 依序寫入 DBF (DBF 絕對權威)
            foreach (var item in validItems)
            {
                var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.Noteno.Trim() == item.Noteno);
                var op = existing != null ? "UPDATE" : "INSERT";
                var fields = new Dictionary<string, object?>
                {
                    ["noteno"] = item.Noteno,
                    ["note"] = item.Note
                };

                var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, op, KeyField, item.Noteno, fields);
                if (!dbfRes.Success)
                {
                    if (dbfRes.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfRes.Error,
                            message = $"收費備註 [{item.Noteno}] 正被地端其他工作站編輯中，批次存檔取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfRes.Error,
                        message = $"地端 DBF 寫入失敗 [{item.Noteno}]: " + (dbfRes.Message ?? dbfRes.Error)
                    });
                }
                if (dbfRes.Recno > 0) item.RecordNumber = dbfRes.Recno;

                if (existing != null)
                {
                    existing.Note = item.Note;
                    existing.RecordNumber = item.RecordNumber;
                }
                else
                {
                    _context.NoteMasters.Add(item);
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

        // POST: api/wbase1070/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<NoteMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.NoteMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query?.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => string.Compare(f.Noteno.Trim(), start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query?.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => string.Compare(f.Noteno.Trim(), end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.Noteno).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1070 PrintRange error: {ex.Message}");
                return Ok(new List<NoteMaster>());
            }
        }
    }
}
