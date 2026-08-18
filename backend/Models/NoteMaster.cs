using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("基本備註", Schema = "e3000__comm")]
    public class NoteMaster
    {
        [Column("序")]
        public int? Seq { get; set; }

        [Key]
        [Column("編號")]
        [StringLength(50)]
        public string NoteCode { get; set; } = string.Empty;

        [Column("說明")]
        [StringLength(50)]
        public string? NoteName { get; set; }

        [Column("備註")]
        [StringLength(512)]
        public string? Content { get; set; }

        [Column("guid")]
        [StringLength(50)]
        public string? Guid { get; set; }
    }
}
