using System.Collections.Generic;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 3-4-1 原媒體轉檔 (VFP wbase3025) / 3-4-2 網路申購轉檔 (VFP wbase3025n) 的轉檔條件
    /// </summary>
    public class MediaTransferRequest
    {
        /// <summary>media = 原媒體轉檔 (wbase3025)、net = 網路申購轉檔 (wbase3025n)</summary>
        public string Mode { get; set; } = "media";

        /// <summary>民國年 3 碼</summary>
        public string Year { get; set; } = string.Empty;
        public string StartMonth { get; set; } = string.Empty;
        public string EndMonth { get; set; } = string.Empty;

        /// <summary>1 依地址縣市 (City)、2 依購買地點 (PlaceNo)</summary>
        public string FilterBy { get; set; } = "1";
        /// <summary>轉檔縣市 (VFP bbcity，最多 6 碼；網路申購轉檔可輸入 * 不分區)</summary>
        public string City { get; set; } = string.Empty;
        /// <summary>購買地點代號 (place.no)</summary>
        public string PlaceNo { get; set; } = string.Empty;

        /// <summary>記帳業者ＩＤ (VFP mid，10 碼)</summary>
        public string AgentId { get; set; } = string.Empty;

        /// <summary>原媒體轉檔：1 依統一編號、2 依稅籍編號 (VFP Optiongroup1)</summary>
        public string SortBy { get; set; } = "1";

        /// <summary>
        /// 原媒體轉檔：台灣省檔名 1 PODER.DAT、2 PODER.TXT (VFP OP1)；
        /// 網路申購轉檔：1 台北市、2 高雄市、3 台灣省 (VFP op1)
        /// </summary>
        public string Format { get; set; } = "1";

        /// <summary>原媒體轉檔：台灣省檔尾加事務所簽章框 (VFP Check2 轉出事務所資料)</summary>
        public bool WithOffice { get; set; } = true;
    }

    /// <summary>轉出的一家公司 (預覽清單用)</summary>
    public class MediaTransferRowDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        public string Taxno { get; set; } = string.Empty;
        public string Addr { get; set; } = string.Empty;
        public string PlaceNo { get; set; } = string.Empty;
        public string Times { get; set; } = string.Empty;
        public int A02 { get; set; }
        public int A02b { get; set; }
        public int A03 { get; set; }
        public int A03b { get; set; }
        public int Spec { get; set; }
        public int C02 { get; set; }
        public int C03 { get; set; }
        public int C03b { get; set; }
        /// <summary>這家公司在錯誤清單裡的訊息 (客戶代號不存在 / 地址空白 / 地址不在縣市)，沒有為空</summary>
        public string Error { get; set; } = string.Empty;
    }

    public class MediaTransferResultDto
    {
        /// <summary>taipei / kaohsiung / province</summary>
        public string Region { get; set; } = string.Empty;
        public string RegionName { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        /// <summary>檔案內容 (Big5 位元組) 的 Base64</summary>
        public string ContentBase64 { get; set; } = string.Empty;
        public int ByteLength { get; set; }
        public int LineCount { get; set; }
        /// <summary>true = VFP COPY TO ... SDF 的寫法：每列補滿 254 位元組，檔尾有 0x1A；false = FWRITE 寫 ALLTRIM 後的列</summary>
        public bool Padded { get; set; }
        /// <summary>轉出的公司 (依輸出順序)</summary>
        public List<MediaTransferRowDto> Rows { get; set; } = new();
        /// <summary>錯誤清單 (VFP error_media 報表的內容)</summary>
        public List<string> Errors { get; set; } = new();
        /// <summary>8 種發票的本數合計</summary>
        public Dictionary<string, int> Totals { get; set; } = new();
        public string Message { get; set; } = string.Empty;
    }

    /// <summary>進入畫面時的預設值 (VFP Init：最近一期、pub_para.buycity) 與事務所資料 (base.dbf)</summary>
    public class MediaTransferDefaultsDto
    {
        public string Year { get; set; } = string.Empty;
        public string StartMonth { get; set; } = string.Empty;
        public string EndMonth { get; set; } = string.Empty;
        /// <summary>pub_para.buycity</summary>
        public string City { get; set; } = string.Empty;
        public string OfficeName { get; set; } = string.Empty;
        public string OfficeUnino { get; set; } = string.Empty;
        public string OfficeTel { get; set; } = string.Empty;
        public string OfficeAddr { get; set; } = string.Empty;
        public string OfficeOwner { get; set; } = string.Empty;
    }
}
