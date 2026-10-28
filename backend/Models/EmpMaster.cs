using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Wx3000.Backend.Models
{
    [Table("keyin", Schema = "c:/w3000/comm")]
    public class EmpMaster
    {
        [Key]
        [Column("no")]
        [StringLength(255)]
        [JsonPropertyName("no")]
        public string No { get; set; } = string.Empty;

        [Column("name")]
        [StringLength(255)]
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [Column("psw")]
        [StringLength(255)]
        [JsonPropertyName("psw")]
        public string Psw { get; set; } = string.Empty;

        [Column("birthday")]
        [StringLength(255)]
        [JsonPropertyName("birthday")]
        public string Birthday { get; set; } = string.Empty;

        [Column("tel")]
        [StringLength(255)]
        [JsonPropertyName("tel")]
        public string Tel { get; set; } = string.Empty;

        [Column("id")]
        [StringLength(255)]
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [Column("addr")]
        [StringLength(255)]
        [JsonPropertyName("addr")]
        public string Addr { get; set; } = string.Empty;

        [Column("memo")]
        [StringLength(255)]
        [JsonPropertyName("memo")]
        public string Memo { get; set; } = string.Empty;

        [Column("oneuserid")]
        [StringLength(255)]
        [JsonPropertyName("oneuserid")]
        public string OneUserId { get; set; } = string.Empty;

        [Column("onepassno")]
        [StringLength(255)]
        [JsonPropertyName("onepassno")]
        public string OnePassNo { get; set; } = string.Empty;

        [Column("phone")]
        [StringLength(255)]
        [JsonPropertyName("phone")]
        public string Phone { get; set; } = string.Empty;

        [Column("email")]
        [StringLength(255)]
        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [Column("_record_number")]
        [JsonPropertyName("_record_number")]
        public int RecordNumber { get; set; } = 0;

        // 相容舊程式之別名屬性 (Legacy Aliases)
        [NotMapped]
        [JsonPropertyName("empCode")]
        public string EmpCode
        {
            get => No;
            set { if (string.IsNullOrEmpty(No) && !string.IsNullOrEmpty(value)) No = value; }
        }

        [NotMapped]
        [JsonPropertyName("empName")]
        public string EmpName
        {
            get => Name;
            set { if (string.IsNullOrEmpty(Name) && !string.IsNullOrEmpty(value)) Name = value; }
        }

        [NotMapped]
        [JsonPropertyName("mobile")]
        public string Mobile
        {
            get => Phone;
            set { if (string.IsNullOrEmpty(Phone) && !string.IsNullOrEmpty(value)) Phone = value; }
        }

        [NotMapped]
        [JsonPropertyName("depName")]
        public string DepName
        {
            get => Memo;
            set { if (string.IsNullOrEmpty(Memo) && !string.IsNullOrEmpty(value)) Memo = value; }
        }
    }
}
