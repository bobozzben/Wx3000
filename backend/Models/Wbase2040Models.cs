using System.Collections.Generic;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 2-4 客戶收費資料輸入：收費單表頭 (recmom.dbf)
    /// 日期一律以 "yyyy-MM-dd" 字串傳遞，空日期為 ""
    /// </summary>
    public class FeeReceiptDto
    {
        public string Rno { get; set; } = string.Empty;
        public string Recdate { get; set; } = string.Empty;
        public string Cno { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        /// <summary>"*" = 明細全部已收 (整張單唯讀)，"" = 未收清</summary>
        public string Isover { get; set; } = string.Empty;
        public string Recman { get; set; } = string.Empty;
        public decimal Amt { get; set; }
        public decimal Tax { get; set; }
        public decimal Sum { get; set; }
        public decimal Notamt { get; set; }
        public string Note { get; set; } = string.Empty;
        /// <summary>收據摘要 (memo)；清單查詢不帶此欄以減少傳輸量</summary>
        public string? Memo { get; set; }
        public int RecordNumber { get; set; }
    }

    /// <summary>
    /// 收費明細 (recmod.dbf)。DBF 沒有唯一鍵，以 RecordNumber (= DBF RECNO) 搭配 Rno 定位
    /// </summary>
    public class FeeReceiptLineDto
    {
        public int RecordNumber { get; set; }
        public string Rno { get; set; } = string.Empty;
        public string Cno { get; set; } = string.Empty;
        public string Recdate { get; set; } = string.Empty;
        public decimal Money { get; set; }
        public string Isover { get; set; } = string.Empty;
        public string Itemno { get; set; } = string.Empty;
        public string Item { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
        public string Recman { get; set; } = string.Empty;
    }

    public class FeeReceiptDetailDto
    {
        public FeeReceiptDto Receipt { get; set; } = new();
        public List<FeeReceiptLineDto> Lines { get; set; } = new();
        /// <summary>非阻斷式提示 (例如查無客戶代號，簡稱未更新)</summary>
        public string? Warning { get; set; }
        /// <summary>明細異動後前端應停留的列 (新增明細時為新列的 RECNO)</summary>
        public int? FocusRecordNumber { get; set; }
    }

    /// <summary>表頭修改：欄位為 null 表示不修改</summary>
    public class FeeReceiptUpdateRequest
    {
        public string? Recdate { get; set; }
        public string? Cno { get; set; }
        public string? Recman { get; set; }
        public string? Note { get; set; }
        public string? Memo { get; set; }
    }

    public class FeeReceiptRenameRequest
    {
        public string NewRno { get; set; } = string.Empty;
    }

    /// <summary>明細修改：欄位為 null 表示不修改</summary>
    public class FeeReceiptLineUpdateRequest
    {
        public string? Itemno { get; set; }
        public string? Item { get; set; }
        public decimal? Money { get; set; }
        public string? Note { get; set; }
    }

    public class FeeSharedMemoDto
    {
        public string Memo { get; set; } = string.Empty;
    }

    /// <summary>F5 批次產生帳款收據 (VFP rec_all.scx)</summary>
    public class FeeReceiptBatchRequest
    {
        public string Recdate { get; set; } = string.Empty;
        /// <summary>帳款月份 (必填，放在項目名稱前，例如「3」)</summary>
        public string Month { get; set; } = string.Empty;
        /// <summary>帳款週期 (customer.rectime)，空白 = 不限</summary>
        public string Cycle { get; set; } = string.Empty;
        public string CnoFrom { get; set; } = string.Empty;
        public string CnoTo { get; set; } = string.Empty;
        /// <summary>同客戶同日期已有收費單時，仍要產生</summary>
        public bool Force { get; set; }
    }

    public class FeeReceiptBatchResult
    {
        public int Created { get; set; }
        public string FirstRno { get; set; } = string.Empty;
        public string LastRno { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class FeeCustomerLookupDto
    {
        public string No { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal Recamt { get; set; }
        public string Rectime { get; set; } = string.Empty;
    }

    /// <summary>F4 收據列印 / F6 請款單列印的資料列 (對應 VFP reccno.frx / recapy.frx 的暫存表)</summary>
    public class FeeReceiptPrintRow
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Addr { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        public string Tel { get; set; } = string.Empty;
        public string Fax { get; set; } = string.Empty;
        public string Linkman { get; set; } = string.Empty;
        public string Linktel { get; set; } = string.Empty;
        public string Bkaddr { get; set; } = string.Empty;
        public string Sbkaddr { get; set; } = string.Empty;
        public string Haddr { get; set; } = string.Empty;
        public string Invaddr { get; set; } = string.Empty;
        public string Cusmemo { get; set; } = string.Empty;
        /// <summary>單號；請款單的前期應收列為「yyy年mm月」</summary>
        public string Rno { get; set; } = string.Empty;
        public string Recdate { get; set; } = string.Empty;
        public string Recman { get; set; } = string.Empty;
        public decimal Amt { get; set; }
        /// <summary>表頭收據摘要 (recmom.memo)</summary>
        public string Mm { get; set; } = string.Empty;
        /// <summary>表頭註記 (recmom.note)</summary>
        public string Mmnote { get; set; } = string.Empty;
        /// <summary>共用說明 (recsmemo.memo)</summary>
        public string Doc { get; set; } = string.Empty;
        public string Itemno { get; set; } = string.Empty;
        public string Item { get; set; } = string.Empty;
        public decimal Money { get; set; }
        public string Note { get; set; } = string.Empty;
    }

    /// <summary>事務所資料 (base.dbf：000A 名稱、000B 統編、0001 地址、0002 電話、0003 傳真、0004 負責人)</summary>
    public class FeeOfficeInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string TaxNo { get; set; } = string.Empty;
        public string Addr { get; set; } = string.Empty;
        public string Tel { get; set; } = string.Empty;
        public string Fax { get; set; } = string.Empty;
        public string Boss { get; set; } = string.Empty;
    }

    public class FeeStatItemDto
    {
        public string Itemno { get; set; } = string.Empty;
        public string Item { get; set; } = string.Empty;
    }

    public class FeeStatRowDto
    {
        public string Cno { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public Dictionary<string, decimal> Amounts { get; set; } = new();
    }

    /// <summary>F9 收費統計表 (客戶 × 收費項目)</summary>
    public class FeeStatResultDto
    {
        public List<FeeStatItemDto> Items { get; set; } = new();
        public List<FeeStatRowDto> Rows { get; set; } = new();
    }
}
