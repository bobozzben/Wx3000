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
    public class Wbase1030Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "keyin";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "keyin";
        private const string KeyField = "no";

        public Wbase1030Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // GET: api/wbase1030/inspect
        [HttpGet("inspect")]
        public async Task<IActionResult> InspectTable()
        {
            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                
                using var cmd1 = conn.CreateCommand();
                cmd1.CommandText = $@"
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = '{PgSchema}' AND table_name = 'keyin';
                ";
                using var r1 = await cmd1.ExecuteReaderAsync();
                var cols = new List<string>();
                while (await r1.ReadAsync())
                {
                    cols.Add(r1.GetString(0));
                }
                r1.Close();

                using var cmd2 = conn.CreateCommand();
                cmd2.CommandText = $@"SELECT * FROM ""{PgSchema}"".keyin LIMIT 5;";
                using var r2 = await cmd2.ExecuteReaderAsync();
                var rows = new List<Dictionary<string, object>>();
                while (await r2.ReadAsync())
                {
                    var dict = new Dictionary<string, object>();
                    for (int i = 0; i < r2.FieldCount; i++)
                    {
                        dict[r2.GetName(i)] = r2.GetValue(i);
                    }
                    rows.Add(dict);
                }

                return Ok(new { columns = cols, sampleRows = rows });
            }
            catch (Exception ex)
            {
                return Ok(new { error = ex.Message });
            }
        }

        // GET: api/wbase1030?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmpMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                // 開檔前確保快照與 DBF Checksum 同步 (Checksum 相符則 ~2ms 放行)
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.EmpMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(e =>
                        e.No.ToLower().Contains(kw) ||
                        e.Name.ToLower().Contains(kw) ||
                        (e.Tel != null && e.Tel.ToLower().Contains(kw)) ||
                        (e.Id != null && e.Id.ToLower().Contains(kw)) ||
                        (e.Memo != null && e.Memo.ToLower().Contains(kw)) ||
                        (e.Phone != null && e.Phone.ToLower().Contains(kw))
                    );
                }

                var rawList = await queryable.OrderBy(e => e.No).ToListAsync();
                var list = rawList.Select(e => new EmpMaster
                {
                    No = e.No?.Trim() ?? string.Empty,
                    Name = e.Name?.Trim() ?? string.Empty,
                    Psw = e.Psw?.Trim() ?? string.Empty,
                    Birthday = e.Birthday?.Trim() ?? string.Empty,
                    Tel = e.Tel?.Trim() ?? string.Empty,
                    Id = e.Id?.Trim() ?? string.Empty,
                    Addr = e.Addr?.Trim() ?? string.Empty,
                    Memo = e.Memo?.Trim() ?? string.Empty,
                    OneUserId = e.OneUserId?.Trim() ?? string.Empty,
                    OnePassNo = e.OnePassNo?.Trim() ?? string.Empty,
                    Phone = e.Phone?.Trim() ?? string.Empty,
                    Email = e.Email?.Trim() ?? string.Empty,
                    RecordNumber = e.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1030 GetList error: {ex.Message}");
                return Ok(new List<EmpMaster>());
            }
        }

        // GET: api/wbase1030/{code}
        [HttpGet("{code}")]
        public async Task<ActionResult<EmpMaster>> GetByCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var targetCode = code.Trim().ToUpper();
            var item = await _context.EmpMasters.FirstOrDefaultAsync(e => e.No.Trim() == targetCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到編號為 '{code}' 的人員資料" });
            }

            item.No = item.No?.Trim() ?? string.Empty;
            item.Name = item.Name?.Trim() ?? string.Empty;
            item.Psw = item.Psw?.Trim() ?? string.Empty;
            item.Birthday = item.Birthday?.Trim() ?? string.Empty;
            item.Tel = item.Tel?.Trim() ?? string.Empty;
            item.Id = item.Id?.Trim() ?? string.Empty;
            item.Addr = item.Addr?.Trim() ?? string.Empty;
            item.Memo = item.Memo?.Trim() ?? string.Empty;
            item.OneUserId = item.OneUserId?.Trim() ?? string.Empty;
            item.OnePassNo = item.OnePassNo?.Trim() ?? string.Empty;
            item.Phone = item.Phone?.Trim() ?? string.Empty;
            item.Email = item.Email?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1030 (Create or Upsert)
        [HttpPost]
        public async Task<ActionResult<EmpMaster>> Create([FromBody] EmpMaster input)
        {
            var rawCode = !string.IsNullOrWhiteSpace(input?.No) ? input.No : input?.EmpCode;
            if (input == null || string.IsNullOrWhiteSpace(rawCode))
            {
                return BadRequest(new { message = "編號為必填欄位" });
            }

            var code = rawCode.Trim().ToUpper();
            input.No = code;
            input.Name = (input.Name ?? input.EmpName ?? string.Empty).Trim();
            input.Psw = (input.Psw ?? string.Empty).Trim();
            input.Birthday = (input.Birthday ?? string.Empty).Trim();
            input.Tel = (input.Tel ?? string.Empty).Trim();
            input.Id = (input.Id ?? string.Empty).Trim();
            input.Addr = (input.Addr ?? string.Empty).Trim();
            input.Memo = (input.Memo ?? input.DepName ?? string.Empty).Trim();
            input.OneUserId = (input.OneUserId ?? string.Empty).Trim();
            input.OnePassNo = (input.OnePassNo ?? string.Empty).Trim();
            input.Phone = (input.Phone ?? input.Mobile ?? string.Empty).Trim();
            input.Email = (input.Email ?? string.Empty).Trim();

            var existing = await _context.EmpMasters.FirstOrDefaultAsync(e => e.No.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 12 個欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = code,
                ["name"] = input.Name,
                ["psw"] = input.Psw,
                ["birthday"] = input.Birthday,
                ["tel"] = input.Tel,
                ["id"] = input.Id,
                ["addr"] = input.Addr,
                ["memo"] = input.Memo,
                ["oneuserid"] = input.OneUserId,
                ["onepassno"] = input.OnePassNo,
                ["phone"] = input.Phone,
                ["email"] = input.Email
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

            // 3. DBF 寫入成功後才 Commit 至 PostgreSQL
            if (existing != null)
            {
                existing.Name = input.Name;
                existing.Psw = input.Psw;
                existing.Birthday = input.Birthday;
                existing.Tel = input.Tel;
                existing.Id = input.Id;
                existing.Addr = input.Addr;
                existing.Memo = input.Memo;
                existing.OneUserId = input.OneUserId;
                existing.OnePassNo = input.OnePassNo;
                existing.Phone = input.Phone;
                existing.Email = input.Email;
                if (dbfResult.Recno > 0 && existing.RecordNumber != dbfResult.Recno)
                    existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) input.RecordNumber = dbfResult.Recno;
            _context.EmpMasters.Add(input);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { code = input.No }, input);
        }

        // PUT: api/wbase1030/{code} (Upsert: Create if not exists, Update if exists)
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] EmpMaster input)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            var targetCode = code.Trim().ToUpper();
            input.No = targetCode;
            input.Name = (input.Name ?? input.EmpName ?? string.Empty).Trim();
            input.Psw = (input.Psw ?? string.Empty).Trim();
            input.Birthday = (input.Birthday ?? string.Empty).Trim();
            input.Tel = (input.Tel ?? string.Empty).Trim();
            input.Id = (input.Id ?? string.Empty).Trim();
            input.Addr = (input.Addr ?? string.Empty).Trim();
            input.Memo = (input.Memo ?? input.DepName ?? string.Empty).Trim();
            input.OneUserId = (input.OneUserId ?? string.Empty).Trim();
            input.OnePassNo = (input.OnePassNo ?? string.Empty).Trim();
            input.Phone = (input.Phone ?? input.Mobile ?? string.Empty).Trim();
            input.Email = (input.Email ?? string.Empty).Trim();

            var existing = await _context.EmpMasters.FirstOrDefaultAsync(e => e.No.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 12 個欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = targetCode,
                ["name"] = input.Name,
                ["psw"] = input.Psw,
                ["birthday"] = input.Birthday,
                ["tel"] = input.Tel,
                ["id"] = input.Id,
                ["addr"] = input.Addr,
                ["memo"] = input.Memo,
                ["oneuserid"] = input.OneUserId,
                ["onepassno"] = input.OnePassNo,
                ["phone"] = input.Phone,
                ["email"] = input.Email
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
                if (dbfResult.Recno > 0) input.RecordNumber = dbfResult.Recno;
                _context.EmpMasters.Add(input);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(input);
            }

            existing.Name = input.Name;
            existing.Psw = input.Psw;
            existing.Birthday = input.Birthday;
            existing.Tel = input.Tel;
            existing.Id = input.Id;
            existing.Addr = input.Addr;
            existing.Memo = input.Memo;
            existing.OneUserId = input.OneUserId;
            existing.OnePassNo = input.OnePassNo;
            existing.Phone = input.Phone;
            existing.Email = input.Email;
            if (dbfResult.Recno > 0 && existing.RecordNumber != dbfResult.Recno)
                existing.RecordNumber = dbfResult.Recno;

            await _context.SaveChangesAsync();
            var updatedChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(updatedChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, updatedChecksum);

            return Ok(existing);
        }

        // DELETE: api/wbase1030/{code}
        [HttpDelete("{code}")]
        public async Task<IActionResult> Delete(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            var targetCode = code.Trim().ToUpper();
            var existing = await _context.EmpMasters.FirstOrDefaultAsync(e => e.No.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"找不到編號為 '{targetCode}' 的人員資料" });
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
            _context.EmpMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = $"人員 [{targetCode}] 已成功刪除" });
        }

        public class PrintRequest
        {
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase1030/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<EmpMaster>>> PrintData([FromBody] PrintRequest req)
        {
            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var queryable = _context.EmpMasters.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(req.CodeStart))
            {
                var start = req.CodeStart.Trim().ToUpper();
                queryable = queryable.Where(e => string.Compare(e.No.Trim(), start) >= 0);
            }

            if (!string.IsNullOrWhiteSpace(req.CodeEnd))
            {
                var end = req.CodeEnd.Trim().ToUpper();
                queryable = queryable.Where(e => string.Compare(e.No.Trim(), end) <= 0);
            }

            var rawList = await queryable.OrderBy(e => e.No).ToListAsync();
            var list = rawList.Select(e => new EmpMaster
            {
                No = e.No?.Trim() ?? string.Empty,
                Name = e.Name?.Trim() ?? string.Empty,
                Psw = e.Psw?.Trim() ?? string.Empty,
                Birthday = e.Birthday?.Trim() ?? string.Empty,
                Tel = e.Tel?.Trim() ?? string.Empty,
                Id = e.Id?.Trim() ?? string.Empty,
                Addr = e.Addr?.Trim() ?? string.Empty,
                Memo = e.Memo?.Trim() ?? string.Empty,
                OneUserId = e.OneUserId?.Trim() ?? string.Empty,
                OnePassNo = e.OnePassNo?.Trim() ?? string.Empty,
                Phone = e.Phone?.Trim() ?? string.Empty,
                Email = e.Email?.Trim() ?? string.Empty,
                RecordNumber = e.RecordNumber
            }).ToList();

            return Ok(list);
        }
    }
}
