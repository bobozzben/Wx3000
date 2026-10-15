using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("customer", Schema = "c:/w3000/comm")]
    public class CompanyMaster
    {
        [Key]
        [Column("no")]
        [StringLength(255)]
        public string CompanyCode { get; set; } = string.Empty;

        [Column("name")]
        [StringLength(255)]
        public string? CompanyName { get; set; }

        [Column("engname")]
        [StringLength(255)]
        public string? EnglishName { get; set; }

        [Column("abbr")]
        [StringLength(255)]
        public string? ShortName { get; set; }

        [Column("unino")]
        [StringLength(255)]
        public string? UnifiedNo { get; set; }

        [Column("taxno")]
        [StringLength(255)]
        public string? TaxNo { get; set; }

        [Column("offno")]
        [StringLength(255)]
        public string? TaxOffice { get; set; }

        [Column("capital")]
        public decimal? Capital { get; set; }

        [Column("tel")]
        [StringLength(255)]
        public string? Tel { get; set; }

        [Column("fax")]
        [StringLength(255)]
        public string? Fax { get; set; }

        [Column("addr")]
        [StringLength(255)]
        public string? Address { get; set; }

        [Column("invaddr")]
        [StringLength(255)]
        public string? Address2 { get; set; }

        [Column("email")]
        [StringLength(255)]
        public string? Email { get; set; }

        [Column("acctype")]
        [StringLength(255)]
        public string? AcctType { get; set; }

        [Column("hname")]
        [StringLength(255)]
        public string? Owner { get; set; }

        [Column("hidno")]
        [StringLength(255)]
        public string? OwnerIdNo { get; set; }

        [Column("mobile")]
        [StringLength(255)]
        public string? OwnerMobile { get; set; }

        [Column("haddr")]
        [StringLength(255)]
        public string? OwnerAddr { get; set; }

        [Column("linkman")]
        [StringLength(255)]
        public string? ContactName { get; set; }

        [Column("linkmobile")]
        [StringLength(255)]
        public string? ContactMobile { get; set; }

        [Column("memo01")]
        [StringLength(255)]
        public string? Memo { get; set; }

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public string? ListedType { get; set; }

        [NotMapped]
        public string? OfficeId { get; set; }
    }
}
