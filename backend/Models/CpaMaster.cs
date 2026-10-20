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
        public string CpaName { get; set; } = string.Empty;

        [Column("kind")]
        [StringLength(255)]
        public string CertType { get; set; } = string.Empty;

        [Column("id")]
        [StringLength(255)]
        public string TaxId { get; set; } = string.Empty;

        [Column("cno1")]
        [StringLength(255)]
        public string LicenseNo { get; set; } = string.Empty;

        [Column("cword")]
        [StringLength(255)]
        public string DocTrack { get; set; } = string.Empty;

        [Column("cno2")]
        [StringLength(255)]
        public string CertNo { get; set; } = string.Empty;

        [Column("gno1")]
        [StringLength(255)]
        public string OfficeName { get; set; } = string.Empty;

        [Column("gno2")]
        [StringLength(255)]
        public string MemberNo { get; set; } = string.Empty;

        [Column("tel")]
        [StringLength(255)]
        public string Tel { get; set; } = string.Empty;

        [Column("mobile")]
        [StringLength(255)]
        public string Mobile { get; set; } = string.Empty;

        [Column("fax")]
        [StringLength(255)]
        public string Fax { get; set; } = string.Empty;

        [Column("unino")]
        [StringLength(255)]
        public string UnifiedNo { get; set; } = string.Empty;

        [Column("addr")]
        [StringLength(255)]
        public string Address { get; set; } = string.Empty;

        [Column("hno1")]
        [StringLength(255)]
        public string GuildNo1 { get; set; } = string.Empty;

        [Column("hno2")]
        [StringLength(255)]
        public string GuildNo2 { get; set; } = string.Empty;

        [Column("email")]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public string Guid { get; set; } = string.Empty;

        [NotMapped]
        public string Memo { get; set; } = string.Empty;
    }
}
