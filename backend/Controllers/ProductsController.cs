using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProductsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<Product>>> Search([FromQuery] string? q)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                var all = await _context.Products.OrderBy(p => p.Code).Take(50).ToListAsync();
                return Ok(all);
            }

            var query = q.Trim().ToLower();
            var results = await _context.Products
                .Where(p => p.Code.ToLower().Contains(query) || p.Name.ToLower().Contains(query))
                .OrderBy(p => p.Code)
                .Take(50)
                .ToListAsync();

            return Ok(results);
        }
    }
}
