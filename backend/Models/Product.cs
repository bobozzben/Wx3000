using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("products")]
    public class Product
    {
        [Key]
        [Column("code")]
        public string Code { get; set; } = string.Empty;

        [Required]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [Column("spec")]
        public string Spec { get; set; } = string.Empty;

        [Column("price", TypeName = "numeric(18,2)")]
        public decimal Price { get; set; }

        [Column("stock", TypeName = "numeric(18,2)")]
        public decimal Stock { get; set; }
    }
}
