using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("buyinv", Schema = "c:/w3000/comm")]
    public class InvoicePurchaseMaster
    {
        [Column("yymm")]
        [StringLength(255)]
        public string Period { get; set; } = string.Empty;

        [Column("times")]
        [StringLength(255)]
        public string Times { get; set; } = "1";

        [Column("no")]
        [StringLength(255)]
        public string CompanyCode { get; set; } = string.Empty;

        [Column("name")]
        [StringLength(255)]
        public string CompanyShortName { get; set; } = string.Empty;

        [Column("unino")]
        [StringLength(255)]
        public string UnifiedNo { get; set; } = string.Empty;

        [Column("taxno")]
        [StringLength(255)]
        public string TaxNo { get; set; } = string.Empty;

        [Column("a02")]
        public int ManualTwoDup { get; set; } = 0;

        [Column("a02b")]
        public int ManualTwoDupSub { get; set; } = 0;

        [Column("a03")]
        public int ManualThreeDup { get; set; } = 0;

        [Column("a03b")]
        public int ManualThreeDupSub { get; set; } = 0;

        [Column("spec")]
        public int ManualSpecial { get; set; } = 0;

        [Column("c02")]
        public int CashTwoDup { get; set; } = 0;

        [Column("c03")]
        public int CashThreeDup { get; set; } = 0;

        [Column("c03b")]
        public int CashThreeDupSub { get; set; } = 0;

        // 字軌與起迄號
        [Column("a02beg")]
        [StringLength(255)]
        public string ManualTwoTrack { get; set; } = string.Empty;

        [Column("a02begno")]
        [StringLength(255)]
        public string ManualTwoStartNo { get; set; } = string.Empty;

        [Column("a02endno")]
        [StringLength(255)]
        public string ManualTwoEndNo { get; set; } = string.Empty;

        [Column("a02bbeg")]
        [StringLength(255)]
        public string ManualTwoSubTrack { get; set; } = string.Empty;

        [Column("a02bbegno")]
        [StringLength(255)]
        public string ManualTwoSubStartNo { get; set; } = string.Empty;

        [Column("a02bendno")]
        [StringLength(255)]
        public string ManualTwoSubEndNo { get; set; } = string.Empty;

        [Column("a03beg")]
        [StringLength(255)]
        public string ManualThreeTrack { get; set; } = string.Empty;

        [Column("a03begno")]
        [StringLength(255)]
        public string ManualThreeStartNo { get; set; } = string.Empty;

        [Column("a03endno")]
        [StringLength(255)]
        public string ManualThreeEndNo { get; set; } = string.Empty;

        [Column("a03bbeg")]
        [StringLength(255)]
        public string ManualThreeSubTrack { get; set; } = string.Empty;

        [Column("a03bbegno")]
        [StringLength(255)]
        public string ManualThreeSubStartNo { get; set; } = string.Empty;

        [Column("a03bendno")]
        [StringLength(255)]
        public string ManualThreeSubEndNo { get; set; } = string.Empty;

        [Column("specbeg")]
        [StringLength(255)]
        public string SpecialTrack { get; set; } = string.Empty;

        [Column("specbegno")]
        [StringLength(255)]
        public string SpecialStartNo { get; set; } = string.Empty;

        [Column("specendno")]
        [StringLength(255)]
        public string SpecialEndNo { get; set; } = string.Empty;

        [Column("c02beg")]
        [StringLength(255)]
        public string CashTwoTrack { get; set; } = string.Empty;

        [Column("c02begno")]
        [StringLength(255)]
        public string CashTwoStartNo { get; set; } = string.Empty;

        [Column("c02endno")]
        [StringLength(255)]
        public string CashTwoEndNo { get; set; } = string.Empty;

        [Column("c03beg")]
        [StringLength(255)]
        public string CashThreeTrack { get; set; } = string.Empty;

        [Column("c03begno")]
        [StringLength(255)]
        public string CashThreeStartNo { get; set; } = string.Empty;

        [Column("c03endno")]
        [StringLength(255)]
        public string CashThreeEndNo { get; set; } = string.Empty;

        [Column("c03bbeg")]
        [StringLength(255)]
        public string CashThreeSubTrack { get; set; } = string.Empty;

        [Column("c03bbegno")]
        [StringLength(255)]
        public string CashThreeSubStartNo { get; set; } = string.Empty;

        [Column("c03bendno")]
        [StringLength(255)]
        public string CashThreeSubEndNo { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public decimal? SpecialTotal { get; set; }

        [NotMapped]
        public string? City { get; set; }

        [NotMapped]
        public string? PlaceCode { get; set; }

        [NotMapped]
        public string? EmpCode { get; set; }

        [NotMapped]
        public string? Guid { get; set; }

        [NotMapped]
        public string? CompanyName { get; set; }

        [NotMapped]
        public string? CompanyAddr { get; set; }

        [NotMapped]
        public string? CompanyTel { get; set; }

        [NotMapped]
        public string? CompanyFax { get; set; }

        [NotMapped]
        public string? DataYear { get; set; }

        [NotMapped]
        public string? DataStartMonth { get; set; }

        [NotMapped]
        public string? DataEndMonth { get; set; }
    }
}
