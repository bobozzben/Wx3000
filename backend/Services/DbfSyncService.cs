using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using Wx3000.Backend.Data;

namespace Wx3000.Backend.Services
{
    public class DbfSyncService : IDbfSyncService
    {
        private readonly HttpClient _http;
        private readonly AppDbContext _dbContext;
        private readonly ILogger<DbfSyncService> _logger;
        private readonly string _localAgentUrl;

        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        public DbfSyncService(
            HttpClient http,
            AppDbContext dbContext,
            ILogger<DbfSyncService> logger,
            IConfiguration config)
        {
            _http = http;
            _dbContext = dbContext;
            _logger = logger;
            _localAgentUrl = config["LocalAgent:Url"] ?? "http://localhost:5009";
            if (_http.BaseAddress == null)
            {
                _http.BaseAddress = new Uri(_localAgentUrl);
            }
        }

        public async Task<bool> PingAsync()
        {
            try
            {
                var resp = await _http.GetAsync("/api/dbf/ping");
                if (!resp.IsSuccessStatusCode) return false;
                var json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.TryGetProperty("success", out var prop) && prop.GetBoolean();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[DbfSync] Ping LocalAgent 失敗: {Message}", ex.Message);
                return false;
            }
        }

        public async Task<string?> GetChecksumAsync(string dbfPath, string dbfName)
        {
            try
            {
                var fullPath = Path.Combine(dbfPath, dbfName);
                if (!fullPath.EndsWith(".dbf", StringComparison.OrdinalIgnoreCase)) fullPath += ".dbf";
                var payload = new { filePath = fullPath, dbfPath, dbfName };
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var resp = await _http.PostAsync("/api/dbf/checksum", content);
                if (!resp.IsSuccessStatusCode) return null;

                var json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("success", out var prop) && prop.GetBoolean())
                {
                    if (doc.RootElement.TryGetProperty("checksum", out var cProp))
                    {
                        return cProp.GetString();
                    }
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DbfSync] 取得 Checksum 失敗 ({Path}/{Name}): {Message}", dbfPath, dbfName, ex.Message);
                return null;
            }
        }

        public async Task<bool> EnsureTableSyncedAsync(
            string dbfPath,
            string dbfName,
            string schema,
            string table,
            string keyFields,
            string hexFields = "")
        {
            var sw = Stopwatch.StartNew();
            try
            {
                var normPath = NormalizePath(dbfPath);
                var normDbf = NormalizeDbf(dbfName);

                // 1. 確保 dictionary.w3000_dbf 字典表存在
                await EnsureDictionaryTableExistsAsync();

                // 2. 從 LocalAgent 取得地端 DBF 即時 Checksum
                var currentDbfChecksum = await GetChecksumAsync(dbfPath, dbfName);
                if (string.IsNullOrEmpty(currentDbfChecksum))
                {
                    _logger.LogWarning("[DbfSync] 無法自 LocalAgent 取得 DBF 校驗碼 ({Path}/{Dbf})，維持既有快照。", dbfPath, dbfName);
                    return false;
                }

                // 3. 讀取 PostgreSQL 字典表已儲存的快照校驗碼
                var recordedChecksum = await GetRecordedChecksumAsync(normPath, normDbf);

                // 4. 若 Checksum 相符，表示地端 DBF 未有任何外部異動，直接放行 (Fast-path: ~2ms)
                if (!string.IsNullOrEmpty(recordedChecksum) &&
                    string.Equals(recordedChecksum.Trim(), currentDbfChecksum.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogDebug("[DbfSync] 表格 [{Schema}.{Table}] Checksum 吻合 ({Checksum})，略過快照重載 (耗時 {Elapsed}ms)",
                        schema, table, currentDbfChecksum, sw.ElapsedMilliseconds);
                    return true;
                }

                _logger.LogInformation("[DbfSync] 表格 [{Schema}.{Table}] Checksum 不一致 (PG: {Pg} vs DBF: {Dbf})，開始重載快照...",
                    schema, table, recordedChecksum ?? "無", currentDbfChecksum);

                // 5. 取得結構腳本 (確保 Schema、資料表與唯一鍵索引存在) 與全量資料腳本 (TRUNCATE + 全量批次 INSERT)
                var struScript = await GetPgScriptAsync(dbfPath, dbfName, "STRUCT", schema, table, keyFields, hexFields);
                var dataScript = await GetPgScriptAsync(dbfPath, dbfName, "DATA", schema, table, "", hexFields);
                if (!string.IsNullOrWhiteSpace(dataScript))
                {
                    // 防呆：FoxPro DBF 若有數值溢位欄位 (Numeric Overflow)，Data_to_PG_Script 會輸出 ****...
                    // 將 SQL VALUES 中未加引號的連續星號替換為 0，避免 PostgreSQL 42601 語法錯誤
                    dataScript = System.Text.RegularExpressions.Regex.Replace(
                        dataScript,
                        @"(?<=[\(,])\s*\*+\s*(?=[,\)])",
                        "0");
                }

                // 6. 在同一交易內重灌：任何一步失敗都整個回復，保留原本的快照
                var duplicates = new List<DbfDuplicateKey>();
                await using (var tx = await _dbContext.Database.BeginTransactionAsync())
                {
                    await ResetSnapshotAsync(schema, table);

                    if (!string.IsNullOrWhiteSpace(struScript))
                    {
                        await _dbContext.Database.ExecuteSqlRawAsync(struScript);
                    }

                    if (!string.IsNullOrWhiteSpace(dataScript))
                    {
                        await tx.CreateSavepointAsync("data");
                        try
                        {
                            await _dbContext.Database.ExecuteSqlRawAsync(dataScript);
                        }
                        catch (PostgresException pex) when (pex.SqlState == PostgresErrorCodes.UniqueViolation && !string.IsNullOrWhiteSpace(keyFields))
                        {
                            // DBF 沒有唯一限制，主鍵重複時整批 INSERT 會失敗；
                            // 改為每個主鍵只保留 RECNO 最小的一筆 (與 VFP LOCATE / SEEK 找到的記錄一致)，並記下重複的主鍵
                            await tx.RollbackToSavepointAsync("data");
                            duplicates = await ReloadKeepingFirstAsync(schema, table, keyFields, dataScript);
                            _logger.LogWarning("[DbfSync] 表格 [{Schema}.{Table}] DBF 主鍵 ({Keys}) 重複，快照只保留 RECNO 最小的一筆: {Duplicates}",
                                schema, table, keyFields,
                                string.Join("; ", duplicates.Select(d => $"{d.Key} (#{string.Join(",#", d.RecordNumbers)})")));
                        }
                    }

                    await tx.CommitAsync();
                }

                // 7. 更新字典表記錄
                await UpdateDictionaryChecksumAsync(normPath, normDbf, currentDbfChecksum);
                await SaveDuplicateKeysAsync(normPath, normDbf, duplicates);

                sw.Stop();
                _logger.LogInformation("[DbfSync] 表格 [{Schema}.{Table}] 快照重載完成，耗時 {Elapsed}ms",
                    schema, table, sw.ElapsedMilliseconds);
                return true;
            }
            catch (Exception ex)
            {
                sw.Stop();
                _logger.LogError(ex, "[DbfSync] 表格 [{Schema}.{Table}] 快照同步失敗: {Message}", schema, table, ex.Message);
                return false;
            }
        }

        public async Task<DbfWriteResult> WriteRecordAsync(
            string dbfPath,
            string dbfName,
            string operation,
            string keyField,
            string keyValue,
            Dictionary<string, object?> fields)
        {
            var sw = Stopwatch.StartNew();
            try
            {
                var payload = new
                {
                    dbfPath,
                    dbfName,
                    operation = operation.ToUpperInvariant(),
                    keyField,
                    keyValue,
                    fields
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var resp = await _http.PostAsync("/api/dbf/write", content);
                var json = await resp.Content.ReadAsStringAsync();

                var result = JsonSerializer.Deserialize<DbfWriteResult>(json, JsonOptions);
                if (result == null)
                {
                    return new DbfWriteResult
                    {
                        Success = false,
                        ErrorType = "EMPTY_RESPONSE",
                        Error = "LocalAgent 回傳空字串"
                    };
                }

                return result;
            }
            catch (Exception ex)
            {
                sw.Stop();
                _logger.LogError(ex, "[DbfSync] 寫入 DBF 發生例外 ({Path}/{Dbf}): {Message}", dbfPath, dbfName, ex.Message);
                return new DbfWriteResult
                {
                    Success = false,
                    ErrorType = "HTTP_EXCEPTION",
                    Error = ex.Message,
                    Message = "連線至地端 LocalAgent 失敗: " + ex.Message
                };
            }
        }

        public async Task<DbfReadResult> ReadRecordAsync(
            string dbfPath,
            string dbfName,
            string keyField,
            string keyValue,
            IEnumerable<string> fields)
        {
            try
            {
                var payload = new
                {
                    dbfPath,
                    dbfName,
                    keyField,
                    keyValue,
                    fields
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var resp = await _http.PostAsync("/api/dbf/read", content);
                var json = await resp.Content.ReadAsStringAsync();

                var result = JsonSerializer.Deserialize<DbfReadResult>(json, JsonOptions);
                return result ?? new DbfReadResult { Success = false, Error = "LocalAgent 回傳空回應" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DbfSync] 讀取 DBF 發生例外: {Message}", ex.Message);
                return new DbfReadResult { Success = false, Error = ex.Message };
            }
        }

        public async Task<bool> UpdateDictionaryChecksumAsync(string dbfPath, string dbfName, string checksum)
        {
            try
            {
                var normPath = NormalizePath(dbfPath);
                var normDbf = NormalizeDbf(dbfName);

                await EnsureDictionaryTableExistsAsync();

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    INSERT INTO dictionary.w3000_dbf (path, dbf, checksum)
                    VALUES (@p, @d, @c)
                    ON CONFLICT (path, dbf) DO UPDATE SET checksum = EXCLUDED.checksum;
                ";

                var p1 = cmd.CreateParameter(); p1.ParameterName = "@p"; p1.Value = normPath; cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@d"; p2.Value = normDbf; cmd.Parameters.Add(p2);
                var p3 = cmd.CreateParameter(); p3.ParameterName = "@c"; p3.Value = checksum; cmd.Parameters.Add(p3);

                await cmd.ExecuteNonQueryAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DbfSync] 更新 Checksum 字典表失敗: {Message}", ex.Message);
                return false;
            }
        }

        public Task<CustbakAgentResult> ExportCustbakAsync(string dbfPath, IEnumerable<string> keys, string targetFile) =>
            PostCustbakAsync("/api/dbf/export_custbak", new { dbfPath, keys, targetFile });

        public Task<CustbakAgentResult> ImportCustbakAsync(string dbfPath, IEnumerable<string> keys, string sourceFile) =>
            PostCustbakAsync("/api/dbf/import_custbak", new { dbfPath, keys, sourceFile });

        private async Task<CustbakAgentResult> PostCustbakAsync(string endpoint, object payload)
        {
            try
            {
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var resp = await _http.PostAsync(endpoint, content);
                var json = await resp.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<CustbakAgentResult>(json, JsonOptions)
                    ?? new CustbakAgentResult { Success = false, ErrorType = "EMPTY_RESPONSE", Error = "LocalAgent 回傳空字串" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DbfSync] {Endpoint} 發生例外: {Message}", endpoint, ex.Message);
                return new CustbakAgentResult
                {
                    Success = false,
                    ErrorType = "HTTP_EXCEPTION",
                    Error = ex.Message,
                    Message = "連線至地端 LocalAgent 失敗: " + ex.Message
                };
            }
        }

        public async Task<IReadOnlyList<DbfDuplicateKey>> GetDuplicateKeysAsync(string dbfPath, string dbfName)
        {
            try
            {
                await EnsureDictionaryTableExistsAsync();

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT dup_keys FROM dictionary.w3000_dbf_dupkey WHERE path = @p AND dbf = @d;";
                var p1 = cmd.CreateParameter(); p1.ParameterName = "@p"; p1.Value = NormalizePath(dbfPath); cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@d"; p2.Value = NormalizeDbf(dbfName); cmd.Parameters.Add(p2);

                var json = (await cmd.ExecuteScalarAsync()) as string;
                if (string.IsNullOrWhiteSpace(json)) return Array.Empty<DbfDuplicateKey>();
                return JsonSerializer.Deserialize<List<DbfDuplicateKey>>(json, JsonOptions) ?? new List<DbfDuplicateKey>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DbfSync] 讀取重複主鍵記錄失敗 ({Path}/{Name}): {Message}", dbfPath, dbfName, ex.Message);
                return Array.Empty<DbfDuplicateKey>();
            }
        }

        /// <summary>
        /// 先把資料腳本灌進沒有唯一索引的暫存表，找出重複主鍵，再以每個主鍵 RECNO 最小的一筆覆蓋正式快照 (同一交易)
        /// </summary>
        private async Task<List<DbfDuplicateKey>> ReloadKeepingFirstAsync(string schema, string table, string keyFields, string dataScript)
        {
            var target = QuoteIdent(schema) + "." + QuoteIdent(table);
            if (!dataScript.Contains(target))
            {
                throw new InvalidOperationException($"資料腳本中找不到 {target}，無法改以去除重複主鍵的方式重載");
            }

            const string stage = "\"_wx_dbf_stage\"";
            var keys = keyFields.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(QuoteIdent).ToList();
            var keyList = string.Join(", ", keys);
            var keyText = string.Join(" || ',' || ", keys.Select(k => $"TRIM({k}::text)"));

            // 在呼叫端 (EnsureTableSyncedAsync) 的重灌交易內執行
            var conn = _dbContext.Database.GetDbConnection();
            var tx = _dbContext.Database.CurrentTransaction?.GetDbTransaction()
                ?? throw new InvalidOperationException("去除重複主鍵的重載必須在重灌交易內執行");

            async Task ExecAsync(string sql)
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = sql;
                await cmd.ExecuteNonQueryAsync();
            }

            await ExecAsync($"CREATE TEMP TABLE {stage} (LIKE {target} INCLUDING DEFAULTS) ON COMMIT DROP;");
            await ExecAsync(dataScript.Replace(target, stage));

            var duplicates = new List<DbfDuplicateKey>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = $@"SELECT {keyText}, string_agg(""_record_number""::text, ',' ORDER BY ""_record_number"")
                    FROM {stage} GROUP BY {keyList} HAVING COUNT(*) > 1 ORDER BY MIN(""_record_number"");";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    duplicates.Add(new DbfDuplicateKey
                    {
                        Key = reader.GetString(0),
                        RecordNumbers = reader.GetString(1).Split(',').Select(int.Parse).ToList()
                    });
                }
            }

            await ExecAsync($@"TRUNCATE TABLE {target};
                INSERT INTO {target} SELECT DISTINCT ON ({keyList}) * FROM {stage} ORDER BY {keyList}, ""_record_number"";");
            return duplicates;
        }

        /// <summary>
        /// 重灌前清空快照，並移除結構腳本先前建立的唯一索引 (ux_ 開頭)，讓這次的結構腳本在空表上依本次 keyFields 重建。
        /// 同一張 DBF 可能被不同畫面以不同 keyFields 同步 (例如 customer 有的以 no、有的不設唯一鍵)；
        /// 舊快照若留有重複主鍵，CREATE UNIQUE INDEX 會失敗，快照就會永遠停在舊版。
        /// </summary>
        private async Task ResetSnapshotAsync(string schema, string table)
        {
            var conn = _dbContext.Database.GetDbConnection();
            var tx = _dbContext.Database.CurrentTransaction?.GetDbTransaction();
            var target = QuoteIdent(schema) + "." + QuoteIdent(table);

            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = "SELECT to_regclass(@t) IS NOT NULL;";
                var p = cmd.CreateParameter(); p.ParameterName = "@t"; p.Value = target; cmd.Parameters.Add(p);
                if (!(bool)(await cmd.ExecuteScalarAsync())!) return;
            }

            var indexes = new List<string>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = @"SELECT indexname FROM pg_indexes WHERE schemaname = @s AND tablename = @t AND indexname LIKE 'ux\_%';";
                var p1 = cmd.CreateParameter(); p1.ParameterName = "@s"; p1.Value = schema; cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@t"; p2.Value = table; cmd.Parameters.Add(p2);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) indexes.Add(reader.GetString(0));
            }

            var sql = new StringBuilder($"TRUNCATE TABLE {target};");
            foreach (var index in indexes)
            {
                sql.Append($" DROP INDEX IF EXISTS {QuoteIdent(schema)}.{QuoteIdent(index)};");
            }

            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = sql.ToString();
                await cmd.ExecuteNonQueryAsync();
            }
        }

        private async Task SaveDuplicateKeysAsync(string normPath, string normDbf, List<DbfDuplicateKey> duplicates)
        {
            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = duplicates.Count == 0
                ? "DELETE FROM dictionary.w3000_dbf_dupkey WHERE path = @p AND dbf = @d;"
                : @"INSERT INTO dictionary.w3000_dbf_dupkey (path, dbf, dup_keys) VALUES (@p, @d, @k)
                    ON CONFLICT (path, dbf) DO UPDATE SET dup_keys = EXCLUDED.dup_keys;";

            var p1 = cmd.CreateParameter(); p1.ParameterName = "@p"; p1.Value = normPath; cmd.Parameters.Add(p1);
            var p2 = cmd.CreateParameter(); p2.ParameterName = "@d"; p2.Value = normDbf; cmd.Parameters.Add(p2);
            var p3 = cmd.CreateParameter(); p3.ParameterName = "@k"; p3.Value = JsonSerializer.Serialize(duplicates); cmd.Parameters.Add(p3);

            await cmd.ExecuteNonQueryAsync();
        }

        private static string QuoteIdent(string name) => "\"" + name.Replace("\"", "\"\"") + "\"";

        private async Task<string> GetPgScriptAsync(
            string dbfPath,
            string dbfName,
            string mode,
            string schema,
            string table,
            string keyFields,
            string hexFields = "")
        {
            var payload = new
            {
                dbfPath,
                dbfName,
                mode,
                schema,
                table,
                keyFields,
                hexFields
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await _http.PostAsync("/api/dbf/get_pg_script", content);
            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"LocalAgent get_pg_script 回傳錯誤: {err}");
            }

            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("script", out var sProp))
            {
                return sProp.GetString() ?? string.Empty;
            }

            return string.Empty;
        }

        private async Task<string?> GetRecordedChecksumAsync(string normPath, string normDbf)
        {
            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT checksum FROM dictionary.w3000_dbf WHERE path = @p AND dbf = @d;";

            var p1 = cmd.CreateParameter(); p1.ParameterName = "@p"; p1.Value = normPath; cmd.Parameters.Add(p1);
            var p2 = cmd.CreateParameter(); p2.ParameterName = "@d"; p2.Value = normDbf; cmd.Parameters.Add(p2);

            var obj = await cmd.ExecuteScalarAsync();
            return obj?.ToString();
        }

        private async Task EnsureDictionaryTableExistsAsync()
        {
            await _dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE SCHEMA IF NOT EXISTS ""dictionary"";
                CREATE TABLE IF NOT EXISTS ""dictionary"".""w3000_dbf"" (
                    path character varying(255) NOT NULL DEFAULT '',
                    dbf character varying(255) NOT NULL DEFAULT '',
                    checksum character varying(255) NOT NULL DEFAULT '',
                    PRIMARY KEY (path, dbf)
                );
                CREATE TABLE IF NOT EXISTS ""dictionary"".""w3000_dbf_dupkey"" (
                    path character varying(255) NOT NULL DEFAULT '',
                    dbf character varying(255) NOT NULL DEFAULT '',
                    dup_keys text NOT NULL DEFAULT '',
                    PRIMARY KEY (path, dbf)
                );
            ");
        }

        private static string NormalizePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return "";
            var p = path.Trim().ToLower().Replace('/', '\\');
            if (!p.EndsWith('\\')) p += "\\";
            return p;
        }

        private static string NormalizeDbf(string dbf)
        {
            if (string.IsNullOrWhiteSpace(dbf)) return "";
            var name = Path.GetFileNameWithoutExtension(dbf).Trim().ToLower();
            return name;
        }
    }
}
