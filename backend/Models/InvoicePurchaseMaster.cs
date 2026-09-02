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

        [Column("收銀二聯")]
        public int CashTwoDup { get; set; } = 0;

        [Column("收銀三聯")]
        public int CashThreeDup { get; set; } = 0;

        [Column("收銀三聯副")]
        public int CashThreeDupSub { get; set; } = 0;

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
    }
}
