using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Wx3000.Backend.Services
{
    public class DbfWriteResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("operation")]
        public string? Operation { get; set; }

        [JsonPropertyName("recno")]
        public int Recno { get; set; }

        [JsonPropertyName("errorType")]
        public string? ErrorType { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }

        [JsonPropertyName("elapsedMs")]
        public int ElapsedMs { get; set; }
    }

    public class DbfReadResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("found")]
        public bool Found { get; set; }

        [JsonPropertyName("recno")]
        public int Recno { get; set; }

        [JsonPropertyName("data")]
        public Dictionary<string, string>? Data { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        [JsonPropertyName("elapsedMs")]
        public int ElapsedMs { get; set; }
    }

    /// <summary>LocalAgent export_custbak / import_custbak 的回傳 (2-2 客戶資料匯出、2-3 客戶資料匯入)</summary>
    public class CustbakAgentResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("errorType")]
        public string? ErrorType { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }

        /// <summary>匯出筆數</summary>
        [JsonPropertyName("count")]
        public int Count { get; set; }

        [JsonPropertyName("inserted")]
        public int Inserted { get; set; }

        [JsonPropertyName("updated")]
        public int Updated { get; set; }

        /// <summary>匯入時逐筆失敗 (例如記錄被其他工作站鎖定)</summary>
        [JsonPropertyName("failed")]
        public List<CustbakAgentFailure> Failed { get; set; } = new();

        [JsonPropertyName("elapsedMs")]
        public int ElapsedMs { get; set; }
    }

    public class CustbakAgentFailure
    {
        [JsonPropertyName("key")]
        public string Key { get; set; } = string.Empty;

        [JsonPropertyName("reason")]
        public string Reason { get; set; } = string.Empty;
    }

    /// <summary>
    /// DBF 中主鍵重複的一組記錄 (快照只保留 RECNO 最小的一筆，也就是 VFP LOCATE / SEEK 會找到的那筆)
    /// </summary>
    public class DbfDuplicateKey
    {
        [JsonPropertyName("key")]
        public string Key { get; set; } = string.Empty;

        [JsonPropertyName("recordNumbers")]
        public List<int> RecordNumbers { get; set; } = new();
    }

    public interface IDbfSyncService
    {
        /// <summary>
        /// 測試 LocalAgent DBFBridge 連線狀態與 VFP COM 模組版本
        /// </summary>
        Task<bool> PingAsync();

        /// <summary>
        /// 取得 DBF 檔案 SHA256 校驗碼 (格式: SHA256:FileSize)
        /// </summary>
        Task<string?> GetChecksumAsync(string dbfPath, string dbfName);

        /// <summary>
        /// 確保 PostgreSQL 表格結構與資料快照與地端 DBF 同步 (Checksum 命中則略過，不一致則自動重灌)
        /// </summary>
        Task<bool> EnsureTableSyncedAsync(string dbfPath, string dbfName, string schema, string table, string keyFields, string hexFields = "");

        /// <summary>
        /// 依據 DBF 絕對權威原則，向地端 DBF 發動 INSERT / UPDATE / DELETE 寫入
        /// 若遭其他工作站鎖定 (Lock Timeout) 立即回報失敗，絕不單邊寫入 PostgreSQL
        /// </summary>
        Task<DbfWriteResult> WriteRecordAsync(string dbfPath, string dbfName, string operation, string keyField, string keyValue, Dictionary<string, object?> fields);

        /// <summary>
        /// 直接從地端 DBF 讀取指定主鍵之記錄
        /// </summary>
        Task<DbfReadResult> ReadRecordAsync(string dbfPath, string dbfName, string keyField, string keyValue, IEnumerable<string> fields);

        /// <summary>
        /// 更新 PostgreSQL dictionary.w3000_dbf 快照校驗碼
        /// </summary>
        Task<bool> UpdateDictionaryChecksumAsync(string dbfPath, string dbfName, string checksum);

        /// <summary>
        /// 取得最近一次快照重載時發現的主鍵重複記錄 (無重複時回傳空清單)
        /// </summary>
        Task<IReadOnlyList<DbfDuplicateKey>> GetDuplicateKeysAsync(string dbfPath, string dbfName);

        /// <summary>
        /// 由地端 customer.dbf 將指定客戶 COPY TO 新檔 targetFile (目的檔不可已存在)，輸出檔的 sel 填 "=>"，與 VFP 2-2 匯出檔相同
        /// </summary>
        Task<CustbakAgentResult> ExportCustbakAsync(string dbfPath, IEnumerable<string> keys, string targetFile);

        /// <summary>
        /// 將 sourceFile (custbak.dbf) 中指定的客戶依代號新增或整筆覆蓋到地端 customer.dbf，customer.sel 不覆蓋
        /// </summary>
        Task<CustbakAgentResult> ImportCustbakAsync(string dbfPath, IEnumerable<string> keys, string sourceFile);
    }
}
