using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("基本發票購買", Schema = "e3000__comm")]
    public class InvoicePurchaseMaster
    {
        [Column("期別")]
        [StringLength(20)]
        public string Period { get; set; } = string.Empty;

        [Column("次數")]
        [StringLength(10)]
        public string Times { get; set; } = "1";

        [Column("公司編號")]
        [StringLength(30)]
        public string CompanyCode { get; set; } = string.Empty;

        [Column("公司簡稱")]
        [StringLength(255)]
        public string? CompanyShortName { get; set; }

        [Column("公司統編")]
        [StringLength(20)]
        public string? UnifiedNo { get; set; }

        [Column("稅籍編號")]
        [StringLength(30)]
        public string? TaxNo { get; set; }

        [Column("手開二聯")]
        public int ManualTwoDup { get; set; } = 0;

        [Column("手開二聯副")]
        public int ManualTwoDupSub { get; set; } = 0;

        [Column("手開三聯")]
        public int ManualThreeDup { get; set; } = 0;

        [Column("手開三聯副")]
        public int ManualThreeDupSub { get; set; } = 0;

        [Column("手開特種")]
        public int ManualSpecial { get; set; } = 0;

        [Column("特種")]
        public decimal? SpecialTotal { get; set; }

        [Column("收銀二聯")]
        public int CashTwoDup { get; set; } = 0;

        [Column("收銀三聯")]
        public int CashThreeDup { get; set; } = 0;

        [Column("收銀三聯副")]
        public int CashThreeDupSub { get; set; } = 0;

        // 字軌與起迄號
        [Column("手開二聯字軌")]
        [StringLength(10)]
        public string? ManualTwoTrack { get; set; }

        [Column("手開二聯起號")]
        [StringLength(20)]
        public string? ManualTwoStartNo { get; set; }

        [Column("手開二聯迄號")]
        [StringLength(20)]
        public string? ManualTwoEndNo { get; set; }

        [Column("手開二聯副字軌")]
        [StringLength(10)]
        public string? ManualTwoSubTrack { get; set; }

        [Column("手開二聯副起號")]
        [StringLength(20)]
        public string? ManualTwoSubStartNo { get; set; }

        [Column("手開二聯副迄號")]
        [StringLength(20)]
        public string? ManualTwoSubEndNo { get; set; }

        [Column("手開三聯字軌")]
        [StringLength(10)]
        public string? ManualThreeTrack { get; set; }

        [Column("手開三聯起號")]
        [StringLength(20)]
        public string? ManualThreeStartNo { get; set; }

        [Column("手開三聯迄號")]
        [StringLength(20)]
        public string? ManualThreeEndNo { get; set; }

        [Column("手開三聯副字軌")]
        [StringLength(10)]
        public string? ManualThreeSubTrack { get; set; }

        [Column("手開三聯副起號")]
        [StringLength(20)]
        public string? ManualThreeSubStartNo { get; set; }

        [Column("手開三聯副迄號")]
        [StringLength(20)]
        public string? ManualThreeSubEndNo { get; set; }

        [Column("特種字軌")]
        [StringLength(10)]
        public string? SpecialTrack { get; set; }

        [Column("特種起號")]
        [StringLength(20)]
        public string? SpecialStartNo { get; set; }

        [Column("特種迄號")]
        [StringLength(20)]
        public string? SpecialEndNo { get; set; }

        [Column("收銀二聯字軌")]
        [StringLength(10)]
        public string? CashTwoTrack { get; set; }

        [Column("收銀二聯起號")]
        [StringLength(20)]
        public string? CashTwoStartNo { get; set; }

        [Column("收銀二聯迄號")]
        [StringLength(20)]
        public string? CashTwoEndNo { get; set; }

        [Column("收銀三聯字軌")]
        [StringLength(10)]
        public string? CashThreeTrack { get; set; }

        [Column("收銀三聯起號")]
        [StringLength(20)]
        public string? CashThreeStartNo { get; set; }

        [Column("收銀三聯迄號")]
        [StringLength(20)]
        public string? CashThreeEndNo { get; set; }

        [Column("收銀三聯副字軌")]
        [StringLength(10)]
        public string? CashThreeSubTrack { get; set; }

        [Column("收銀三聯副起號")]
        [StringLength(20)]
        public string? CashThreeSubStartNo { get; set; }

        [Column("收銀三聯副迄號")]
        [StringLength(20)]
        public string? CashThreeSubEndNo { get; set; }

        [Column("縣市別")]
        [StringLength(50)]
        public string? City { get; set; }

        [Column("購買地點")]
        [StringLength(50)]
        public string? PlaceCode { get; set; }

        [Column("建檔人員")]
        [StringLength(50)]
        public string? EmpCode { get; set; }

        [Column("guid")]
        [StringLength(50)]
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
