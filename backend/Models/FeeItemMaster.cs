using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("recitem", Schema = "c:/w3000/comm")]
    public class FeeItemMaster
    {
        [Key]
        [Column("itemno")]
        [StringLength(255)]
        public string FeeCode { get; set; } = string.Empty;

        [Column("item")]
        [StringLength(255)]
        public string FeeName { get; set; } = string.Empty;

        [Column("amt", TypeName = "numeric(20,4)")]
        public decimal Price { get; set; } = 0.00m;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public string? Guid { get; set; }
    }
}
