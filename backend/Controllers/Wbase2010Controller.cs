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
                        ""資本額"" numeric(18,2) DEFAULT 0,
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
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""公司名稱"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""公司英文名稱"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""公司簡稱"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""公司統編"" character varying(20);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""稅籍編號"" character varying(30);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""國稅局"" character varying(100);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""資本額"" numeric(18,2) DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""聯絡電話"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""公司傳真"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""公司地址"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""聯絡地址"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""電子信箱"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""會計類別"" character varying(50);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""負責人"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""負責人證號"" character varying(30);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""負責人手機"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""負責人地址"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""聯絡人"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""聯絡人手機"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""備註"" character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""上市公司"" character varying(20);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""事務所編號"" character varying(30);

                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司名稱"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司英文名稱"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司簡稱"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司統編"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""稅籍編號"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""國稅局"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡電話"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司傳真"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司地址"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡地址"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""電子信箱"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""會計類別"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人證號"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人手機"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人地址"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡人"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡人手機"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""備註"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""上市公司"" TYPE character varying(255);
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""事務所編號"" TYPE character varying(255);

                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司名稱"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司英文名稱"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司簡稱"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司統編"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""稅籍編號"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""國稅局"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""資本額"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡電話"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司傳真"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""公司地址"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡地址"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""電子信箱"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""會計類別"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人證號"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人手機"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""負責人地址"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡人"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""聯絡人手機"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""備註"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""上市公司"" DROP NOT NULL;
                    ALTER TABLE ""e3000__comm"".""公司資料"" ALTER COLUMN ""事務所編號"" DROP NOT NULL;
                ");

                if (!await _context.CompanyMasters.AnyAsync())
                {
                    var initialList = new List<CompanyMaster>
                    {
                        new CompanyMaster { CompanyCode = "C0001", CompanyName = "鴻海精密工業股份有限公司", UnifiedNo = "03545423", Owner = "劉揚偉", Tel = "02-2268-3466", ListedType = "上市", ShortName = "鴻海", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0002", CompanyName = "台灣積體電路製造股份有限公司", UnifiedNo = "22099118", Owner = "魏哲家", Tel = "03-5636688", ListedType = "上市", ShortName = "台積電", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0003", CompanyName = "聯發科技股份有限公司", UnifiedNo = "16670998", Owner = "蔡明介", Tel = "03-5670766", ListedType = "上市", ShortName = "聯發科", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0004", CompanyName = "中華電信股份有限公司", UnifiedNo = "96972798", Owner = "郭水義", Tel = "02-23445566", ListedType = "上市", ShortName = "中華電", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0005", CompanyName = "富邦金融控股股份有限公司", UnifiedNo = "70790807", Owner = "蔡明興", Tel = "02-66387888", ListedType = "上市", ShortName = "富邦金", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0006", CompanyName = "國泰金融控股股份有限公司", UnifiedNo = "70790808", Owner = "蔡宏圖", Tel = "02-27087698", ListedType = "上市", ShortName = "國泰金", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0007", CompanyName = "長榮海運股份有限公司", UnifiedNo = "03534567", Owner = "張衍義", Tel = "02-25001122", ListedType = "上市", ShortName = "長榮", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0008", CompanyName = "台塑石化股份有限公司", UnifiedNo = "16082491", Owner = "陳寶郎", Tel = "02-27122211", ListedType = "上市", ShortName = "台塑化", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0009", CompanyName = "大立光電股份有限公司", UnifiedNo = "22345678", Owner = "林恩平", Tel = "04-23594121", ListedType = "上市", ShortName = "大立光", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0010", CompanyName = "研華股份有限公司", UnifiedNo = "23545678", Owner = "劉克振", Tel = "02-2792-4788", ListedType = "上市", ShortName = "研華", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0011", CompanyName = "廣達電腦股份有限公司", UnifiedNo = "22102493", Owner = "林百里", Tel = "02-2888-4567", ListedType = "上市", ShortName = "廣達", Capital = 0 },
                        new CompanyMaster { CompanyCode = "C0012", CompanyName = "緯創資通股份有限公司", UnifiedNo = "70708552", Owner = "林憲銘", Tel = "02-6615-2525", ListedType = "上市", ShortName = "緯創", Capital = 0 }
                    };
                    await _context.CompanyMasters.AddRangeAsync(initialList);
                    await _context.SaveChangesAsync();
                }
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
