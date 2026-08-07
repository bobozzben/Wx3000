using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("purchase_headers")]
    public class PurchaseHeader
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("bill_no")]
        public string BillNo { get; set; } = string.Empty;

        [Required]
        [Column("vendor_code")]
        public string VendorCode { get; set; } = string.Empty;

        [Column("vendor_name")]
        public string VendorName { get; set; } = string.Empty;

        [Column("total", TypeName = "numeric(18,2)")]
        public decimal Total { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<PurchaseLine> Lines { get; set; } = new();
    }
}
