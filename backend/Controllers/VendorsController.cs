using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VendorsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public VendorsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<Vendor>>> Search([FromQuery] string? q)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                var all = await _context.Vendors.OrderBy(v => v.Code).Take(50).ToListAsync();
                return Ok(all);
            }

            var query = q.Trim().ToLower();
            var results = await _context.Vendors
                .Where(v => v.Code.ToLower().Contains(query) || v.Name.ToLower().Contains(query))
                .OrderBy(v => v.Code)
                .Take(50)
                .ToListAsync();

            return Ok(results);
        }
    }
}
