using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1050Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase1050Controller(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableCreatedAsync()
        {
            await Task.CompletedTask;
        }

        // GET: api/wbase1050?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaxOfficerMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.TaxOfficerMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(t =>
                        t.TaxCode.ToLower().Contains(kw) ||
                        t.TaxName.ToLower().Contains(kw) ||
                        (t.TaxBureau != null && t.TaxBureau.ToLower().Contains(kw)) ||
                        (t.Unit != null && t.Unit.ToLower().Contains(kw))
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

            return Ok(item);
        }

        // POST: api/wbase1050
        [HttpPost]
        public async Task<ActionResult<TaxOfficerMaster>> Create([FromBody] TaxOfficerMaster input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.TaxCode))
            {
                return BadRequest(new { message = "稅務人員編號為必填欄位" });
            }

            var code = input.TaxCode.Trim().ToUpper();
            input.TaxName ??= string.Empty;

            var existing = await _context.TaxOfficerMasters.FirstOrDefaultAsync(t => t.TaxCode.Trim() == code);
            if (existing != null)
            {
                existing.TaxName = input.TaxName.Trim();
                existing.TaxBureau = input.TaxBureau?.Trim() ?? string.Empty;
                existing.Unit = input.Unit?.Trim() ?? string.Empty;
                existing.Tel = input.Tel?.Trim() ?? string.Empty;
                existing.Ext = input.Ext?.Trim() ?? string.Empty;
                existing.Fax = input.Fax?.Trim() ?? string.Empty;
                existing.Mobile = input.Mobile?.Trim() ?? string.Empty;
                existing.Email = input.Email?.Trim() ?? string.Empty;
                existing.Memo = input.Memo?.Trim() ?? string.Empty;

                await _context.SaveChangesAsync();
                return Ok(existing);
            }

            input.TaxCode = code;
            _context.TaxOfficerMasters.Add(input);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetByCode), new { code = input.TaxCode }, input);
        }

        // PUT: api/wbase1050/{code}
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] TaxOfficerMaster input)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            var targetCode = code.Trim().ToUpper();
            var existing = await _context.TaxOfficerMasters.FirstOrDefaultAsync(t => t.TaxCode.Trim() == targetCode);
            if (existing == null)
            {
                input.TaxCode = targetCode;
                input.TaxName ??= string.Empty;
                input.TaxBureau ??= string.Empty;
                input.Unit ??= string.Empty;
                input.Tel ??= string.Empty;
                input.Ext ??= string.Empty;
                input.Fax ??= string.Empty;
                input.Mobile ??= string.Empty;
                input.Email ??= string.Empty;
                input.Memo ??= string.Empty;

                _context.TaxOfficerMasters.Add(input);
                await _context.SaveChangesAsync();
                return Ok(input);
            }

            existing.TaxName = input.TaxName?.Trim() ?? string.Empty;
            existing.TaxBureau = input.TaxBureau?.Trim() ?? string.Empty;
            existing.Unit = input.Unit?.Trim() ?? string.Empty;
            existing.Tel = input.Tel?.Trim() ?? string.Empty;
            existing.Ext = input.Ext?.Trim() ?? string.Empty;
            existing.Fax = input.Fax?.Trim() ?? string.Empty;
            existing.Mobile = input.Mobile?.Trim() ?? string.Empty;
            existing.Email = input.Email?.Trim() ?? string.Empty;
            existing.Memo = input.Memo?.Trim() ?? string.Empty;

            await _context.SaveChangesAsync();
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

            _context.TaxOfficerMasters.Remove(existing);
            await _context.SaveChangesAsync();

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
