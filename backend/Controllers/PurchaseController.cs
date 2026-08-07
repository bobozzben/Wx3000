using Wx3000.Backend.Data;
using Wx3000.Backend.DTOs;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PurchaseController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PurchaseController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<ActionResult> CreatePurchaseOrder([FromBody] CreatePurchaseOrderDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.BillNo) || dto.Lines == null || !dto.Lines.Any())
            {
                return BadRequest(new { message = "單據內容不可為空，請輸入完整明細。" });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var header = new PurchaseHeader
                {
                    BillNo = dto.BillNo,
                    VendorCode = dto.VendorCode,
                    VendorName = dto.VendorName,
                    Total = dto.Total,
                    CreatedAt = DateTime.UtcNow
                };

                _context.PurchaseHeaders.Add(header);
                await _context.SaveChangesAsync();

                var lines = dto.Lines.Select(l => new PurchaseLine
                {
                    HeaderId = header.Id,
                    LineNo = l.LineNo,
                    ProductCode = l.ProductCode,
                    ProductName = l.ProductName,
                    Qty = l.Qty,
                    Price = l.Price,
                    Amount = l.Amount,
                    Remark = l.Remark ?? string.Empty
                }).ToList();

                _context.PurchaseLines.AddRange(lines);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new { success = true, id = header.Id, billNo = header.BillNo, message = "單據存檔成功！" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"存檔失敗: {ex.Message}" });
            }
        }

        [HttpGet]
        public async Task<ActionResult> GetPurchaseOrders()
        {
            var orders = await _context.PurchaseHeaders
                .Include(h => h.Lines)
                .OrderByDescending(h => h.CreatedAt)
                .Take(20)
                .ToListAsync();

            return Ok(orders);
        }
    }
}
