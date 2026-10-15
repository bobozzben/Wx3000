using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("cpa", Schema = "c:/w3000/comm")]
    public class CpaMaster
    {
        [Key]
        [Column("no")]
        [StringLength(255)]
        public string CpaCode { get; set; } = string.Empty;

        [Column("name")]
        [StringLength(255)]
        public string? CpaName { get; set; }

        [Column("kind")]
        [StringLength(255)]
        public string? CertType { get; set; }

        [Column("id")]
        [StringLength(255)]
        public string? TaxId { get; set; }

        [Column("cno1")]
        [StringLength(255)]
        public string? LicenseNo { get; set; }

        [Column("cword")]
        [StringLength(255)]
        public string? DocTrack { get; set; }

        [Column("cno2")]
        [StringLength(255)]
        public string? CertNo { get; set; }

        [Column("gno1")]
        [StringLength(255)]
        public string? OfficeName { get; set; }

        [Column("gno2")]
        [StringLength(255)]
        public string? MemberNo { get; set; }

        [Column("tel")]
        [StringLength(255)]
        public string? Tel { get; set; }

        [Column("mobile")]
        [StringLength(255)]
        public string? Mobile { get; set; }

        [Column("fax")]
        [StringLength(255)]
        public string? Fax { get; set; }

        [Column("unino")]
        [StringLength(255)]
        public string? UnifiedNo { get; set; }

        [Column("addr")]
        [StringLength(255)]
        public string? Address { get; set; }

        [Column("hno1")]
        [StringLength(255)]
        public string? GuildNo1 { get; set; }

        [Column("hno2")]
        [StringLength(255)]
        public string? GuildNo2 { get; set; }

        [Column("email")]
        [StringLength(255)]
        public string? Email { get; set; }

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public string? Guid { get; set; }

        [NotMapped]
        public string? Memo { get; set; }
    }
}
