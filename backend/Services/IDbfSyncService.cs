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

        /// <summary>寫入前的 DBF checksum (LocalAgent 在同一個隊列項目內讀取；舊版 LocalAgent 不回傳)</summary>
        [JsonPropertyName("checksumBefore")]
        public string? ChecksumBefore { get; set; }

        /// <summary>寫入後的 DBF checksum</summary>
        [JsonPropertyName("checksumAfter")]
        public string? ChecksumAfter { get; set; }

        /// <summary>寫入前後的差異超出這次寫入的範圍，代表同時有其他程式 (例如舊系統) 改了這個 DBF</summary>
        [JsonPropertyName("otherChanges")]
        public bool OtherChanges { get; set; } = true;

        /// <summary>
        /// 以 DbfWriteOptions.AutoNumber 新增時，VFP 在檔頭鎖內取到的號碼 (數值欄位為十進位字串)。
        /// 舊版 LocalAgent 不支援取號，此值為 null，DBF 寫入的是呼叫端放在 fields 裡的號碼。
        /// </summary>
        [JsonPropertyName("autoNumber")]
        public string? AutoNumber { get; set; }

        /// <summary>
        /// LOCK_TIMEOUT (記錄或檔案被其他工作站鎖定) 或 DUPLICATE_KEY (DBF 已有相同主鍵)：都是別的工作站造成的，控制器回 409
        /// </summary>
        [JsonIgnore]
        public bool IsConflict => ErrorType is "LOCK_TIMEOUT" or "DUPLICATE_KEY";

        /// <summary>取到的號碼；沒有取號 (或舊版 LocalAgent) 時回傳 fallback</summary>
        public decimal AutoNumberOr(decimal fallback) =>
            decimal.TryParse(AutoNumber, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var n) ? n : fallback;
    }

    /// <summary>
    /// INSERT 的防重複與取號：由 LocalAgent 在同一段 VFP 腳本內先鎖 DBF 檔頭，再檢查主鍵 / 取號後新增，
    /// 網頁之間與舊系統 (VFP) 的新增都會排隊，不會因 PostgreSQL 快照過期或多人同時新增而重複。
    /// </summary>
    public sealed class DbfWriteOptions
    {
        /// <summary>DBF 已有 keyField = keyValue 的記錄 (不含已刪除) 時不新增，回 ErrorType = DUPLICATE_KEY</summary>
        public bool Unique { get; init; }

        /// <summary>由 VFP 取號後新增，號碼回傳在 DbfWriteResult.AutoNumber</summary>
        public DbfAutoNumber? AutoNumber { get; init; }

        /// <summary>新增時要求主鍵不重複</summary>
        public static readonly DbfWriteOptions UniqueKey = new() { Unique = true };

        /// <summary>operation 為 INSERT 時要求主鍵不重複；UPDATE / DELETE 回傳 null (LocalAgent 不接受在 UPDATE / DELETE 使用)</summary>
        public static DbfWriteOptions? UniqueKeyIfInsert(string operation) =>
            string.Equals(operation, "INSERT", System.StringComparison.OrdinalIgnoreCase) ? UniqueKey : null;
    }

    /// <summary>
    /// 新增時取號：Field = MAX(Field) + 1 (只看未刪除且符合 ScopeField = ScopeValue 的記錄)；
    /// 有 Prefix 時 Field 為字元欄，號碼 = Prefix + 補零到 Width 位的 (MAX(VAL(去掉前綴的部分)) + 1)。
    /// 號碼同時寫入 AssignTo 列出的欄位。呼叫端仍要在 fields 放入自己算的號碼，給不支援取號的舊版 LocalAgent 使用。
    /// </summary>
    public sealed class DbfAutoNumber
    {
        [JsonPropertyName("field")]
        public string Field { get; init; } = string.Empty;

        [JsonPropertyName("assignTo")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string[]? AssignTo { get; init; }

        [JsonPropertyName("scopeField")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? ScopeField { get; init; }

        [JsonPropertyName("scopeValue")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? ScopeValue { get; init; }

        [JsonPropertyName("prefix")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Prefix { get; init; }

        [JsonPropertyName("width")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public int? Width { get; init; }
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
        /// 若遭其他工作站鎖定 (Lock Timeout) 立即回報失敗，絕不單邊寫入 PostgreSQL。
        /// INSERT 可帶 options 要求主鍵不重複 (DUPLICATE_KEY) 或由 VFP 取號 (AutoNumber)，見 DbfWriteOptions。
        /// </summary>
        Task<DbfWriteResult> WriteRecordAsync(string dbfPath, string dbfName, string operation, string keyField, string keyValue, Dictionary<string, object?> fields, DbfWriteOptions? options = null);

        /// <summary>
        /// 直接從地端 DBF 讀取指定主鍵之記錄
        /// </summary>
        Task<DbfReadResult> ReadRecordAsync(string dbfPath, string dbfName, string keyField, string keyValue, IEnumerable<string> fields);

        /// <summary>
        /// 更新 PostgreSQL dictionary.w3000_dbf 快照校驗碼 (無條件覆寫；寫入 DBF 後請改用 CommitWriteChecksumAsync)
        /// </summary>
        Task<bool> UpdateDictionaryChecksumAsync(string dbfPath, string dbfName, string checksum);

        /// <summary>
        /// 寫完 DBF 與 PostgreSQL 後呼叫：只有這個請求對該 DBF 的寫入前後串得起來 (每次寫入前的 checksum
        /// 等於上一次寫入後的 checksum)、寫入期間沒有其他程式改檔，而且字典記錄仍是第一次寫入前的 checksum 時，
        /// 才把字典更新為最後一次寫入後的 checksum。否則不更新，下次讀取會從 DBF 重灌快照。
        /// 回傳是否更新了字典。
        /// </summary>
        Task<bool> CommitWriteChecksumAsync(string dbfPath, string dbfName);

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
