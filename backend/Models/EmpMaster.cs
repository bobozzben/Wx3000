using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("keyin", Schema = "c:/w3000/comm")]
    public class EmpMaster
    {
        [Key]
        [Column("no")]
        [StringLength(255)]
        public string EmpCode { get; set; } = string.Empty;

        [Column("name")]
        [StringLength(255)]
        public string EmpName { get; set; } = string.Empty;

        [Column("memo")]
        [StringLength(255)]
        public string DepName { get; set; } = string.Empty;

        [Column("phone")]
        [StringLength(255)]
        public string Mobile { get; set; } = string.Empty;

        [Column("email")]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Column("oneuserid")]
        [StringLength(255)]
        public string OneUserId { get; set; } = string.Empty;

        [Column("onepassno")]
        [StringLength(255)]
        public string OnePassNo { get; set; } = string.Empty;

        [Column("psw")]
        [StringLength(255)]
        public string Psw { get; set; } = string.Empty;

        [Column("birthday")]
        [StringLength(255)]
        public string Birthday { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;
    }
}
