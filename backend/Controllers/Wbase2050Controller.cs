using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    /// <summary>
    /// 2-5 總分支機構設定 (VFP base20.prg wbasemenu02cmd05 → wbase1.vcx wbase2050「總分支機構設定」與 wbase2050f8「分公司資料維護」)
    /// 只用 customer.dbf：總機構 = tpay='1' 的客戶；分支機構 = mainunino 等於總機構統編的客戶 (對應鍵是統編，不是客戶代號)
    /// DBF 以 RECNO() 加客戶代號定位，RECNO 過期時改用客戶代號；寫入 DBF 成功後才寫 PostgreSQL 並更新 Checksum
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase2050Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        private const string Table = "customer";
        private const string HqTpay = "1";
        private const string BranchTpay = "2";
        private const string Yes = "Y";

        private static readonly string[] TchkCodes = { "", "1", "2" };
        private static readonly string[] YesNoCodes = { "", "Y", "N" };
        private static readonly string[] MediaTypeCodes = { "", "0", "1", "2", "3", "4" };

        private const string NotHqMessage = "此客戶已不是總機構 (彙總註記=1)，請重新整理";

        public Wbase2050Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // =========================================================================
        // 總機構清單 (wbase2050)
        // =========================================================================

        // GET: api/wbase2050/headquarters (VFP 只取 tpay='1'，依 no 排序)
        [HttpGet("headquarters")]
        public async Task<IActionResult> GetHeadquarters()
        {
            try
            {
                await SyncAsync();
                var list = (await QueryCustomersAsync(@"WHERE TRIM(""tpay"") = @tpay", ("@tpay", HqTpay))).Select(ToHq).ToList();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取總機構資料失敗: " + ex.Message });
            }
        }

        // PUT: api/wbase2050/headquarters/{no} (VFP 關閉畫面時回寫 tchk, mediatype, t401, tzero, tnot, tflog；不寫 tpay)
        [HttpPut("headquarters/{no}")]
        public async Task<IActionResult> UpdateHeadquarter(string no, [FromBody] HqUpdateRequest req)
        {
            if (req == null) return BadRequest(new { message = "缺少修改內容" });
            var tchk = Code(req.Tchk);
            var tzero = Code(req.Tzero);
            var tflog = Code(req.Tflog);
            var tnot = Code(req.Tnot);
            if (!TchkCodes.Contains(tchk)) return BadRequest(new { message = "進銷項合併設定請輸入 1 或 2" });
            var invalid = CheckYesNo(tzero, "零稅率媒體") ?? CheckYesNo(tflog, "固定資產退稅申報") ?? CheckYesNo(tnot, "不得扣抵媒體");
            if (invalid != null) return BadRequest(new { message = invalid });

            try
            {
                await SyncAsync();
                var hq = await FindHqAsync(no);
                if (hq == null) return Conflict(new { message = NotHqMessage });

                // mediatype 與 t401 由伺服器決定 (VFP base20.prg:462 與 Text1.LostFocus 的 tchk 連動)
                var target = new Dictionary<string, object?>
                {
                    ["tchk"] = tchk,
                    ["mediatype"] = HqMediatype(tchk),
                    ["t401"] = Yes,
                    ["tzero"] = tzero,
                    ["tnot"] = tnot,
                    ["tflog"] = tflog,
                };
                var fields = ChangedFields(hq, target);
                if (fields.Count > 0)
                {
                    var res = await WriteCustomerAsync(hq, fields);
                    if (!res.Success) return DbfError(res, "儲存總機構設定");
                    var pgOk = await TryPgAsync(() => UpdatePgAsync(fields, res.Recno));
                    if (pgOk) await UpdateChecksumAsync();
                }

                var updated = await FindHqAsync(hq.No);
                return updated == null ? Conflict(new { message = NotHqMessage }) : Ok(ToHq(updated));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "儲存總機構設定失敗: " + ex.Message });
            }
        }

        // =========================================================================
        // 分公司資料維護 (wbase2050f8)
        // =========================================================================

        // GET: api/wbase2050/headquarters/{no}/branches (VFP F8 分公司設定)
        [HttpGet("headquarters/{no}/branches")]
        public async Task<IActionResult> GetBranches(string no)
        {
            try
            {
                await SyncAsync();
                var hq = await FindHqAsync(no);
                if (hq == null) return Conflict(new { message = NotHqMessage });
                var pre = CheckBranchEntry(hq);
                if (pre != null) return BadRequest(new { message = pre });
                return Ok(new BranchListDto { Hq = ToHq(hq), Branches = await QueryBranchesAsync(hq) });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取分支機構資料失敗: " + ex.Message });
            }
        }

        // PUT: api/wbase2050/headquarters/{no}/branches (VFP 子畫面關閉後逐筆回寫 tpay, mediatype, t401, tnot, tzero, mainunino, tflog)
        [HttpPut("headquarters/{no}/branches")]
        public async Task<IActionResult> SaveBranches(string no, [FromBody] BranchSaveRequest req)
        {
            if (req?.Branches == null) return BadRequest(new { message = "缺少分支機構資料" });
            try
            {
                await SyncAsync();
                var hq = await FindHqAsync(no);
                if (hq == null) return Conflict(new { message = NotHqMessage });
                var pre = CheckBranchEntry(hq);
                if (pre != null) return BadRequest(new { message = pre });

                var customers = new Dictionary<string, CustomerRow>();
                foreach (var c in await QueryCustomersAsync(string.Empty)) customers.TryAdd(c.No, c);

                // 空白代號的新列直接略過 (VFP 回寫時 seek 不到「新代號N」自然略過)
                var items = req.Branches
                    .Select(b => (No: Key(b.No), OrigNo: Key(b.OrigNo), Item: b))
                    .Where(x => x.No.Length > 0)
                    .ToList();
                var targetNos = new HashSet<string>(items.Select(x => x.No));
                var results = new List<BranchSaveItemResult>();
                var wrote = false;
                var pgOk = true;

                // 1. 先檢查全部列，沒通過的列不寫入，也不清它原本的客戶
                var plans = new List<(string No, string OrigNo, CustomerRow Cust, Dictionary<string, object?> Target)>();
                var seen = new HashSet<string>();
                foreach (var x in items)
                {
                    if (!seen.Add(x.No))
                    {
                        results.Add(Invalid(x.No, "客戶代號重複"));
                        continue;
                    }
                    var check = CheckBranch(hq, x.Item, x.No, customers, out var cust, out var target);
                    if (check != null)
                    {
                        results.Add(Invalid(x.No, check));
                        continue;
                    }
                    plans.Add((x.No, x.OrigNo, cust!, target!));
                }

                // 2. 既有分支改了代號：先清掉舊客戶的 mainunino (只清仍掛在本總機構下、這次也沒有再列入的客戶)；
                //    要先清再寫，舊代號若又被另一列加回來才會留在本總機構下。清除失敗時這一列不寫，讓使用者重送
                var failed = new HashSet<string>();
                foreach (var p in plans.Where(p => p.OrigNo.Length > 0 && p.OrigNo != p.No && !targetNos.Contains(p.OrigNo)))
                {
                    if (!customers.TryGetValue(p.OrigNo, out var old) || old.Mainunino != hq.Unino) continue;
                    var fields = new Dictionary<string, object?> { ["mainunino"] = string.Empty };
                    var res = await WriteCustomerAsync(old, fields);
                    if (!res.Success)
                    {
                        failed.Add(p.No);
                        results.Add(Failure(p.No, res, $"清除原分支 {p.OrigNo}"));
                        continue;
                    }
                    wrote = true;
                    pgOk &= await TryPgAsync(() => UpdatePgAsync(fields, res.Recno));
                }

                // 3. 逐筆寫入分支：失敗就記錄下來繼續下一筆 (VFP lock_rec 取消時略過該筆)，全部處理完才更新一次 Checksum
                foreach (var p in plans.Where(p => !failed.Contains(p.No)))
                {
                    var fields = ChangedFields(p.Cust, p.Target);
                    if (fields.Count > 0)
                    {
                        var res = await WriteCustomerAsync(p.Cust, fields);
                        if (!res.Success)
                        {
                            results.Add(Failure(p.No, res, "儲存分支機構"));
                            continue;
                        }
                        wrote = true;
                        pgOk &= await TryPgAsync(() => UpdatePgAsync(fields, res.Recno));
                    }
                    results.Add(new BranchSaveItemResult { No = p.No, Success = true });
                }

                if (wrote && pgOk) await UpdateChecksumAsync();
                return Ok(new BranchSaveResult
                {
                    Success = results.All(r => r.Success),
                    Results = results,
                    Branches = await QueryBranchesAsync(hq),
                });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "儲存分支機構失敗: " + ex.Message });
            }
        }

        // DELETE: api/wbase2050/headquarters/{no}/branches/{branchNo} (VFP Delete.Click：立即清空 mainunino，tpay 等欄不動)
        [HttpDelete("headquarters/{no}/branches/{branchNo}")]
        public async Task<IActionResult> DeleteBranch(string no, string branchNo)
        {
            try
            {
                await SyncAsync();
                var hq = await FindHqAsync(no);
                if (hq == null) return Conflict(new { message = NotHqMessage });
                if (hq.Unino.Length == 0) return BadRequest(new { message = "公司統編尚未輸入,請先輸入後再執行此功能" });

                var cust = (await QueryCustomersAsync(@"WHERE TRIM(""no"") = @no", ("@no", Key(branchNo)))).FirstOrDefault();
                if (cust == null) return NotFound(new { message = $"查無客戶代號 {branchNo}" });
                if (cust.Mainunino.Length == 0) return Ok(new { success = true });
                if (cust.Mainunino != hq.Unino)
                {
                    return Conflict(new { message = $"客戶 {cust.No} 目前掛在總機構統編 {cust.Mainunino} 之下，不是本總機構的分支機構，請重新整理" });
                }

                var fields = new Dictionary<string, object?> { ["mainunino"] = string.Empty };
                var res = await WriteCustomerAsync(cust, fields);
                if (!res.Success) return DbfError(res, "刪除分支機構");
                if (await TryPgAsync(() => UpdatePgAsync(fields, res.Recno))) await UpdateChecksumAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "刪除分支機構失敗: " + ex.Message });
            }
        }

        // GET: api/wbase2050/customers?keyword=xxx (F2 客戶選單與客戶代號檢查)
        [HttpGet("customers")]
        public async Task<IActionResult> GetCustomers([FromQuery] string? keyword = null)
        {
            try
            {
                await SyncAsync();
                var kw = (keyword ?? string.Empty).Trim().ToLowerInvariant();
                var list = kw.Length == 0
                    ? await QueryCustomersAsync(string.Empty)
                    : await QueryCustomersAsync(
                        @"WHERE (LOWER(""no"") LIKE @kw OR LOWER(""name"") LIKE @kw OR LOWER(""abbr"") LIKE @kw OR LOWER(""unino"") LIKE @kw)",
                        ("@kw", "%" + kw + "%"));
                return Ok(list.Select(c => new CustomerPickDto
                {
                    No = c.No, Name = c.Name, Abbr = c.Abbr, Unino = c.Unino, Tpay = c.Tpay,
                    Mainunino = c.Mainunino, Tzero = c.Tzero, Tnot = c.Tnot, Tflog = c.Tflog,
                }).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取客戶資料失敗: " + ex.Message });
            }
        }

        // =========================================================================
        // 規則
        // =========================================================================

        /// <summary>總機構的進銷項媒體由進銷項合併設定決定：2.子公司各別申報 → 3.不媒體，其他 (含空白) → 2.進銷項</summary>
        private static string HqMediatype(string tchk) => tchk == "2" ? "3" : "2";

        /// <summary>開啟分公司資料維護前的檢查，訊息照 VFP (wbase2050 f8.Click)</summary>
        private static string? CheckBranchEntry(CustomerRow hq)
        {
            if (hq.Unino.Length == 0) return "公司統編尚未輸入,請先輸入後再執行此功能";
            if (hq.Tchk.Length == 0) return "尚未設定進銷存合併方式";
            return null;
        }

        /// <summary>
        /// 分支的阻斷檢查 (VFP 都沒有檢查)：客戶存在、不是總機構本身、不是其他總機構、代碼合法；
        /// 已掛在其他總機構下的客戶必須由使用者確認過 (AllowMove) 才改掛。通過時回傳要寫入的欄位
        /// </summary>
        private static string? CheckBranch(CustomerRow hq, BranchSaveItem item, string no, Dictionary<string, CustomerRow> customers,
            out CustomerRow? cust, out Dictionary<string, object?>? target)
        {
            target = null;
            if (!customers.TryGetValue(no, out cust)) return "查無此客戶代號";
            if (cust.No == hq.No) return "不可將總機構本身設為分支機構";
            if (cust.Tpay == HqTpay) return "該客戶為總機構，請先至客戶資料建檔修改彙總註記";
            if (cust.Mainunino.Length > 0 && cust.Mainunino != hq.Unino && !item.AllowMove)
            {
                return $"該客戶已是總機構統編 {cust.Mainunino} 的分支機構";
            }

            var mediatype = Code(item.Mediatype);
            var tzero = Code(item.Tzero);
            var tflog = Code(item.Tflog);
            var tnot = Code(item.Tnot);
            if (!MediaTypeCodes.Contains(mediatype)) return "進銷項媒體請輸入 0~4";
            var invalid = CheckYesNo(tzero, "零稅率媒體") ?? CheckYesNo(tflog, "固定資產退稅申報") ?? CheckYesNo(tnot, "不得扣抵媒體");
            if (invalid != null) return invalid;

            // 欄位清單同 VFP 回寫；mainunino 一律由伺服器填入總機構統編
            target = new Dictionary<string, object?>
            {
                ["tpay"] = BranchTpay,
                ["mediatype"] = mediatype,
                ["t401"] = Yes,
                ["tnot"] = tnot,
                ["tzero"] = tzero,
                ["mainunino"] = hq.Unino,
                ["tflog"] = tflog,
            };
            return null;
        }

        private static string? CheckYesNo(string value, string label) =>
            YesNoCodes.Contains(value) ? null : $"{label}請輸入 Y 或 N";

        /// <summary>只寫入與目前資料不同的欄位：值相同的回寫不改變 DBF 內容，略過可減少鎖定與快照重灌</summary>
        private static Dictionary<string, object?> ChangedFields(CustomerRow current, Dictionary<string, object?> target)
        {
            var fields = new Dictionary<string, object?>();
            foreach (var (name, value) in target)
            {
                if (!string.Equals(current.Get(name), value as string, StringComparison.Ordinal)) fields[name] = value;
            }
            return fields;
        }

        private static HqDto ToHq(CustomerRow c) => new()
        {
            No = c.No, Abbr = c.Abbr, Unino = c.Unino, Tpay = c.Tpay, Tchk = c.Tchk,
            Mediatype = HqMediatype(c.Tchk), T401 = Yes,
            Tzero = c.Tzero, Tflog = c.Tflog, Tnot = c.Tnot,
            DbMediatype = c.Mediatype, DbT401 = c.T401,
            RecordNumber = c.RecordNumber,
        };

        private static BranchDto ToBranch(CustomerRow c) => new()
        {
            No = c.No, Abbr = c.Abbr, Unino = c.Unino, Tpay = BranchTpay, Mediatype = c.Mediatype, T401 = Yes,
            Tzero = c.Tzero, Tflog = c.Tflog, Tnot = c.Tnot, Mainunino = c.Mainunino, RecordNumber = c.RecordNumber,
        };

        private static string Key(string? no) => (no ?? string.Empty).Trim();

        private static string Code(string? value) => (value ?? string.Empty).Trim().ToUpperInvariant();

        // =========================================================================
        // DBF / PostgreSQL
        // =========================================================================

        private Task SyncAsync() => _dbfSyncService.EnsureTableSyncedAsync(DbfPath, Table, PgSchema, Table, "");

        private async Task<CustomerRow?> FindHqAsync(string no) =>
            (await QueryCustomersAsync(@"WHERE TRIM(""no"") = @no AND TRIM(""tpay"") = @tpay", ("@no", Key(no)), ("@tpay", HqTpay))).FirstOrDefault();

        /// <summary>分支 = mainunino 等於總機構統編；排除總機構本身與其他總機構 (VFP 會列出並在存檔時把它們降級)</summary>
        private async Task<List<BranchDto>> QueryBranchesAsync(CustomerRow hq) =>
            (await QueryCustomersAsync(
                @"WHERE TRIM(""mainunino"") = @unino AND TRIM(""no"") <> @no AND COALESCE(TRIM(""tpay""), '') <> @tpay",
                ("@unino", hq.Unino), ("@no", hq.No), ("@tpay", HqTpay)))
            .Select(ToBranch).ToList();

        private async Task<List<CustomerRow>> QueryCustomersAsync(string whereSql, params (string Name, object Value)[] args)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"
                SELECT ""no"", ""name"", ""abbr"", ""unino"", ""tpay"", ""tchk"", ""mediatype"", ""t401"", ""tzero"", ""tflog"", ""tnot"", ""mainunino"", ""_record_number""
                FROM ""{PgSchema}"".""{Table}""
                {whereSql}
                ORDER BY TRIM(""no"") COLLATE ""C"", ""_record_number"";";
            foreach (var (name, value) in args) AddParam(cmd, name, value);

            var list = new List<CustomerRow>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new CustomerRow
                {
                    No = Str(reader, "no"), Name = Str(reader, "name"), Abbr = Str(reader, "abbr"), Unino = Str(reader, "unino"),
                    Tpay = Str(reader, "tpay"), Tchk = Str(reader, "tchk"), Mediatype = Str(reader, "mediatype"), T401 = Str(reader, "t401"),
                    Tzero = Str(reader, "tzero"), Tflog = Str(reader, "tflog"), Tnot = Str(reader, "tnot"), Mainunino = Str(reader, "mainunino"),
                    RecordNumber = reader["_record_number"] == DBNull.Value ? 0 : Convert.ToInt32(reader["_record_number"]),
                });
            }
            return list;
        }

        /// <summary>以 RECNO() 加客戶代號定位 (RECNO 過期時回 RECORD_NOT_FOUND 而不是改錯列)，找不到再只用客戶代號完全比對</summary>
        private async Task<DbfWriteResult> WriteCustomerAsync(CustomerRow c, Dictionary<string, object?> fields)
        {
            if (c.RecordNumber > 0 && !c.No.Contains(','))
            {
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, Table, "UPDATE", "RECNO(),no", $"{c.RecordNumber},{c.No}", fields);
                if (res.Success || res.ErrorType != "RECORD_NOT_FOUND") return res;
            }
            return await _dbfSyncService.WriteRecordAsync(DbfPath, Table, "UPDATE", "no", c.No, fields);
        }

        /// <summary>DBF 已寫入後同步 PostgreSQL；失敗時回傳 false，呼叫端不更新 Checksum，下次讀取會自動重灌快照</summary>
        private async Task<bool> TryPgAsync(Func<Task> pgAction)
        {
            try
            {
                await pgAction();
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase2050 PostgreSQL 同步失敗，下次讀取將重灌快照: {ex.Message}");
                return false;
            }
        }

        private async Task UpdateChecksumAsync()
        {
            try
            {
                var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, Table);
                if (!string.IsNullOrEmpty(chk)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, Table, chk);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase2050 更新 Checksum 失敗，下次讀取將重灌快照: {ex.Message}");
            }
        }

        /// <summary>以寫入 DBF 的同一組欄位更新 PostgreSQL，用 LocalAgent 回傳的 RECNO 定位</summary>
        private async Task UpdatePgAsync(Dictionary<string, object?> fields, int recno)
        {
            using var cmd = await CommandAsync();
            var sets = new List<string>();
            var i = 0;
            foreach (var (name, value) in fields)
            {
                var p = "@f" + i++;
                sets.Add($@"""{name}"" = {p}");
                AddParam(cmd, p, value ?? string.Empty);
            }
            AddParam(cmd, "@recno", recno);
            cmd.CommandText = $@"UPDATE ""{PgSchema}"".""{Table}"" SET {string.Join(", ", sets)} WHERE ""_record_number"" = @recno;";
            await cmd.ExecuteNonQueryAsync();
        }

        private static string DescribeDbfError(DbfWriteResult res, string action)
        {
            if (res.ErrorType == "LOCK_TIMEOUT") return $"{action}失敗：資料正被地端其他工作站鎖定中，請稍後再試";
            if (res.ErrorType == "RECORD_NOT_FOUND") return $"{action}失敗：地端資料已變動，請重新整理後再試";
            return $"{action}失敗：{res.Message ?? res.Error ?? "寫入 DBF 失敗"}";
        }

        private ObjectResult DbfError(DbfWriteResult res, string action)
        {
            var status = res.ErrorType is "LOCK_TIMEOUT" or "RECORD_NOT_FOUND"
                ? StatusCodes.Status409Conflict
                : StatusCodes.Status500InternalServerError;
            return StatusCode(status, new { error = res.Error, errorType = res.ErrorType, message = DescribeDbfError(res, action) });
        }

        private static BranchSaveItemResult Failure(string no, DbfWriteResult res, string action) => new()
        {
            No = no, Success = false, ErrorType = res.ErrorType ?? "DBF_ERROR", Message = DescribeDbfError(res, action),
        };

        private static BranchSaveItemResult Invalid(string no, string message) => new()
        {
            No = no, Success = false, ErrorType = "INVALID", Message = message,
        };

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

        private static string Str(DbDataReader r, string col) => r[col] == DBNull.Value ? string.Empty : r[col]?.ToString()?.Trim() ?? string.Empty;

        /// <summary>customer.dbf 中本功能用到的欄位 (PostgreSQL 快照的值已去除尾端空白)</summary>
        private sealed class CustomerRow
        {
            public string No { get; init; } = string.Empty;
            public string Name { get; init; } = string.Empty;
            public string Abbr { get; init; } = string.Empty;
            public string Unino { get; init; } = string.Empty;
            public string Tpay { get; init; } = string.Empty;
            public string Tchk { get; init; } = string.Empty;
            public string Mediatype { get; init; } = string.Empty;
            public string T401 { get; init; } = string.Empty;
            public string Tzero { get; init; } = string.Empty;
            public string Tflog { get; init; } = string.Empty;
            public string Tnot { get; init; } = string.Empty;
            public string Mainunino { get; init; } = string.Empty;
            public int RecordNumber { get; init; }

            public string Get(string field) => field switch
            {
                "tpay" => Tpay,
                "tchk" => Tchk,
                "mediatype" => Mediatype,
                "t401" => T401,
                "tzero" => Tzero,
                "tflog" => Tflog,
                "tnot" => Tnot,
                "mainunino" => Mainunino,
                _ => throw new ArgumentOutOfRangeException(nameof(field), field, null),
            };
        }
    }
}
