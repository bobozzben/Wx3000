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

        private async Task EnsureTableCreatedAsync()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE SCHEMA IF NOT EXISTS ""e3000__comm"";
                    CREATE TABLE IF NOT EXISTS ""e3000__comm"".""公司資料"" (
                        ""公司編號"" character varying(30) NOT NULL,
                        ""公司名稱"" character varying(255),
                        ""公司英文名稱"" character varying(255),
                        ""公司簡稱"" character varying(255),
                        ""公司統編"" character varying(20),
                        ""稅籍編號"" character varying(30),
                        ""國稅局"" character varying(100),
                        ""資本額"" numeric(18,2),
                        ""聯絡電話"" character varying(255),
                        ""公司傳真"" character varying(255),
                        ""公司地址"" character varying(255),
                        ""聯絡地址"" character varying(255),
                        ""電子信箱"" character varying(255),
                        ""會計類別"" character varying(50),
                        ""負責人"" character varying(255),
                        ""負責人證號"" character varying(30),
                        ""負責人手機"" character varying(255),
                        ""負責人地址"" character varying(255),
                        ""聯絡人"" character varying(255),
                        ""聯絡人手機"" character varying(255),
                        ""備註"" character varying(255),
                        ""上市公司"" character varying(20),
                        ""事務所編號"" character varying(30),
                        CONSTRAINT ""PK_公司資料"" PRIMARY KEY (""公司編號"")
                    );
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase2010 EnsureTableCreatedAsync info: {ex.Message}");
            }
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
                return StatusCode(500, new { message = "查詢 PostgreSQL 公司資料失敗", detail = ex.Message });
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
                return StatusCode(500, new { message = "取得單筆公司資料失敗", detail = ex.Message });
            }
        }

        // POST: api/wbase2010
        [HttpPost]
        public async Task<ActionResult<CompanyMaster>> Create([FromBody] CompanyMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();

                if (string.IsNullOrWhiteSpace(model.CompanyCode))
                {
                    return BadRequest(new { message = "公司編號不可為空" });
                }

                var code = model.CompanyCode.Trim();
                var exists = await _context.CompanyMasters.AnyAsync(c => c.CompanyCode == code);
                if (exists)
                {
                    return BadRequest(new { message = $"公司編號 {code} 已存在" });
                }

                model.CompanyCode = code;
                model.CompanyName = model.CompanyName?.Trim();
                model.ShortName = model.ShortName?.Trim();
                model.UnifiedNo = model.UnifiedNo?.Trim();
                model.Owner = model.Owner?.Trim();

                _context.CompanyMasters.Add(model);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetByCode), new { code = model.CompanyCode }, model);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "新增公司資料失敗", detail = ex.Message });
            }
        }

        // PUT: api/wbase2010/{code}
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] CompanyMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();

                var existing = await _context.CompanyMasters.FirstOrDefaultAsync(c => c.CompanyCode == code);
                if (existing == null)
                {
                    return NotFound(new { message = $"找不到公司編號 {code} 之資料" });
                }

                existing.CompanyName = model.CompanyName?.Trim();
                existing.EnglishName = model.EnglishName?.Trim();
                existing.ShortName = model.ShortName?.Trim();
                existing.UnifiedNo = model.UnifiedNo?.Trim();
                existing.TaxNo = model.TaxNo?.Trim();
                existing.TaxOffice = model.TaxOffice?.Trim();
                existing.Capital = model.Capital;
                existing.Tel = model.Tel?.Trim();
                existing.Fax = model.Fax?.Trim();
                existing.Address = model.Address?.Trim();
                existing.Address2 = model.Address2?.Trim();
                existing.Email = model.Email?.Trim();
                existing.AcctType = model.AcctType?.Trim();
                existing.Owner = model.Owner?.Trim();
                existing.OwnerIdNo = model.OwnerIdNo?.Trim();
                existing.OwnerMobile = model.OwnerMobile?.Trim();
                existing.OwnerAddr = model.OwnerAddr?.Trim();
                existing.ContactName = model.ContactName?.Trim();
                existing.ContactMobile = model.ContactMobile?.Trim();
                existing.Memo = model.Memo?.Trim();
                existing.ListedType = model.ListedType?.Trim();
                existing.OfficeId = model.OfficeId?.Trim();

                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "更新公司資料失敗", detail = ex.Message });
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
