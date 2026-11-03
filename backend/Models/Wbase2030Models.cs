using System.Collections.Generic;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 2-2 客戶資料匯出 / 2-3 客戶資料匯入：轉檔列印密碼
    /// </summary>
    public class TransferPasswordRequest
    {
        public string? Password { get; set; }
    }

    /// <summary>
    /// 匯出畫面的客戶清單。Selected 是查詢結果的計算欄位 (一律 false)，不對應 customer.sel；
    /// 勾選只存在前端，送出時只傳勾選的代號
    /// </summary>
    public class CustbakCustomerDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        public bool Selected { get; set; }
    }

    public class CustbakExportRequest
    {
        public string? Password { get; set; }
        public List<string> Nos { get; set; } = new();
    }

    /// <summary>匯出結果：custbak.dbf 以 Base64 傳回，前端存成下載檔</summary>
    public class CustbakExportResultDto
    {
        public string FileName { get; set; } = "custbak.dbf";
        public int Count { get; set; }
        /// <summary>勾選了但地端 customer.dbf 已找不到的代號 (快照之後被其他工作站刪除)</summary>
        public List<string> Missing { get; set; } = new();
        public string Content { get; set; } = string.Empty;
    }

    public class CustbakPreviewRowDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        /// <summary>customer 已有此代號：匯入時整筆覆蓋；否則新增</summary>
        public bool Exists { get; set; }
    }

    /// <summary>上傳 custbak.dbf 後的預覽；ImportId 是後端產生的 GUID (N 格式)，指向暫存的上傳檔</summary>
    public class CustbakPreviewResultDto
    {
        public string ImportId { get; set; } = string.Empty;
        public List<CustbakPreviewRowDto> Rows { get; set; } = new();
        /// <summary>customer 有、來源檔沒有的欄位：匯入後這些欄位會被清空 (與 VFP APPEND FROM 相同)</summary>
        public List<string> MissingFields { get; set; } = new();
        /// <summary>來源檔多出的欄位：匯入時忽略</summary>
        public List<string> ExtraFields { get; set; } = new();
    }

    public class CustbakImportRequest
    {
        public string? Password { get; set; }
        public string? ImportId { get; set; }
        public List<string> Nos { get; set; } = new();
    }

    public class CustbakImportFailureDto
    {
        public string No { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }

    public class CustbakImportResultDto
    {
        public int Inserted { get; set; }
        public int Updated { get; set; }
        public List<CustbakImportFailureDto> Failed { get; set; } = new();
        /// <summary>PostgreSQL 快照是否已重灌；false 時下次讀取客戶資料會再自動重灌</summary>
        public bool Synced { get; set; }
    }
}
