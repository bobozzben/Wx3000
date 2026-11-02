using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 會計科目主檔 (對齊 xmaster.dbf, xmaster2~6.dbf)
    /// </summary>
    public class AccountMaster
    {
        [Key]
        [Column("accno")]
        [MaxLength(8)]
        public string Accno { get; set; } = string.Empty;

        [Column("accname")]
        [MaxLength(20)]
        public string Accname { get; set; } = string.Empty;

        [Column("type")]
        [MaxLength(1)]
        public string? Type { get; set; }

        [Column("dept")]
        [MaxLength(1)]
        public string? Dept { get; set; }

        [Column("ldamount")]
        public decimal? Ldamount { get; set; } = 0;

        [Column("lcamount")]
        public decimal? Lcamount { get; set; } = 0;

        [Column("damount1")] public decimal? Damount1 { get; set; } = 0;
        [Column("camount1")] public decimal? Camount1 { get; set; } = 0;
        [Column("damount2")] public decimal? Damount2 { get; set; } = 0;
        [Column("camount2")] public decimal? Camount2 { get; set; } = 0;
        [Column("damount3")] public decimal? Damount3 { get; set; } = 0;
        [Column("camount3")] public decimal? Camount3 { get; set; } = 0;
        [Column("damount4")] public decimal? Damount4 { get; set; } = 0;
        [Column("camount4")] public decimal? Camount4 { get; set; } = 0;
        [Column("damount5")] public decimal? Damount5 { get; set; } = 0;
        [Column("camount5")] public decimal? Camount5 { get; set; } = 0;
        [Column("damount6")] public decimal? Damount6 { get; set; } = 0;
        [Column("camount6")] public decimal? Camount6 { get; set; } = 0;
        [Column("damount7")] public decimal? Damount7 { get; set; } = 0;
        [Column("camount7")] public decimal? Camount7 { get; set; } = 0;
        [Column("damount8")] public decimal? Damount8 { get; set; } = 0;
        [Column("camount8")] public decimal? Camount8 { get; set; } = 0;
        [Column("damount9")] public decimal? Damount9 { get; set; } = 0;
        [Column("camount9")] public decimal? Camount9 { get; set; } = 0;
        [Column("damount10")] public decimal? Damount10 { get; set; } = 0;
        [Column("camount10")] public decimal? Camount10 { get; set; } = 0;
        [Column("damount11")] public decimal? Damount11 { get; set; } = 0;
        [Column("camount11")] public decimal? Camount11 { get; set; } = 0;
        [Column("damount12")] public decimal? Damount12 { get; set; } = 0;
        [Column("camount12")] public decimal? Camount12 { get; set; } = 0;

        [Column("bpage1")]
        public int? Bpage1 { get; set; }

        [Column("bpage2")]
        public int? Bpage2 { get; set; }

        [Column("taxcode")]
        [MaxLength(1)]
        public string? Taxcode { get; set; }

        [Column("serial")]
        public int? Serial { get; set; }

        [Column("engaccname")]
        [MaxLength(254)]
        public string? Engaccname { get; set; }

        [Column("clsaccno")]
        [MaxLength(8)]
        public string? Clsaccno { get; set; }

        [Column("clsaccname")]
        [MaxLength(20)]
        public string? Clsaccname { get; set; }

        [Column("accnamel")]
        [MaxLength(60)]
        public string? Accnamel { get; set; }

        [Column("_record_number")]
        [System.Text.Json.Serialization.JsonPropertyName("_record_number")]
        public int? RecordNumber { get; set; }
    }
}
