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
    public class Wbase1050Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;

        private const string DbfPath = @"C:\w3000\comm";
        private const string DbfName = "taxno";
        private const string PgSchema = "c:/w3000/comm";
        private const string PgTable = "taxno";
        private const string KeyField = "no";

        public Wbase1050Controller(AppDbContext context, IDbfSyncService dbfSyncService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
        }

        // GET: api/wbase1050?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaxOfficerMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.TaxOfficerMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(t =>
                        t.TaxCode.ToLower().Contains(kw) ||
                        t.TaxName.ToLower().Contains(kw) ||
                        t.TaxBureau.ToLower().Contains(kw) ||
                        t.Unit.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(t => t.TaxCode).ToListAsync();
                var list = rawList.Select(t => new TaxOfficerMaster
                {
                    TaxCode = t.TaxCode?.Trim() ?? string.Empty,
                    TaxName = t.TaxName?.Trim() ?? string.Empty,
                    TaxBureau = t.TaxBureau?.Trim() ?? string.Empty,
                    Unit = t.Unit?.Trim() ?? string.Empty,
                    Tel = t.Tel?.Trim() ?? string.Empty,
                    Ext = t.Ext?.Trim() ?? string.Empty,
                    Fax = t.Fax?.Trim() ?? string.Empty,
                    Mobile = t.Mobile?.Trim() ?? string.Empty,
                    Email = t.Email?.Trim() ?? string.Empty,
                    Memo = t.Memo?.Trim() ?? string.Empty,
                    Address = t.Address?.Trim() ?? string.Empty,
                    RecordNumber = t.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1050 GetList error: {ex.Message}");
                return Ok(new List<TaxOfficerMaster>());
            }
        }

        // GET: api/wbase1050/{code}
        [HttpGet("{code}")]
        public async Task<ActionResult<TaxOfficerMaster>> GetByCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var targetCode = code.Trim().ToUpper();
            var item = await _context.TaxOfficerMasters.FirstOrDefaultAsync(t => t.TaxCode.Trim() == targetCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到編號為 '{code}' 的稅務人員資料" });
            }

            item.TaxCode = item.TaxCode?.Trim() ?? string.Empty;
            item.TaxName = item.TaxName?.Trim() ?? string.Empty;
            item.TaxBureau = item.TaxBureau?.Trim() ?? string.Empty;
            item.Unit = item.Unit?.Trim() ?? string.Empty;
            item.Tel = item.Tel?.Trim() ?? string.Empty;
            item.Ext = item.Ext?.Trim() ?? string.Empty;
            item.Fax = item.Fax?.Trim() ?? string.Empty;
            item.Mobile = item.Mobile?.Trim() ?? string.Empty;
            item.Email = item.Email?.Trim() ?? string.Empty;
            item.Memo = item.Memo?.Trim() ?? string.Empty;
            item.Address = item.Address?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1050 (Create or Upsert)
        [HttpPost]
        public async Task<ActionResult<TaxOfficerMaster>> Create([FromBody] TaxOfficerMaster input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.TaxCode))
            {
                return BadRequest(new { message = "稅務人員編號為必填欄位" });
            }

            var code = input.TaxCode.Trim().ToUpper();
            input.TaxCode = code;
            input.TaxName = input.TaxName?.Trim() ?? string.Empty;
            input.TaxBureau = input.TaxBureau?.Trim() ?? string.Empty;
            input.Unit = input.Unit?.Trim() ?? string.Empty;
            input.Tel = input.Tel?.Trim() ?? string.Empty;
            input.Ext = input.Ext?.Trim() ?? string.Empty;
            input.Fax = input.Fax?.Trim() ?? string.Empty;
            input.Mobile = input.Mobile?.Trim() ?? string.Empty;
            input.Email = input.Email?.Trim() ?? string.Empty;
            input.Memo = input.Memo?.Trim() ?? string.Empty;
            input.Address = input.Address?.Trim() ?? string.Empty;

            var existing = await _context.TaxOfficerMasters.FirstOrDefaultAsync(t => t.TaxCode.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = code,
                ["name"] = input.TaxName,
                ["helpman"] = input.TaxBureau,
                ["department"] = input.Unit,
                ["tel"] = input.Tel,
                ["memo"] = input.Memo,
                ["addr"] = input.Address
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
                existing.TaxName = input.TaxName;
                existing.TaxBureau = input.TaxBureau;
                existing.Unit = input.Unit;
                existing.Tel = input.Tel;
                existing.Ext = input.Ext;
                existing.Fax = input.Fax;
                existing.Mobile = input.Mobile;
                existing.Email = input.Email;
                existing.Memo = input.Memo;
                existing.Address = input.Address;
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) input.RecordNumber = dbfResult.Recno;
            _context.TaxOfficerMasters.Add(input);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { code = input.TaxCode }, input);
        }

        // PUT: api/wbase1050/{code}
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] TaxOfficerMaster input)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            var targetCode = code.Trim().ToUpper();
            input.TaxCode = targetCode;
            input.TaxName = input.TaxName?.Trim() ?? string.Empty;
            input.TaxBureau = input.TaxBureau?.Trim() ?? string.Empty;
            input.Unit = input.Unit?.Trim() ?? string.Empty;
            input.Tel = input.Tel?.Trim() ?? string.Empty;
            input.Ext = input.Ext?.Trim() ?? string.Empty;
            input.Fax = input.Fax?.Trim() ?? string.Empty;
            input.Mobile = input.Mobile?.Trim() ?? string.Empty;
            input.Email = input.Email?.Trim() ?? string.Empty;
            input.Memo = input.Memo?.Trim() ?? string.Empty;
            input.Address = input.Address?.Trim() ?? string.Empty;

            var existing = await _context.TaxOfficerMasters.FirstOrDefaultAsync(t => t.TaxCode.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = targetCode,
                ["name"] = input.TaxName,
                ["helpman"] = input.TaxBureau,
                ["department"] = input.Unit,
                ["tel"] = input.Tel,
                ["memo"] = input.Memo,
                ["addr"] = input.Address
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
                _context.TaxOfficerMasters.Add(input);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(input);
            }

            existing.TaxName = input.TaxName;
            existing.TaxBureau = input.TaxBureau;
            existing.Unit = input.Unit;
            existing.Tel = input.Tel;
            existing.Ext = input.Ext;
            existing.Fax = input.Fax;
            existing.Mobile = input.Mobile;
            existing.Email = input.Email;
            existing.Memo = input.Memo;
            existing.Address = input.Address;
            if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

            await _context.SaveChangesAsync();
            var updatedChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(updatedChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, updatedChecksum);

            return Ok(existing);
        }

        // DELETE: api/wbase1050/{code}
        [HttpDelete("{code}")]
        public async Task<IActionResult> Delete(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            var targetCode = code.Trim().ToUpper();
            var existing = await _context.TaxOfficerMasters.FirstOrDefaultAsync(t => t.TaxCode.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"找不到編號為 '{code}' 的資料" });
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
            _context.TaxOfficerMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = $"稅務人員 [{code}] 已成功刪除" });
        }

        public class PrintRangeQuery
        {
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase1050/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<TaxOfficerMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.TaxOfficerMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(t => t.TaxCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(t => t.TaxCode.Trim().CompareTo(end) <= 0);
                }

                var rawList = await queryable.OrderBy(t => t.TaxCode).ToListAsync();
                var list = rawList.Select(t => new TaxOfficerMaster
                {
                    TaxCode = t.TaxCode?.Trim() ?? string.Empty,
                    TaxName = t.TaxName?.Trim() ?? string.Empty,
                    TaxBureau = t.TaxBureau?.Trim() ?? string.Empty,
                    Unit = t.Unit?.Trim() ?? string.Empty,
                    Tel = t.Tel?.Trim() ?? string.Empty,
                    Ext = t.Ext?.Trim() ?? string.Empty,
                    Fax = t.Fax?.Trim() ?? string.Empty,
                    Mobile = t.Mobile?.Trim() ?? string.Empty,
                    Email = t.Email?.Trim() ?? string.Empty,
                    Memo = t.Memo?.Trim() ?? string.Empty,
                    Address = t.Address?.Trim() ?? string.Empty,
                    RecordNumber = t.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1050 Print error: {ex.Message}");
                return Ok(new List<TaxOfficerMaster>());
            }
        }
    }
}
