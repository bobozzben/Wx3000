using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("taxno", Schema = "c:/w3000/comm")]
    public class TaxOfficerMaster
    {
        [Key]
        [Column("no")]
        [StringLength(255)]
        public string TaxCode { get; set; } = string.Empty;

        [Column("name")]
        [StringLength(255)]
        public string TaxName { get; set; } = string.Empty;

        [Column("helpman")]
        [StringLength(255)]
        public string TaxBureau { get; set; } = string.Empty;

        [Column("department")]
        [StringLength(255)]
        public string Unit { get; set; } = string.Empty;

        [Column("tel")]
        [StringLength(255)]
        public string Tel { get; set; } = string.Empty;

        [Column("memo")]
        [StringLength(255)]
        public string Memo { get; set; } = string.Empty;

        [Column("addr")]
        [StringLength(255)]
        public string Address { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;

        [NotMapped]
        public string Ext { get; set; } = string.Empty;

        [NotMapped]
        public string Fax { get; set; } = string.Empty;

        [NotMapped]
        public string Mobile { get; set; } = string.Empty;

        [NotMapped]
        public string Email { get; set; } = string.Empty;
    }
}
