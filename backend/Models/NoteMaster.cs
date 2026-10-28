using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("recnote", Schema = "c:/w3000/comm")]
    public class NoteMaster
    {
        [Key]
        [Column("noteno")]
        [StringLength(255)]
        public string Noteno { get; set; } = string.Empty;

        [Column("note")]
        [StringLength(255)]
        public string Note { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        // 相容舊有別名 (Legacy Aliases)
        [NotMapped]
        public string NoteCode
        {
            get => Noteno;
            set => Noteno = value;
        }

        [NotMapped]
        public string Content
        {
            get => Note;
            set => Note = value;
        }

        [NotMapped]
        public string NoteName
        {
            get => Note;
            set => Note = value;
        }

        [NotMapped]
        public int? Seq { get; set; }

        [NotMapped]
        public string Guid { get; set; } = string.Empty;
    }
}
