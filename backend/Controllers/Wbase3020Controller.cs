using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase3020Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private static readonly SemaphoreSlim _seedLock = new SemaphoreSlim(1, 1);

        public Wbase3020Controller(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableCreatedAndSeededAsync(string period, string times)
        {
            await Task.CompletedTask;
        }

        // GET: api/wbase3020?period=11505-06&times=1&keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> GetList(
            [FromQuery] string? period,
            [FromQuery] string? times,
            [FromQuery] string? keyword,
            [FromQuery] string? inputMode,
            [FromQuery] string? inputCondition)
        {
            try
            {
                var targetPeriod = string.IsNullOrWhiteSpace(period) ? "11505-06" : period.Trim();
                var targetTimes = string.IsNullOrWhiteSpace(times) ? "1" : times.Trim();

                await EnsureTableCreatedAndSeededAsync(targetPeriod, targetTimes);

                var queryable = _context.InvoicePurchaseMasters
                    .AsNoTracking()
                    .Where(x => x.Period == targetPeriod && x.Times == targetTimes);

                // Input mode condition filtering & sorting
                if (!string.IsNullOrWhiteSpace(inputMode))
                {
                    var mode = inputMode.Trim();
                    var cond = (inputCondition ?? "").Trim().ToLower();

                    switch (mode)
                    {
                        case "1": // 稅籍編號
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                queryable = queryable.Where(x => x.TaxNo != null && x.TaxNo.ToLower().Contains(cond));
                            }
                            queryable = queryable.OrderBy(x => x.TaxNo).ThenBy(x => x.CompanyCode);
                            break;
                        case "2": // 統一編號
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                queryable = queryable.Where(x => x.UnifiedNo != null && x.UnifiedNo.ToLower().Contains(cond));
                            }
                            queryable = queryable.OrderBy(x => x.UnifiedNo).ThenBy(x => x.CompanyCode);
                            break;
                        case "3": // 客戶編號
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                queryable = queryable.Where(x => x.CompanyCode.ToLower().Contains(cond));
                            }
                            queryable = queryable.OrderBy(x => x.CompanyCode);
                            break;
                        case "4": // 上次次序
                            queryable = queryable.OrderBy(x => x.CompanyCode);
                            break;
                        case "5": // 依縣市別
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                queryable = queryable.Where(x => x.City != null && x.City.ToLower().Contains(cond));
                            }
                            queryable = queryable.OrderBy(x => x.City).ThenBy(x => x.CompanyCode);
                            break;
                        case "6": // 購買地點
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                queryable = queryable.Where(x => x.PlaceCode != null && x.PlaceCode.ToLower().Contains(cond));
                            }
                            queryable = queryable.OrderBy(x => x.PlaceCode).ThenBy(x => x.CompanyCode);
                            break;
                        case "7": // 登入人員
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                queryable = queryable.Where(x => x.EmpCode != null && x.EmpCode.ToLower().Contains(cond));
                            }
                            queryable = queryable.OrderBy(x => x.EmpCode).ThenBy(x => x.CompanyCode);
                            break;
                        default:
                            queryable = queryable.OrderBy(x => x.CompanyCode);
                            break;
                    }
                }
                else
                {
                    queryable = queryable.OrderBy(x => x.CompanyCode);
                }

                // General keyword search
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    queryable = queryable.Where(x =>
                        x.CompanyCode.ToLower().Contains(kw) ||
                        (x.CompanyShortName != null && x.CompanyShortName.ToLower().Contains(kw)) ||
                        (x.UnifiedNo != null && x.UnifiedNo.ToLower().Contains(kw)) ||
                        (x.TaxNo != null && x.TaxNo.ToLower().Contains(kw))
                    );
                }

                var list = await queryable.ToListAsync();
                var deduplicatedList = list
                    .GroupBy(x => x.CompanyCode.Trim().ToUpper())
                    .Select(g => g.First())
                    .ToList();

                var companyDict = await _context.CompanyMasters.AsNoTracking()
                    .ToDictionaryAsync(c => c.CompanyCode.Trim().ToUpper(), c => c);

                foreach (var item in deduplicatedList)
                {
                    var code = item.CompanyCode.Trim().ToUpper();

                    if (companyDict.TryGetValue(code, out var comp))
                    {
                        item.CompanyName = comp.CompanyName?.Trim() ?? string.Empty;
                        item.CompanyAddr = comp.Address?.Trim() ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(item.CompanyShortName))
                            item.CompanyShortName = comp.ShortName?.Trim() ?? comp.CompanyName?.Trim() ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(item.UnifiedNo))
                            item.UnifiedNo = comp.UnifiedNo?.Trim() ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(item.TaxNo))
                            item.TaxNo = comp.TaxNo?.Trim() ?? string.Empty;
                    }
                    else
                    {
                        item.CompanyName = string.Empty;
                        item.CompanyAddr = string.Empty;
                    }
                }

                return Ok(deduplicatedList);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"查詢發票購買資料失敗: {ex.Message}" });
            }
        }

        // GET: api/wbase3020/{period}/{times}/{companyCode}
        [HttpGet("{period}/{times}/{companyCode}")]
        public async Task<ActionResult<InvoicePurchaseMaster>> GetByCode(string period, string times, string companyCode)
        {
            try
            {
                var p = period.Trim();
                var t = times.Trim();
                var c = companyCode.Trim();

                await EnsureTableCreatedAndSeededAsync(p, t);

                var item = await _context.InvoicePurchaseMasters.FindAsync(p, t, c);
                if (item == null)
                {
                    return NotFound(new { message = "查無此發票購買紀錄" });
                }

                return Ok(item);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"取得發票購買紀錄失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase3020
        [HttpPost]
        public async Task<ActionResult<InvoicePurchaseMaster>> Create([FromBody] InvoicePurchaseMaster model)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(model.Period) || string.IsNullOrWhiteSpace(model.CompanyCode))
                {
                    return BadRequest(new { message = "期別與公司編號為必填欄位" });
                }

                model.Period = model.Period.Trim();
                model.Times = string.IsNullOrWhiteSpace(model.Times) ? "1" : model.Times.Trim();
                model.CompanyCode = model.CompanyCode.Trim();
                model.CompanyShortName = model.CompanyShortName?.Trim() ?? string.Empty;
                model.UnifiedNo = model.UnifiedNo?.Trim() ?? string.Empty;
                model.TaxNo = model.TaxNo?.Trim() ?? string.Empty;

                await EnsureTableCreatedAndSeededAsync(model.Period, model.Times);

                var existing = await _context.InvoicePurchaseMasters.FindAsync(model.Period, model.Times, model.CompanyCode);
                if (existing != null)
                {
                    return Conflict(new { message = $"發票購買紀錄 [{model.CompanyCode}] 在期別 {model.Period} 已存在" });
                }

                _context.InvoicePurchaseMasters.Add(model);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetByCode), new { period = model.Period, times = model.Times, companyCode = model.CompanyCode }, model);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"新增發票購買紀錄失敗: {ex.Message}" });
            }
        }

        // PUT: api/wbase3020
        [HttpPut]
        public async Task<IActionResult> UpdateBody([FromBody] InvoicePurchaseMaster model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Period) || string.IsNullOrWhiteSpace(model.CompanyCode))
            {
                return BadRequest(new { message = "期別與公司編號為必填欄位" });
            }
            return await UpdateInternal(model.Period, model.Times, model.CompanyCode, model);
        }

        // PUT: api/wbase3020/{period}/{times}/{companyCode}
        [HttpPut("{period}/{times}/{companyCode}")]
        public async Task<IActionResult> Update(string period, string times, string companyCode, [FromBody] InvoicePurchaseMaster model)
        {
            return await UpdateInternal(period, times, companyCode, model);
        }

        private async Task<IActionResult> UpdateInternal(string period, string times, string companyCode, InvoicePurchaseMaster model)
        {
            try
            {
                var p = System.Net.WebUtility.UrlDecode(period ?? model.Period ?? "").Trim();
                var rawTimes = System.Net.WebUtility.UrlDecode(times ?? model.Times ?? "1").Trim();
                var tMatch = System.Text.RegularExpressions.Regex.Match(rawTimes, @"\d+");
                var t = tMatch.Success ? tMatch.Value : "1";
                var c = System.Net.WebUtility.UrlDecode(companyCode ?? model.CompanyCode ?? "").Trim().ToUpper();

                if (string.IsNullOrWhiteSpace(c))
                {
                    return BadRequest(new { message = "公司編號不可為空" });
                }

                await EnsureTableCreatedAndSeededAsync(p, t);

                var existing = await _context.InvoicePurchaseMasters.FindAsync(p, t, c);
                if (existing == null)
                {
                    model.Period = p;
                    model.Times = t;
                    model.CompanyCode = c;
                    model.CompanyShortName = model.CompanyShortName?.Trim() ?? string.Empty;
                    model.UnifiedNo = model.UnifiedNo?.Trim() ?? string.Empty;
                    model.TaxNo = model.TaxNo?.Trim() ?? string.Empty;
                    model.City = model.City?.Trim() ?? string.Empty;
                    model.PlaceCode = model.PlaceCode?.Trim() ?? string.Empty;
                    model.EmpCode = model.EmpCode?.Trim() ?? string.Empty;
                    model.Guid = string.IsNullOrWhiteSpace(model.Guid) ? Guid.NewGuid().ToString() : model.Guid;

                    _context.InvoicePurchaseMasters.Add(model);
                    await _context.SaveChangesAsync();
                    return Ok(model);
                }

                existing.CompanyShortName = model.CompanyShortName?.Trim() ?? string.Empty;
                existing.UnifiedNo = model.UnifiedNo?.Trim() ?? string.Empty;
                existing.TaxNo = model.TaxNo?.Trim() ?? string.Empty;
                existing.ManualTwoDup = model.ManualTwoDup;
                existing.ManualTwoDupSub = model.ManualTwoDupSub;
                existing.ManualThreeDup = model.ManualThreeDup;
                existing.ManualThreeDupSub = model.ManualThreeDupSub;
                existing.ManualSpecial = model.ManualSpecial;
                existing.CashTwoDup = model.CashTwoDup;
                existing.CashThreeDup = model.CashThreeDup;
                existing.CashThreeDupSub = model.CashThreeDupSub;
                existing.City = model.City?.Trim() ?? string.Empty;
                existing.PlaceCode = model.PlaceCode?.Trim() ?? string.Empty;
                existing.EmpCode = model.EmpCode?.Trim() ?? string.Empty;

                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"更新發票購買紀錄失敗: {ex.Message}" });
            }
        }

        // DELETE: api/wbase3020/{period}/{times}/{companyCode}
        [HttpDelete("{period}/{times}/{companyCode}")]
        public async Task<IActionResult> Delete(string period, string times, string companyCode)
        {
            try
            {
                var p = period.Trim();
                var t = times.Trim();
                var c = companyCode.Trim();

                await EnsureTableCreatedAndSeededAsync(p, t);

                var existing = await _context.InvoicePurchaseMasters.FindAsync(p, t, c);
                if (existing == null)
                {
                    return NotFound(new { message = "欲刪除的紀錄不存在" });
                }

                _context.InvoicePurchaseMasters.Remove(existing);
                await _context.SaveChangesAsync();
                return Ok(new { message = "刪除成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"刪除發票購買紀錄失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase3020/batch-save
        [HttpPost("batch-save")]
        public async Task<IActionResult> BatchSave([FromBody] List<InvoicePurchaseMaster> list)
        {
            try
            {
                if (list == null || list.Count == 0) return BadRequest(new { message = "無效的提交資料" });

                var p = list[0].Period.Trim();
                var t = string.IsNullOrWhiteSpace(list[0].Times) ? "1" : list[0].Times.Trim();

                await EnsureTableCreatedAndSeededAsync(p, t);

                var validItems = list
                    .Where(x => !string.IsNullOrWhiteSpace(x.CompanyCode))
                    .Select(x => new InvoicePurchaseMaster
                    {
                        Period = p,
                        Times = t,
                        CompanyCode = x.CompanyCode.Trim(),
                        CompanyShortName = x.CompanyShortName?.Trim() ?? string.Empty,
                        UnifiedNo = x.UnifiedNo?.Trim() ?? string.Empty,
                        TaxNo = x.TaxNo?.Trim() ?? string.Empty,
                        ManualTwoDup = x.ManualTwoDup,
                        ManualTwoDupSub = x.ManualTwoDupSub,
                        ManualThreeDup = x.ManualThreeDup,
                        ManualThreeDupSub = x.ManualThreeDupSub,
                        ManualSpecial = x.ManualSpecial,
                        CashTwoDup = x.CashTwoDup,
                        CashThreeDup = x.CashThreeDup,
                        CashThreeDupSub = x.CashThreeDupSub,
                        City = x.City?.Trim() ?? string.Empty,
                        PlaceCode = x.PlaceCode?.Trim() ?? string.Empty,
                        EmpCode = x.EmpCode?.Trim() ?? string.Empty,
                    }).ToList();

                var currentDbList = await _context.InvoicePurchaseMasters
                    .Where(x => x.Period == p && x.Times == t)
                    .ToListAsync();

                _context.InvoicePurchaseMasters.RemoveRange(currentDbList);
                await _context.InvoicePurchaseMasters.AddRangeAsync(validItems);
                await _context.SaveChangesAsync();

                return Ok(new { message = "批次儲存成功", count = validItems.Count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"批次儲存失敗: {ex.Message}" });
            }
        }

        public class TransferCompanyDataRequest
        {
            public string? Period { get; set; }
            public string? Times { get; set; }
        }

        // POST: api/wbase3020/transfer-company-data
        [HttpPost("transfer-company-data")]
        public async Task<IActionResult> TransferCompanyData([FromBody] TransferCompanyDataRequest req)
        {
            try
            {
                var targetPeriod = string.IsNullOrWhiteSpace(req.Period) ? "11505-06" : req.Period.Trim();
                var targetTimes = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

                await EnsureTableCreatedAndSeededAsync(targetPeriod, targetTimes);

var companies = await _context.CompanyMasters.AsNoTracking().ToListAsync();
                var existingPurchases = await _context.InvoicePurchaseMasters
                    .Where(x => x.Period == targetPeriod && (x.Times == targetTimes || x.Times == targetTimes.TrimStart('0')))
                    .ToListAsync();
                var existingMap = existingPurchases.ToDictionary(x => x.CompanyCode.Trim().ToUpper(), x => x);

                foreach (var c in companies)
                {
                    if (string.IsNullOrWhiteSpace(c.CompanyCode)) continue;
                    var code = c.CompanyCode.Trim().ToUpper();
                    if (!existingMap.TryGetValue(code, out var item))
                    {
                        item = new InvoicePurchaseMaster
                        {
                            Period = targetPeriod,
                            Times = targetTimes,
                            CompanyCode = code,
                            CompanyShortName = c.ShortName ?? c.CompanyName ?? string.Empty,
                            UnifiedNo = c.UnifiedNo ?? string.Empty,
                            TaxNo = c.TaxNo ?? string.Empty
                        };
                        _context.InvoicePurchaseMasters.Add(item);
                    }
                    else
                    {
                        item.CompanyShortName = c.ShortName ?? c.CompanyName ?? string.Empty;
                        item.UnifiedNo = c.UnifiedNo ?? string.Empty;
                        item.TaxNo = c.TaxNo ?? string.Empty;
                    }
                }
                await _context.SaveChangesAsync();

                var totalCount = await _context.InvoicePurchaseMasters
                    .CountAsync(x => x.Period == targetPeriod && x.Times == targetTimes);

                return Ok(new { 
                    success = true, 
                    message = $"F3 轉檔成功！已將公司資料轉入【基本發票購買】(期別: {targetPeriod}, 次數: {targetTimes})", 
                    totalCount 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"F3 轉檔失敗: {ex.Message}" });
            }
        }

        public class PrintRangeQuery
        {
            public string? Period { get; set; }
            public string? Times { get; set; }
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
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
        }

        // POST: api/wbase3020/buyinv-print-query
        // 依 SQL 從 Postgresql Database: a3000 schema: e3000__comm Table: 基本發票購買 提取資料供報表使用
        [HttpPost("buyinv-print-query")]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> BuyinvPrintQuery([FromBody] BuyinvPrintQueryRequest req)
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

                await EnsureTableCreatedAndSeededAsync(hyphenPeriod, times);

                // SQL:
                // SELECT M.* ,CAST('115' AS VARChar(3) ) AS "資料年度" 
                // ,CAST('05' AS VARChar(2) ) AS "資料起月" 
                // ,CAST('06' AS VARChar(2) ) AS "資料迄月" 
                // ,C.* 
                //  FROM e3000__comm."基本發票購買" M 
                //  LEFT JOIN e3000__comm."公司資料" C ON C."公司編號"=M."公司編號" 
                //  WHERE ( "期別"='1150506' AND "購買次數"= 1) 
                //  AND ( ( "手開二聯" > 0 )     OR ( "手開二聯副" > 0 )     OR ( "手開三聯" > 0 )     
                //  OR ( "手開三聯副" > 0 )     OR ( "特種" > 0 )     OR ( "收銀二聯" > 0 )     
                //  OR ( "收銀三聯" > 0 )     OR ( "收銀三聯副" > 0 )    ) 
                //  ORDER BY M."公司統編"

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
                if (mode == "1") // 1.依地址縣市
                {
                    var city = (req.CityCondition ?? "*").Trim();
                    if (city != "*" && !string.IsNullOrWhiteSpace(city))
                    {
                        query = query.Where(x => (x.p.City != null && x.p.City.Contains(city)) || (x.c != null && x.c.Address != null && x.c.Address.Contains(city)));
                    }
                }
                else if (mode == "2") // 2.依購買地點
                {
                    var place = (req.PlaceCondition ?? "").Trim();
                    if (!string.IsNullOrWhiteSpace(place))
                    {
                        query = query.Where(x => x.p.PlaceCode != null && x.p.PlaceCode.Contains(place));
                    }
                }

                var sortOrder = (req.SortOrder ?? "1").Trim();
                if (sortOrder == "2") // 2.依稅籍編號排序
                {
                    query = query.OrderBy(x => x.p.TaxNo != null && x.p.TaxNo != "" ? x.p.TaxNo : (x.c != null ? x.c.TaxNo : ""))
                                 .ThenBy(x => x.p.CompanyCode);
                }
                else // 1.依統一編號排序 (預設: ORDER BY M."公司統編")
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
                Console.WriteLine($"BuyinvPrintQuery error: {ex.Message}");
                return StatusCode(500, new { message = $"查詢預購統一發票資料失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase3020/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                var period = string.IsNullOrWhiteSpace(query.Period) ? "11505-06" : query.Period.Trim();
                var times = string.IsNullOrWhiteSpace(query.Times) ? "1" : query.Times.Trim();

                await EnsureTableCreatedAndSeededAsync(period, times);

                var q = from p in _context.InvoicePurchaseMasters.AsNoTracking()
                        where p.Period == period && p.Times == times
                        join c in _context.CompanyMasters.AsNoTracking()
                        on p.CompanyCode equals c.CompanyCode into gc
                        from c in gc.DefaultIfEmpty()
                        select new { p, c };

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim();
                    q = q.Where(x => x.p.CompanyCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim();
                    q = q.Where(x => x.p.CompanyCode.Trim().CompareTo(end) <= 0);
                }

                var rawList = await q.OrderBy(x => x.p.CompanyCode).ToListAsync();
                var resultList = rawList.Select(x =>
                {
                    var p = x.p;
                    var c = x.c;

                    p.UnifiedNo = !string.IsNullOrWhiteSpace(c?.UnifiedNo) ? c.UnifiedNo!.Trim()
                        : (!string.IsNullOrWhiteSpace(p.UnifiedNo) ? p.UnifiedNo.Trim() : string.Empty);

                    p.TaxNo = !string.IsNullOrWhiteSpace(c?.TaxNo) ? c.TaxNo!.Trim()
                        : (!string.IsNullOrWhiteSpace(p.TaxNo) ? p.TaxNo.Trim() : string.Empty);

                    p.CompanyShortName = !string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName!.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName!.Trim()
                        : (!string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim() : string.Empty));

                    p.CompanyName = !string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName!.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName!.Trim()
                        : (!string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim() : string.Empty));

                    p.CompanyAddr = !string.IsNullOrWhiteSpace(c?.Address) ? c.Address!.Trim()
                        : (!string.IsNullOrWhiteSpace(p.City) ? p.City.Trim() : string.Empty);

                    return p;
                }).ToList();

                return Ok(resultList);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3020 Print error: {ex.Message}");
                return Ok(new List<InvoicePurchaseMaster>());
            }
        }
    }
}
