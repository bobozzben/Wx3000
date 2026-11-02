using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 4-2 營業稅設定 DTO (對應 customer.dbf)
    /// </summary>
    public class CustomerTaxDto
    {
        public string No { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Bydno { get; set; } = string.Empty;
        public string Bycno { get; set; } = string.Empty;
        public string Bybkdno { get; set; } = string.Empty;
        public string Bybkcno { get; set; } = string.Empty;
        public string Sadno { get; set; } = string.Empty;
        public string Sacno { get; set; } = string.Empty;
        public string Sabkdno { get; set; } = string.Empty;
        public string Sabkcno { get; set; } = string.Empty;
        public string Casaccno { get; set; } = string.Empty;
        public string Mediatype { get; set; } = string.Empty;
        public string T401 { get; set; } = string.Empty;
        public string Fileno { get; set; } = string.Empty;
        public string Tpay { get; set; } = string.Empty;
        public string Mainunino { get; set; } = string.Empty;
        public string Monthv { get; set; } = string.Empty;
        public int? Serial { get; set; }
        public int? RecordNumber { get; set; }
    }

    /// <summary>
    /// 4-3 營業稅傳票轉檔設定 DTO (對應 customer.dbf)
    /// </summary>
    public class CustomerVoucherDto
    {
        public string No { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Monthv { get; set; } = string.Empty;
        public string Mediatype { get; set; } = string.Empty;
        public string Trantype { get; set; } = string.Empty;
        public string Trankind { get; set; } = string.Empty;
        public decimal? Trandate { get; set; }
        public string Trantypeb { get; set; } = string.Empty;
        public string Trankindb { get; set; } = string.Empty;
        public decimal? Trandateb { get; set; }
        public string Fileno { get; set; } = string.Empty;
        public string Tpay { get; set; } = string.Empty;
        public int? Serial { get; set; }
        public int? RecordNumber { get; set; }
    }

    /// <summary>
    /// 標準營業稅會計科目設定 DTO (對應 accpara.dbf / wbase4021)
    /// </summary>
    public class AccParaTaxDto
    {
        public string Bydno { get; set; } = string.Empty;
        public string Bycno { get; set; } = string.Empty;
        public string Bybkdno { get; set; } = string.Empty;
        public string Bybkcno { get; set; } = string.Empty;
        public string Sadno { get; set; } = string.Empty;
        public string Sacno { get; set; } = string.Empty;
        public string Sabkdno { get; set; } = string.Empty;
        public string Sabkcno { get; set; } = string.Empty;
        public string Casaccno { get; set; } = string.Empty;
    }

    /// <summary>
    /// 標準轉傳票參數設定 DTO (對應 accpara.dbf / wbase4031)
    /// </summary>
    public class AccParaVoucherDto
    {
        public string SmMonthv { get; set; } = string.Empty;
        public string SmMedia { get; set; } = string.Empty;
        public string SmType { get; set; } = string.Empty;
        public string SmKind { get; set; } = string.Empty;
        public decimal? SmDate { get; set; }
        public string SmTypeb { get; set; } = string.Empty;
        public string SmKindb { get; set; } = string.Empty;
        public decimal? SmDateb { get; set; }
    }

    /// <summary>
    /// 4-4 期末存貨計算方式 / 進銷存方式設定 DTO (對應 acc_st.dbf)
    /// </summary>
    public class AccStDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Stock { get; set; } = "A";
        public string Acctype { get; set; } = "A";
        public int? Serial { get; set; }
        public int? RecordNumber { get; set; }
    }

    /// <summary>
    /// 4-5 共用會計科目摘要 DTO (對應 descrip.dbf)
    /// </summary>
    public class DescripItemDto
    {
        public string Accno { get; set; } = string.Empty;
        public string Descrip { get; set; } = string.Empty;
        public decimal? Serial { get; set; }
        public int? RecordNumber { get; set; }
    }

    /// <summary>
    /// 4-6 共用參數設定 DTO (對應 pub_para.dbf)
    /// </summary>
    public class PubParaDto
    {
        public string Qqsel { get; set; } = "0";
    }
}
