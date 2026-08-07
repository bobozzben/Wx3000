using System.Collections.Generic;

namespace Wx3000.Backend.DTOs
{
    public class CreatePurchaseOrderDto
    {
        public string BillNo { get; set; } = string.Empty;
        public string VendorCode { get; set; } = string.Empty;
        public string VendorName { get; set; } = string.Empty;
        public decimal Total { get; set; }
        public List<CreatePurchaseLineDto> Lines { get; set; } = new();
    }

    public class CreatePurchaseLineDto
    {
        public int LineNo { get; set; }
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public decimal Qty { get; set; }
        public decimal Price { get; set; }
        public decimal Amount { get; set; }
        public string Remark { get; set; } = string.Empty;
    }
}
