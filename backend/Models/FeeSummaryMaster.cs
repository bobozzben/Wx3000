using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("recmemo", Schema = "c:/w3000/comm")]
    public class FeeSummaryMaster
    {
        [Key]
        [Column("mno")]
        [StringLength(255)]
        public string Mno { get; set; } = string.Empty;

        [Column("tx")]
        [StringLength(255)]
        public string Tx { get; set; } = string.Empty;

        [Column("memo")]
        public string Memo { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        // 相容舊有別名 (Legacy Aliases)
        [NotMapped]
        public string SummaryCode
        {
            get => Mno;
            set => Mno = value;
        }

        [NotMapped]
        public string SummaryName
        {
            get => Tx;
            set => Tx = value;
        }

        [NotMapped]
        public string Content
        {
            get => Memo;
            set => Memo = value;
        }

        [NotMapped]
        public int? Seq { get; set; }

        [NotMapped]
        public string Guid { get; set; } = string.Empty;
    }
}
