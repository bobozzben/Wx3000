using System.Collections.Generic;

namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 5-7 碳健檢企業名單匯出：選擇客戶清單 (VFP wbase4000 的 tmpcust：選擇、公司編號、公司名稱)。
    /// Selected 是查詢結果的計算欄位 (一律 false)，不對應 customer.sel；勾選只存在前端
    /// </summary>
    public class CarbonCustomerDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool Selected { get; set; }
    }

    /// <summary>
    /// F8 轉出的計算條件 (VFP wbase5070：資料年度、營業起始月份、結束月份)。
    /// 轉檔列印密碼每次請求都要帶，只在後端比對
    /// </summary>
    public class CarbonSalesRequest
    {
        public string? Password { get; set; }
        /// <summary>民國年 1~3 位數字；資料目錄取補滿 3 碼後的末 2 碼 (VFP RIGHT(pyear,2))</summary>
        public string? Year { get; set; }
        public int StartMonth { get; set; } = 1;
        public int EndMonth { get; set; } = 12;
        /// <summary>要計算的客戶代號 (前端分批送出，每批最多 MaxBatch 筆)</summary>
        public List<string> Nos { get; set; } = new();
    }

    /// <summary>
    /// 匯出 Excel 的一列 (VFP oengfield：no,name,linkman,linktel,email,unino,addr,capital,t025,pnostd)。
    /// T025 是 &lt;資料磁碟機&gt;:\w3000\data\&lt;客戶代號&gt;\&lt;年&gt;\t403.dbf 在月份區間內 t025 (銷售額合計) 的加總，四捨五入到整數
    /// </summary>
    public class CarbonSalesRowDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Linkman { get; set; } = string.Empty;
        public string Linktel { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Unino { get; set; } = string.Empty;
        public string Addr { get; set; } = string.Empty;
        public decimal Capital { get; set; }
        public decimal T025 { get; set; }
        public string Pnostd { get; set; } = string.Empty;
        /// <summary>ok：已加總；nofile：該年度沒有 t403.dbf (VFP 以 0 計)；error：t403.dbf 讀取失敗 (以 0 計，前端會提示)</summary>
        public string Source { get; set; } = "ok";
        public string? Message { get; set; }
    }

    public class CarbonSalesResultDto
    {
        /// <summary>依請求的代號順序；不含已不在 customer 中的代號</summary>
        public List<CarbonSalesRowDto> Rows { get; set; } = new();
        /// <summary>勾選了但 customer 快照中已找不到的代號 (其他工作站已刪除)</summary>
        public List<string> Missing { get; set; } = new();
    }
}
