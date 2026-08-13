using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("公司資料", Schema = "e3000__comm")]
    public class CompanyMaster
    {
        [Key]
        [Column("公司編號")]
        [StringLength(30)]
        public string CompanyCode { get; set; } = string.Empty;

        [Column("公司名稱")]
        [StringLength(255)]
        public string? CompanyName { get; set; }

        [Column("公司英文名稱")]
        [StringLength(255)]
        public string? EnglishName { get; set; }

        [Column("公司簡稱")]
        [StringLength(255)]
        public string? ShortName { get; set; }

        [Column("公司統編")]
        [StringLength(20)]
        public string? UnifiedNo { get; set; }

        [Column("稅籍編號")]
        [StringLength(30)]
        public string? TaxNo { get; set; }

        [Column("國稅局")]
        [StringLength(100)]
        public string? TaxOffice { get; set; }

        [Column("資本額")]
        public decimal? Capital { get; set; }

        [Column("聯絡電話")]
        [StringLength(255)]
        public string? Tel { get; set; }

        [Column("公司傳真")]
        [StringLength(255)]
        public string? Fax { get; set; }

        [Column("公司地址")]
        [StringLength(255)]
        public string? Address { get; set; }

        [Column("聯絡地址")]
        [StringLength(255)]
        public string? Address2 { get; set; }

        [Column("電子信箱")]
        [StringLength(255)]
        public string? Email { get; set; }

        [Column("會計類別")]
        [StringLength(50)]
        public string? AcctType { get; set; }

        [Column("負責人")]
        [StringLength(255)]
        public string? Owner { get; set; }

        [Column("負責人證號")]
        [StringLength(30)]
        public string? OwnerIdNo { get; set; }

        [Column("負責人手機")]
        [StringLength(255)]
        public string? OwnerMobile { get; set; }

        [Column("負責人地址")]
        [StringLength(255)]
        public string? OwnerAddr { get; set; }

        [Column("聯絡人")]
        [StringLength(255)]
        public string? ContactName { get; set; }

        [Column("聯絡人手機")]
        [StringLength(255)]
        public string? ContactMobile { get; set; }

        [Column("備註")]
        [StringLength(255)]
        public string? Memo { get; set; }

        [Column("上市公司")]
        [StringLength(20)]
        public string? ListedType { get; set; }

        [Column("事務所編號")]
        [StringLength(30)]
        public string? OfficeId { get; set; }
    }
}
