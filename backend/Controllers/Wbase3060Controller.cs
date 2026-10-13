using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase3060Controller : ControllerBase
    {
        private readonly AppDbContext _context;

        public Wbase3060Controller(AppDbContext context)
        {
            _context = context;
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
                var targetTimes = string.IsNullOrWhiteSpace(times) ? "1" : times.Trim();

                var query = from p in _context.InvoicePurchaseMasters.AsNoTracking()
                            where (p.Period == targetPeriod || p.Period == cleanPeriod)
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
                        item.CompanyShortName = !string.IsNullOrWhiteSpace(c.ShortName) ? c.ShortName.Trim() : c.CompanyName?.Trim();

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
                    var times = dto.Times.Trim();
                    var compCode = dto.CompanyCode.Trim();

                    var existing = await _context.InvoicePurchaseMasters
                        .FirstOrDefaultAsync(x =>
                            (x.Period == period || x.Period == cleanPeriod) &&
                            (x.Times == times || x.Times == times.TrimStart('0')) &&
                            x.CompanyCode == compCode);

                    if (existing != null)
                    {
                        existing.ManualTwoTrack = dto.ManualTwoTrack;
                        existing.ManualTwoStartNo = dto.ManualTwoStartNo;
                        existing.ManualTwoEndNo = dto.ManualTwoEndNo;

                        existing.ManualTwoSubTrack = dto.ManualTwoSubTrack;
                        existing.ManualTwoSubStartNo = dto.ManualTwoSubStartNo;
                        existing.ManualTwoSubEndNo = dto.ManualTwoSubEndNo;

                        existing.ManualThreeTrack = dto.ManualThreeTrack;
                        existing.ManualThreeStartNo = dto.ManualThreeStartNo;
                        existing.ManualThreeEndNo = dto.ManualThreeEndNo;

                        existing.ManualThreeSubTrack = dto.ManualThreeSubTrack;
                        existing.ManualThreeSubStartNo = dto.ManualThreeSubStartNo;
                        existing.ManualThreeSubEndNo = dto.ManualThreeSubEndNo;

                        existing.SpecialTrack = dto.SpecialTrack;
                        existing.SpecialStartNo = dto.SpecialStartNo;
                        existing.SpecialEndNo = dto.SpecialEndNo;

                        existing.CashTwoTrack = dto.CashTwoTrack;
                        existing.CashTwoStartNo = dto.CashTwoStartNo;
                        existing.CashTwoEndNo = dto.CashTwoEndNo;

                        existing.CashThreeTrack = dto.CashThreeTrack;
                        existing.CashThreeStartNo = dto.CashThreeStartNo;
                        existing.CashThreeEndNo = dto.CashThreeEndNo;

                        existing.CashThreeSubTrack = dto.CashThreeSubTrack;
                        existing.CashThreeSubStartNo = dto.CashThreeSubStartNo;
                        existing.CashThreeSubEndNo = dto.CashThreeSubEndNo;

                        successCount++;
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { success = true, updated = successCount });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "批次更新字軌失敗", error = ex.Message });
            }
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
