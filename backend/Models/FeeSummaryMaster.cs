using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("recnote", Schema = "c:/w3000/comm")]
    public class FeeSummaryMaster
    {
        [Key]
        [Column("noteno")]
        [StringLength(255)]
        public string SummaryCode { get; set; } = string.Empty;

        [Column("note")]
        [StringLength(255)]
        public string SummaryName { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public string Content { get; set; } = string.Empty;

        [NotMapped]
        public int? Seq { get; set; }

        [NotMapped]
        public string Guid { get; set; } = string.Empty;
    }
}
