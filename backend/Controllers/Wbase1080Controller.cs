using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1080Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase1080Controller(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableCreatedAsync()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE SCHEMA IF NOT EXISTS ""e3000__comm"";
                    CREATE TABLE IF NOT EXISTS ""e3000__comm"".""基本收費摘要"" (
                        ""序"" integer,
                        ""編號"" character varying(50) NOT NULL,
                        ""說明"" character varying(50),
                        ""摘要"" character varying(512),
                        ""guid"" character varying(50),
                        CONSTRAINT ""PK_基本收費摘要"" PRIMARY KEY (""編號"")
                    );
                    ALTER TABLE ""e3000__comm"".""基本收費摘要"" ADD COLUMN IF NOT EXISTS ""說明"" character varying(50);
                    ALTER TABLE ""e3000__comm"".""基本收費摘要"" ADD COLUMN IF NOT EXISTS ""摘要"" character varying(512);
                    ALTER TABLE ""e3000__comm"".""基本收費摘要"" ADD COLUMN IF NOT EXISTS ""guid"" character varying(50);
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EnsureTableCreatedAsync error: {ex.Message}");
            }
        }

        // GET: api/wbase1080?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FeeSummaryMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.FeeSummaryMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.SummaryCode.ToLower().Contains(kw) ||
                        (f.SummaryName != null && f.SummaryName.ToLower().Contains(kw)) ||
                        (f.Content != null && f.Content.ToLower().Contains(kw))
                    );
                }

                var rawList = await queryable.OrderBy(f => f.SummaryCode).ToListAsync();
                var list = rawList.Select(f => new FeeSummaryMaster
                {
                    Seq = f.Seq,
                    SummaryCode = f.SummaryCode?.Trim() ?? string.Empty,
                    SummaryName = f.SummaryName?.Trim() ?? string.Empty,
                    Content = f.Content?.Trim() ?? string.Empty,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1080 GetList error: {ex.Message}");
                return Ok(new List<FeeSummaryMaster>());
            }
        }

        // GET: api/wbase1080/{summaryCode}
        [HttpGet("{summaryCode}")]
        public async Task<ActionResult<FeeSummaryMaster>> GetByCode(string summaryCode)
        {
            if (string.IsNullOrWhiteSpace(summaryCode)) return BadRequest("摘要代號不可為空");

            var trimmedCode = summaryCode.Trim().ToUpper();
            var item = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == trimmedCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{summaryCode}' 的收費摘要資料" });
            }

            item.SummaryCode = item.SummaryCode?.Trim() ?? string.Empty;
            item.SummaryName = item.SummaryName?.Trim() ?? string.Empty;
            item.Content = item.Content?.Trim() ?? string.Empty;
            item.Guid = item.Guid?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1080
        [HttpPost]
        public async Task<ActionResult<FeeSummaryMaster>> Create([FromBody] FeeSummaryMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (model == null || string.IsNullOrWhiteSpace(model.SummaryCode))
                {
                    return BadRequest(new { message = "收費摘要代號不得為空" });
                }

                model.SummaryCode = model.SummaryCode.Trim().ToUpper();
                model.SummaryName = model.SummaryName?.Trim() ?? string.Empty;
                model.Content = model.Content?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(model.Guid))
                {
                    model.Guid = Guid.NewGuid().ToString("N").ToUpper();
                }

                if (!model.Seq.HasValue || model.Seq.Value == 0)
                {
                    var maxSeq = await _context.FeeSummaryMasters.MaxAsync(f => (int?)f.Seq) ?? 0;
                    model.Seq = maxSeq + 1;
                }

                var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == model.SummaryCode);
                if (existing != null)
                {
                    existing.SummaryName = model.SummaryName;
                    existing.Content = model.Content;
                    if (!string.IsNullOrWhiteSpace(model.Guid)) existing.Guid = model.Guid.Trim();
                    await _context.SaveChangesAsync();
                    return Ok(existing);
                }

                _context.FeeSummaryMasters.Add(model);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetByCode), new { summaryCode = model.SummaryCode }, model);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"新增收費摘要失敗: {ex.Message}" });
            }
        }

        // PUT: api/wbase1080/{summaryCode}
        [HttpPut("{summaryCode}")]
        public async Task<IActionResult> Update(string summaryCode, [FromBody] FeeSummaryMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = summaryCode.Trim().ToUpper();
                var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == trimmedCode);
                if (existing == null)
                {
                    model.SummaryCode = trimmedCode;
                    model.SummaryName = model.SummaryName?.Trim() ?? string.Empty;
                    model.Content = model.Content?.Trim() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(model.Guid))
                    {
                        model.Guid = Guid.NewGuid().ToString("N").ToUpper();
                    }
                    if (!model.Seq.HasValue || model.Seq.Value == 0)
                    {
                        var maxSeq = await _context.FeeSummaryMasters.MaxAsync(f => (int?)f.Seq) ?? 0;
                        model.Seq = maxSeq + 1;
                    }
                    _context.FeeSummaryMasters.Add(model);
                    await _context.SaveChangesAsync();
                    return Ok(model);
                }

                existing.SummaryName = model.SummaryName?.Trim() ?? string.Empty;
                existing.Content = model.Content?.Trim() ?? string.Empty;
                if (!string.IsNullOrWhiteSpace(model.Guid))
                {
                    existing.Guid = model.Guid.Trim();
                }

                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"更新收費摘要失敗: {ex.Message}" });
            }
        }

        // DELETE: api/wbase1080/{summaryCode}
        [HttpDelete("{summaryCode}")]
        public async Task<IActionResult> Delete(string summaryCode)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = summaryCode.Trim().ToUpper();
                var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == trimmedCode);
                if (existing == null)
                {
                    return NotFound(new { message = "欲刪除的收費摘要不存在" });
                }

                _context.FeeSummaryMasters.Remove(existing);
                await _context.SaveChangesAsync();
                return Ok(new { message = "刪除成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"刪除收費摘要失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase1080/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<FeeSummaryMaster> list)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (list == null) return BadRequest(new { message = "無效的提交資料" });

                var validItems = list
                    .Where(x => !string.IsNullOrWhiteSpace(x.SummaryCode))
                    .Select(x => new FeeSummaryMaster
                    {
                        Seq = x.Seq,
                        SummaryCode = x.SummaryCode.Trim().ToUpper(),
                        SummaryName = x.SummaryName?.Trim() ?? string.Empty,
                        Content = x.Content?.Trim() ?? string.Empty,
                        Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                    })
                    .ToList();

                foreach (var item in validItems)
                {
                    var existing = await _context.FeeSummaryMasters.FirstOrDefaultAsync(f => f.SummaryCode.Trim() == item.SummaryCode);
                    if (existing != null)
                    {
                        existing.SummaryName = item.SummaryName;
                        existing.Content = item.Content;
                    }
                    else
                    {
                        _context.FeeSummaryMasters.Add(item);
                    }
                }

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

        // POST: api/wbase1080/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<FeeSummaryMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.FeeSummaryMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => f.SummaryCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => f.SummaryCode.Trim().CompareTo(end) <= 0);
                }

                var rawList = await queryable.OrderBy(f => f.SummaryCode).ToListAsync();
                var list = rawList.Select(f => new FeeSummaryMaster
                {
                    Seq = f.Seq,
                    SummaryCode = f.SummaryCode?.Trim() ?? string.Empty,
                    SummaryName = f.SummaryName?.Trim() ?? string.Empty,
                    Content = f.Content?.Trim() ?? string.Empty,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1080 Print error: {ex.Message}");
                return Ok(new List<FeeSummaryMaster>());
            }
        }
    }
}
