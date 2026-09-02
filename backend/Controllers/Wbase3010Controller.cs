using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase3010Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase3010Controller(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableCreatedAsync()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE SCHEMA IF NOT EXISTS ""e3000__comm"";
                    CREATE TABLE IF NOT EXISTS ""e3000__comm"".""基本購票地點"" (
                        ""編號"" character varying(50) NOT NULL,
                        ""購買地點"" character varying(255) NOT NULL DEFAULT '',
                        ""連絡人"" character varying(255) NOT NULL DEFAULT '',
                        ""連絡電話"" character varying(255) NOT NULL DEFAULT '',
                        ""購買地址"" character varying(255) NOT NULL DEFAULT '',
                        CONSTRAINT ""PK_基本購票地點"" PRIMARY KEY (""編號"")
                    );
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EnsureTableCreatedAsync error in Wbase3010: {ex.Message}");
            }
        }

        // GET: api/wbase3010?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TicketPlaceMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.TicketPlaceMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        (f.PlaceCode != null && f.PlaceCode.ToLower().Contains(kw)) ||
                        (f.PlaceName != null && f.PlaceName.ToLower().Contains(kw)) ||
                        (f.ContactPerson != null && f.ContactPerson.ToLower().Contains(kw)) ||
                        (f.ContactTel != null && f.ContactTel.ToLower().Contains(kw)) ||
                        (f.PlaceAddress != null && f.PlaceAddress.ToLower().Contains(kw))
                    );
                }

                var rawList = await queryable.OrderBy(f => f.PlaceCode).ToListAsync();
                var list = rawList.Select(f => new TicketPlaceMaster
                {
                    PlaceCode = f.PlaceCode?.Trim() ?? string.Empty,
                    PlaceName = f.PlaceName?.Trim() ?? string.Empty,
                    ContactPerson = f.ContactPerson?.Trim() ?? string.Empty,
                    ContactTel = f.ContactTel?.Trim() ?? string.Empty,
                    PlaceAddress = f.PlaceAddress?.Trim() ?? string.Empty,
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"查詢基本購票地點資料失敗: {ex.Message}" });
            }
        }

        // GET: api/wbase3010/AA
        [HttpGet("{placeCode}")]
        public async Task<ActionResult<TicketPlaceMaster>> GetByCode(string placeCode)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = placeCode.Trim();
                var item = await _context.TicketPlaceMasters.FindAsync(trimmedCode);
                if (item == null)
                {
                    return NotFound(new { message = "查無此購票地點資料" });
                }

                item.PlaceCode = item.PlaceCode?.Trim() ?? string.Empty;
                item.PlaceName = item.PlaceName?.Trim() ?? string.Empty;
                item.ContactPerson = item.ContactPerson?.Trim() ?? string.Empty;
                item.ContactTel = item.ContactTel?.Trim() ?? string.Empty;
                item.PlaceAddress = item.PlaceAddress?.Trim() ?? string.Empty;

                return Ok(item);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得購票地點失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase3010
        [HttpPost]
        public async Task<ActionResult<TicketPlaceMaster>> Create([FromBody] TicketPlaceMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (string.IsNullOrWhiteSpace(model.PlaceCode))
                {
                    return BadRequest(new { message = "購票地點代號不得為空" });
                }

                model.PlaceCode = model.PlaceCode.Trim();
                model.PlaceName = model.PlaceName?.Trim() ?? string.Empty;
                model.ContactPerson = model.ContactPerson?.Trim() ?? string.Empty;
                model.ContactTel = model.ContactTel?.Trim() ?? string.Empty;
                model.PlaceAddress = model.PlaceAddress?.Trim() ?? string.Empty;

                var exists = await _context.TicketPlaceMasters.AnyAsync(f => f.PlaceCode == model.PlaceCode);
                if (exists)
                {
                    return Conflict(new { message = $"購票地點代號 {model.PlaceCode} 已存在" });
                }

                _context.TicketPlaceMasters.Add(model);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetByCode), new { placeCode = model.PlaceCode }, model);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"新增購票地點失敗: {ex.Message}" });
            }
        }

        // PUT: api/wbase3010/AA
        [HttpPut("{placeCode}")]
        public async Task<IActionResult> Update(string placeCode, [FromBody] TicketPlaceMaster model)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = placeCode.Trim();
                var existing = await _context.TicketPlaceMasters.FindAsync(trimmedCode);
                if (existing == null)
                {
                    model.PlaceCode = trimmedCode;
                    model.PlaceName = model.PlaceName?.Trim() ?? string.Empty;
                    model.ContactPerson = model.ContactPerson?.Trim() ?? string.Empty;
                    model.ContactTel = model.ContactTel?.Trim() ?? string.Empty;
                    model.PlaceAddress = model.PlaceAddress?.Trim() ?? string.Empty;

                    _context.TicketPlaceMasters.Add(model);
                    await _context.SaveChangesAsync();
                    return Ok(model);
                }

                existing.PlaceName = model.PlaceName?.Trim() ?? string.Empty;
                existing.ContactPerson = model.ContactPerson?.Trim() ?? string.Empty;
                existing.ContactTel = model.ContactTel?.Trim() ?? string.Empty;
                existing.PlaceAddress = model.PlaceAddress?.Trim() ?? string.Empty;

                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"更新購票地點失敗: {ex.Message}" });
            }
        }

        // DELETE: api/wbase3010/AA
        [HttpDelete("{placeCode}")]
        public async Task<IActionResult> Delete(string placeCode)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var trimmedCode = placeCode.Trim();
                var existing = await _context.TicketPlaceMasters.FindAsync(trimmedCode);
                if (existing == null)
                {
                    return NotFound(new { message = "欲刪除的購票地點不存在" });
                }

                _context.TicketPlaceMasters.Remove(existing);
                await _context.SaveChangesAsync();
                return Ok(new { message = "刪除成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"刪除購票地點失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase3010/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<TicketPlaceMaster> list)
        {
            try
            {
                await EnsureTableCreatedAsync();
                if (list == null) return BadRequest(new { message = "無效的提交資料" });

                var validItems = list
                    .Where(x => !string.IsNullOrWhiteSpace(x.PlaceCode))
                    .Select(x => new TicketPlaceMaster
                    {
                        PlaceCode = x.PlaceCode.Trim(),
                        PlaceName = x.PlaceName?.Trim() ?? string.Empty,
                        ContactPerson = x.ContactPerson?.Trim() ?? string.Empty,
                        ContactTel = x.ContactTel?.Trim() ?? string.Empty,
                        PlaceAddress = x.PlaceAddress?.Trim() ?? string.Empty,
                    }).ToList();

                var currentDbList = await _context.TicketPlaceMasters.ToListAsync();
                _context.TicketPlaceMasters.RemoveRange(currentDbList);
                await _context.TicketPlaceMasters.AddRangeAsync(validItems);
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

        // POST: api/wbase3010/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<TicketPlaceMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.TicketPlaceMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim();
                    queryable = queryable.Where(f => f.PlaceCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim();
                    queryable = queryable.Where(f => f.PlaceCode.Trim().CompareTo(end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.PlaceCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3010 Print error: {ex.Message}");
                return Ok(new List<TicketPlaceMaster>());
            }
        }

        // GET: api/wbase3010/print-preview?codeStart=xxx&codeEnd=yyy
        [HttpGet("print-preview")]
        public async Task<ActionResult<IEnumerable<TicketPlaceMaster>>> GetPrintPreview([FromQuery] string? codeStart, [FromQuery] string? codeEnd)
        {
            try
            {
                await EnsureTableCreatedAsync();
                var queryable = _context.TicketPlaceMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(codeStart))
                {
                    queryable = queryable.Where(f => string.Compare(f.PlaceCode, codeStart.Trim()) >= 0);
                }
                if (!string.IsNullOrWhiteSpace(codeEnd))
                {
                    queryable = queryable.Where(f => string.Compare(f.PlaceCode, codeEnd.Trim()) <= 0);
                }

                var list = await queryable.OrderBy(f => f.PlaceCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得預覽資料失敗: {ex.Message}" });
            }
        }
    }
}
