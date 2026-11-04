using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1060Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "recitem";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "recitem";
        private const string KeyField = "itemno";

        // recitem.itemno 為 C(4)，超過的部分會被 VFP 截斷，可能撞到既有代號
        private const int ItemnoBytes = 4;

        // 收費明細 recmod.dbf 沒有唯一鍵，以 RECNO() 搭配 rno 與舊代號定位；VFP PACK 讓 RECNO 重排時回 RECORD_NOT_FOUND 而不是改錯列
        private const string RecmodTable = "recmod";
        private const string RecmodKeyField = "RECNO(),rno,itemno";

        private static readonly Encoding Big5 = CreateBig5();

        public Wbase1060Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // GET: api/wbase1060?keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> GetList([FromQuery] string? keyword)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(f =>
                        f.FeeCode.ToLower().Contains(kw) ||
                        f.FeeName.ToLower().Contains(kw)
                    );
                }

                var rawList = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                var list = rawList.Select(f => new FeeItemMaster
                {
                    FeeCode = f.FeeCode?.Trim() ?? string.Empty,
                    FeeName = f.FeeName?.Trim() ?? string.Empty,
                    Price = f.Price,
                    Guid = f.Guid?.Trim() ?? string.Empty,
                    RecordNumber = f.RecordNumber
                }).ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1060 GetList error: {ex.Message}");
                return Ok(new List<FeeItemMaster>());
            }
        }

        // GET: api/wbase1060/duplicates
        // 地端 recitem.dbf 代號重複的記錄；快照每個代號只保留 RECNO 最小的一筆，其餘需在地端清理
        [HttpGet("duplicates")]
        public async Task<ActionResult<IReadOnlyList<DbfDuplicateKey>>> GetDuplicates()
        {
            await SyncAsync();
            return Ok(await _dbfSyncService.GetDuplicateKeysAsync(DbfPath, DbfName));
        }

        // GET: api/wbase1060/{feeCode}
        [HttpGet("{feeCode}")]
        public async Task<ActionResult<FeeItemMaster>> GetByCode(string feeCode)
        {
            if (string.IsNullOrWhiteSpace(feeCode)) return BadRequest("代號不可為空");

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

            var targetCode = feeCode.Trim().ToUpper();
            var item = await _context.FeeItemMasters.FirstOrDefaultAsync(f => f.FeeCode.Trim() == targetCode);
            if (item == null)
            {
                return NotFound(new { message = $"找不到代號為 '{feeCode}' 的收費項目" });
            }

            item.FeeCode = item.FeeCode.Trim();
            item.FeeName = item.FeeName?.Trim() ?? string.Empty;
            item.Guid = item.Guid?.Trim() ?? string.Empty;

            return Ok(item);
        }

        // POST: api/wbase1060
        // 只新增；代號已存在時比照 VFP recitem.scx 回「項目代號重複」，不覆蓋既有項目
        [HttpPost]
        public async Task<ActionResult<FeeItemMaster>> Create([FromBody] FeeItemMaster model)
        {
            if (model == null || (string.IsNullOrWhiteSpace(model.FeeCode) && string.IsNullOrWhiteSpace(model.ItemNo)))
            {
                return BadRequest(new { message = "收費項目代號不得為空" });
            }

            var rawCode = !string.IsNullOrWhiteSpace(model.FeeCode) ? model.FeeCode : model.ItemNo;
            var code = rawCode.Trim().ToUpper();
            var invalid = ValidateCode(code);
            if (invalid != null) return BadRequest(new { message = invalid });
            NormalizeModel(model);

            // 先以 DBF 最新內容重灌快照再判斷是否存在；快照過期時直接查 PG 會把已存在的代號再 INSERT 一次
            if (!await SyncAsync()) return SyncUnavailable();
            if (await FindAsync(code) != null)
            {
                return Conflict(new { message = $"項目代號重複：[{code}] 已存在" });
            }

            var error = await InsertAsync(code, model);
            if (error != null) return error;
            return CreatedAtAction(nameof(GetByCode), new { feeCode = code }, model);
        }

        // PUT: api/wbase1060/{feeCode}
        // {feeCode} 為目前 (修改前) 的代號；body 的 itemno 與其不同時視為修改代號，比照 VFP recitem.scx #5885 連動 recmod
        // {feeCode} 不存在且代號未修改時新增 (Grid 新增列以 PUT 存檔)
        [HttpPut("{feeCode}")]
        public async Task<IActionResult> Update(string feeCode, [FromBody] FeeItemMaster model)
        {
            if (string.IsNullOrWhiteSpace(feeCode)) return BadRequest("代號不可為空");

            var oldCode = feeCode.Trim().ToUpper();
            var rawCode = !string.IsNullOrWhiteSpace(model.FeeCode) ? model.FeeCode : model.ItemNo;
            var newCode = string.IsNullOrWhiteSpace(rawCode) ? oldCode : rawCode.Trim().ToUpper();
            var invalid = ValidateCode(newCode);
            if (invalid != null) return BadRequest(new { message = invalid });
            NormalizeModel(model);

            if (!await SyncAsync()) return SyncUnavailable();
            var existing = await FindAsync(oldCode);

            if (existing == null)
            {
                if (newCode != oldCode)
                {
                    return NotFound(new { message = $"找不到欲修改代號的收費項目 [{oldCode}]，請重新整理後再試" });
                }
                return (IActionResult?)await InsertAsync(newCode, model) ?? Ok(model);
            }

            if (newCode != oldCode)
            {
                return await RenameAsync(existing, oldCode, newCode, model);
            }

            // DBF 絕對權威！先寫 DBF
            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "UPDATE", KeyField, oldCode, RecitemFields(oldCode, model));
            if (!dbfResult.Success) return DbfError(dbfResult, "存檔");

            // DBF 成功後才寫入 PostgreSQL
            existing.FeeName = model.FeeName;
            existing.Price = model.Price;
            existing.Guid = model.Guid;
            if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;
            await AfterDbfWriteAsync(() => _context.SaveChangesAsync());

            return Ok(existing);
        }

        // DELETE: api/wbase1060/{feeCode}
        [HttpDelete("{feeCode}")]
        public async Task<IActionResult> Delete(string feeCode)
        {
            if (string.IsNullOrWhiteSpace(feeCode)) return BadRequest("代號不可為空");

            var targetCode = feeCode.Trim().ToUpper();
            if (!await SyncAsync()) return SyncUnavailable();
            var existing = await FindAsync(targetCode);
            if (existing == null)
            {
                return NotFound(new { message = $"欲刪除的收費項目 [{targetCode}] 不存在" });
            }

            // 1. 核心原則：DBF 絕對權威！先刪除 DBF
            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "DELETE", KeyField, targetCode, new Dictionary<string, object?>());
            if (!dbfResult.Success) return DbfError(dbfResult, "刪除");

            // 2. DBF 成功刪除後才刪除 PostgreSQL
            await AfterDbfWriteAsync(async () =>
            {
                _context.FeeItemMasters.Remove(existing);
                await _context.SaveChangesAsync();
            });

            return Ok(new { message = "刪除成功" });
        }

        // POST: api/wbase1060/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<FeeItemMaster> list)
        {
            if (list == null) return BadRequest(new { message = "無效的提交資料" });

            var validItems = list
                .Where(x => !string.IsNullOrWhiteSpace(x.FeeCode))
                .Select(x => new FeeItemMaster
                {
                    FeeCode = x.FeeCode.Trim().ToUpper(),
                    FeeName = x.FeeName?.Trim() ?? string.Empty,
                    Price = x.Price,
                    Guid = string.IsNullOrWhiteSpace(x.Guid) ? Guid.NewGuid().ToString("N").ToUpper() : x.Guid.Trim(),
                }).ToList();

            var invalid = validItems.Select(x => ValidateCode(x.FeeCode)).FirstOrDefault(m => m != null);
            if (invalid != null) return BadRequest(new { message = invalid });

            // 同一代號出現兩次時，兩筆都會被當成新增寫進 DBF
            var repeated = validItems.GroupBy(x => x.FeeCode).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
            if (repeated.Count > 0)
            {
                return BadRequest(new { message = $"項目代號重複：{string.Join("、", repeated)}" });
            }

            if (!await SyncAsync()) return SyncUnavailable();
            var existingCodes = (await _context.FeeItemMasters.AsNoTracking().Select(f => f.FeeCode.Trim()).ToListAsync()).ToHashSet();

            // 依序寫入 DBF (DBF 絕對權威)；中途失敗時不更新 Checksum，下次讀取會依 DBF 重灌快照
            foreach (var item in validItems)
            {
                var op = existingCodes.Contains(item.FeeCode) ? "UPDATE" : "INSERT";
                var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, op, KeyField, item.FeeCode, RecitemFields(item.FeeCode, item), DbfWriteOptions.UniqueKeyIfInsert(op));
                if (!dbfRes.Success)
                {
                    if (dbfRes.IsConflict)
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfRes.Error,
                            message = dbfRes.ErrorType == "DUPLICATE_KEY"
                                ? $"項目 [{item.FeeCode}] 已被其他工作站新增，批次存檔取消，請重新整理後再試"
                                : $"項目 [{item.FeeCode}] 正被地端其他工作站編輯中，批次存檔取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfRes.Error,
                        message = $"地端 DBF 寫入失敗 [{item.FeeCode}]: " + (dbfRes.Message ?? dbfRes.Error)
                    });
                }
            }

            // 以 DBF 重灌快照；不可用送來的清單整批覆蓋 PG，清單外 (例如被關鍵字篩掉) 的項目會從快照消失
            await SyncAsync();

            return Ok(new { message = "批次儲存成功", count = validItems.Count });
        }

        public class PrintRangeQuery
        {
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase1060/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim().ToUpper();
                    queryable = queryable.Where(f => f.FeeCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim().ToUpper();
                    queryable = queryable.Where(f => f.FeeCode.Trim().CompareTo(end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1060 Print error: {ex.Message}");
                return Ok(new List<FeeItemMaster>());
            }
        }

        // GET: api/wbase1060/print-preview?codeStart=xxx&codeEnd=yyy
        [HttpGet("print-preview")]
        public async Task<ActionResult<IEnumerable<FeeItemMaster>>> GetPrintPreview([FromQuery] string? codeStart, [FromQuery] string? codeEnd)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var queryable = _context.FeeItemMasters.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(codeStart))
                {
                    queryable = queryable.Where(f => string.Compare(f.FeeCode, codeStart.Trim().ToUpper()) >= 0);
                }
                if (!string.IsNullOrWhiteSpace(codeEnd))
                {
                    queryable = queryable.Where(f => string.Compare(f.FeeCode, codeEnd.Trim().ToUpper()) <= 0);
                }

                var list = await queryable.OrderBy(f => f.FeeCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得預覽資料失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 比照 VFP recitem.scx itemno.Valid：新代號已存在回「項目代號重複」；
        /// 否則先把 recmod 的舊代號改成新代號 (#5885)，再改 recitem 本身。中途失敗時舊代號仍在，重試會接續完成。
        /// </summary>
        private async Task<IActionResult> RenameAsync(FeeItemMaster existing, string oldCode, string newCode, FeeItemMaster model)
        {
            if (await FindAsync(newCode) != null)
            {
                return Conflict(new { message = $"項目代號重複：[{newCode}] 已存在" });
            }

            if (!await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, RecmodTable, PgSchema, RecmodTable, ""))
            {
                return SyncUnavailable();
            }
            var lines = await RecmodLinesAsync(oldCode);
            var linesPgOk = true;
            for (var i = 0; i < lines.Count; i++)
            {
                var (recno, rno) = lines[i];
                var lineFields = new Dictionary<string, object?> { ["itemno"] = newCode };
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, RecmodTable, "UPDATE", RecmodKeyField, $"{recno},{rno},{oldCode}", lineFields);
                if (!res.Success)
                {
                    return DbfError(res, $"收費明細代號連動 (第 {i + 1}/{lines.Count} 筆，前 {i} 筆已改為 [{newCode}]，請重新整理後再試)");
                }
                linesPgOk &= await TryPgAsync(RecmodTable, () => ExecPgAsync(
                    $@"UPDATE ""{PgSchema}"".""{RecmodTable}"" SET ""itemno"" = @new WHERE ""_record_number"" = @rec;",
                    ("@new", newCode), ("@rec", recno)));
            }
            if (lines.Count > 0 && linesPgOk) await RefreshChecksumAsync(RecmodTable);

            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "UPDATE", KeyField, oldCode, RecitemFields(newCode, model));
            if (!dbfResult.Success)
            {
                var done = lines.Count > 0 ? $"，收費明細 {lines.Count} 筆已改為 [{newCode}]，請重新整理後再試" : string.Empty;
                return DbfError(dbfResult, $"修改收費項目代號{done}");
            }

            var recordNumber = dbfResult.Recno > 0 ? dbfResult.Recno : existing.RecordNumber;
            // EF 不能修改追蹤中實體的主鍵，改以 SQL 更新
            await AfterDbfWriteAsync(() => ExecPgAsync(
                $@"UPDATE ""{PgSchema}"".""{PgTable}"" SET ""itemno"" = @new, ""item"" = @item, ""amt"" = @amt WHERE TRIM(""itemno"") = @old;",
                ("@new", newCode), ("@item", model.FeeName), ("@amt", model.Price), ("@old", oldCode)));

            return Ok(new FeeItemMaster
            {
                FeeCode = newCode,
                FeeName = model.FeeName,
                Price = model.Price,
                Guid = model.Guid,
                RecordNumber = recordNumber
            });
        }

        /// <summary>新增一筆收費項目；成功回傳 null，DBF 寫入失敗回傳錯誤回應</summary>
        private async Task<ObjectResult?> InsertAsync(string code, FeeItemMaster model)
        {
            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "INSERT", KeyField, code, RecitemFields(code, model), DbfWriteOptions.UniqueKey);
            if (!dbfResult.Success) return DbfError(dbfResult, "存檔");

            model.FeeCode = code;
            if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
            await AfterDbfWriteAsync(async () =>
            {
                _context.FeeItemMasters.Add(model);
                await _context.SaveChangesAsync();
            });
            return null;
        }

        private async Task<List<(int Recno, string Rno)>> RecmodLinesAsync(string itemno)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT ""_record_number"", TRIM(""rno"") FROM ""{PgSchema}"".""{RecmodTable}""
                WHERE TRIM(""itemno"") = @code ORDER BY ""_record_number"";";
            AddParam(cmd, "@code", itemno);

            var lines = new List<(int, string)>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                lines.Add((reader.GetInt32(0), reader.IsDBNull(1) ? string.Empty : reader.GetString(1)));
            }
            return lines;
        }

        /// <summary>
        /// DBF 已寫入後同步 PostgreSQL 並更新 Checksum。
        /// DBF 有重複代號時快照只保留 RECNO 最小的一筆，手動修補會與 DBF 對不上，改為直接重灌快照；
        /// PG 失敗時不更新 Checksum，下次讀取會自動重灌。
        /// </summary>
        private async Task AfterDbfWriteAsync(Func<Task> pgAction)
        {
            if ((await _dbfSyncService.GetDuplicateKeysAsync(DbfPath, DbfName)).Count > 0)
            {
                await SyncAsync();
                return;
            }
            if (await TryPgAsync(DbfName, pgAction)) await RefreshChecksumAsync(DbfName);
        }

        private static async Task<bool> TryPgAsync(string table, Func<Task> pgAction)
        {
            try
            {
                await pgAction();
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1060 PostgreSQL 同步失敗 ({table})，下次讀取將重灌快照: {ex.Message}");
                return false;
            }
        }

        private async Task RefreshChecksumAsync(string dbfName)
        {
            await _dbfSyncService.CommitWriteChecksumAsync(DbfPath, dbfName);
        }

        private Task<bool> SyncAsync() =>
            _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

        private Task<FeeItemMaster?> FindAsync(string code) =>
            _context.FeeItemMasters.FirstOrDefaultAsync(f => f.FeeCode.Trim() == code);

        private ObjectResult SyncUnavailable() =>
            StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "無法確認地端收費資料的最新內容 (LocalAgent 或資料庫異常)，存檔取消" });

        private ObjectResult DbfError(DbfWriteResult res, string action)
        {
            // DUPLICATE_KEY：DBF 已有這個代號 (快照過期或剛被其他工作站新增)，LocalAgent 的 message 已說明
            if (res.IsConflict)
            {
                return StatusCode(StatusCodes.Status409Conflict, new
                {
                    error = res.Error,
                    message = res.Message ?? $"資料正被地端其他工作站編輯中，{action}取消"
                });
            }
            if (res.ErrorType == "RECORD_NOT_FOUND")
            {
                return StatusCode(StatusCodes.Status409Conflict, new
                {
                    error = res.Error,
                    message = $"{action}失敗：地端資料已變動，請重新整理後再試"
                });
            }
            return BadRequest(new
            {
                error = res.Error,
                message = $"地端 DBF 寫入失敗 ({action}): " + (res.Message ?? res.Error)
            });
        }

        private static Dictionary<string, object?> RecitemFields(string code, FeeItemMaster model) => new()
        {
            ["itemno"] = code,
            ["item"] = model.FeeName,
            ["amt"] = model.Price
        };

        private static void NormalizeModel(FeeItemMaster model)
        {
            model.FeeName = (!string.IsNullOrWhiteSpace(model.FeeName) ? model.FeeName : model.Item)?.Trim() ?? string.Empty;
            if (model.Price == 0 && model.Amt != 0) model.Price = model.Amt;
            if (string.IsNullOrWhiteSpace(model.Guid))
            {
                model.Guid = Guid.NewGuid().ToString("N").ToUpper();
            }
        }

        private static string? ValidateCode(string code)
        {
            if (code.Length == 0) return "收費項目代號不得為空";
            if (Big5.GetByteCount(code) > ItemnoBytes) return $"收費項目代號最多 {ItemnoBytes} 碼 (中文字算 2 碼): [{code}]";
            // 寫入 recmod 時以逗號分隔多個鍵值
            if (code.Contains(',')) return "收費項目代號不可包含逗號";
            return null;
        }

        private static Encoding CreateBig5()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(950);
        }

        private async Task ExecPgAsync(string sql, params (string Name, object Value)[] args)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = sql;
            foreach (var (name, value) in args) AddParam(cmd, name, value);
            await cmd.ExecuteNonQueryAsync();
        }

        private async Task<DbCommand> CommandAsync()
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();
            return conn.CreateCommand();
        }

        private static void AddParam(DbCommand cmd, string name, object value)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value;
            cmd.Parameters.Add(p);
        }
    }
}
