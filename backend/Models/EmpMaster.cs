using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("建檔人員", Schema = "e3000__comm")]
    public class EmpMaster
    {
        [Key]
        [Column("建檔人員編號")]
        [StringLength(20)]
        public string EmpCode { get; set; } = string.Empty;

        [Required]
        [Column("建檔人員名稱")]
        [StringLength(50)]
        public string EmpName { get; set; } = string.Empty;

        [Column("建檔人員密碼")]
        [StringLength(50)]
        public string? DepName { get; set; }

        [Column("建檔人員手機")]
        [StringLength(30)]
        public string? Mobile { get; set; }

        [Column("建檔人員信箱")]
        [StringLength(100)]
        public string? Email { get; set; }

        [Column("oneuserid")]
        [StringLength(50)]
        public string? OneUserId { get; set; }

        [Column("onepassno")]
        [StringLength(50)]
        public string? OnePassNo { get; set; }
    }
}
