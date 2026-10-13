using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase3050Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ISystemParamService _paramService;

        public Wbase3050Controller(AppDbContext context, ISystemParamService paramService)
        {
            _context = context;
            _paramService = paramService;
        }

        public class BuyinvPrintQueryRequest
        {
            public string? Period { get; set; }          // 依列印期別 (e.g. "11505-06" 或 "1150506")
            public string? Times { get; set; }           // 次數 (e.g. "1")
            public string? Year { get; set; }            // 資料年度 (e.g. "115")
            public string? StartMonth { get; set; }      // 資料起月 (e.g. "05")
            public string? EndMonth { get; set; }        // 資料迄月 (e.g. "06")
            public string? Mode { get; set; }            // "1": 依地址縣市, "2": 依購買地點
            public string? CityCondition { get; set; }   // e.g. "*" 代表全部, 或特定縣市
            public string? PlaceCondition { get; set; }  // e.g. 購買地點代碼/名稱
            public string? SortOrder { get; set; }       // "1": 依統一編號, "2": 依稅籍編號
            public string? ReportType { get; set; }      // "1": A4發票清單, "2": 中一刀發票領取簽收單
        }

        public class BuyinvPriceConfig
        {
            public decimal ManualTwoDup { get; set; } = 15;       // 手開二聯單價
            public decimal ManualTwoDupSub { get; set; } = 16;    // 手開二聯副單價
            public decimal ManualThreeDup { get; set; } = 18;     // 手開三聯單價
            public decimal ManualThreeDupSub { get; set; } = 19;  // 手開三聯副單價
            public decimal ManualSpecial { get; set; } = 15;      // 特種單價
            public decimal CashTwoDup { get; set; } = 36;         // 收銀二聯單價
            public decimal CashThreeDup { get; set; } = 85;       // 收銀三聯單價
            public decimal CashThreeDupSub { get; set; } = 95;    // 收銀三聯副單價 (四聯式收銀機發票)
        }

        /// <summary>
        /// QueryData: 從 Postgresql Database:a3000 schema:e3000__comm Table:基本發票購買 取得資料
        /// </summary>
        [HttpPost("query")]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> QueryData([FromBody] BuyinvPrintQueryRequest req)
        {
            try
            {
                var rawPeriod = string.IsNullOrWhiteSpace(req.Period) ? "11505-06" : req.Period.Trim();
                var cleanPeriod = rawPeriod.Replace("-", "").Trim(); // e.g. "1150506"
                var times = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

                // 解析年度與起迄月份
                string dataYear = !string.IsNullOrWhiteSpace(req.Year) ? req.Year.Trim() : "";
                string dataStartMonth = !string.IsNullOrWhiteSpace(req.StartMonth) ? req.StartMonth.Trim().PadLeft(2, '0') : "";
                string dataEndMonth = !string.IsNullOrWhiteSpace(req.EndMonth) ? req.EndMonth.Trim().PadLeft(2, '0') : "";

                if (string.IsNullOrWhiteSpace(dataYear) || string.IsNullOrWhiteSpace(dataStartMonth) || string.IsNullOrWhiteSpace(dataEndMonth))
                {
                    if (cleanPeriod.Length >= 7)
                    {
                        dataYear = cleanPeriod.Substring(0, cleanPeriod.Length - 4);
                        dataStartMonth = cleanPeriod.Substring(cleanPeriod.Length - 4, 2);
                        dataEndMonth = cleanPeriod.Substring(cleanPeriod.Length - 2, 2);
                    }
                    else if (cleanPeriod.Length >= 5)
                    {
                        dataYear = cleanPeriod.Substring(0, cleanPeriod.Length - 2);
                        dataStartMonth = cleanPeriod.Substring(cleanPeriod.Length - 2, 2);
                        dataEndMonth = dataStartMonth;
                    }
                }

                var hyphenPeriod = $"{dataYear}{dataStartMonth}-{dataEndMonth}";

                // 查詢 基本發票購買 且發票數量大於 0
                var query = from p in _context.InvoicePurchaseMasters.AsNoTracking()
                            where (p.Period == rawPeriod || p.Period == cleanPeriod || p.Period == hyphenPeriod)
                               && (p.Times == times || p.Times == times.TrimStart('0'))
                               && (p.ManualTwoDup > 0 ||
                                   p.ManualTwoDupSub > 0 ||
                                   p.ManualThreeDup > 0 ||
                                   p.ManualThreeDupSub > 0 ||
                                   p.ManualSpecial > 0 ||
                                   p.CashTwoDup > 0 ||
                                   p.CashThreeDup > 0 ||
                                   p.CashThreeDupSub > 0)
                            join c in _context.CompanyMasters.AsNoTracking()
                            on p.CompanyCode equals c.CompanyCode into gc
                            from c in gc.DefaultIfEmpty()
                            select new { p, c };

                var mode = (req.Mode ?? "1").Trim();
                if (mode == "1") // 1. 依地址縣市
                {
                    var city = (req.CityCondition ?? "*").Trim();
                    if (city != "*" && !string.IsNullOrWhiteSpace(city))
                    {
                        query = query.Where(x => (x.p.City != null && x.p.City.Contains(city)) || (x.c != null && x.c.Address != null && x.c.Address.Contains(city)));
                    }
                }
                else if (mode == "2") // 2. 依購買地點
                {
                    var place = (req.PlaceCondition ?? "").Trim();
                    if (!string.IsNullOrWhiteSpace(place))
                    {
                        query = query.Where(x => (x.p.PlaceCode != null && x.p.PlaceCode.Contains(place)));
                    }
                }

                var sortOrder = (req.SortOrder ?? "1").Trim();
                if (sortOrder == "2") // 2. 依稅籍編號
                {
                    query = query.OrderBy(x => x.p.TaxNo != null && x.p.TaxNo != "" ? x.p.TaxNo : (x.c != null ? x.c.TaxNo : ""))
                                 .ThenBy(x => x.p.CompanyCode);
                }
                else // 1. 依統一編號
                {
                    query = query.OrderBy(x => x.p.UnifiedNo != null && x.p.UnifiedNo != "" ? x.p.UnifiedNo : (x.c != null ? x.c.UnifiedNo : ""))
                                 .ThenBy(x => x.p.CompanyCode);
                }

                var rawList = await query.ToListAsync();
                var resultList = rawList.Select(x =>
                {
                    var p = x.p;
                    var c = x.c;

                    p.DataYear = dataYear;
                    p.DataStartMonth = dataStartMonth;
                    p.DataEndMonth = dataEndMonth;

                    p.UnifiedNo = !string.IsNullOrWhiteSpace(p.UnifiedNo) ? p.UnifiedNo.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.UnifiedNo) ? c.UnifiedNo!.Trim() : string.Empty);

                    p.TaxNo = !string.IsNullOrWhiteSpace(p.TaxNo) ? p.TaxNo.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.TaxNo) ? c.TaxNo!.Trim() : string.Empty);

                    p.CompanyShortName = !string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName!.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName!.Trim() : string.Empty));

                    p.CompanyName = !string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName!.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName!.Trim()
                        : (!string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim() : string.Empty));

                    p.CompanyAddr = !string.IsNullOrWhiteSpace(c?.Address) ? c.Address!.Trim()
                        : (!string.IsNullOrWhiteSpace(p.City) ? p.City.Trim() : string.Empty);

                    p.CompanyTel = !string.IsNullOrWhiteSpace(c?.Tel) ? c.Tel!.Trim() : string.Empty;
                    p.CompanyFax = !string.IsNullOrWhiteSpace(c?.Fax) ? c.Fax!.Trim() : string.Empty;

                    return p;
                }).ToList();

                return Ok(resultList);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3050 QueryData error: {ex.Message}");
                return StatusCode(500, new { message = $"查詢發票購買資料失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 讀取發票種類金額設定 (Postgresql Database: a3000 schema: e3000__comm Table: 總帳參數設定)
        /// </summary>
        [HttpGet("prices")]
        public async Task<ActionResult<BuyinvPriceConfig>> GetPrices()
        {
            try
            {
                var schema = "e3000__comm";
                var table = "總帳參數設定";

                var v1 = await _paramService.GetParamAsync(schema, table, "手開二聯單價", "15");
                var v2 = await _paramService.GetParamAsync(schema, table, "手開二聯副單價", "16");
                var v3 = await _paramService.GetParamAsync(schema, table, "手開三聯單價", "18");
                var v4 = await _paramService.GetParamAsync(schema, table, "手開三聯副單價", "19");
                var v5 = await _paramService.GetParamAsync(schema, table, "特種單價", "15");
                var v6 = await _paramService.GetParamAsync(schema, table, "收銀二聯單價", "36");
                var v7 = await _paramService.GetParamAsync(schema, table, "收銀三聯單價", "85");
                var v8 = await _paramService.GetParamAsync(schema, table, "收銀三聯副單價", "95");

                var config = new BuyinvPriceConfig
                {
                    ManualTwoDup = decimal.TryParse(v1, out var p1) ? p1 : 15,
                    ManualTwoDupSub = decimal.TryParse(v2, out var p2) ? p2 : 16,
                    ManualThreeDup = decimal.TryParse(v3, out var p3) ? p3 : 18,
                    ManualThreeDupSub = decimal.TryParse(v4, out var p4) ? p4 : 19,
                    ManualSpecial = decimal.TryParse(v5, out var p5) ? p5 : 15,
                    CashTwoDup = decimal.TryParse(v6, out var p6) ? p6 : 36,
                    CashThreeDup = decimal.TryParse(v7, out var p7) ? p7 : 85,
                    CashThreeDupSub = decimal.TryParse(v8, out var p8) ? p8 : 95,
                };

                return Ok(config);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"讀取發票金額設定失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 儲存發票種類金額設定 (Postgresql Database: a3000 schema: e3000__comm Table: 總帳參數設定)
        /// </summary>
        [HttpPost("prices")]
        public async Task<IActionResult> SavePrices([FromBody] BuyinvPriceConfig config)
        {
            if (config == null) return BadRequest(new { message = "請求內容不可為空" });

            try
            {
                var schema = "e3000__comm";
                var table = "總帳參數設定";

                await _paramService.SetParamAsync(schema, table, "手開二聯單價", config.ManualTwoDup.ToString());
                await _paramService.SetParamAsync(schema, table, "手開二聯副單價", config.ManualTwoDupSub.ToString());
                await _paramService.SetParamAsync(schema, table, "手開三聯單價", config.ManualThreeDup.ToString());
                await _paramService.SetParamAsync(schema, table, "手開三聯副單價", config.ManualThreeDupSub.ToString());
                await _paramService.SetParamAsync(schema, table, "特種單價", config.ManualSpecial.ToString());
                await _paramService.SetParamAsync(schema, table, "收銀二聯單價", config.CashTwoDup.ToString());
                await _paramService.SetParamAsync(schema, table, "收銀三聯單價", config.CashThreeDup.ToString());
                await _paramService.SetParamAsync(schema, table, "收銀三聯副單價", config.CashThreeDupSub.ToString());
                // 同時相容儲存 "四聯式收銀機發票單價"
                await _paramService.SetParamAsync(schema, table, "四聯式收銀機發票單價", config.CashThreeDupSub.ToString());

                return Ok(new { success = true, message = "發票種類金額設定儲存成功", config });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"儲存發票金額設定失敗: {ex.Message}" });
            }
        }
    }
}
