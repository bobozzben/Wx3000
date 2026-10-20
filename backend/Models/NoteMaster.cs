using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("recmemo", Schema = "c:/w3000/comm")]
    public class NoteMaster
    {
        [Key]
        [Column("mno")]
        [StringLength(255)]
        public string NoteCode { get; set; } = string.Empty;

        [Column("tx")]
        [StringLength(255)]
        public string NoteName { get; set; } = string.Empty;

        [Column("memo")]
        public string Content { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public int? Seq { get; set; }

        [NotMapped]
        public string Guid { get; set; } = string.Empty;
    }
}
