using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1030Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase1030Controller(AppDbContext context)
        {
            _context = context;
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
                cmd1.CommandText = @"
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'e3000__comm' AND table_name = '建檔人員';
                ";
                using var r1 = await cmd1.ExecuteReaderAsync();
                var cols = new List<string>();
                while (await r1.ReadAsync())
                {
                    cols.Add(r1.GetString(0));
                }
                r1.Close();

                using var cmd2 = conn.CreateCommand();
                cmd2.CommandText = @"SELECT * FROM e3000__comm.""建檔人員"" LIMIT 5;";
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
                var queryable = _context.EmpMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(e =>
                        e.EmpCode.ToLower().Contains(kw) ||
                        e.EmpName.ToLower().Contains(kw) ||
                        (e.DepName != null && e.DepName.ToLower().Contains(kw))
                    );
                }

                var rawList = await queryable.OrderBy(e => e.EmpCode).ToListAsync();
                var list = rawList.Select(e => new EmpMaster
                {
                    EmpCode = e.EmpCode?.Trim() ?? string.Empty,
                    EmpName = e.EmpName?.Trim() ?? string.Empty,
                    DepName = e.DepName?.Trim() ?? string.Empty,
                    Mobile = e.Mobile?.Trim() ?? string.Empty,
                    Email = e.Email?.Trim() ?? string.Empty,
                    OneUserId = e.OneUserId?.Trim() ?? string.Empty,
                    OnePassNo = e.OnePassNo?.Trim() ?? string.Empty,
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

            var targetCode = code.Trim().ToUpper();
            var item = await _context.EmpMasters.FirstOrDefaultAsync(e => e.EmpCode.Trim() == targetCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到編號為 '{code}' 的人員資料" });
            }

            item.EmpCode = item.EmpCode?.Trim() ?? string.Empty;
            item.EmpName = item.EmpName?.Trim() ?? string.Empty;
            item.DepName = item.DepName?.Trim() ?? string.Empty;
            item.Mobile = item.Mobile?.Trim() ?? string.Empty;
            item.Email = item.Email?.Trim() ?? string.Empty;
            item.OneUserId = item.OneUserId?.Trim() ?? string.Empty;
            item.OnePassNo = item.OnePassNo?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1030 (Create or Upsert)
        [HttpPost]
        public async Task<ActionResult<EmpMaster>> Create([FromBody] EmpMaster input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.EmpCode))
            {
                return BadRequest(new { message = "人員編號為必填欄位" });
            }

            var code = input.EmpCode.Trim().ToUpper();
            input.EmpName ??= string.Empty;

            var existing = await _context.EmpMasters.FirstOrDefaultAsync(e => e.EmpCode.Trim() == code);
            if (existing != null)
            {
                existing.EmpName = input.EmpName.Trim();
                existing.DepName = input.DepName?.Trim() ?? string.Empty;
                existing.Mobile = input.Mobile?.Trim() ?? string.Empty;
                existing.Email = input.Email?.Trim() ?? string.Empty;
                existing.OneUserId = input.OneUserId?.Trim() ?? string.Empty;
                existing.OnePassNo = input.OnePassNo?.Trim() ?? string.Empty;

                await _context.SaveChangesAsync();
                return Ok(existing);
            }

            input.EmpCode = code;
            _context.EmpMasters.Add(input);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetByCode), new { code = input.EmpCode }, input);
        }

        // PUT: api/wbase1030/{code} (Upsert: Create if not exists, Update if exists)
        [HttpPut("{code}")]
        public async Task<IActionResult> Update(string code, [FromBody] EmpMaster input)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            var targetCode = code.Trim().ToUpper();
            var existing = await _context.EmpMasters.FirstOrDefaultAsync(e => e.EmpCode.Trim() == targetCode);
            if (existing == null)
            {
                input.EmpCode = targetCode;
                input.EmpName ??= string.Empty;
                input.DepName ??= string.Empty;
                input.Mobile ??= string.Empty;
                input.Email ??= string.Empty;
                input.OneUserId ??= string.Empty;
                input.OnePassNo ??= string.Empty;

                _context.EmpMasters.Add(input);
                await _context.SaveChangesAsync();
                return Ok(input);
            }

            existing.EmpName = input.EmpName?.Trim() ?? string.Empty;
            existing.DepName = input.DepName?.Trim() ?? string.Empty;
            existing.Mobile = input.Mobile?.Trim() ?? string.Empty;
            existing.Email = input.Email?.Trim() ?? string.Empty;
            existing.OneUserId = input.OneUserId?.Trim() ?? string.Empty;
            existing.OnePassNo = input.OnePassNo?.Trim() ?? string.Empty;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/wbase1030/{code}
        [HttpDelete("{code}")]
        public async Task<IActionResult> Delete(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("編號不可為空");

            var targetCode = code.Trim().ToUpper();
            var existing = await _context.EmpMasters.FirstOrDefaultAsync(e => e.EmpCode.Trim() == targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"找不到編號為 '{targetCode}' 的人員資料" });
            }

            _context.EmpMasters.Remove(existing);
            await _context.SaveChangesAsync();

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
            var queryable = _context.EmpMasters.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(req.CodeStart))
            {
                var start = req.CodeStart.Trim().ToUpper();
                queryable = queryable.Where(e => string.Compare(e.EmpCode.Trim(), start) >= 0);
            }

            if (!string.IsNullOrWhiteSpace(req.CodeEnd))
            {
                var end = req.CodeEnd.Trim().ToUpper();
                queryable = queryable.Where(e => string.Compare(e.EmpCode.Trim(), end) <= 0);
            }

            var rawList = await queryable.OrderBy(e => e.EmpCode).ToListAsync();
            var list = rawList.Select(e => new EmpMaster
            {
                EmpCode = e.EmpCode?.Trim() ?? string.Empty,
                EmpName = e.EmpName?.Trim() ?? string.Empty,
                DepName = e.DepName?.Trim() ?? string.Empty,
                Mobile = e.Mobile?.Trim() ?? string.Empty,
                Email = e.Email?.Trim() ?? string.Empty,
                OneUserId = e.OneUserId?.Trim() ?? string.Empty,
                OnePassNo = e.OnePassNo?.Trim() ?? string.Empty,
            }).ToList();

            return Ok(list);
        }
    }
}
