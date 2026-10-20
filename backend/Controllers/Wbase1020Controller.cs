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
    public class Wbase1020Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;

        private const string DbfPath = @"C:\w3000\comm";
        private const string DbfName = "cpa";
        private const string PgSchema = "c:/w3000/comm";
        private const string PgTable = "cpa";
        private const string KeyField = "no";

        public Wbase1020Controller(AppDbContext context, IDbfSyncService dbfSyncService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
        }

        private static string Truncate(string? value, int maxLength)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            var trimmed = value.Trim();
            return trimmed.Length <= maxLength ? trimmed : trimmed.Substring(0, maxLength);
        }

        // GET: api/wbase1020/inspect
        [HttpGet("inspect")]
        public async Task<IActionResult> InspectTable()
        {
            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT column_name, data_type, character_maximum_length 
                    FROM information_schema.columns 
                    WHERE table_schema = 'c:/w3000/comm' AND table_name = 'cpa';
                ";
                using var r = await cmd.ExecuteReaderAsync();
                var cols = new List<object>();
                while (await r.ReadAsync())
                {
                    cols.Add(new
                    {
                        name = r.GetString(0),
                        type = r.GetString(1),
                        maxLen = r.IsDBNull(2) ? (int?)null : r.GetInt32(2)
                    });
                }
                return Ok(cols);
            }
            catch (Exception ex)
            {
                return Ok(new { error = ex.Message });
            }
        }

        // GET: api/wbase1020?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CpaMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.CpaMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(c =>
                        (c.CpaCode != null && c.CpaCode.ToLower().Contains(kw)) ||
                        (c.CpaName != null && c.CpaName.ToLower().Contains(kw)) ||
                        (c.OfficeName != null && c.OfficeName.ToLower().Contains(kw)) ||
                        (c.LicenseNo != null && c.LicenseNo.ToLower().Contains(kw)) ||
                        (c.Tel != null && c.Tel.ToLower().Contains(kw))
                    );
                }

                var rawList = await queryable.OrderBy(c => c.CpaCode).ToListAsync();
                var list = rawList.Select(c => new CpaMaster
                {
                    CpaCode = c.CpaCode?.Trim() ?? string.Empty,
                    CpaName = c.CpaName?.Trim() ?? string.Empty,
                    CertType = c.CertType?.Trim() ?? string.Empty,
                    TaxId = c.TaxId?.Trim() ?? string.Empty,
                    LicenseNo = c.LicenseNo?.Trim() ?? string.Empty,
                    DocTrack = c.DocTrack?.Trim() ?? string.Empty,
                    CertNo = c.CertNo?.Trim() ?? string.Empty,
                    OfficeName = c.OfficeName?.Trim() ?? string.Empty,
                    MemberNo = c.MemberNo?.Trim() ?? string.Empty,
                    Tel = c.Tel?.Trim() ?? string.Empty,
                    Mobile = c.Mobile?.Trim() ?? string.Empty,
                    Fax = c.Fax?.Trim() ?? string.Empty,
                    UnifiedNo = c.UnifiedNo?.Trim() ?? string.Empty,
                    Address = c.Address?.Trim() ?? string.Empty,
                    GuildNo1 = c.GuildNo1?.Trim() ?? string.Empty,
                    GuildNo2 = c.GuildNo2?.Trim() ?? string.Empty,
                    Email = c.Email?.Trim() ?? string.Empty,
                    Guid = c.Guid?.Trim() ?? string.Empty,
                    Memo = c.Memo?.Trim() ?? string.Empty,
                    RecordNumber = c.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1020 GetList error: {ex.Message}");
                return Ok(new List<CpaMaster>());
            }
        }

        // GET: api/wbase1020/{code}
        [HttpGet("{code}")]
        public async Task<ActionResult<CpaMaster>> GetByCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("代號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var targetCode = code.Trim().ToUpper();
            var item = await _context.CpaMasters.FirstOrDefaultAsync(c => c.CpaCode.Trim() == targetCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{code}' 的會計師資料" });
            }

            item.CpaCode = item.CpaCode?.Trim() ?? string.Empty;
            item.CpaName = item.CpaName?.Trim() ?? string.Empty;
            item.OfficeName = item.OfficeName?.Trim() ?? string.Empty;
            item.LicenseNo = item.LicenseNo?.Trim() ?? string.Empty;
            item.Tel = item.Tel?.Trim() ?? string.Empty;
            item.Fax = item.Fax?.Trim() ?? string.Empty;
            item.Address = item.Address?.Trim() ?? string.Empty;
            item.Email = item.Email?.Trim() ?? string.Empty;
            item.Mobile = item.Mobile?.Trim() ?? string.Empty;
            item.UnifiedNo = item.UnifiedNo?.Trim() ?? string.Empty;
            item.CertType = item.CertType?.Trim() ?? string.Empty;
            item.TaxId = item.TaxId?.Trim() ?? string.Empty;
            item.DocTrack = item.DocTrack?.Trim() ?? string.Empty;
            item.CertNo = item.CertNo?.Trim() ?? string.Empty;
            item.MemberNo = item.MemberNo?.Trim() ?? string.Empty;
            item.GuildNo1 = item.GuildNo1?.Trim() ?? string.Empty;
            item.GuildNo2 = item.GuildNo2?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1020 (Create or Upsert)
        [HttpPost]
        public async Task<ActionResult<CpaMaster>> Create([FromBody] CpaMaster input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.CpaCode))
            {
                return BadRequest(new { message = "會計師代號為必填欄位" });
            }

            var code = Truncate(input.CpaCode.ToUpper(), 10);
            input.CpaCode = code;
            input.CpaName = Truncate(input.CpaName, 40);
            input.CertType = Truncate(input.CertType, 1);
            input.TaxId = Truncate(input.TaxId, 10);
            input.LicenseNo = Truncate(input.LicenseNo, 3);
            input.DocTrack = Truncate(input.DocTrack, 20);
            input.CertNo = Truncate(input.CertNo, 8);
            input.OfficeName = Truncate(input.OfficeName, 40);
            input.MemberNo = Truncate(input.MemberNo, 12);
            input.Tel = Truncate(input.Tel, 20);
            input.Mobile = Truncate(input.Mobile, 20);
            input.Fax = Truncate(input.Fax, 20);
            input.UnifiedNo = Truncate(input.UnifiedNo, 8);
            input.Address = Truncate(input.Address, 60);
            input.GuildNo1 = Truncate(input.GuildNo1, 20);
            input.GuildNo2 = Truncate(input.GuildNo2, 20);
            input.Email = Truncate(input.Email, 255);
            input.Guid = string.IsNullOrWhiteSpace(input.Guid) ? Guid.NewGuid().ToString("N") : Truncate(input.Guid, 32);

            var existing = await _context.CpaMasters.FirstOrDefaultAsync(c => c.CpaCode.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = code,
                ["name"] = input.CpaName,
                ["kind"] = input.CertType,
                ["id"] = input.TaxId,
                ["cno1"] = input.LicenseNo,
                ["cword"] = input.DocTrack,
                ["cno2"] = input.CertNo,
                ["gno1"] = input.OfficeName,
                ["gno2"] = input.MemberNo,
                ["tel"] = input.Tel,
                ["mobile"] = input.Mobile,
                ["fax"] = input.Fax,
                ["unino"] = input.UnifiedNo,
                ["addr"] = input.Address,
                ["hno1"] = input.GuildNo1,
                ["hno2"] = input.GuildNo2,
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

            // 3. DBF 成功後才寫入 PostgreSQL
            if (existing != null)
            {
                existing.CpaName = input.CpaName;
                existing.CertType = input.CertType;
                existing.TaxId = input.TaxId;
                existing.LicenseNo = input.LicenseNo;
                existing.DocTrack = input.DocTrack;
                existing.CertNo = input.CertNo;
                existing.OfficeName = input.OfficeName;
                existing.MemberNo = input.MemberNo;
                existing.Tel = input.Tel;
                existing.Mobile = input.Mobile;
                existing.Fax = input.Fax;
                existing.UnifiedNo = input.UnifiedNo;
                existing.Address = input.Address;
                existing.GuildNo1 = input.GuildNo1;
                existing.GuildNo2 = input.GuildNo2;
                existing.Email = input.Email;
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) input.RecordNumber = dbfResult.Recno;
            _context.CpaMasters.Add(input);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { code = input.CpaCode }, input);
        }

        // PUT: api/wbase1020/{code} (Upsert: Create if not exists, Update if exists)
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] CpaMaster input)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("代號不可為空");

            var targetCode = Truncate(code.ToUpper(), 10);
            input.CpaCode = targetCode;
            input.CpaName = Truncate(input.CpaName, 40);
            input.CertType = Truncate(input.CertType, 1);
            input.TaxId = Truncate(input.TaxId, 10);
            input.LicenseNo = Truncate(input.LicenseNo, 3);
            input.DocTrack = Truncate(input.DocTrack, 20);
            input.CertNo = Truncate(input.CertNo, 8);
            input.OfficeName = Truncate(input.OfficeName, 40);
            input.MemberNo = Truncate(input.MemberNo, 12);
            input.Tel = Truncate(input.Tel, 20);
            input.Mobile = Truncate(input.Mobile, 20);
            input.Fax = Truncate(input.Fax, 20);
            input.UnifiedNo = Truncate(input.UnifiedNo, 8);
            input.Address = Truncate(input.Address, 60);
            input.GuildNo1 = Truncate(input.GuildNo1, 20);
            input.GuildNo2 = Truncate(input.GuildNo2, 20);
            input.Email = Truncate(input.Email, 255);
            input.Guid = string.IsNullOrWhiteSpace(input.Guid) ? Guid.NewGuid().ToString("N") : Truncate(input.Guid, 32);

            var existing = await _context.CpaMasters.FirstOrDefaultAsync(c => c.CpaCode.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = targetCode,
                ["name"] = input.CpaName,
                ["kind"] = input.CertType,
                ["id"] = input.TaxId,
                ["cno1"] = input.LicenseNo,
                ["cword"] = input.DocTrack,
                ["cno2"] = input.CertNo,
                ["gno1"] = input.OfficeName,
                ["gno2"] = input.MemberNo,
                ["tel"] = input.Tel,
                ["mobile"] = input.Mobile,
                ["fax"] = input.Fax,
                ["unino"] = input.UnifiedNo,
                ["addr"] = input.Address,
                ["hno1"] = input.GuildNo1,
                ["hno2"] = input.GuildNo2,
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
                _context.CpaMasters.Add(input);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(input);
            }

            existing.CpaName = input.CpaName;
            existing.CertType = input.CertType;
            existing.TaxId = input.TaxId;
            existing.LicenseNo = input.LicenseNo;
            existing.DocTrack = input.DocTrack;
            existing.CertNo = input.CertNo;
            existing.OfficeName = input.OfficeName;
            existing.MemberNo = input.MemberNo;
            existing.Tel = input.Tel;
            existing.Mobile = input.Mobile;
            existing.Fax = input.Fax;
            existing.UnifiedNo = input.UnifiedNo;
            existing.Address = input.Address;
            existing.GuildNo1 = input.GuildNo1;
            existing.GuildNo2 = input.GuildNo2;
            existing.Email = input.Email;
            if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

            await _context.SaveChangesAsync();
            var updatedChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(updatedChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, updatedChecksum);

            return Ok(existing);
        }

        // DELETE: api/wbase1020/{code}
        [HttpDelete("{code}")]
        public async Task<IActionResult> Delete(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("代號不可為空");

            var targetCode = code.Trim().ToUpper();
            var existing = await _context.CpaMasters.FirstOrDefaultAsync(c => c.CpaCode.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"找不到代號為 '{targetCode}' 的會計師資料" });
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
            _context.CpaMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = $"會計師 [{targetCode}] 已成功刪除" });
        }

        public class PrintRequest
        {
            public string? CpaCodeStart { get; set; }
            public string? CpaCodeEnd { get; set; }
        }

        // POST: api/wbase1020/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<CpaMaster>>> PrintData([FromBody] PrintRequest req)
        {
            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var queryable = _context.CpaMasters.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(req.CpaCodeStart))
            {
                var start = req.CpaCodeStart.Trim().ToUpper();
                queryable = queryable.Where(c => string.Compare(c.CpaCode.Trim(), start) >= 0);
            }

            if (!string.IsNullOrWhiteSpace(req.CpaCodeEnd))
            {
                var end = req.CpaCodeEnd.Trim().ToUpper();
                queryable = queryable.Where(c => string.Compare(c.CpaCode.Trim(), end) <= 0);
            }

            var rawList = await queryable.OrderBy(c => c.CpaCode).ToListAsync();
            var list = rawList.Select(c => new CpaMaster
            {
                CpaCode = c.CpaCode?.Trim() ?? string.Empty,
                CpaName = c.CpaName?.Trim() ?? string.Empty,
                CertType = c.CertType?.Trim() ?? string.Empty,
                TaxId = c.TaxId?.Trim() ?? string.Empty,
                LicenseNo = c.LicenseNo?.Trim() ?? string.Empty,
                DocTrack = c.DocTrack?.Trim() ?? string.Empty,
                CertNo = c.CertNo?.Trim() ?? string.Empty,
                OfficeName = c.OfficeName?.Trim() ?? string.Empty,
                MemberNo = c.MemberNo?.Trim() ?? string.Empty,
                Tel = c.Tel?.Trim() ?? string.Empty,
                Mobile = c.Mobile?.Trim() ?? string.Empty,
                Fax = c.Fax?.Trim() ?? string.Empty,
                UnifiedNo = c.UnifiedNo?.Trim() ?? string.Empty,
                Address = c.Address?.Trim() ?? string.Empty,
                GuildNo1 = c.GuildNo1?.Trim() ?? string.Empty,
                GuildNo2 = c.GuildNo2?.Trim() ?? string.Empty,
                Email = c.Email?.Trim() ?? string.Empty,
                RecordNumber = c.RecordNumber
            }).ToList();

            return Ok(list);
        }
    }
}
