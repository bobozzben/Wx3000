using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    /// <summary>
    /// 2-2 客戶資料匯出 (VFP base20.prg wbasemenu02cmd02 → wbase2020) 與 2-3 客戶資料匯入 (wbasemenu02cmd03 → wbase2030)。
    /// 檔案一律是與 VFP 互通的 custbak.dbf (customer 結構、CP950)：匯出由 LocalAgent COPY TO 暫存檔後回傳給瀏覽器下載；
    /// 匯入先上傳到暫存目錄預覽，再由 LocalAgent 依代號新增或整筆覆蓋 customer.dbf，最後整表重灌 PostgreSQL 快照。
    /// 勾選狀態只存在前端，不讀也不寫 customer.sel；VFP 的 mopath.txt 不使用。
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase2030Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;
        private readonly ILogger<Wbase2030Controller> _logger;

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        private const string DbfName = "customer";
        private const string KeyField = "no";
        private const string CustbakFileName = "custbak.dbf";
        private const int NoBytes = 8; // customer.no C(8)
        private const long MaxUploadBytes = 20 * 1024 * 1024; // 373 筆約 1.4 MB
        private static readonly TimeSpan TempLifetime = TimeSpan.FromDays(1);
        private static string TempRoot => Path.Combine(Path.GetTempPath(), "Wx3000", "custbak");

        private static readonly Encoding Big5 = CreateBig5();

        private static Encoding CreateBig5()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(950);
        }

        public Wbase2030Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService, ILogger<Wbase2030Controller> logger)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
            _logger = logger;
        }

        // POST: api/wbase2030/verify-password (進入 2-2 / 2-3 前的轉檔列印密碼)
        [HttpPost("verify-password")]
        public IActionResult VerifyPassword([FromBody] TransferPasswordRequest req) =>
            Ok(new { ok = TransferPasswordService.Verify(DbfPath, req?.Password) });

        // GET: api/wbase2030/customers (2-2 匯出清單，依代號排序，全部未勾選)
        [HttpGet("customers")]
        public async Task<IActionResult> GetCustomers()
        {
            try
            {
                await SyncCustomerAsync();
                using var cmd = await CommandAsync();
                // 空白代號無法以代號匯出，也無法匯入 (VFP 以 no 為鍵)，不列出
                cmd.CommandText = $@"SELECT ""no"", ""name"", ""unino"" FROM ""{PgSchema}"".""customer"" WHERE TRIM(""no"") <> '' ORDER BY TRIM(""no"") COLLATE ""C"";";
                var list = new List<CustbakCustomerDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new CustbakCustomerDto { No = Str(reader, "no"), Name = Str(reader, "name"), Unino = Str(reader, "unino"), Selected = false });
                }
                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Wbase2030 讀取客戶清單失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取客戶資料失敗: " + ex.Message });
            }
        }

        // POST: api/wbase2030/export (F8 匯出資料)
        [HttpPost("export")]
        public async Task<IActionResult> Export([FromBody] CustbakExportRequest req)
        {
            if (!TransferPasswordService.Verify(DbfPath, req?.Password)) return WrongPassword();
            var nos = NormalizeNos(req!.Nos);
            if (nos.Count == 0) return BadRequest(new { message = "請先選擇要匯出的客戶" });
            var badNo = nos.FirstOrDefault(n => !IsValidNo(n));
            if (badNo != null) return BadRequest(new { message = $"不合法的客戶代號: {badNo}" });

            CleanupStaleTempDirs();
            var dir = CreateTempDir(Guid.NewGuid().ToString("N"));
            try
            {
                var target = Path.Combine(dir, CustbakFileName);
                var res = await _dbfSyncService.ExportCustbakAsync(DbfPath, nos, target);
                if (!res.Success) return AgentError(res, "匯出客戶資料");

                var bytes = await System.IO.File.ReadAllBytesAsync(target);
                var exported = ReadCustbak(bytes).Rows.Select(r => r.No).ToHashSet(StringComparer.Ordinal);
                if (exported.Count == 0)
                {
                    return Conflict(new { message = "勾選的客戶在地端客戶資料檔中都找不到，請重新進入後再試" });
                }
                return Ok(new CustbakExportResultDto
                {
                    FileName = CustbakFileName,
                    Count = exported.Count,
                    Missing = nos.Where(n => !exported.Contains(n)).ToList(),
                    Content = Convert.ToBase64String(bytes)
                });
            }
            catch (InvalidDataException ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "匯出客戶資料失敗：產生的檔案無法讀取 (" + ex.Message + ")" });
            }
            finally
            {
                TryDeleteDir(dir);
            }
        }

        // POST: api/wbase2030/import/preview (multipart：password、file；VFP 選目錄後讀 custbak.dbf)
        [HttpPost("import/preview")]
        [RequestSizeLimit(MaxUploadBytes + 64 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes + 64 * 1024)]
        public async Task<IActionResult> Preview([FromForm] string? password, IFormFile? file)
        {
            if (!TransferPasswordService.Verify(DbfPath, password)) return WrongPassword();
            if (file == null || file.Length == 0) return BadRequest(new { message = $"請選擇要匯入的 {CustbakFileName}" });
            if (file.Length > MaxUploadBytes) return BadRequest(new { message = $"檔案超過 {MaxUploadBytes / 1024 / 1024} MB，不是客戶資料匯出檔" });

            byte[] bytes;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms);
                bytes = ms.ToArray();
            }

            CustbakContent content;
            try
            {
                content = ReadCustbak(bytes);
            }
            catch (InvalidDataException ex)
            {
                return BadRequest(new { message = $"{file.FileName} 無法匯入：{ex.Message}" });
            }

            try
            {
                await SyncCustomerAsync();
                var (existingNos, customerFields) = await CustomerKeysAndFieldsAsync();

                CleanupStaleTempDirs();
                var importId = Guid.NewGuid().ToString("N");
                var dir = CreateTempDir(importId);
                await System.IO.File.WriteAllBytesAsync(Path.Combine(dir, CustbakFileName), bytes);

                var sourceFields = content.Fields.Select(f => f.ToLowerInvariant()).ToHashSet();
                foreach (var row in content.Rows) row.Exists = existingNos.Contains(row.No);
                return Ok(new CustbakPreviewResultDto
                {
                    ImportId = importId,
                    Rows = content.Rows,
                    // sel 不匯入 (保留 customer 原值)，來源缺 sel 也不會清空
                    MissingFields = customerFields.Where(f => f != "sel" && !sourceFields.Contains(f)).Select(f => f.ToUpperInvariant()).ToList(),
                    ExtraFields = content.Fields.Where(f => !customerFields.Contains(f.ToLowerInvariant())).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Wbase2030 匯入預覽失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取客戶資料失敗: " + ex.Message });
            }
        }

        // POST: api/wbase2030/import (F9 匯入資料)
        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] CustbakImportRequest req)
        {
            if (!TransferPasswordService.Verify(DbfPath, req?.Password)) return WrongPassword();
            var file = ImportFilePath(req!.ImportId);
            if (file == null || !System.IO.File.Exists(file)) return NotFound(new { message = "找不到上傳的匯入檔 (可能已逾時清除)，請重新選擇檔案" });
            var nos = NormalizeNos(req.Nos);
            if (nos.Count == 0) return BadRequest(new { message = "請先選擇要匯入的客戶" });

            var inFile = ReadCustbak(await System.IO.File.ReadAllBytesAsync(file)).Rows.Select(r => r.No).ToHashSet(StringComparer.Ordinal);
            var unknown = nos.Where(n => !inFile.Contains(n)).ToList();
            if (unknown.Count > 0) return BadRequest(new { message = "匯入檔中沒有這些客戶代號: " + string.Join(", ", unknown.Take(10)) });

            var res = await _dbfSyncService.ImportCustbakAsync(DbfPath, nos, file);
            // DBF 已改變 (含部分寫入) 時 checksum 不同，整表重灌讓 PostgreSQL 與 DBF 一致；不手動寫 PG、不直接更新 checksum
            var synced = await SyncCustomerAsync();

            if (!res.Success)
            {
                var (status, message) = DescribeAgentError(res, "匯入客戶資料", writes: true);
                return StatusCode(status, new { error = res.Error, message, inserted = res.Inserted, updated = res.Updated, synced });
            }

            TryDeleteDir(Path.GetDirectoryName(file)!);
            return Ok(new CustbakImportResultDto
            {
                Inserted = res.Inserted,
                Updated = res.Updated,
                Failed = res.Failed.Select(f => new CustbakImportFailureDto { No = f.Key, Reason = f.Reason }).ToList(),
                Synced = synced
            });
        }

        // DELETE: api/wbase2030/import/{importId} (離開 2-3 時清除上傳的暫存檔)
        [HttpDelete("import/{importId}")]
        public IActionResult DiscardImport(string importId)
        {
            var file = ImportFilePath(importId);
            if (file == null) return BadRequest(new { message = "不合法的匯入代碼" });
            TryDeleteDir(Path.GetDirectoryName(file)!);
            return NoContent();
        }

        // =========================================================================
        // custbak.dbf 解析
        // =========================================================================

        private sealed record CustbakContent(List<string> Fields, List<CustbakPreviewRowDto> Rows);

        /// <summary>
        /// 依表頭的欄位描述取欄 (custbak.dbf 的欄位順序可能和 customer 不同，VFP APPEND FROM 依欄名對應)；
        /// 略過已刪除記錄，代號不可空白、不可重複、不可超過 8 bytes。不合格時丟出 InvalidDataException，訊息可直接給使用者看
        /// </summary>
        private static CustbakContent ReadCustbak(byte[] bytes)
        {
            if (bytes.Length < 33) throw new InvalidDataException("不是 DBF 資料表");
            var version = bytes[0];
            if (version is 0x83 or 0x8B or 0xF5 || (version is 0x30 or 0x31 or 0x32 && (bytes[28] & 0x02) != 0))
            {
                throw new InvalidDataException("含備註 (memo) 欄位，不是客戶資料匯出檔");
            }
            if (version is not (0x03 or 0x30 or 0x31 or 0x32)) throw new InvalidDataException("不是 DBF 資料表");

            var recordCount = BitConverter.ToUInt32(bytes, 4);
            int headerLength = BitConverter.ToUInt16(bytes, 8);
            int recordLength = BitConverter.ToUInt16(bytes, 10);

            var fields = new List<(string Name, char Type, int Offset, int Length)>();
            var offset = 1; // 第一個 byte 是刪除旗標
            for (var pos = 32; ; pos += 32)
            {
                if (pos >= bytes.Length || pos >= headerLength) throw new InvalidDataException("DBF 表頭不完整");
                if (bytes[pos] == 0x0D) break;
                if (pos + 32 > bytes.Length) throw new InvalidDataException("DBF 表頭不完整");
                var name = Encoding.ASCII.GetString(bytes, pos, 11).Split('\0')[0].Trim().ToUpperInvariant();
                var type = (char)bytes[pos + 11];
                int length = bytes[pos + 16];
                if (type is 'M' or 'G' or 'W') throw new InvalidDataException("含備註 (memo) 欄位，不是客戶資料匯出檔");
                fields.Add((name, type, offset, length));
                offset += length;
            }
            if (offset != recordLength) throw new InvalidDataException("DBF 記錄長度與欄位定義不符");
            if (headerLength + (long)recordCount * recordLength > bytes.Length) throw new InvalidDataException("檔案不完整");

            var noField = fields.FirstOrDefault(f => f.Name == "NO");
            if (noField.Name == null || noField.Type != 'C') throw new InvalidDataException("沒有客戶代號 (NO) 欄位");
            var nameField = fields.FirstOrDefault(f => f.Name == "NAME" && f.Type == 'C');
            var uninoField = fields.FirstOrDefault(f => f.Name == "UNINO" && f.Type == 'C');

            string Read((string Name, char Type, int Offset, int Length) f, int start) =>
                f.Name == null ? string.Empty : Big5.GetString(bytes, start + f.Offset, f.Length).Trim();

            var rows = new List<CustbakPreviewRowDto>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i < recordCount; i++)
            {
                var start = headerLength + i * recordLength;
                if (bytes[start] == 0x2A) continue; // 已刪除
                var no = Read(noField, start);
                if (no.Length == 0) throw new InvalidDataException($"第 {i + 1} 筆的客戶代號空白");
                if (!IsValidNo(no)) throw new InvalidDataException($"第 {i + 1} 筆的客戶代號「{no}」不合法 (最多 {NoBytes} 碼)");
                if (!seen.Add(no)) throw new InvalidDataException($"客戶代號「{no}」重複");
                rows.Add(new CustbakPreviewRowDto { No = no, Name = Read(nameField, start), Unino = Read(uninoField, start) });
            }
            rows.Sort((a, b) => string.CompareOrdinal(a.No, b.No));
            return new CustbakContent(fields.Select(f => f.Name).ToList(), rows);
        }

        /// <summary>代號會寫進 LocalAgent 的代號清單 (以 | 分隔)，也必須放得進 customer.no C(8)</summary>
        private static bool IsValidNo(string no) =>
            no.Length > 0 && Big5.GetByteCount(no) <= NoBytes && !no.Contains('|') && !no.Any(char.IsControl);

        private static List<string> NormalizeNos(IEnumerable<string>? nos) =>
            (nos ?? Enumerable.Empty<string>()).Select(n => (n ?? string.Empty).Trim()).Where(n => n.Length > 0).Distinct(StringComparer.Ordinal).ToList();

        // =========================================================================
        // 暫存檔
        // =========================================================================

        private static string CreateTempDir(string id)
        {
            var dir = Path.Combine(TempRoot, id);
            Directory.CreateDirectory(dir);
            return dir;
        }

        /// <summary>importId 只接受後端產生的 GUID (N 格式)，避免被拿來組出任意路徑</summary>
        private static string? ImportFilePath(string? importId) =>
            Guid.TryParseExact(importId, "N", out _) ? Path.Combine(TempRoot, importId!, CustbakFileName) : null;

        private void TryDeleteDir(string dir)
        {
            try
            {
                if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Wbase2030 刪除暫存目錄失敗: {Dir}", dir);
            }
        }

        /// <summary>使用者沒按 Esc 就關掉瀏覽器時，上傳檔會留在暫存目錄；超過一天的一併清掉</summary>
        private void CleanupStaleTempDirs()
        {
            try
            {
                if (!Directory.Exists(TempRoot)) return;
                foreach (var dir in Directory.GetDirectories(TempRoot))
                {
                    if (Guid.TryParseExact(Path.GetFileName(dir), "N", out _) && DateTime.UtcNow - Directory.GetCreationTimeUtc(dir) > TempLifetime)
                    {
                        TryDeleteDir(dir);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Wbase2030 清理暫存目錄失敗");
            }
        }

        // =========================================================================
        // 共用
        // =========================================================================

        private Task<bool> SyncCustomerAsync() => _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, DbfName, KeyField);

        private async Task<(HashSet<string> Nos, HashSet<string> Fields)> CustomerKeysAndFieldsAsync()
        {
            var nos = new HashSet<string>(StringComparer.Ordinal);
            using (var cmd = await CommandAsync())
            {
                cmd.CommandText = $@"SELECT TRIM(""no"") FROM ""{PgSchema}"".""customer"";";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) if (!reader.IsDBNull(0)) nos.Add(reader.GetString(0));
            }

            // PostgreSQL 快照的欄位 = customer.dbf 欄位 (小寫) 加上 _record_number 等內部欄位
            var fields = new HashSet<string>(StringComparer.Ordinal);
            using (var cmd = await CommandAsync())
            {
                cmd.CommandText = @"SELECT column_name FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'customer';";
                var p = cmd.CreateParameter();
                p.ParameterName = "@schema";
                p.Value = PgSchema;
                cmd.Parameters.Add(p);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var name = reader.GetString(0).ToLowerInvariant();
                    if (!name.StartsWith('_')) fields.Add(name);
                }
            }
            return (nos, fields);
        }

        private ObjectResult WrongPassword() => StatusCode(StatusCodes.Status403Forbidden, new { message = "密碼錯誤!" });

        private static (int Status, string Message) DescribeAgentError(CustbakAgentResult res, string action, bool writes = false)
        {
            var partial = writes && res.Inserted + res.Updated > 0 ? $" (中斷前已新增 {res.Inserted} 筆、覆蓋 {res.Updated} 筆)" : "";
            return res.ErrorType switch
            {
                "LOCK_TIMEOUT" => (StatusCodes.Status409Conflict, $"{action}失敗：{res.Message ?? "客戶資料正被地端其他工作站使用中"}{partial}"),
                "INVALID_REQUEST" => (StatusCodes.Status400BadRequest, $"{action}失敗：{res.Error}"),
                "HTTP_EXCEPTION" => (StatusCodes.Status502BadGateway,
                    $"{action}失敗：{res.Message}{(writes ? " (若是逾時，資料可能已部分寫入，請重新查詢客戶資料確認)" : "")}"),
                _ => (StatusCodes.Status500InternalServerError, $"{action}失敗：地端 DBF {(writes ? "寫入" : "處理")}失敗: {res.Message ?? res.Error}{partial}")
            };
        }

        private ObjectResult AgentError(CustbakAgentResult res, string action)
        {
            var (status, message) = DescribeAgentError(res, action);
            return StatusCode(status, new { error = res.Error, message });
        }

        private async Task<DbCommand> CommandAsync()
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();
            return conn.CreateCommand();
        }

        private static string Str(DbDataReader r, string col) => r[col] == DBNull.Value ? string.Empty : r[col]?.ToString()?.Trim() ?? string.Empty;
    }
}
