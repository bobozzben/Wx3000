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

        public class ImportExcelTrackItem
        {
            public string? UnifiedNo { get; set; }      // 統一編號
            public string? TaxNo { get; set; }          // 稅籍編號
            public string? CompanyCode { get; set; }    // 公司編號
            public string? InvoiceType { get; set; }    // 發票種類 (二聯, 二聯副, 三聯, 三聯副, 特種, 二收, 三收, 三收副)
            public string? Track { get; set; }          // 字軌
            public string? StartNo { get; set; }        // 起號
            public string? EndNo { get; set; }          // 迄號
            public int? Quantity { get; set; }          // 本數/數量
        }

        public class ImportExcelTrackRequest
        {
            public string Period { get; set; } = string.Empty;
            public string Times { get; set; } = "1";
            public string SourceType { get; set; } = "1"; // "1": 網路購買, "2": 代售點購買
            public List<ImportExcelTrackItem> Items { get; set; } = new();
        }

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

                var written = new List<(int Recno, Dictionary<string, object?> Fields)>();
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
                    written.Add((existing.RecordNumber, fields));
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
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                error = res.Error,
                message = $"{prefix}發票購買紀錄 [{code}] 寫入地端 DBF 失敗，{action}中止: {res.Message ?? res.Error}"
            });
        }

        /// <summary>
        /// DBF 全部寫入成功後，以同一組欄位依 _record_number 同步 PostgreSQL 並更新 Checksum。
        /// PostgreSQL 失敗時不更新 Checksum，下次讀取會從 DBF 重灌快照。
        /// </summary>
        private async Task SyncWrittenRowsAsync(List<(int Recno, Dictionary<string, object?> Fields)> rows)
        {
            if (rows.Count == 0) return;

            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var tx = await conn.BeginTransactionAsync();
                foreach (var (recno, fields) in rows)
                {
                    using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx;
                    var sets = new List<string>();
                    var i = 0;
                    foreach (var (name, value) in fields)
                    {
                        var p = cmd.CreateParameter();
                        p.ParameterName = "@f" + i;
                        p.Value = value ?? string.Empty;
                        cmd.Parameters.Add(p);
                        sets.Add($@"""{name}"" = @f{i}");
                        i++;
                    }
                    var pRec = cmd.CreateParameter();
                    pRec.ParameterName = "@recno";
                    pRec.Value = recno;
                    cmd.Parameters.Add(pRec);
                    cmd.CommandText = $@"UPDATE ""{PgSchema}"".""{PgTable}"" SET {string.Join(", ", sets)} WHERE ""_record_number"" = @recno;";
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
        /// 匯入 Excel 解析後的統購字軌資料
        /// POST: api/wbase3060/import-track
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

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

                // 取得當期所有公司資料 (DBF 的 yymm 是 6 碼，例如 11505-06 → 150506)
                var dbList = await _context.InvoicePurchaseMasters.AsNoTracking()
                    .Where(x => (x.Period == period || x.Period == cleanPeriod || x.Period == dbfPeriod) &&
                                (x.Times == times || x.Times == times.TrimStart('0')))
                    .OrderBy(x => x.RecordNumber)
                    .ToListAsync();

                // 每筆購買紀錄目前的字軌欄位值與要寫入 DBF 的異動欄位 (以 RECNO 區分同公司的多筆)
                var current = new Dictionary<int, Dictionary<string, object?>>();
                var changes = new Dictionary<int, Dictionary<string, object?>>();
                void SetTrack(InvoicePurchaseMaster row, string field, string? value)
                {
                    if (string.IsNullOrEmpty(value)) return;
                    if (!current.TryGetValue(row.RecordNumber, out var cur))
                    {
                        cur = AssembleTrackFields(row);
                        current[row.RecordNumber] = cur;
                    }
                    if (string.Equals((cur[field] as string)?.Trim(), value, StringComparison.Ordinal)) return;
                    cur[field] = value;
                    if (!changes.TryGetValue(row.RecordNumber, out var chg))
                    {
                        chg = new Dictionary<string, object?>();
                        changes[row.RecordNumber] = chg;
                    }
                    chg[field] = value;
                }

                // 同時取得公司資料以備統編對應
                var companies = await _context.CompanyMasters.AsNoTracking().ToListAsync();
                var compMapByUnified = companies
                    .Where(c => !string.IsNullOrWhiteSpace(c.UnifiedNo))
                    .ToLookup(c => c.UnifiedNo!.Trim(), c => c.CompanyCode.Trim());
                var compMapByTaxNo = companies
                    .Where(c => !string.IsNullOrWhiteSpace(c.TaxNo))
                    .ToLookup(c => c.TaxNo!.Trim(), c => c.CompanyCode.Trim());

                int matchedCount = 0;
                int unmatchedCount = 0;

                foreach (var item in req.Items)
                {
                    InvoicePurchaseMaster? target = null;

                    // 1. 先用公司編號比對
                    if (!string.IsNullOrWhiteSpace(item.CompanyCode))
                    {
                        var code = item.CompanyCode.Trim();
                        target = dbList.FirstOrDefault(x => x.CompanyCode == code);
                    }

                    // 2. 用公司統編比對
                    if (target == null && !string.IsNullOrWhiteSpace(item.UnifiedNo))
                    {
                        var uNo = item.UnifiedNo.Trim();
                        target = dbList.FirstOrDefault(x => x.UnifiedNo == uNo);
                        if (target == null && compMapByUnified.Contains(uNo))
                        {
                            var possibleCodes = compMapByUnified[uNo].ToHashSet();
                            target = dbList.FirstOrDefault(x => possibleCodes.Contains(x.CompanyCode));
                        }
                    }

                    // 3. 用稅籍編號比對
                    if (target == null && !string.IsNullOrWhiteSpace(item.TaxNo))
                    {
                        var tNo = item.TaxNo.Trim();
                        target = dbList.FirstOrDefault(x => x.TaxNo == tNo);
                        if (target == null && compMapByTaxNo.Contains(tNo))
                        {
                            var possibleCodes = compMapByTaxNo[tNo].ToHashSet();
                            target = dbList.FirstOrDefault(x => possibleCodes.Contains(x.CompanyCode));
                        }
                    }

                    if (target == null)
                    {
                        unmatchedCount++;
                        continue;
                    }

                    // 依發票種類寫入對應字軌與起迄
                    var type = (item.InvoiceType ?? "").Trim();
                    var track = item.Track?.Trim();
                    var startNo = item.StartNo?.Trim();
                    var endNo = item.EndNo?.Trim();

                    // 判斷順序沿用原本寫法
                    string? prefix = null;
                    if (type.Contains("二聯副") || type.Contains("手開二聯副")) prefix = "a02b";
                    else if (type.Contains("二聯") || type.Contains("手開二聯")) prefix = "a02";
                    else if (type.Contains("三聯副") || type.Contains("手開三聯副")) prefix = "a03b";
                    else if (type.Contains("三聯") || type.Contains("手開三聯")) prefix = "a03";
                    else if (type.Contains("特種")) prefix = "spec";
                    else if (type.Contains("收銀二聯") || type.Contains("二收")) prefix = "c02";
                    else if (type.Contains("收銀三聯副") || type.Contains("三收副")) prefix = "c03b";
                    else if (type.Contains("收銀三聯") || type.Contains("三收")) prefix = "c03";

                    if (prefix != null)
                    {
                        SetTrack(target, prefix + "beg", track);
                        SetTrack(target, prefix + "begno", startNo);
                        SetTrack(target, prefix + "endno", endNo);
                    }

                    matchedCount++;
                }

                // 先逐筆寫 DBF，全部成功才同步 PostgreSQL
                var rowsByRecno = dbList.GroupBy(x => x.RecordNumber).ToDictionary(g => g.Key, g => g.First());
                var written = new List<(int Recno, Dictionary<string, object?> Fields)>();
                foreach (var (recno, fields) in changes.OrderBy(c => c.Key))
                {
                    var row = rowsByRecno[recno];
                    var dbfRes = await WriteTrackRowAsync(row, fields);
                    if (!dbfRes.Success) return DbfWriteFailure(dbfRes, row, written.Count, "Excel 轉入");
                    written.Add((recno, fields));
                }

                await SyncWrittenRowsAsync(written);

                return Ok(new
                {
                    success = true,
                    totalItems = req.Items.Count,
                    matched = matchedCount,
                    unmatched = unmatchedCount,
                    updated = written.Count,
                    message = $"Excel 轉入完成！成功匹配 {matchedCount} 筆，未匹配 {unmatchedCount} 筆，更新 {written.Count} 筆購買紀錄。"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "匯入 Excel 失敗", error = ex.Message });
            }
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
                var written = new List<(int Recno, Dictionary<string, object?> Fields)>();
                foreach (var item in list)
                {
                    var trackFields = AssembleTrackFields(item);
                    if (trackFields.Values.All(v => string.IsNullOrWhiteSpace(v as string))) continue;

                    var fields = trackFields.Keys.ToDictionary(k => k, _ => (object?)string.Empty);
                    var dbfRes = await WriteTrackRowAsync(item, fields);
                    if (!dbfRes.Success) return DbfWriteFailure(dbfRes, item, written.Count, "清除");
                    written.Add((item.RecordNumber, fields));
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
