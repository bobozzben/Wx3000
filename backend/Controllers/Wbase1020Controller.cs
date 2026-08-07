using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1020Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase1020Controller(AppDbContext context)
        {
            _context = context;
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
                    WHERE table_schema = 'e3000__comm' AND table_name = '基本會計師';
                ";
                using var r = await cmd.ExecuteReaderAsync();
                var cols = new List<object>();
                while (await r.ReadAsync())
                {
                    cols.Add(new { 
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
            var queryable = _context.CpaMasters.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var kw = keyword.Trim().ToLower();
                queryable = queryable.Where(c =>
                    c.CpaCode.ToLower().Contains(kw) ||
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
            }).ToList();

            return Ok(list);
        }

        // GET: api/wbase1020/C001
        [HttpGet("{code}")]
        public async Task<ActionResult<CpaMaster>> GetByCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("代號不可為空");

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
            var existing = await _context.CpaMasters.FirstOrDefaultAsync(c => c.CpaCode.Trim() == code);
            if (existing != null)
            {
                existing.CpaName = Truncate(input.CpaName, 40);
                existing.CertType = Truncate(input.CertType, 1);
                existing.TaxId = Truncate(input.TaxId, 10);
                existing.LicenseNo = Truncate(input.LicenseNo, 3);
                existing.DocTrack = Truncate(input.DocTrack, 20);
                existing.CertNo = Truncate(input.CertNo, 8);
                existing.OfficeName = Truncate(input.OfficeName, 40);
                existing.MemberNo = Truncate(input.MemberNo, 12);
                existing.Tel = Truncate(input.Tel, 20);
                existing.Mobile = Truncate(input.Mobile, 20);
                existing.Fax = Truncate(input.Fax, 20);
                existing.UnifiedNo = Truncate(input.UnifiedNo, 8);
                existing.Address = Truncate(input.Address, 60);
                existing.GuildNo1 = Truncate(input.GuildNo1, 20);
                existing.GuildNo2 = Truncate(input.GuildNo2, 20);
                existing.Email = Truncate(input.Email, 255);
                if (string.IsNullOrEmpty(existing.Guid)) existing.Guid = System.Guid.NewGuid().ToString("N");

                await _context.SaveChangesAsync();
                return Ok(existing);
            }

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
            input.Guid = string.IsNullOrWhiteSpace(input.Guid) ? System.Guid.NewGuid().ToString("N") : Truncate(input.Guid, 32);

            _context.CpaMasters.Add(input);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetByCode), new { code = input.CpaCode }, input);
        }

        // PUT: api/wbase1020/C001 (Upsert: Create if not exists, Update if exists)
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] CpaMaster input)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("代號不可為空");

            var targetCode = Truncate(code.ToUpper(), 10);
            var existing = await _context.CpaMasters.FirstOrDefaultAsync(c => c.CpaCode.Trim() == targetCode);
            if (existing == null)
            {
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
                input.Guid = string.IsNullOrWhiteSpace(input.Guid) ? System.Guid.NewGuid().ToString("N") : Truncate(input.Guid, 32);

                _context.CpaMasters.Add(input);
                await _context.SaveChangesAsync();
                return Ok(input);
            }

            existing.CpaName = Truncate(input.CpaName, 40);
            existing.CertType = Truncate(input.CertType, 1);
            existing.TaxId = Truncate(input.TaxId, 10);
            existing.LicenseNo = Truncate(input.LicenseNo, 3);
            existing.DocTrack = Truncate(input.DocTrack, 20);
            existing.CertNo = Truncate(input.CertNo, 8);
            existing.OfficeName = Truncate(input.OfficeName, 40);
            existing.MemberNo = Truncate(input.MemberNo, 12);
            existing.Tel = Truncate(input.Tel, 20);
            existing.Mobile = Truncate(input.Mobile, 20);
            existing.Fax = Truncate(input.Fax, 20);
            existing.UnifiedNo = Truncate(input.UnifiedNo, 8);
            existing.Address = Truncate(input.Address, 60);
            existing.GuildNo1 = Truncate(input.GuildNo1, 20);
            existing.GuildNo2 = Truncate(input.GuildNo2, 20);
            existing.Email = Truncate(input.Email, 255);
            if (string.IsNullOrEmpty(existing.Guid)) existing.Guid = System.Guid.NewGuid().ToString("N");

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/wbase1020/C001
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

            _context.CpaMasters.Remove(existing);
            await _context.SaveChangesAsync();

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
                OfficeName = c.OfficeName?.Trim() ?? string.Empty,
                LicenseNo = c.LicenseNo?.Trim() ?? string.Empty,
                Tel = c.Tel?.Trim() ?? string.Empty,
                Fax = c.Fax?.Trim() ?? string.Empty,
                Address = c.Address?.Trim() ?? string.Empty,
            }).ToList();

            return Ok(list);
        }
    }
}
