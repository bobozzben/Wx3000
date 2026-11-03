using System.Collections.Generic;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 2-5 總分支機構設定：總機構列 (customer.dbf 中 tpay='1' 的客戶)
    /// Mediatype / T401 為依 VFP 規則算出的值 (t401 固定 'Y'、mediatype 由 tchk 決定)；DbMediatype / DbT401 為 DBF 原值，
    /// 兩者不同時前端離開畫面要回寫一次，對齊 VFP 關閉畫面時整批回寫的結果
    /// </summary>
    public class HqDto
    {
        public string No { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        public string Tpay { get; set; } = string.Empty;
        public string Tchk { get; set; } = string.Empty;
        public string Mediatype { get; set; } = string.Empty;
        public string T401 { get; set; } = string.Empty;
        public string Tzero { get; set; } = string.Empty;
        public string Tflog { get; set; } = string.Empty;
        public string Tnot { get; set; } = string.Empty;
        public string DbMediatype { get; set; } = string.Empty;
        public string DbT401 { get; set; } = string.Empty;
        public int RecordNumber { get; set; }
    }

    /// <summary>總機構列存檔 (VFP 回寫 tchk, mediatype, t401, tzero, tnot, tflog；mediatype 與 t401 由伺服器決定)</summary>
    public class HqUpdateRequest
    {
        public string? Tchk { get; set; }
        public string? Tzero { get; set; }
        public string? Tflog { get; set; }
        public string? Tnot { get; set; }
    }

    /// <summary>分支機構列 (mainunino = 總機構統編的客戶)；tpay 固定顯示 '2'、t401 固定 'Y'</summary>
    public class BranchDto
    {
        public string No { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        public string Tpay { get; set; } = string.Empty;
        public string Mediatype { get; set; } = string.Empty;
        public string T401 { get; set; } = string.Empty;
        public string Tzero { get; set; } = string.Empty;
        public string Tflog { get; set; } = string.Empty;
        public string Tnot { get; set; } = string.Empty;
        public string Mainunino { get; set; } = string.Empty;
        public int RecordNumber { get; set; }
    }

    public class BranchListDto
    {
        public HqDto Hq { get; set; } = new();
        public List<BranchDto> Branches { get; set; } = new();
    }

    /// <summary>
    /// 分支存檔的一列。OrigNo 為載入時的客戶代號：與 No 不同表示既有分支改了代號，存檔時要先清掉舊客戶的 mainunino。
    /// AllowMove 為 true 表示使用者已確認把掛在其他總機構下的客戶改掛到本總機構
    /// </summary>
    public class BranchSaveItem
    {
        public string? No { get; set; }
        public string? OrigNo { get; set; }
        public string? Mediatype { get; set; }
        public string? Tzero { get; set; }
        public string? Tflog { get; set; }
        public string? Tnot { get; set; }
        public bool AllowMove { get; set; }
    }

    public class BranchSaveRequest
    {
        public List<BranchSaveItem> Branches { get; set; } = new();
    }

    public class BranchSaveItemResult
    {
        public string No { get; set; } = string.Empty;
        public bool Success { get; set; }
        public string? ErrorType { get; set; }
        public string? Message { get; set; }
    }

    /// <summary>分支整批存檔結果：逐筆處理，遇到失敗記錄下來繼續下一筆；Branches 為存檔後重新讀出的分支清單</summary>
    public class BranchSaveResult
    {
        public bool Success { get; set; }
        public List<BranchSaveItemResult> Results { get; set; } = new();
        public List<BranchDto> Branches { get; set; } = new();
    }

    /// <summary>客戶選單與代號檢查 (VFP f2.Click 的 sele9：客戶代號／客戶名稱／統一編號)</summary>
    public class CustomerPickDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        public string Tpay { get; set; } = string.Empty;
        public string Mainunino { get; set; } = string.Empty;
        public string Tzero { get; set; } = string.Empty;
        public string Tnot { get; set; } = string.Empty;
        public string Tflog { get; set; } = string.Empty;
    }
}
