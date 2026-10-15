using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase2010Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase2010Controller(AppDbContext context)
        {
            _context = context;
        }

        private static void Sanitize(CompanyMaster model)
        {
            model.CompanyCode = (model.CompanyCode ?? string.Empty).Trim();
            model.CompanyName = (model.CompanyName ?? string.Empty).Trim();
            model.EnglishName = (model.EnglishName ?? string.Empty).Trim();
            model.ShortName = (model.ShortName ?? string.Empty).Trim();
            model.UnifiedNo = (model.UnifiedNo ?? string.Empty).Trim();
            model.TaxNo = (model.TaxNo ?? string.Empty).Trim();
            model.TaxOffice = (model.TaxOffice ?? string.Empty).Trim();
            model.Capital = model.Capital ?? 0m;
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

        private async Task EnsureTableCreatedAsync()
        {
            await Task.CompletedTask;
        }

        // GET: api/wbase2010?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CompanyMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.CompanyMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(c =>
                        c.CompanyCode.ToLower().Contains(kw) ||
                        (c.CompanyName != null && c.CompanyName.ToLower().Contains(kw)) ||
                        (c.ShortName != null && c.ShortName.ToLower().Contains(kw)) ||
                        (c.UnifiedNo != null && c.UnifiedNo.ToLower().Contains(kw)) ||
                        (c.Owner != null && c.Owner.ToLower().Contains(kw)) ||
                        (c.Tel != null && c.Tel.ToLower().Contains(kw))
                    );
                }

                var list = await queryable.OrderBy(c => c.CompanyCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "查詢 PostgreSQL 公司資料失敗", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        // GET: api/wbase2010/{code}
        [HttpGet("{code}")]
        public async Task<ActionResult<CompanyMaster>> GetByCode(string code)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var company = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode == code);
                if (company == null)
                {
                    return NotFound(new { message = $"找不到公司編號 {code} 之資料" });
                }
                return Ok(company);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "取得單筆公司資料失敗", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        // POST: api/wbase2010
        [HttpPost]
        public async Task<ActionResult<CompanyMaster>> Create([FromBody] CompanyMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                Sanitize(model);

                var lenErr = ValidateFieldLengths(model);
                if (lenErr != null)
                {
                    return BadRequest(new { message = lenErr, detail = lenErr });
                }

                if (string.IsNullOrWhiteSpace(model.CompanyCode))
                {
                    return BadRequest(new { message = "公司編號不可為空" });
                }

                var exists = await _context.CompanyMasters.AnyAsync(c => c.CompanyCode == model.CompanyCode);
                if (exists)
                {
                    return BadRequest(new { message = $"公司編號 {model.CompanyCode} 已存在" });
                }

                _context.CompanyMasters.Add(model);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetByCode), new { code = model.CompanyCode }, model);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "新增公司資料失敗", detail = ex.InnerException?.Message ?? ex.Message });
            }
        }

        // PUT: api/wbase2010/{code}
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] CompanyMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                Sanitize(model);

                var lenErr = ValidateFieldLengths(model);
                if (lenErr != null)
                {
                    return BadRequest(new { message = lenErr, detail = lenErr });
                }

                var targetCode = (code ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(targetCode))
                {
                    return BadRequest(new { message = "公司編號不可為空" });
                }

                model.CompanyCode = targetCode;

                var existing = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode.Trim() == targetCode);
                if (existing == null)
                {
                    _context.CompanyMasters.Add(model);
                    await _context.SaveChangesAsync();
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

                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                var detailMsg = ex.InnerException != null ? $"{ex.Message} -> {ex.InnerException.Message}" : ex.Message;
                Console.WriteLine($"Wbase2010 Update Error: {detailMsg}");
                return StatusCode(500, new { message = "更新公司資料失敗", detail = detailMsg });
            }
        }

        // DELETE: api/wbase2010/{code}
        [HttpDelete("{code}")]
        public async Task<IActionResult> Delete(string code)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var company = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode == code);
                if (company == null)
                {
                    return NotFound(new { message = $"找不到公司編號 {code} 之資料" });
                }

                _context.CompanyMasters.Remove(company);
                await _context.SaveChangesAsync();
                return Ok(new { message = $"已成功刪除公司編號 {code}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "刪除公司資料失敗", detail = ex.Message });
            }
        }
    }
}
