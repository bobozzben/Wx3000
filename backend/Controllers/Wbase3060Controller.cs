using System;
using System.Collections.Generic;
using System.Data;
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
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase3060Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private const string DbfName = "buyinv";
        private string PgSchema => _configService.CurrentPgSchema;
        private const string PgTable = "buyinv";
        private const string SyncKeyField = "_record_number";

        public Wbase3060Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        public class Wbase3060QueryRequest
        {
            public string? Period { get; set; }
            public string? Times { get; set; }
            public string? SortOrder { get; set; } // "1": 公司統編, "2": 公司編號, "3": 稅籍編號
            public string? Keyword { get; set; }
        }

        public class UpdateTrackItemDto
        {
            public string Period { get; set; } = string.Empty;
            public string Times { get; set; } = "1";
            public string CompanyCode { get; set; } = string.Empty;

            public string? ManualTwoTrack { get; set; }
            public string? ManualTwoStartNo { get; set; }
            public string? ManualTwoEndNo { get; set; }

            public string? ManualTwoSubTrack { get; set; }
            public string? ManualTwoSubStartNo { get; set; }
            public string? ManualTwoSubEndNo { get; set; }

            public string? ManualThreeTrack { get; set; }
            public string? ManualThreeStartNo { get; set; }
            public string? ManualThreeEndNo { get; set; }

            public string? ManualThreeSubTrack { get; set; }
            public string? ManualThreeSubStartNo { get; set; }
            public string? ManualThreeSubEndNo { get; set; }

            public string? SpecialTrack { get; set; }
            public string? SpecialStartNo { get; set; }
            public string? SpecialEndNo { get; set; }

            public string? CashTwoTrack { get; set; }
            public string? CashTwoStartNo { get; set; }
            public string? CashTwoEndNo { get; set; }

            public string? CashThreeTrack { get; set; }
            public string? CashThreeStartNo { get; set; }
            public string? CashThreeEndNo { get; set; }

            public string? CashThreeSubTrack { get; set; }
            public string? CashThreeSubStartNo { get; set; }
            public string? CashThreeSubEndNo { get; set; }
        }

        /// <summary>
        /// 前端解析 Excel 後的一筆「公司 × 發票種類」資料 (VFP wbase3022 轉入時 netbuy.dbf 的一個欄位群)。
        /// 網路購買一列公司展開成最多 8 筆，代售點購買一列就是一筆。
        /// </summary>
        public class ImportExcelTrackItem
        {
            public string? UnifiedNo { get; set; }      // 統一編號
            public string? TaxNo { get; set; }          // 稅籍編號
            public string? CompanyName { get; set; }    // 公司名稱 (只用於回報找不到客戶的列)
            public string? BuyDate { get; set; }        // 購買日期 (代售點 Excel L 欄，7 碼；網路購買為空)
            public string? Kind { get; set; }           // a02 a02b a03 a03b spec c02 c03 c03b
            public int? Quantity { get; set; }          // 本數
            public string? Track { get; set; }          // 字軌
            public string? StartNo { get; set; }        // 起號
            public string? EndNo { get; set; }          // 迄號
        }

        public class ImportExcelTrackRequest
        {
            public string Period { get; set; } = string.Empty;
            public string Times { get; set; } = "1";
            public string SourceType { get; set; } = "1"; // "1": 網路購買, "2": 代售點購買
            public List<ImportExcelTrackItem> Items { get; set; } = new();
        }

        /// <summary>buyinv 的 8 種發票：本數欄位名，字軌 / 起號 / 迄號為 {kind}beg / {kind}begno / {kind}endno</summary>
        private static readonly string[] TrackKinds = { "a02", "a02b", "a03", "a03b", "spec", "c02", "c03", "c03b" };

        /// <summary>Excel 轉入時的一筆購買紀錄 (既有列或要新增的列) 與其異動欄位</summary>
        private sealed class ImportTarget
        {
            public int Recno;                      // 0 = 新增
            public InvoicePurchaseMaster? Row;
            public string No = string.Empty;
            public string Name = string.Empty;
            public string Unino = string.Empty;
            public string Taxno = string.Empty;
            public string BuyDate = string.Empty;
            public Dictionary<string, object?> Current = new();
            public Dictionary<string, object?> Changes = new();
            public bool Touched;                   // 這次轉入有對應到 Excel 資料 (不一定有異動)
            public bool DataChanged;               // 本數或字軌有異動 (新列沒有異動就不新增)
        }

        private sealed record WrittenRow(int Recno, Dictionary<string, object?> Fields, bool Insert = false);

        /// <summary>
        /// 取得統購字軌資料清單
        /// GET: api/wbase3060?period=11505-06&times=1&sortOrder=1&keyword=xxx
        /// </summary>
        private static string NormalizeToDbfPeriod(string? period)
        {
            var raw = string.IsNullOrWhiteSpace(period) ? "11505-06" : period.Trim();
            var clean = raw.Replace("-", "").Trim();
            if (clean.Length == 7 && clean.StartsWith("1"))
            {
                return clean.Substring(1);
            }
            return clean;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> GetList(
            [FromQuery] string? period,
            [FromQuery] string? times,
            [FromQuery] string? sortOrder,
            [FromQuery] string? keyword)
        {
            try
            {
                var targetPeriod = string.IsNullOrWhiteSpace(period) ? "11505-06" : period.Trim();
                var cleanPeriod = targetPeriod.Replace("-", "").Trim();
                var dbfPeriod = NormalizeToDbfPeriod(targetPeriod);
                var targetTimes = string.IsNullOrWhiteSpace(times) ? "1" : times.Trim();

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

                var query = from p in _context.InvoicePurchaseMasters.AsNoTracking()
                            where (p.Period == targetPeriod || p.Period == cleanPeriod || p.Period == dbfPeriod)
                               && (p.Times == targetTimes || p.Times == targetTimes.TrimStart('0'))
                            join c in _context.CompanyMasters.AsNoTracking()
                            on p.CompanyCode equals c.CompanyCode into gc
                            from c in gc.DefaultIfEmpty()
                            select new { p, c };

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim();
                    query = query.Where(x =>
                        x.p.CompanyCode.Contains(kw) ||
                        (x.p.CompanyShortName != null && x.p.CompanyShortName.Contains(kw)) ||
                        (x.p.UnifiedNo != null && x.p.UnifiedNo.Contains(kw)) ||
                        (x.p.TaxNo != null && x.p.TaxNo.Contains(kw)) ||
                        (x.c != null && x.c.ShortName != null && x.c.ShortName.Contains(kw)) ||
                        (x.c != null && x.c.UnifiedNo != null && x.c.UnifiedNo.Contains(kw)));
                }

                var sort = string.IsNullOrWhiteSpace(sortOrder) ? "1" : sortOrder.Trim();
                if (sort == "2") // 2. 依公司編號
                {
                    query = query.OrderBy(x => x.p.CompanyCode);
                }
                else if (sort == "3") // 3. 依稅籍編號
                {
                    query = query.OrderBy(x => (x.p.TaxNo != null && x.p.TaxNo != "") ? x.p.TaxNo : (x.c != null ? x.c.TaxNo : ""))
                                 .ThenBy(x => x.p.CompanyCode);
                }
                else // 1. 預設依公司統編 (如 screen2.png 所示: 排序：公司統編)
                {
                    query = query.OrderBy(x => (x.p.UnifiedNo != null && x.p.UnifiedNo != "") ? x.p.UnifiedNo : (x.c != null ? x.c.UnifiedNo : ""))
                                 .ThenBy(x => x.p.CompanyCode);
                }

                var list = await query.ToListAsync();

                var result = list.Select(x =>
                {
                    var item = x.p;
                    var c = x.c;

                    if (string.IsNullOrWhiteSpace(item.UnifiedNo) && c != null && !string.IsNullOrWhiteSpace(c.UnifiedNo))
                        item.UnifiedNo = c.UnifiedNo.Trim();

                    if (string.IsNullOrWhiteSpace(item.CompanyShortName) && c != null)
                        item.CompanyShortName = !string.IsNullOrWhiteSpace(c.ShortName) ? c.ShortName.Trim() : (c.CompanyName?.Trim() ?? string.Empty);

                    if (string.IsNullOrWhiteSpace(item.TaxNo) && c != null && !string.IsNullOrWhiteSpace(c.TaxNo))
                        item.TaxNo = c.TaxNo.Trim();

                    if (c != null)
                    {
                        item.CompanyName = c.CompanyName?.Trim();
                        item.CompanyAddr = c.Address?.Trim();
                    }

                    // 若手開特種在 ManualSpecial 為 0 但 SpecialTotal 有值，同步設定
                    if (item.ManualSpecial == 0 && item.SpecialTotal.HasValue && item.SpecialTotal.Value > 0)
                    {
                        item.ManualSpecial = (int)item.SpecialTotal.Value;
                    }

                    return item;
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "取得統購字軌資料失敗", error = ex.Message });
            }
        }

        /// <summary>
        /// 單筆或批次更新發票字軌與起迄號
        /// PUT: api/wbase3060/batch
        /// </summary>
        [HttpPut("batch")]
        public async Task<IActionResult> UpdateBatch([FromBody] List<UpdateTrackItemDto> updates)
        {
            if (updates == null || updates.Count == 0)
                return BadRequest(new { message = "無更新資料" });

            try
            {
                // 先讓快照與 DBF 一致，_record_number 才等於目前的 RECNO
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

                var written = new List<WrittenRow>();
                foreach (var dto in updates)
                {
                    var period = (dto.Period ?? string.Empty).Trim();
                    var cleanPeriod = period.Replace("-", "");
                    var dbfPeriod = NormalizeToDbfPeriod(period);
                    var times = (dto.Times ?? string.Empty).Trim();
                    var compCode = (dto.CompanyCode ?? string.Empty).Trim();

                    // 同一公司同期別可能有多筆 (追加購買)，與 DBF LOCATE 一致取 RECNO 最小的一筆
                    var existing = await _context.InvoicePurchaseMasters.AsNoTracking()
                        .Where(x =>
                            (x.Period == period || x.Period == cleanPeriod || x.Period == dbfPeriod) &&
                            (x.Times == times || x.Times == times.TrimStart('0')) &&
                            x.CompanyCode == compCode)
                        .OrderBy(x => x.RecordNumber)
                        .FirstOrDefaultAsync();
                    if (existing == null) continue;

                    var fields = new Dictionary<string, object?>
                    {
                        ["a02beg"] = dto.ManualTwoTrack ?? string.Empty,
                        ["a02begno"] = dto.ManualTwoStartNo ?? string.Empty,
                        ["a02endno"] = dto.ManualTwoEndNo ?? string.Empty,
                        ["a02bbeg"] = dto.ManualTwoSubTrack ?? string.Empty,
                        ["a02bbegno"] = dto.ManualTwoSubStartNo ?? string.Empty,
                        ["a02bendno"] = dto.ManualTwoSubEndNo ?? string.Empty,
                        ["a03beg"] = dto.ManualThreeTrack ?? string.Empty,
                        ["a03begno"] = dto.ManualThreeStartNo ?? string.Empty,
                        ["a03endno"] = dto.ManualThreeEndNo ?? string.Empty,
                        ["a03bbeg"] = dto.ManualThreeSubTrack ?? string.Empty,
                        ["a03bbegno"] = dto.ManualThreeSubStartNo ?? string.Empty,
                        ["a03bendno"] = dto.ManualThreeSubEndNo ?? string.Empty,
                        ["specbeg"] = dto.SpecialTrack ?? string.Empty,
                        ["specbegno"] = dto.SpecialStartNo ?? string.Empty,
                        ["specendno"] = dto.SpecialEndNo ?? string.Empty,
                        ["c02beg"] = dto.CashTwoTrack ?? string.Empty,
                        ["c02begno"] = dto.CashTwoStartNo ?? string.Empty,
                        ["c02endno"] = dto.CashTwoEndNo ?? string.Empty,
                        ["c03beg"] = dto.CashThreeTrack ?? string.Empty,
                        ["c03begno"] = dto.CashThreeStartNo ?? string.Empty,
                        ["c03endno"] = dto.CashThreeEndNo ?? string.Empty,
                        ["c03bbeg"] = dto.CashThreeSubTrack ?? string.Empty,
                        ["c03bbegno"] = dto.CashThreeSubStartNo ?? string.Empty,
                        ["c03bendno"] = dto.CashThreeSubEndNo ?? string.Empty
                    };

                    var dbfRes = await WriteTrackRowAsync(existing, fields);
                    if (!dbfRes.Success) return DbfWriteFailure(dbfRes, existing, written.Count, "更新");
                    written.Add(new WrittenRow(existing.RecordNumber, fields));
                }

                await SyncWrittenRowsAsync(written);
                return Ok(new { success = true, updated = written.Count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "批次更新字軌失敗", error = ex.Message });
            }
        }

        /// <summary>
        /// 以 RECNO 加 yymm、times、no 定位：同一公司同期別可能有多筆追加購買，RECNO 過期時回 RECORD_NOT_FOUND 而不會改錯列
        /// </summary>
        private Task<DbfWriteResult> WriteTrackRowAsync(InvoicePurchaseMaster row, Dictionary<string, object?> fields)
        {
            var no = row.CompanyCode.Trim();
            // LocalAgent 以逗號拆複合鍵，代號含逗號時只用 RECNO 與期別、次數定位
            var keyField = no.Contains(',') ? "RECNO(),yymm,times" : "RECNO(),yymm,times,no";
            var keyVal = no.Contains(',')
                ? $"{row.RecordNumber},{row.Period.Trim()},{row.Times.Trim()}"
                : $"{row.RecordNumber},{row.Period.Trim()},{row.Times.Trim()},{no}";
            return _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "UPDATE", keyField, keyVal, fields);
        }

        /// <summary>
        /// DBF 寫入失敗：PostgreSQL 與 Checksum 都不動。已寫入的前幾筆只在 DBF，Checksum 不符，下次讀取會自動重灌快照
        /// </summary>
        private ObjectResult DbfWriteFailure(DbfWriteResult res, InvoicePurchaseMaster row, int writtenCount, string action)
        {
            var code = row.CompanyCode.Trim();
            var prefix = writtenCount > 0 ? $"前 {writtenCount} 筆已寫入，" : string.Empty;
            if (res.ErrorType == "LOCK_TIMEOUT")
            {
                return StatusCode(StatusCodes.Status409Conflict, new
                {
                    error = res.Error,
                    message = $"{prefix}發票購買紀錄 [{code}] 正被地端其他工作站編輯中，{action}中止"
                });
            }
            if (res.ErrorType == "RECORD_NOT_FOUND")
            {
                return StatusCode(StatusCodes.Status409Conflict, new
                {
                    error = res.Error,
                    message = $"{prefix}發票購買紀錄 [{code}] 已被其他工作站異動，{action}中止，請重新查詢後再試"
                });
            }
            if (res.IsUnconfirmed)
            {
                return StatusCode(StatusCodes.Status504GatewayTimeout, new
                {
                    error = res.Error,
                    message = $"{prefix}發票購買紀錄 [{code}] {action}中止：{res.Message}"
                });
            }
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                error = res.Error,
                message = $"{prefix}發票購買紀錄 [{code}] 寫入地端 DBF 失敗，{action}中止: {res.Message ?? res.Error}"
            });
        }

        /// <summary>
        /// DBF 全部寫入成功後，以同一組欄位依 _record_number 同步 PostgreSQL (既有列 UPDATE、新列 INSERT，
        /// 未列出的欄位用快照表的預設值) 並更新 Checksum。PostgreSQL 失敗時不更新 Checksum，下次讀取會從 DBF 重灌快照。
        /// </summary>
        private async Task SyncWrittenRowsAsync(List<WrittenRow> rows)
        {
            if (rows.Count == 0) return;

            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var tx = await conn.BeginTransactionAsync();
                foreach (var row in rows)
                {
                    using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx;
                    var sets = new List<string>();
                    var cols = new List<string>();
                    var marks = new List<string>();
                    var i = 0;
                    foreach (var (name, value) in row.Fields)
                    {
                        var p = cmd.CreateParameter();
                        p.ParameterName = "@f" + i;
                        p.Value = value ?? string.Empty;
                        cmd.Parameters.Add(p);
                        sets.Add($@"""{name}"" = @f{i}");
                        cols.Add($@"""{name}""");
                        marks.Add("@f" + i);
                        i++;
                    }
                    var pRec = cmd.CreateParameter();
                    pRec.ParameterName = "@recno";
                    pRec.Value = row.Recno;
                    cmd.Parameters.Add(pRec);
                    cmd.CommandText = row.Insert
                        ? $@"INSERT INTO ""{PgSchema}"".""{PgTable}"" (""_record_number"", {string.Join(", ", cols)}) VALUES (@recno, {string.Join(", ", marks)});"
                        : $@"UPDATE ""{PgSchema}"".""{PgTable}"" SET {string.Join(", ", sets)} WHERE ""_record_number"" = @recno;";
                    await cmd.ExecuteNonQueryAsync();
                }
                await tx.CommitAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3060 PostgreSQL 同步失敗，下次讀取將重灌快照: {ex.Message}");
                return;
            }

            await _dbfSyncService.CommitWriteChecksumAsync(DbfPath, DbfName);
        }

        private static Dictionary<string, object?> AssembleTrackFields(InvoicePurchaseMaster item)
        {
            return new Dictionary<string, object?>
            {
                ["a02beg"] = item.ManualTwoTrack ?? string.Empty,
                ["a02begno"] = item.ManualTwoStartNo ?? string.Empty,
                ["a02endno"] = item.ManualTwoEndNo ?? string.Empty,
                ["a02bbeg"] = item.ManualTwoSubTrack ?? string.Empty,
                ["a02bbegno"] = item.ManualTwoSubStartNo ?? string.Empty,
                ["a02bendno"] = item.ManualTwoSubEndNo ?? string.Empty,
                ["a03beg"] = item.ManualThreeTrack ?? string.Empty,
                ["a03begno"] = item.ManualThreeStartNo ?? string.Empty,
                ["a03endno"] = item.ManualThreeEndNo ?? string.Empty,
                ["a03bbeg"] = item.ManualThreeSubTrack ?? string.Empty,
                ["a03bbegno"] = item.ManualThreeSubStartNo ?? string.Empty,
                ["a03bendno"] = item.ManualThreeSubEndNo ?? string.Empty,
                ["specbeg"] = item.SpecialTrack ?? string.Empty,
                ["specbegno"] = item.SpecialStartNo ?? string.Empty,
                ["specendno"] = item.SpecialEndNo ?? string.Empty,
                ["c02beg"] = item.CashTwoTrack ?? string.Empty,
                ["c02begno"] = item.CashTwoStartNo ?? string.Empty,
                ["c02endno"] = item.CashTwoEndNo ?? string.Empty,
                ["c03beg"] = item.CashThreeTrack ?? string.Empty,
                ["c03begno"] = item.CashThreeStartNo ?? string.Empty,
                ["c03endno"] = item.CashThreeEndNo ?? string.Empty,
                ["c03bbeg"] = item.CashThreeSubTrack ?? string.Empty,
                ["c03bbegno"] = item.CashThreeSubStartNo ?? string.Empty,
                ["c03bendno"] = item.CashThreeSubEndNo ?? string.Empty
            };
        }

        /// <summary>
        /// 匯入 Excel 解析後的統購字軌資料 (VFP wbase3022 [轉入] 建 netbuy.dbf + base30.prg wbasemenu03cmd06 把 netbuy 併入 buyinv)
        /// POST: api/wbase3060/import-track
        /// 對應規則 (舊程式轉入後常出現重覆列，這裡改成)：
        ///   1. 每筆 Excel 資料先以統編對應當期已有的購買紀錄 (稅籍相同者優先，否則 RECNO 最小，與 VFP LOCATE 一致) 取得客戶代號，
        ///      沒有才查 customer (同統編多家時稅籍相同者優先)；找不到客戶的列不新增、只回報。
        ///   2. 同一客戶代號在同期別、同次數只會有一列：首次購買一律寫入既有列；追加購買依購買日期找列，購買日期空白的既有列先沿用，
        ///      都沒有才新增。因此同一檔案轉入兩次、或先手動輸入再轉入，都不會多出一列。
        ///   3. Excel 空白的欄位不覆蓋既有資料 (VFP 錯誤 #5994 的做法，追加購買也一樣)。
        ///   4. 新增前由 LocalAgent 在 DBF 上再查一次同鍵值的記錄，快照過期或多人同時轉入時回 409，不會多出一列。
        /// </summary>
        [HttpPost("import-track")]
        public async Task<IActionResult> ImportTrackData([FromBody] ImportExcelTrackRequest req)
        {
            if (req == null || req.Items == null || req.Items.Count == 0)
                return BadRequest(new { message = "無匯入資料" });

            try
            {
                var period = string.IsNullOrWhiteSpace(req.Period) ? "11505-06" : req.Period.Trim();
                var cleanPeriod = period.Replace("-", "");
                var dbfPeriod = NormalizeToDbfPeriod(period);
                var times = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();
                var isAppend = times.TrimStart('0') == "2";

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");

                // 當期所有購買紀錄 (DBF 的 yymm 是 6 碼，例如 11505-06 → 150506)
                var existing = await _context.InvoicePurchaseMasters.AsNoTracking()
                    .Where(x => (x.Period == period || x.Period == cleanPeriod || x.Period == dbfPeriod) &&
                                (x.Times == times || x.Times == times.TrimStart('0')))
                    .OrderBy(x => x.RecordNumber)
                    .ToListAsync();
                var (hasBuyDate, buyDates) = await LoadBuyDatesAsync(existing.Select(x => x.RecordNumber).ToList());

                var customers = await _context.CompanyMasters.AsNoTracking().OrderBy(c => c.RecordNumber).ToListAsync();

                // 新增列的期別 / 次數格式跟著 DBF 既有資料
                var newPeriod = existing.Count > 0 ? existing[0].Period.Trim() : dbfPeriod;
                var newTimes = existing.Count > 0 ? existing[0].Times.Trim() : times;

                var targets = existing.Select(r => new ImportTarget
                {
                    Recno = r.RecordNumber,
                    Row = r,
                    No = r.CompanyCode.Trim(),
                    Name = r.CompanyShortName.Trim(),
                    Unino = r.UnifiedNo.Trim(),
                    Taxno = r.TaxNo.Trim(),
                    BuyDate = buyDates.GetValueOrDefault(r.RecordNumber, string.Empty),
                    Current = AssembleImportFields(r)
                }).ToList();

                var unmatched = new List<object>();
                var unmatchedKeys = new HashSet<string>();
                var skipped = 0;

                foreach (var item in req.Items)
                {
                    var kind = (item.Kind ?? string.Empty).Trim().ToLowerInvariant();
                    var unino = (item.UnifiedNo ?? string.Empty).Trim();
                    var taxno = (item.TaxNo ?? string.Empty).Trim();
                    if (!TrackKinds.Contains(kind) || unino.Length == 0) { skipped++; continue; }
                    var buyDate = (item.BuyDate ?? string.Empty).Trim();

                    // 找客戶代號：1. 統編 + 稅籍都相同的當期購買紀錄 → 2. 統編 + 稅籍都相同的客戶 (總分公司同統編不同稅籍，不能寫到另一家)
                    //           → 3. 只比統編的當期購買紀錄 (RECNO 最小，與 VFP LOCATE 一致) → 4. 只比統編的客戶 (RECNO 最小)
                    var sameUnino = targets.Where(t => t.Unino == unino).ToList();
                    var cands = customers.Where(c => c.UnifiedNo.Trim() == unino).ToList();
                    var template = taxno.Length > 0 ? sameUnino.FirstOrDefault(t => t.Taxno == taxno) : null;
                    var cust = template == null && taxno.Length > 0 ? cands.FirstOrDefault(c => c.TaxNo.Trim() == taxno) : null;
                    if (template == null && cust == null) template = sameUnino.FirstOrDefault();
                    if (template == null && cust == null) cust = cands.FirstOrDefault();
                    string no, name, custTaxno;
                    if (template != null)
                    {
                        no = template.No;
                        name = template.Name;
                        custTaxno = template.Taxno;
                    }
                    else if (cust != null)
                    {
                        no = cust.CompanyCode.Trim();
                        name = !string.IsNullOrWhiteSpace(cust.ShortName) ? cust.ShortName.Trim() : cust.CompanyName.Trim();
                        custTaxno = !string.IsNullOrWhiteSpace(cust.TaxNo) ? cust.TaxNo.Trim() : taxno;
                    }
                    else
                    {
                        if (unmatchedKeys.Add(unino + "|" + taxno))
                            unmatched.Add(new { unifiedNo = unino, taxNo = taxno, companyName = (item.CompanyName ?? string.Empty).Trim() });
                        continue;
                    }

                    // 3. 決定寫到哪一列：首次購買每家一列；追加購買依購買日期 (同日期的列 → 日期空白的既有列 → 新增)，
                    //    Excel 沒有購買日期時就用該客戶既有的列，不另外新增
                    var forNo = targets.Where(t => t.No == no).ToList();
                    ImportTarget? target;
                    if (!isAppend || buyDate.Length == 0)
                    {
                        target = forNo.FirstOrDefault();
                    }
                    else
                    {
                        target = forNo.FirstOrDefault(t => t.BuyDate == buyDate) ?? forNo.FirstOrDefault(t => t.BuyDate.Length == 0);
                        if (target != null && target.BuyDate.Length == 0)
                        {
                            target.BuyDate = buyDate;
                            if (hasBuyDate && target.Recno > 0) target.Changes["buydate"] = buyDate;
                        }
                    }
                    if (target == null)
                    {
                        target = new ImportTarget
                        {
                            Recno = 0,
                            No = no,
                            Name = name,
                            Unino = unino,
                            Taxno = custTaxno,
                            BuyDate = buyDate,
                            Current = AssembleImportFields(null)
                        };
                        target.Changes["yymm"] = newPeriod;
                        target.Changes["times"] = newTimes;
                        target.Changes["no"] = no;
                        target.Changes["name"] = name;
                        target.Changes["unino"] = unino;
                        target.Changes["taxno"] = custTaxno;
                        if (hasBuyDate && buyDate.Length > 0) target.Changes["buydate"] = buyDate;
                        targets.Add(target);
                    }
                    target.Touched = true;

                    // 4. Excel 有值的欄位才寫入，不清掉既有的本數與字軌
                    var qty = item.Quantity ?? 0;
                    if (qty > 0) SetImportValue(target, kind, qty);
                    SetImportValue(target, kind + "beg", (item.Track ?? string.Empty).Trim().ToUpperInvariant());
                    SetImportValue(target, kind + "begno", (item.StartNo ?? string.Empty).Trim());
                    SetImportValue(target, kind + "endno", (item.EndNo ?? string.Empty).Trim());
                }

                // 先逐筆寫 DBF (既有列依 RECNO UPDATE，新列 INSERT)，全部成功才同步 PostgreSQL
                var written = new List<WrittenRow>();
                var inserted = 0;
                var updated = 0;
                foreach (var target in targets.Where(t => t.Changes.Count > 0 && t.DataChanged).OrderBy(t => t.Recno == 0 ? int.MaxValue : t.Recno))
                {
                    if (target.Recno > 0 && target.Row != null)
                    {
                        var res = await WriteTrackRowAsync(target.Row, target.Changes);
                        if (!res.Success) return DbfWriteFailure(res, target.Row, written.Count, "Excel 轉入");
                        written.Add(new WrittenRow(target.Recno, target.Changes));
                        updated++;
                        continue;
                    }

                    // 新增：LocalAgent 在同一段腳本內先找 DBF 有沒有同鍵值的未刪除記錄 (快照過期或其他工作站同時新增的最後防線)
                    var keyField = "yymm,times,no" + (hasBuyDate ? ",buydate" : string.Empty);
                    var keyValue = $"{newPeriod},{newTimes},{target.No}" + (hasBuyDate ? "," + target.BuyDate : string.Empty);
                    if (target.No.Contains(','))
                    {
                        keyField = "RECNO()";
                        keyValue = "0";
                    }
                    var insRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "INSERT", keyField, keyValue, target.Changes);
                    if (!insRes.Success)
                    {
                        var stub = new InvoicePurchaseMaster { CompanyCode = target.No, Period = newPeriod, Times = newTimes };
                        if (insRes.ErrorType == "DUPLICATE_KEY")
                        {
                            var prefix = written.Count > 0 ? $"前 {written.Count} 筆已寫入，" : string.Empty;
                            return StatusCode(StatusCodes.Status409Conflict, new
                            {
                                error = insRes.Error,
                                message = $"{prefix}發票購買紀錄 [{target.No}] 已被其他工作站新增，Excel 轉入中止，請重新執行轉入"
                            });
                        }
                        return DbfWriteFailure(insRes, stub, written.Count, "Excel 轉入");
                    }
                    written.Add(new WrittenRow(insRes.Recno, target.Changes, Insert: true));
                    inserted++;
                }

                await SyncWrittenRowsAsync(written);

                var touched = targets.Where(t => t.Touched).ToList();
                var companies = touched.Select(t => t.No).Distinct().Count();
                var unchanged = touched.Count - inserted - updated;
                var summary = $"共轉入 {companies} 家公司資料：新增 {inserted} 筆、更新 {updated} 筆、{unchanged} 筆無異動";
                if (unmatched.Count > 0) summary += $"；{unmatched.Count} 家找不到客戶資料，未轉入";

                return Ok(new
                {
                    success = true,
                    period,
                    times,
                    sourceType = req.SourceType,
                    totalItems = req.Items.Count,
                    companies,
                    rows = touched.Count,
                    inserted,
                    updated,
                    unchanged,
                    skipped,
                    unmatched,
                    message = summary
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "匯入 Excel 失敗", error = ex.Message });
            }
        }

        /// <summary>Excel 有值才寫入；與目前值相同就不列入異動</summary>
        private static void SetImportValue(ImportTarget target, string field, object value)
        {
            if (value is string s)
            {
                if (s.Length == 0) return;
                var cur = (target.Current.GetValueOrDefault(field) as string ?? string.Empty).Trim();
                if (cur == s) return;
            }
            else if (value is int n)
            {
                var cur = Convert.ToInt32(target.Current.GetValueOrDefault(field) ?? 0);
                if (cur == n) return;
            }
            target.Current[field] = value;
            target.Changes[field] = value;
            target.DataChanged = true;
        }

        /// <summary>轉入會動到的欄位目前值：8 種發票的本數 (int) 與字軌 / 起號 / 迄號；null 代表新列</summary>
        private static Dictionary<string, object?> AssembleImportFields(InvoicePurchaseMaster? item)
        {
            var d = item != null ? AssembleTrackFields(item) : new Dictionary<string, object?>();
            if (item == null)
            {
                foreach (var kind in TrackKinds)
                {
                    d[kind + "beg"] = string.Empty;
                    d[kind + "begno"] = string.Empty;
                    d[kind + "endno"] = string.Empty;
                }
            }
            d["a02"] = item?.ManualTwoDup ?? 0;
            d["a02b"] = item?.ManualTwoDupSub ?? 0;
            d["a03"] = item?.ManualThreeDup ?? 0;
            d["a03b"] = item?.ManualThreeDupSub ?? 0;
            d["spec"] = item?.ManualSpecial ?? 0;
            d["c02"] = item?.CashTwoDup ?? 0;
            d["c03"] = item?.CashThreeDup ?? 0;
            d["c03b"] = item?.CashThreeDupSub ?? 0;
            return d;
        }

        /// <summary>
        /// 讀取快照的 buydate (購買日期)。舊的 buyinv.dbf 可能沒有這個欄位 (VFP wbasemenu03cmd06 會動態 ALTER TABLE 加上)，
        /// 沒有時回 HasColumn = false，轉入就不讀寫 buydate。
        /// </summary>
        private async Task<(bool HasColumn, Dictionary<int, string> Dates)> LoadBuyDatesAsync(List<int> recnos)
        {
            var dates = new Dictionary<int, string>();
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT 1 FROM information_schema.columns WHERE table_schema = @s AND table_name = @t AND column_name = 'buydate'";
                var ps = check.CreateParameter();
                ps.ParameterName = "@s";
                ps.Value = PgSchema;
                check.Parameters.Add(ps);
                var pt = check.CreateParameter();
                pt.ParameterName = "@t";
                pt.Value = PgTable;
                check.Parameters.Add(pt);
                if (await check.ExecuteScalarAsync() == null) return (false, dates);
            }
            if (recnos.Count == 0) return (true, dates);

            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"SELECT ""_record_number"", ""buydate"" FROM ""{PgSchema}"".""{PgTable}"" WHERE ""_record_number"" = ANY(@recnos)";
            var p = cmd.CreateParameter();
            p.ParameterName = "@recnos";
            p.Value = recnos.ToArray();
            cmd.Parameters.Add(p);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                dates[reader.GetInt32(0)] = reader.IsDBNull(1) ? string.Empty : reader.GetString(1).Trim();
            }
            return (true, dates);
        }

        /// <summary>
        /// 格式預覽圖檔 (VFP wbase3022 Command4 / Command5：<磁碟機>:\W3000\doc\tgo01.jpg 網路購買、tgo02.jpg 代售點 I 欄數量、tgo022.jpg 代售點 F 欄數量)
        /// GET: api/wbase3060/doc-image/tgo01
        /// </summary>
        [HttpGet("doc-image/{name}")]
        public IActionResult GetDocImage(string name)
        {
            var key = (name ?? string.Empty).Trim().ToLowerInvariant();
            if (key != "tgo01" && key != "tgo02" && key != "tgo022")
                return NotFound(new { message = $"不支援的格式預覽圖檔 {name}" });

            var path = $@"{_configService.DataDrive}:\W3000\doc\{key}.jpg";
            if (!System.IO.File.Exists(path))
                return NotFound(new { message = $"找不到格式預覽圖檔 {path}" });

            return PhysicalFile(path, "image/jpeg");
        }
        /// <summary>
        /// 清除指定期別與次數的所有字軌與起迄號
        /// POST: api/wbase3060/clear
        /// </summary>
        [HttpPost("clear")]
        public async Task<IActionResult> ClearTracks([FromBody] Wbase3060QueryRequest req)
        {
            try
            {
                var period = string.IsNullOrWhiteSpace(req.Period) ? "11505-06" : req.Period.Trim();
                var cleanPeriod = period.Replace("-", "");
                var dbfPeriod = NormalizeToDbfPeriod(period);
                var times = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

                // DBF 的 yymm 是 6 碼，例如 11505-06 → 150506
                var list = await _context.InvoicePurchaseMasters.AsNoTracking()
                    .Where(x => (x.Period == period || x.Period == cleanPeriod || x.Period == dbfPeriod) &&
                                (x.Times == times || x.Times == times.TrimStart('0')))
                    .OrderBy(x => x.RecordNumber)
                    .ToListAsync();

                // 只寫有字軌資料的列；先逐筆寫 DBF，全部成功才同步 PostgreSQL
                var written = new List<WrittenRow>();
                foreach (var item in list)
                {
                    var trackFields = AssembleTrackFields(item);
                    if (trackFields.Values.All(v => string.IsNullOrWhiteSpace(v as string))) continue;

                    var fields = trackFields.Keys.ToDictionary(k => k, _ => (object?)string.Empty);
                    var dbfRes = await WriteTrackRowAsync(item, fields);
                    if (!dbfRes.Success) return DbfWriteFailure(dbfRes, item, written.Count, "清除");
                    written.Add(new WrittenRow(item.RecordNumber, fields));
                }

                await SyncWrittenRowsAsync(written);
                return Ok(new { success = true, cleared = written.Count, message = $"已清除期別 {period} 次數 {times} 之所有字軌資料。" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "清除字軌失敗", error = ex.Message });
            }
        }
    }
}
