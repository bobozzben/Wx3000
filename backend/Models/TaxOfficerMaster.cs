using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("基本稅務人員", Schema = "e3000__comm")]
    public class TaxOfficerMaster
    {
        [Key]
        [Column("編號")]
        [StringLength(20)]
        public string TaxCode { get; set; } = string.Empty;

        [Column("姓名")]
        [StringLength(50)]
        public string TaxName { get; set; } = string.Empty;

        [Column("稅局")]
        [StringLength(50)]
        public string? TaxBureau { get; set; }

        [Column("單位")]
        [StringLength(50)]
        public string? Unit { get; set; }

        [Column("電話")]
        [StringLength(30)]
        public string? Tel { get; set; }

        [Column("分機")]
        [StringLength(20)]
        public string? Ext { get; set; }

        [Column("傳真")]
        [StringLength(30)]
        public string? Fax { get; set; }

        [Column("手機")]
        [StringLength(30)]
        public string? Mobile { get; set; }

        [Column("EMAIL")]
        [StringLength(100)]
        public string? Email { get; set; }

        [Column("備註")]
        [StringLength(200)]
        public string? Memo { get; set; }
    }
}
