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
        public string CompanyName { get; set; } = string.Empty;

        [Column("engname")]
        [StringLength(255)]
        public string EnglishName { get; set; } = string.Empty;

        [Column("abbr")]
        [StringLength(255)]
        public string ShortName { get; set; } = string.Empty;

        [Column("unino")]
        [StringLength(255)]
        public string UnifiedNo { get; set; } = string.Empty;

        [Column("taxno")]
        [StringLength(255)]
        public string TaxNo { get; set; } = string.Empty;

        [Column("offno")]
        [StringLength(255)]
        public string TaxOffice { get; set; } = string.Empty;

        [Column("capital")]
        public decimal Capital { get; set; } = 0m;

        [Column("tel")]
        [StringLength(255)]
        public string Tel { get; set; } = string.Empty;

        [Column("fax")]
        [StringLength(255)]
        public string Fax { get; set; } = string.Empty;

        [Column("addr")]
        [StringLength(255)]
        public string Address { get; set; } = string.Empty;

        [Column("invaddr")]
        [StringLength(255)]
        public string Address2 { get; set; } = string.Empty;

        [Column("email")]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Column("acctype")]
        [StringLength(255)]
        public string AcctType { get; set; } = string.Empty;

        [Column("hname")]
        [StringLength(255)]
        public string Owner { get; set; } = string.Empty;

        [Column("hidno")]
        [StringLength(255)]
        public string OwnerIdNo { get; set; } = string.Empty;

        [Column("mobile")]
        [StringLength(255)]
        public string OwnerMobile { get; set; } = string.Empty;

        [Column("haddr")]
        [StringLength(255)]
        public string OwnerAddr { get; set; } = string.Empty;

        [Column("linkman")]
        [StringLength(255)]
        public string ContactName { get; set; } = string.Empty;

        [Column("linkmobile")]
        [StringLength(255)]
        public string ContactMobile { get; set; } = string.Empty;

        [Column("memo01")]
        [StringLength(255)]
        public string Memo { get; set; } = string.Empty;

        [Column("placeno")]
        [StringLength(255)]
        public string PlaceCode { get; set; } = string.Empty;

        [Column("keyin")]
        [StringLength(255)]
        public string EmpCode { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public string ListedType { get; set; } = string.Empty;

        [NotMapped]
        public string OfficeId { get; set; } = string.Empty;
    }
}
