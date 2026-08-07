using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Wx3000.Backend.Models
{
    [Table("purchase_lines")]
    public class PurchaseLine
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("header_id")]
        public int HeaderId { get; set; }

        [Column("line_no")]
        public int LineNo { get; set; }

        [Required]
        [Column("product_code")]
        public string ProductCode { get; set; } = string.Empty;

        [Column("product_name")]
        public string ProductName { get; set; } = string.Empty;

        [Column("qty", TypeName = "numeric(18,2)")]
        public decimal Qty { get; set; }

        [Column("price", TypeName = "numeric(18,2)")]
        public decimal Price { get; set; }

        [Column("amount", TypeName = "numeric(18,2)")]
        public decimal Amount { get; set; }

        [Column("remark")]
        public string Remark { get; set; } = string.Empty;

        [JsonIgnore]
        public PurchaseHeader? Header { get; set; }
    }
}
