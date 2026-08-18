using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1060Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase1060Controller(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableCreatedAsync()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE SCHEMA IF NOT EXISTS ""e3000__comm"";
                    CREATE TABLE IF NOT EXISTS ""e3000__comm"".""基本收費項目"" (
                        ""項目"" character varying(50) NOT NULL,
                        ""項目名稱"" character varying(100),
                        ""收費金額"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""guid"" character varying(50),
                        CONSTRAINT ""PK_基本收費項目"" PRIMARY KEY (""項目"")
                    );
                ");

                if (!await _context.FeeItemMasters.AnyAsync())
                {
                    var sampleFees = new List<FeeItemMaster>
                    {
                        new FeeItemMaster { FeeCode = "01", FeeName = "記帳服務費", Price = 3500.00m, Guid = Guid.NewGuid().ToString("N").ToUpper() },
                        new FeeItemMaster { FeeCode = "02", FeeName = "營業稅申報費", Price = 1500.00m, Guid = Guid.NewGuid().ToString("N").ToUpper() },
                        new FeeItemMaster { FeeCode = "03", FeeName = "各式扣繳申報費", Price = 2000.00m, Guid = Guid.NewGuid().ToString("N").ToUpper() },
                        new FeeItemMaster { FeeCode = "04", FeeName = "營所稅結算申報費", Price = 6000.00m, Guid = Guid.NewGuid().ToString("N").ToUpper() },
                        new FeeItemMaster { FeeCode = "05", FeeName = "資本額查核簽證費", Price = 12000.00m, Guid = Guid.NewGuid().ToString("N").ToUpper() }
                    };
                    await _context.FeeItemMasters.AddRangeAsync(sampleFees);
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EnsureTableCreatedAsync error in Wbase1060: {ex.Message}");
            }
        }

        // GET: api/wbase1060?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.FeeCode.ToLower().Contains(kw) ||
                        (f.FeeName != null && f.FeeName.ToLower().Contains(kw))
                    );
                }

                var rawList = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                var list = rawList.Select(f => new FeeItemMaster
                {
                    FeeCode = f.FeeCode?.Trim() ?? string.Empty,
                    FeeName = f.FeeName?.Trim() ?? string.Empty,
                    Price = f.Price,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"查詢收費項目資料失敗: {ex.Message}" });
            }
        }

        // GET: api/wbase1060/01
        [HttpGet("{feeCode}")]
        public async Task<ActionResult<FeeItemMaster>> GetByCode(string feeCode)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var item = await _context.FeeItemMasters.FindAsync(feeCode.Trim());
                if (item == null)
                {
                    return NotFound(new { message = "查無此收費項目資料" });
                }

                item.FeeCode = item.FeeCode.Trim();
                item.FeeName = item.FeeName?.Trim() ?? string.Empty;
                item.Guid = item.Guid?.Trim() ?? string.Empty;

                return Ok(item);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得收費項目失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase1060
        [HttpPost]
        public async Task<ActionResult<FeeItemMaster>> Create([FromBody] FeeItemMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (string.IsNullOrWhiteSpace(model.FeeCode))
                {
                    return BadRequest(new { message = "收費項目代號不得為空" });
                }

                model.FeeCode = model.FeeCode.Trim();
                model.FeeName = model.FeeName?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(model.Guid))
                {
                    model.Guid = Guid.NewGuid().ToString("N").ToUpper();
                }

                var exists = await _context.FeeItemMasters.AnyAsync(f => f.FeeCode == model.FeeCode);
                if (exists)
                {
                    return Conflict(new { message = $"收費項目代號 {model.FeeCode} 已存在" });
                }

                _context.FeeItemMasters.Add(model);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetByCode), new { feeCode = model.FeeCode }, model);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"新增收費項目失敗: {ex.Message}" });
            }
        }

        // PUT: api/wbase1060/01
        [HttpPut("{feeCode}")]
        public async Task<IActionResult> Update(string feeCode, [FromBody] FeeItemMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = feeCode.Trim();
                var existing = await _context.FeeItemMasters.FindAsync(trimmedCode);
                if (existing == null)
                {
                    model.FeeCode = trimmedCode;
                    model.FeeName = model.FeeName?.Trim() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(model.Guid))
                    {
                        model.Guid = Guid.NewGuid().ToString("N").ToUpper();
                    }
                    _context.FeeItemMasters.Add(model);
                    await _context.SaveChangesAsync();
                    return Ok(model);
                }

                existing.FeeName = model.FeeName?.Trim() ?? string.Empty;
                existing.Price = model.Price;
                if (!string.IsNullOrWhiteSpace(model.Guid))
                {
                    existing.Guid = model.Guid.Trim();
                }

                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"更新收費項目失敗: {ex.Message}" });
            }
        }

        // DELETE: api/wbase1060/01
        [HttpDelete("{feeCode}")]
        public async Task<IActionResult> Delete(string feeCode)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = feeCode.Trim();
                var existing = await _context.FeeItemMasters.FindAsync(trimmedCode);
                if (existing == null)
                {
                    return NotFound(new { message = "欲刪除的收費項目不存在" });
                }

                _context.FeeItemMasters.Remove(existing);
                await _context.SaveChangesAsync();
                return Ok(new { message = "刪除成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"刪除收費項目失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase1060/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<FeeItemMaster> list)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (list == null) return BadRequest(new { message = "無效的提交資料" });

                var validItems = list
                    .Where(x => !string.IsNullOrWhiteSpace(x.FeeCode))
                    .Select(x => new FeeItemMaster
                    {
                        FeeCode = x.FeeCode.Trim(),
                        FeeName = x.FeeName?.Trim() ?? string.Empty,
                        Price = x.Price,
                        Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                    }).ToList();

                var currentDbList = await _context.FeeItemMasters.ToListAsync();
                _context.FeeItemMasters.RemoveRange(currentDbList);
                await _context.FeeItemMasters.AddRangeAsync(validItems);
                await _context.SaveChangesAsync();

                return Ok(new { message = "批次儲存成功", count = validItems.Count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"批次儲存失敗: {ex.Message}" });
            }
        }

        public class PrintRangeQuery
        {
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase1060/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim();
                    queryable = queryable.Where(f => f.FeeCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim();
                    queryable = queryable.Where(f => f.FeeCode.Trim().CompareTo(end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1060 Print error: {ex.Message}");
                return Ok(new List<FeeItemMaster>());
            }
        }

        // GET: api/wbase1060/print-preview?codeStart=xxx&codeEnd=yyy
        [HttpGet("print-preview")]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> GetPrintPreview([FromQuery] string? codeStart, [FromQuery] string? codeEnd)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(codeStart))
                {
                    queryable = queryable.Where(f => string.Compare(f.FeeCode, codeStart.Trim()) >= 0);
                }
                if (!string.IsNullOrWhiteSpace(codeEnd))
                {
                    queryable = queryable.Where(f => string.Compare(f.FeeCode, codeEnd.Trim()) <= 0);
                }

                var list = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得預覽資料失敗: {ex.Message}" });
            }
        }
    }
}
