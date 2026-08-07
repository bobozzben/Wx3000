using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("基本會計師", Schema = "e3000__comm")]
    public class CpaMaster
    {
        [Key]
        [Column("編號")]
        [StringLength(10)]
        public string CpaCode { get; set; } = string.Empty;

        [Column("姓名")]
        [StringLength(30)]
        public string? CpaName { get; set; }

        [Column("證書別")]
        [StringLength(20)]
        public string? CertType { get; set; }

        [Column("申報ID")]
        [StringLength(20)]
        public string? TaxId { get; set; }

        [Column("證書(登錄)字號")]
        [StringLength(50)]
        public string? LicenseNo { get; set; }

        [Column("發文字軌")]
        [StringLength(20)]
        public string? DocTrack { get; set; }

        [Column("證書編號")]
        [StringLength(30)]
        public string? CertNo { get; set; }

        [Column("公會名稱")]
        [StringLength(60)]
        public string? OfficeName { get; set; }

        [Column("會員證號")]
        [StringLength(30)]
        public string? MemberNo { get; set; }

        [Column("電話")]
        [StringLength(20)]
        public string? Tel { get; set; }

        [Column("手機")]
        [StringLength(20)]
        public string? Mobile { get; set; }

        [Column("傳真")]
        [StringLength(20)]
        public string? Fax { get; set; }

        [Column("統一編號")]
        [StringLength(20)]
        public string? UnifiedNo { get; set; }

        [Column("地址")]
        [StringLength(100)]
        public string? Address { get; set; }

        [Column("會計師公會證號1")]
        [StringLength(50)]
        public string? GuildNo1 { get; set; }

        [Column("會計師公會證號2")]
        [StringLength(50)]
        public string? GuildNo2 { get; set; }

        [Column("EMAIL")]
        [StringLength(100)]
        public string? Email { get; set; }

        [Column("guid")]
        [StringLength(50)]
        public string? Guid { get; set; }

        [NotMapped]
        public string? Memo { get; set; }
    }
}
