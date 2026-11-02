using System.Text.Json.Serialization;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 5-1 客戶資料列印項目 DTO
    /// </summary>
    public class CustomerPrintItemDto
    {
        [JsonPropertyName("no")]
        public string No { get; set; } = string.Empty;

        [JsonPropertyName("abbr")]
        public string Abbr { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("unino")]
        public string Unino { get; set; } = string.Empty;

        [JsonPropertyName("taxno")]
        public string Taxno { get; set; } = string.Empty;

        [JsonPropertyName("hname")]
        public string Hname { get; set; } = string.Empty;

        [JsonPropertyName("linkman")]
        public string Linkman { get; set; } = string.Empty;

        [JsonPropertyName("tel")]
        public string Tel { get; set; } = string.Empty;

        [JsonPropertyName("mobile")]
        public string Mobile { get; set; } = string.Empty;

        [JsonPropertyName("fax")]
        public string Fax { get; set; } = string.Empty;

        [JsonPropertyName("addr")]
        public string Addr { get; set; } = string.Empty;

        [JsonPropertyName("invaddr")]
        public string Invaddr { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [JsonPropertyName("keyin")]
        public string Keyin { get; set; } = string.Empty;

        [JsonPropertyName("keyinna")]
        public string Keyinna { get; set; } = string.Empty;

        [JsonPropertyName("orga")]
        public string Orga { get; set; } = string.Empty;

        [JsonPropertyName("organame")]
        public string Organame { get; set; } = string.Empty;

        [JsonPropertyName("pno")]
        public string Pno { get; set; } = string.Empty;

        [JsonPropertyName("pnostd")]
        public string Pnostd { get; set; } = string.Empty;

        [JsonPropertyName("offno")]
        public string Offno { get; set; } = string.Empty;

        [JsonPropertyName("offno1")]
        public string Offno1 { get; set; } = string.Empty;

        [JsonPropertyName("cpano")]
        public string Cpano { get; set; } = string.Empty;

        [JsonPropertyName("capital")]
        public decimal? Capital { get; set; }

        [JsonPropertyName("serial")]
        public int? Serial { get; set; }

        [JsonPropertyName("recordNumber")]
        public int? RecordNumber { get; set; }

        [JsonPropertyName("selected")]
        public bool Selected { get; set; } = true;
    }

    /// <summary>
    /// 5-2 郵寄標籤列印客戶項目 DTO
    /// </summary>
    public class LabelCustomerItemDto
    {
        [JsonPropertyName("no")]
        public string No { get; set; } = string.Empty;

        [JsonPropertyName("abbr")]
        public string Abbr { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("unino")]
        public string Unino { get; set; } = string.Empty;

        [JsonPropertyName("hname")]
        public string Hname { get; set; } = string.Empty;

        [JsonPropertyName("linkman")]
        public string Linkman { get; set; } = string.Empty;

        [JsonPropertyName("tel")]
        public string Tel { get; set; } = string.Empty;

        [JsonPropertyName("addr")]
        public string Addr { get; set; } = string.Empty;

        [JsonPropertyName("invaddr")]
        public string Invaddr { get; set; } = string.Empty;

        [JsonPropertyName("prn")]
        public int Prn { get; set; } = 1;

        [JsonPropertyName("selected")]
        public bool Selected { get; set; } = false;

        [JsonPropertyName("recordNumber")]
        public int? RecordNumber { get; set; }
    }

    /// <summary>
    /// 5-3 登打統計表項目 DTO
    /// </summary>
    public class KeyinStatsItemDto
    {
        [JsonPropertyName("custNo")]
        public string CustNo { get; set; } = string.Empty;

        [JsonPropertyName("custName")]
        public string CustName { get; set; } = string.Empty;

        [JsonPropertyName("unino")]
        public string Unino { get; set; } = string.Empty;

        [JsonPropertyName("taxno")]
        public string Taxno { get; set; } = string.Empty;

        [JsonPropertyName("keyin")]
        public string Keyin { get; set; } = string.Empty;

        [JsonPropertyName("keyinna")]
        public string Keyinna { get; set; } = string.Empty;

        [JsonPropertyName("tel")]
        public string Tel { get; set; } = string.Empty;

        [JsonPropertyName("addr")]
        public string Addr { get; set; } = string.Empty;

        [JsonPropertyName("pno")]
        public string Pno { get; set; } = string.Empty;
    }

    /// <summary>
    /// 5-4 營業狀況表項目 DTO
    /// </summary>
    public class BusinessStatusItemDto
    {
        [JsonPropertyName("no")]
        public string No { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("unino")]
        public string Unino { get; set; } = string.Empty;

        [JsonPropertyName("taxno")]
        public string Taxno { get; set; } = string.Empty;

        [JsonPropertyName("hname")]
        public string Hname { get; set; } = string.Empty;

        [JsonPropertyName("tel")]
        public string Tel { get; set; } = string.Empty;

        [JsonPropertyName("addr")]
        public string Addr { get; set; } = string.Empty;

        [JsonPropertyName("pno")]
        public string Pno { get; set; } = string.Empty;

        [JsonPropertyName("capital")]
        public decimal? Capital { get; set; }

        [JsonPropertyName("startMonth")]
        public string StartMonth { get; set; } = "01";

        [JsonPropertyName("endMonth")]
        public string EndMonth { get; set; } = "12";
    }

    /// <summary>
    /// 5-5 財務狀況參考表項目 DTO
    /// </summary>
    public class FinanceStatusItemDto
    {
        [JsonPropertyName("no")]
        public string No { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("unino")]
        public string Unino { get; set; } = string.Empty;

        [JsonPropertyName("taxno")]
        public string Taxno { get; set; } = string.Empty;

        [JsonPropertyName("capital")]
        public decimal? Capital { get; set; }

        [JsonPropertyName("hname")]
        public string Hname { get; set; } = string.Empty;

        [JsonPropertyName("tel")]
        public string Tel { get; set; } = string.Empty;

        [JsonPropertyName("addr")]
        public string Addr { get; set; } = string.Empty;

        [JsonPropertyName("pno")]
        public string Pno { get; set; } = string.Empty;

        [JsonPropertyName("year")]
        public string Year { get; set; } = string.Empty;
    }

    /// <summary>
    /// 5-6 委任書條文 / 查核程序項目 DTO (對應 bsdesc.dbf)
    /// </summary>
    public class BsdescItemDto
    {
        [JsonPropertyName("seq")]
        public int Seq { get; set; }

        [JsonPropertyName("no")]
        public string No { get; set; } = string.Empty;

        [JsonPropertyName("desc")]
        public string Desc { get; set; } = string.Empty;

        [JsonPropertyName("sel")]
        public string Sel { get; set; } = string.Empty;

        [JsonPropertyName("serial")]
        public int Serial { get; set; }

        [JsonPropertyName("recordNumber")]
        public int? RecordNumber { get; set; }
    }

    /// <summary>
    /// 5-1 查詢參數 DTO
    /// </summary>
    public class CustomerPrintQueryDto
    {
        [JsonPropertyName("startNo")]
        public string? StartNo { get; set; }

        [JsonPropertyName("endNo")]
        public string? EndNo { get; set; }

        /// <summary>
        /// 1: 基本資料, 2: 詳細資料
        /// </summary>
        [JsonPropertyName("reportType")]
        public int ReportType { get; set; } = 1;

        /// <summary>
        /// 1: 公司地址, 2: 聯絡地址, 3: 公司與聯絡地址
        /// </summary>
        [JsonPropertyName("addrType")]
        public int AddrType { get; set; } = 1;

        /// <summary>
        /// 1: 依客戶編號排序, 2: 依登打人員排序
        /// </summary>
        [JsonPropertyName("groupType")]
        public int GroupType { get; set; } = 1;

        /// <summary>
        /// 1: 客戶編號, 2: 統一編號, 3: 稅籍編號
        /// </summary>
        [JsonPropertyName("orderType")]
        public int OrderType { get; set; } = 1;

        [JsonPropertyName("selectedNos")]
        public List<string>? SelectedNos { get; set; }
    }

    /// <summary>
    /// 5-2 標籤列印參數 DTO
    /// </summary>
    public class LabelPrintQueryDto
    {
        [JsonPropertyName("startNo")]
        public string? StartNo { get; set; }

        [JsonPropertyName("endNo")]
        public string? EndNo { get; set; }

        /// <summary>
        /// 1: 磁片標籤, 2: 郵遞標籤
        /// </summary>
        [JsonPropertyName("labelType")]
        public int LabelType { get; set; } = 2;

        /// <summary>
        /// 1: 橫式, 2: 直式
        /// </summary>
        [JsonPropertyName("layoutType")]
        public int LayoutType { get; set; } = 1;

        /// <summary>
        /// 1: 公司地址, 2: 聯絡地址
        /// </summary>
        [JsonPropertyName("addrType")]
        public int AddrType { get; set; } = 1;

        /// <summary>
        /// 1: 負責人, 2: 聯絡人
        /// </summary>
        [JsonPropertyName("recipientType")]
        public int RecipientType { get; set; } = 1;

        [JsonPropertyName("copies")]
        public int Copies { get; set; } = 1;

        [JsonPropertyName("startRow")]
        public int StartRow { get; set; } = 1;

        [JsonPropertyName("isA4")]
        public bool IsA4 { get; set; } = true;

        [JsonPropertyName("isKaohsiungFormat")]
        public bool IsKaohsiungFormat { get; set; } = false;

        [JsonPropertyName("items")]
        public List<LabelCustomerItemDto>? Items { get; set; }
    }

    /// <summary>
    /// 5-3 登打統計查詢參數 DTO
    /// </summary>
    public class KeyinStatsQueryDto
    {
        [JsonPropertyName("year")]
        public string? Year { get; set; }

        [JsonPropertyName("startNo")]
        public string? StartNo { get; set; }

        [JsonPropertyName("endNo")]
        public string? EndNo { get; set; }

        [JsonPropertyName("startKeyin")]
        public string? StartKeyin { get; set; }

        [JsonPropertyName("endKeyin")]
        public string? EndKeyin { get; set; }
    }

    /// <summary>
    /// 5-4 營業狀況查詢參數 DTO
    /// </summary>
    public class BusinessStatusQueryDto
    {
        [JsonPropertyName("year")]
        public string? Year { get; set; }

        [JsonPropertyName("startMonth")]
        public string? StartMonth { get; set; }

        [JsonPropertyName("endMonth")]
        public string? EndMonth { get; set; }

        [JsonPropertyName("startNo")]
        public string? StartNo { get; set; }

        [JsonPropertyName("endNo")]
        public string? EndNo { get; set; }
    }

    /// <summary>
    /// 5-5 財務狀況查詢參數 DTO
    /// </summary>
    public class FinanceStatusQueryDto
    {
        [JsonPropertyName("year")]
        public string? Year { get; set; }

        [JsonPropertyName("startNo")]
        public string? StartNo { get; set; }

        [JsonPropertyName("endNo")]
        public string? EndNo { get; set; }
    }

    /// <summary>
    /// 5-6 委任書條文批次儲存 DTO
    /// </summary>
    public class BsdescBatchUpdateDto
    {
        [JsonPropertyName("rpdate")]
        public string? Rpdate { get; set; }

        [JsonPropertyName("comphidno")]
        public string? Comphidno { get; set; }

        [JsonPropertyName("endyear")]
        public string? Endyear { get; set; }

        [JsonPropertyName("items")]
        public List<BsdescItemDto> Items { get; set; } = new();
    }
}
