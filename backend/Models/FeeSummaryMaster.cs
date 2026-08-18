using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("基本收費摘要", Schema = "e3000__comm")]
    public class FeeSummaryMaster
    {
        [Column("序")]
        public int? Seq { get; set; }

        [Key]
        [Column("編號")]
        [StringLength(50)]
        public string SummaryCode { get; set; } = string.Empty;

        [Column("說明")]
        [StringLength(50)]
        public string? SummaryName { get; set; }

        [Column("摘要")]
        [StringLength(512)]
        public string? Content { get; set; }

        [Column("guid")]
        [StringLength(50)]
        public string? Guid { get; set; }
    }
}
