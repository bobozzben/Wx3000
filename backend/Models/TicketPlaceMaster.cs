using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("基本購票地點", Schema = "e3000__comm")]
    public class TicketPlaceMaster
    {
        [Key]
        [Column("編號")]
        [StringLength(50)]
        public string PlaceCode { get; set; } = string.Empty;

        [Column("購買地點")]
        [StringLength(255)]
        public string PlaceName { get; set; } = string.Empty;

        [Column("連絡人")]
        [StringLength(255)]
        public string ContactPerson { get; set; } = string.Empty;

        [Column("連絡電話")]
        [StringLength(255)]
        public string ContactTel { get; set; } = string.Empty;

        [Column("購買地址")]
        [StringLength(255)]
        public string PlaceAddress { get; set; } = string.Empty;
    }
}
