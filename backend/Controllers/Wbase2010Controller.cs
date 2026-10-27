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
    public class Wbase2010Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "customer";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "customer";
        private const string KeyField = "no";

        public Wbase2010Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        private static void Sanitize(CompanyMaster model)
        {
            model.CompanyCode = (model.CompanyCode ?? string.Empty).Trim().ToUpper();
            model.CompanyName = (model.CompanyName ?? string.Empty).Trim();
            model.EnglishName = (model.EnglishName ?? string.Empty).Trim();
            model.ShortName = (model.ShortName ?? string.Empty).Trim();
            model.UnifiedNo = (model.UnifiedNo ?? string.Empty).Trim();
            model.TaxNo = (model.TaxNo ?? string.Empty).Trim();
            model.TaxOffice = (model.TaxOffice ?? string.Empty).Trim();
            model.Tel = (model.Tel ?? string.Empty).Trim();
            model.Fax = (model.Fax ?? string.Empty).Trim();
            model.Address = (model.Address ?? string.Empty).Trim();
            model.Address2 = (model.Address2 ?? string.Empty).Trim();
            model.Email = (model.Email ?? string.Empty).Trim();
            model.AcctType = (model.AcctType ?? string.Empty).Trim();
            model.Owner = (model.Owner ?? string.Empty).Trim();
            model.OwnerIdNo = (model.OwnerIdNo ?? string.Empty).Trim();
            model.OwnerMobile = (model.OwnerMobile ?? string.Empty).Trim();
            model.OwnerAddr = (model.OwnerAddr ?? string.Empty).Trim();
            model.ContactName = (model.ContactName ?? string.Empty).Trim();
            model.ContactMobile = (model.ContactMobile ?? string.Empty).Trim();
            model.Memo = (model.Memo ?? string.Empty).Trim();
            model.ListedType = (model.ListedType ?? string.Empty).Trim();
            model.OfficeId = (model.OfficeId ?? string.Empty).Trim();
        }

        private static string? ValidateFieldLengths(CompanyMaster model)
        {
            var limits = new (string Label, string Value, int MaxLen)[]
            {
                ("公司編號 (f3_code)", model.CompanyCode, 30),
                ("公司名稱 (f3_name)", model.CompanyName, 255),
                ("公司英文名稱 (f3_eng)", model.EnglishName, 255),
                ("公司簡稱 (f3_short)", model.ShortName, 255),
                ("公司統編 (f3_uni)", model.UnifiedNo, 20),
                ("稅籍編號 (f3_taxNo)", model.TaxNo, 30),
                ("國稅局 (f3_taxOffice)", model.TaxOffice, 100),
                ("聯絡電話 (f3_tel)", model.Tel, 255),
                ("公司傳真 (f3_fax)", model.Fax, 255),
                ("公司地址 (f3_addr)", model.Address, 255),
                ("聯絡地址 (f3_addr2)", model.Address2, 255),
                ("電子信箱 (f3_email)", model.Email, 255),
                ("會計類別 (f3_acctType)", model.AcctType, 50),
                ("負責人 (f3_owner)", model.Owner, 255),
                ("負責人證號 (f3_idNo)", model.OwnerIdNo, 30),
                ("負責人手機 (f3_ownerMobile)", model.OwnerMobile, 255),
                ("負責人地址 (f3_ownerAddr)", model.OwnerAddr, 255),
                ("聯絡人 (f3_contactName)", model.ContactName, 255),
                ("聯絡人手機 (f3_contactTel)", model.ContactMobile, 255),
                ("備註 (f3_memo)", model.Memo, 255),
                ("上市公司 (f5_listed)", model.ListedType, 20),
                ("事務所編號 (f6_officeId)", model.OfficeId, 30),
            };

            foreach (var item in limits)
            {
                if (!string.IsNullOrEmpty(item.Value) && item.Value.Length > item.MaxLen)
                {
                    return $"欄位「{item.Label}」內容長度為 {item.Value.Length} 字元，超過資料庫限制長度 ({item.MaxLen} 字元)！內容為: \"{item.Value}\"";
                }
            }

            return null;
        }

        // GET: api/wbase2010?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CompanyMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.CompanyMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(c =>
                        c.CompanyCode.ToLower().Contains(kw) ||
                        c.CompanyName.ToLower().Contains(kw) ||
                        c.ShortName.ToLower().Contains(kw) ||
                        c.UnifiedNo.ToLower().Contains(kw) ||
                        c.Owner.ToLower().Contains(kw) ||
                        c.Tel.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(c => c.CompanyCode).ToListAsync();
                var list = rawList.Select(c => new CompanyMaster
                {
                    CompanyCode = c.CompanyCode?.Trim() ?? string.Empty,
                    CompanyName = c.CompanyName?.Trim() ?? string.Empty,
                    EnglishName = c.EnglishName?.Trim() ?? string.Empty,
                    ShortName = c.ShortName?.Trim() ?? string.Empty,
                    UnifiedNo = c.UnifiedNo?.Trim() ?? string.Empty,
                    TaxNo = c.TaxNo?.Trim() ?? string.Empty,
                    TaxOffice = c.TaxOffice?.Trim() ?? string.Empty,
                    Capital = c.Capital,
                    Tel = c.Tel?.Trim() ?? string.Empty,
                    Fax = c.Fax?.Trim() ?? string.Empty,
                    Address = c.Address?.Trim() ?? string.Empty,
                    Address2 = c.Address2?.Trim() ?? string.Empty,
                    Email = c.Email?.Trim() ?? string.Empty,
                    AcctType = c.AcctType?.Trim() ?? string.Empty,
                    Owner = c.Owner?.Trim() ?? string.Empty,
                    OwnerIdNo = c.OwnerIdNo?.Trim() ?? string.Empty,
                    OwnerMobile = c.OwnerMobile?.Trim() ?? string.Empty,
                    OwnerAddr = c.OwnerAddr?.Trim() ?? string.Empty,
                    ContactName = c.ContactName?.Trim() ?? string.Empty,
                    ContactMobile = c.ContactMobile?.Trim() ?? string.Empty,
                    Memo = c.Memo?.Trim() ?? string.Empty,
                    ListedType = c.ListedType?.Trim() ?? string.Empty,
                    OfficeId = c.OfficeId?.Trim() ?? string.Empty,
                    RecordNumber = c.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase2010 GetList error: {ex.Message}");
                return StatusCode(500, new { message = "查詢客戶資料失敗", detail = ex.Message });
            }
        }

        // GET: api/wbase2010/{code}
        [HttpGet("{code}")]
        public async Task<ActionResult<CompanyMaster>> GetByCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("公司編號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var targetCode = code.Trim().ToUpper();
            var company = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode.Trim() == targetCode);
            if (company == null)
            {
                return NotFound(new { message = $"找不到公司編號 {code} 之資料" });
            }

            company.CompanyCode = company.CompanyCode?.Trim() ?? string.Empty;
            company.CompanyName = company.CompanyName?.Trim() ?? string.Empty;
            company.EnglishName = company.EnglishName?.Trim() ?? string.Empty;
            company.ShortName = company.ShortName?.Trim() ?? string.Empty;
            company.UnifiedNo = company.UnifiedNo?.Trim() ?? string.Empty;
            company.TaxNo = company.TaxNo?.Trim() ?? string.Empty;
            company.TaxOffice = company.TaxOffice?.Trim() ?? string.Empty;
            company.Tel = company.Tel?.Trim() ?? string.Empty;
            company.Fax = company.Fax?.Trim() ?? string.Empty;
            company.Address = company.Address?.Trim() ?? string.Empty;
            company.Address2 = company.Address2?.Trim() ?? string.Empty;
            company.Email = company.Email?.Trim() ?? string.Empty;
            company.AcctType = company.AcctType?.Trim() ?? string.Empty;
            company.Owner = company.Owner?.Trim() ?? string.Empty;
            company.OwnerIdNo = company.OwnerIdNo?.Trim() ?? string.Empty;
            company.OwnerMobile = company.OwnerMobile?.Trim() ?? string.Empty;
            company.OwnerAddr = company.OwnerAddr?.Trim() ?? string.Empty;
            company.ContactName = company.ContactName?.Trim() ?? string.Empty;
            company.ContactMobile = company.ContactMobile?.Trim() ?? string.Empty;
            company.Memo = company.Memo?.Trim() ?? string.Empty;

            return Ok(company);
        }

        // POST: api/wbase2010
        [HttpPost]
        public async Task<ActionResult<CompanyMaster>> Create([FromBody] CompanyMaster model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.CompanyCode))
            {
                return BadRequest(new { message = "公司編號不可為空" });
            }

            Sanitize(model);
            var lenErr = ValidateFieldLengths(model);
            if (lenErr != null)
            {
                return BadRequest(new { message = lenErr, detail = lenErr });
            }

            var code = model.CompanyCode;
            var existing = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode.Trim() == code);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = code,
                ["name"] = model.CompanyName,
                ["engname"] = model.EnglishName,
                ["abbr"] = model.ShortName,
                ["unino"] = model.UnifiedNo,
                ["taxno"] = model.TaxNo,
                ["offno"] = model.TaxOffice,
                ["capital"] = model.Capital,
                ["tel"] = model.Tel,
                ["fax"] = model.Fax,
                ["addr"] = model.Address,
                ["invaddr"] = model.Address2,
                ["email"] = model.Email,
                ["acctype"] = model.AcctType,
                ["hname"] = model.Owner,
                ["hidno"] = model.OwnerIdNo,
                ["mobile"] = model.OwnerMobile,
                ["haddr"] = model.OwnerAddr,
                ["linkman"] = model.ContactName,
                ["linkmobile"] = model.ContactMobile,
                ["memo01"] = model.Memo
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
                existing.CompanyName = model.CompanyName;
                existing.EnglishName = model.EnglishName;
                existing.ShortName = model.ShortName;
                existing.UnifiedNo = model.UnifiedNo;
                existing.TaxNo = model.TaxNo;
                existing.TaxOffice = model.TaxOffice;
                existing.Capital = model.Capital;
                existing.Tel = model.Tel;
                existing.Fax = model.Fax;
                existing.Address = model.Address;
                existing.Address2 = model.Address2;
                existing.Email = model.Email;
                existing.AcctType = model.AcctType;
                existing.Owner = model.Owner;
                existing.OwnerIdNo = model.OwnerIdNo;
                existing.OwnerMobile = model.OwnerMobile;
                existing.OwnerAddr = model.OwnerAddr;
                existing.ContactName = model.ContactName;
                existing.ContactMobile = model.ContactMobile;
                existing.Memo = model.Memo;
                existing.ListedType = model.ListedType;
                existing.OfficeId = model.OfficeId;
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
            _context.CompanyMasters.Add(model);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { code = model.CompanyCode }, model);
        }

        // PUT: api/wbase2010/{code}
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] CompanyMaster model)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("公司編號不可為空");

            Sanitize(model);
            var lenErr = ValidateFieldLengths(model);
            if (lenErr != null)
            {
                return BadRequest(new { message = lenErr, detail = lenErr });
            }

            var targetCode = code.Trim().ToUpper();
            model.CompanyCode = targetCode;

            var existing = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode.Trim() == targetCode);
            var operation = existing != null ? "UPDATE" : "INSERT";

            // 1. 組裝 DBF 欄位清單
            var fields = new Dictionary<string, object?>
            {
                ["no"] = targetCode,
                ["name"] = model.CompanyName,
                ["engname"] = model.EnglishName,
                ["abbr"] = model.ShortName,
                ["unino"] = model.UnifiedNo,
                ["taxno"] = model.TaxNo,
                ["offno"] = model.TaxOffice,
                ["capital"] = model.Capital,
                ["tel"] = model.Tel,
                ["fax"] = model.Fax,
                ["addr"] = model.Address,
                ["invaddr"] = model.Address2,
                ["email"] = model.Email,
                ["acctype"] = model.AcctType,
                ["hname"] = model.Owner,
                ["hidno"] = model.OwnerIdNo,
                ["mobile"] = model.OwnerMobile,
                ["haddr"] = model.OwnerAddr,
                ["linkman"] = model.ContactName,
                ["linkmobile"] = model.ContactMobile,
                ["memo01"] = model.Memo
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
                _context.CompanyMasters.Add(model);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(model);
            }

            existing.CompanyName = model.CompanyName;
            existing.EnglishName = model.EnglishName;
            existing.ShortName = model.ShortName;
            existing.UnifiedNo = model.UnifiedNo;
            existing.TaxNo = model.TaxNo;
            existing.TaxOffice = model.TaxOffice;
            existing.Capital = model.Capital;
            existing.Tel = model.Tel;
            existing.Fax = model.Fax;
            existing.Address = model.Address;
            existing.Address2 = model.Address2;
            existing.Email = model.Email;
            existing.AcctType = model.AcctType;
            existing.Owner = model.Owner;
            existing.OwnerIdNo = model.OwnerIdNo;
            existing.OwnerMobile = model.OwnerMobile;
            existing.OwnerAddr = model.OwnerAddr;
            existing.ContactName = model.ContactName;
            existing.ContactMobile = model.ContactMobile;
            existing.Memo = model.Memo;
            existing.ListedType = model.ListedType;
            existing.OfficeId = model.OfficeId;
            if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

            await _context.SaveChangesAsync();
            var updatedChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(updatedChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, updatedChecksum);

            return Ok(existing);
        }

        // DELETE: api/wbase2010/{code}
        [HttpDelete("{code}")]
        public async Task<IActionResult> Delete(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("公司編號不可為空");

            var targetCode = code.Trim().ToUpper();
            var existing = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"找不到公司編號 {code} 之資料" });
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
            _context.CompanyMasters.Remove(existing);
            await _context.SaveChangesAsync();
            var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newChecksum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

            return Ok(new { message = $"已成功刪除公司編號 {code}" });
        }

        public class CompanyPrintFilter
        {
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase2010/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<CompanyMaster>>> PrintRange([FromBody] CompanyPrintFilter query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.CompanyMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(c => c.CompanyCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(c => c.CompanyCode.Trim().CompareTo(end) <= 0);
                }

                var list = await queryable.OrderBy(c => c.CompanyCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase2010 Print error: {ex.Message}");
                return Ok(new List<CompanyMaster>());
            }
        }
    }
}
