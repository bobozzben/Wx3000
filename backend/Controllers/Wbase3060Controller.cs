using System;
using System.Collections.Generic;
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

        private const string DbfPath = @"C:\w3000\comm";
        private const string DbfName = "buyinv";
        private const string PgSchema = "c:/w3000/comm";
        private const string PgTable = "buyinv";
        private const string KeyField = "yymm,times,no";
        private const string SyncKeyField = "_record_number";

        public Wbase3060Controller(AppDbContext context, IDbfSyncService dbfSyncService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
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
                int successCount = 0;
                foreach (var dto in updates)
                {
                    var period = dto.Period.Trim();
                    var cleanPeriod = period.Replace("-", "");
                    var dbfPeriod = NormalizeToDbfPeriod(period);
                    var times = dto.Times.Trim();
                    var compCode = dto.CompanyCode.Trim();

                    var existing = await _context.InvoicePurchaseMasters
                        .FirstOrDefaultAsync(x =>
                            (x.Period == period || x.Period == cleanPeriod || x.Period == dbfPeriod) &&
                            (x.Times == times || x.Times == times.TrimStart('0')) &&
                            x.CompanyCode == compCode);

                    if (existing != null)
                    {
                        existing.ManualTwoTrack = dto.ManualTwoTrack ?? string.Empty;
                        existing.ManualTwoStartNo = dto.ManualTwoStartNo ?? string.Empty;
                        existing.ManualTwoEndNo = dto.ManualTwoEndNo ?? string.Empty;

                        existing.ManualTwoSubTrack = dto.ManualTwoSubTrack ?? string.Empty;
                        existing.ManualTwoSubStartNo = dto.ManualTwoSubStartNo ?? string.Empty;
                        existing.ManualTwoSubEndNo = dto.ManualTwoSubEndNo ?? string.Empty;

                        existing.ManualThreeTrack = dto.ManualThreeTrack ?? string.Empty;
                        existing.ManualThreeStartNo = dto.ManualThreeStartNo ?? string.Empty;
                        existing.ManualThreeEndNo = dto.ManualThreeEndNo ?? string.Empty;

                        existing.ManualThreeSubTrack = dto.ManualThreeSubTrack ?? string.Empty;
                        existing.ManualThreeSubStartNo = dto.ManualThreeSubStartNo ?? string.Empty;
                        existing.ManualThreeSubEndNo = dto.ManualThreeSubEndNo ?? string.Empty;

                        existing.SpecialTrack = dto.SpecialTrack ?? string.Empty;
                        existing.SpecialStartNo = dto.SpecialStartNo ?? string.Empty;
                        existing.SpecialEndNo = dto.SpecialEndNo ?? string.Empty;

                        existing.CashTwoTrack = dto.CashTwoTrack ?? string.Empty;
                        existing.CashTwoStartNo = dto.CashTwoStartNo ?? string.Empty;
                        existing.CashTwoEndNo = dto.CashTwoEndNo ?? string.Empty;

                        existing.CashThreeTrack = dto.CashThreeTrack ?? string.Empty;
                        existing.CashThreeStartNo = dto.CashThreeStartNo ?? string.Empty;
                        existing.CashThreeEndNo = dto.CashThreeEndNo ?? string.Empty;

                        existing.CashThreeSubTrack = dto.CashThreeSubTrack ?? string.Empty;
                        existing.CashThreeSubStartNo = dto.CashThreeSubStartNo ?? string.Empty;
                        existing.CashThreeSubEndNo = dto.CashThreeSubEndNo ?? string.Empty;

                        var keyVal = $"{existing.Period},{existing.Times},{existing.CompanyCode}";
                        var fields = AssembleTrackFields(existing);
                        var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "UPDATE", KeyField, keyVal, fields);
                        if (!dbfRes.Success && dbfRes.ErrorType == "LOCK_TIMEOUT")
                        {
                            return StatusCode(StatusCodes.Status409Conflict, new
                            {
                                error = dbfRes.Error,
                                message = $"發票購買紀錄 [{existing.CompanyCode}] 正被地端其他工作站編輯中，更新取消"
                            });
                        }

                        successCount++;
                    }
                }

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(new { success = true, updated = successCount });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "批次更新字軌失敗", error = ex.Message });
            }
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
                var times = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

                // 取得當期所有公司資料
                var dbList = await _context.InvoicePurchaseMasters
                    .Where(x => (x.Period == period || x.Period == cleanPeriod) &&
                                (x.Times == times || x.Times == times.TrimStart('0')))
                    .ToListAsync();

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

                    if (type.Contains("二聯副") || type.Contains("手開二聯副"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.ManualTwoSubTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.ManualTwoSubStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.ManualTwoSubEndNo = endNo;
                    }
                    else if (type.Contains("二聯") || type.Contains("手開二聯"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.ManualTwoTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.ManualTwoStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.ManualTwoEndNo = endNo;
                    }
                    else if (type.Contains("三聯副") || type.Contains("手開三聯副"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.ManualThreeSubTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.ManualThreeSubStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.ManualThreeSubEndNo = endNo;
                    }
                    else if (type.Contains("三聯") || type.Contains("手開三聯"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.ManualThreeTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.ManualThreeStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.ManualThreeEndNo = endNo;
                    }
                    else if (type.Contains("特種"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.SpecialTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.SpecialStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.SpecialEndNo = endNo;
                    }
                    else if (type.Contains("收銀二聯") || type.Contains("二收"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.CashTwoTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.CashTwoStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.CashTwoEndNo = endNo;
                    }
                    else if (type.Contains("收銀三聯副") || type.Contains("三收副"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.CashThreeSubTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.CashThreeSubStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.CashThreeSubEndNo = endNo;
                    }
                    else if (type.Contains("收銀三聯") || type.Contains("三收"))
                    {
                        if (!string.IsNullOrEmpty(track)) target.CashThreeTrack = track;
                        if (!string.IsNullOrEmpty(startNo)) target.CashThreeStartNo = startNo;
                        if (!string.IsNullOrEmpty(endNo)) target.CashThreeEndNo = endNo;
                    }

                    matchedCount++;
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    totalItems = req.Items.Count,
                    matched = matchedCount,
                    unmatched = unmatchedCount,
                    message = $"Excel 轉入完成！成功匹配 {matchedCount} 筆，未匹配 {unmatchedCount} 筆。"
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
                var times = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

                var list = await _context.InvoicePurchaseMasters
                    .Where(x => (x.Period == period || x.Period == cleanPeriod) &&
                                (x.Times == times || x.Times == times.TrimStart('0')))
                    .ToListAsync();

                foreach (var item in list)
                {
                    item.ManualTwoTrack = "";
                    item.ManualTwoStartNo = "";
                    item.ManualTwoEndNo = "";

                    item.ManualTwoSubTrack = "";
                    item.ManualTwoSubStartNo = "";
                    item.ManualTwoSubEndNo = "";

                    item.ManualThreeTrack = "";
                    item.ManualThreeStartNo = "";
                    item.ManualThreeEndNo = "";

                    item.ManualThreeSubTrack = "";
                    item.ManualThreeSubStartNo = "";
                    item.ManualThreeSubEndNo = "";

                    item.SpecialTrack = "";
                    item.SpecialStartNo = "";
                    item.SpecialEndNo = "";

                    item.CashTwoTrack = "";
                    item.CashTwoStartNo = "";
                    item.CashTwoEndNo = "";

                    item.CashThreeTrack = "";
                    item.CashThreeStartNo = "";
                    item.CashThreeEndNo = "";

                    item.CashThreeSubTrack = "";
                    item.CashThreeSubStartNo = "";
                    item.CashThreeSubEndNo = "";
                }

                await _context.SaveChangesAsync();
                return Ok(new { success = true, cleared = list.Count, message = $"已清除期別 {period} 次數 {times} 之所有字軌資料。" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "清除字軌失敗", error = ex.Message });
            }
        }
    }
}
