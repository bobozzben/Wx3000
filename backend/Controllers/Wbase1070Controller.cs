using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1070Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase1070Controller(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableCreatedAsync()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE SCHEMA IF NOT EXISTS ""e3000__comm"";
                    CREATE TABLE IF NOT EXISTS ""e3000__comm"".""基本備註"" (
                        ""序"" integer,
                        ""編號"" character varying(50) NOT NULL,
                        ""說明"" character varying(50),
                        ""備註"" character varying(512),
                        ""guid"" character varying(50),
                        CONSTRAINT ""PK_基本備註"" PRIMARY KEY (""編號"")
                    );
                    ALTER TABLE ""e3000__comm"".""基本備註"" ADD COLUMN IF NOT EXISTS ""序"" integer;
                    ALTER TABLE ""e3000__comm"".""基本備註"" ADD COLUMN IF NOT EXISTS ""說明"" character varying(50);
                    ALTER TABLE ""e3000__comm"".""基本備註"" ADD COLUMN IF NOT EXISTS ""備註"" character varying(512);
                    ALTER TABLE ""e3000__comm"".""基本備註"" ADD COLUMN IF NOT EXISTS ""guid"" character varying(50);
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EnsureTableCreatedAsync error in Wbase1070: {ex.Message}");
            }
        }

        // GET: api/wbase1070?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<NoteMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.NoteMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.NoteCode.ToLower().Contains(kw) ||
                        (f.NoteName != null && f.NoteName.ToLower().Contains(kw)) ||
                        (f.Content != null && f.Content.ToLower().Contains(kw))
                    );
                }

                var rawList = await queryable.OrderBy(f => f.NoteCode).ToListAsync();
                var list = rawList.Select(f => new NoteMaster
                {
                    Seq = f.Seq,
                    NoteCode = f.NoteCode?.Trim() ?? string.Empty,
                    NoteName = f.NoteName?.Trim() ?? string.Empty,
                    Content = f.Content?.Trim() ?? string.Empty,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1070 GetList error: {ex.Message}");
                return Ok(new List<NoteMaster>());
            }
        }

        // GET: api/wbase1070/{noteCode}
        [HttpGet("{noteCode}")]
        public async Task<ActionResult<NoteMaster>> GetByCode(string noteCode)
        {
            if (string.IsNullOrWhiteSpace(noteCode)) return BadRequest("備註代號不可為空");

            var trimmedCode = noteCode.Trim().ToUpper();
            var item = await _context.NoteMasters.FirstOrDefaultAsync(f => f.NoteCode.Trim() == trimmedCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{noteCode}' 的基本備註資料" });
            }

            item.NoteCode = item.NoteCode?.Trim() ?? string.Empty;
            item.NoteName = item.NoteName?.Trim() ?? string.Empty;
            item.Content = item.Content?.Trim() ?? string.Empty;
            item.Guid = item.Guid?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1070
        [HttpPost]
        public async Task<ActionResult<NoteMaster>> Create([FromBody] NoteMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (model == null || string.IsNullOrWhiteSpace(model.NoteCode))
                {
                    return BadRequest(new { message = "備註代號不得為空" });
                }

                model.NoteCode = model.NoteCode.Trim().ToUpper();
                model.NoteName = model.NoteName?.Trim() ?? string.Empty;
                model.Content = model.Content?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(model.Guid))
                {
                    model.Guid = Guid.NewGuid().ToString("N").ToUpper();
                }

                if (!model.Seq.HasValue || model.Seq.Value == 0)
                {
                    var maxSeq = await _context.NoteMasters.MaxAsync(f => (int?)f.Seq) ?? 0;
                    model.Seq = maxSeq + 1;
                }

                var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.NoteCode.Trim() == model.NoteCode);
                if (existing != null)
                {
                    existing.NoteName = model.NoteName;
                    existing.Content = model.Content;
                    if (!string.IsNullOrWhiteSpace(model.Guid)) existing.Guid = model.Guid.Trim();
                    await _context.SaveChangesAsync();
                    return Ok(existing);
                }

                _context.NoteMasters.Add(model);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetByCode), new { noteCode = model.NoteCode }, model);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"新增基本備註失敗: {ex.Message}" });
            }
        }

        // PUT: api/wbase1070/{noteCode}
        [HttpPut("{noteCode}")]
        public async Task<IActionResult> Update(string noteCode, [FromBody] NoteMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = noteCode.Trim().ToUpper();
                var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.NoteCode.Trim() == trimmedCode);
                if (existing == null)
                {
                    model.NoteCode = trimmedCode;
                    model.NoteName = model.NoteName?.Trim() ?? string.Empty;
                    model.Content = model.Content?.Trim() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(model.Guid))
                    {
                        model.Guid = Guid.NewGuid().ToString("N").ToUpper();
                    }
                    if (!model.Seq.HasValue || model.Seq.Value == 0)
                    {
                        var maxSeq = await _context.NoteMasters.MaxAsync(f => (int?)f.Seq) ?? 0;
                        model.Seq = maxSeq + 1;
                    }
                    _context.NoteMasters.Add(model);
                    await _context.SaveChangesAsync();
                    return Ok(model);
                }

                existing.NoteName = model.NoteName?.Trim() ?? string.Empty;
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
                return StatusCode(500, new { message = $"更新基本備註失敗: {ex.Message}" });
            }
        }

        // DELETE: api/wbase1070/{noteCode}
        [HttpDelete("{noteCode}")]
        public async Task<IActionResult> Delete(string noteCode)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = noteCode.Trim().ToUpper();
                var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.NoteCode.Trim() == trimmedCode);
                if (existing == null)
                {
                    return NotFound(new { message = "欲刪除的基本備註不存在" });
                }

                _context.NoteMasters.Remove(existing);
                await _context.SaveChangesAsync();
                return Ok(new { message = "刪除成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"刪除基本備註失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase1070/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<NoteMaster> list)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (list == null) return BadRequest(new { message = "無效的提交資料" });

                var validItems = list
                    .Where(x => !string.IsNullOrWhiteSpace(x.NoteCode))
                    .Select(x => new NoteMaster
                    {
                        Seq = x.Seq,
                        NoteCode = x.NoteCode.Trim().ToUpper(),
                        NoteName = x.NoteName?.Trim() ?? string.Empty,
                        Content = x.Content?.Trim() ?? string.Empty,
                        Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                    })
                    .ToList();

                foreach (var item in validItems)
                {
                    var existing = await _context.NoteMasters.FirstOrDefaultAsync(f => f.NoteCode.Trim() == item.NoteCode);
                    if (existing != null)
                    {
                        existing.NoteName = item.NoteName;
                        existing.Content = item.Content;
                    }
                    else
                    {
                        _context.NoteMasters.Add(item);
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

        // POST: api/wbase1070/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<NoteMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.NoteMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => f.NoteCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => f.NoteCode.Trim().CompareTo(end) <= 0);
                }

                var rawList = await queryable.OrderBy(f => f.NoteCode).ToListAsync();
                var list = rawList.Select(f => new NoteMaster
                {
                    Seq = f.Seq,
                    NoteCode = f.NoteCode?.Trim() ?? string.Empty,
                    NoteName = f.NoteName?.Trim() ?? string.Empty,
                    Content = f.Content?.Trim() ?? string.Empty,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1070 Print error: {ex.Message}");
                return Ok(new List<NoteMaster>());
            }
        }
    }
}
