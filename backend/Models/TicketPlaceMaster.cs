using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    [Table("place", Schema = "c:/w3000/comm")]
    public class TicketPlaceMaster
    {
        [Key]
        [Column("no")]
        [StringLength(255)]
        public string PlaceCode { get; set; } = string.Empty;

        [Column("place")]
        [StringLength(255)]
        public string PlaceName { get; set; } = string.Empty;

        [Column("linkman")]
        [StringLength(255)]
        public string ContactPerson { get; set; } = string.Empty;

        [Column("linktel")]
        [StringLength(255)]
        public string ContactTel { get; set; } = string.Empty;

        [Column("addr")]
        [StringLength(255)]
        public string PlaceAddress { get; set; } = string.Empty;

        [Column("_record_number")]
        public int RecordNumber { get; set; } = 0;
    }
}
