using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("基本收費項目", Schema = "e3000__comm")]
    public class FeeItemMaster
    {
        [Key]
        [Column("項目")]
        [StringLength(50)]
        public string FeeCode { get; set; } = string.Empty;

        [Column("項目名稱")]
        [StringLength(100)]
        public string FeeName { get; set; } = string.Empty;

        [Column("收費金額", TypeName = "numeric(18,2)")]
        public decimal Price { get; set; } = 0.00m;

        [Column("guid")]
        [StringLength(50)]
        public string? Guid { get; set; }
    }
}
