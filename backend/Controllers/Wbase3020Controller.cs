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
    public class Wbase3020Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;

        private const string DbfPath = @"C:\w3000\comm";
        private const string DbfName = "buyinv";
        private const string PgSchema = "c:/w3000/comm";
        private const string PgTable = "buyinv";
        private const string KeyField = "yymm,times,no";
        private const string SyncKeyField = "_record_number";

        public Wbase3020Controller(AppDbContext context, IDbfSyncService dbfSyncService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
        }

        /// <summary>
        /// 將前端期別格式 (如 "11505-06" 或 "1150506") 轉換為 FoxPro buyinv.dbf 的 6 碼 yymm 格式 (如 "150506")
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

        private static string ExtractCity(string? address)
        {
            if (string.IsNullOrWhiteSpace(address)) return string.Empty;
            var raw = address.Trim();
            var cleaned = System.Text.RegularExpressions.Regex.Replace(raw, @"^[\d\uFF10-\uFF19]+", "").Trim();
            if (cleaned.Length >= 3)
            {
                var candidate = cleaned.Substring(0, 3);
                if (candidate.EndsWith("市") || candidate.EndsWith("縣"))
                {
                    return candidate;
                }
            }
            return cleaned.Length >= 3 ? cleaned.Substring(0, 3) : cleaned;
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
                var dbfPeriod = NormalizeToDbfPeriod(targetPeriod);
                var targetTimes = string.IsNullOrWhiteSpace(times) ? "1" : times.Trim();

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

                var rawList = await _context.InvoicePurchaseMasters
                    .AsNoTracking()
                    .Where(x => (x.Period == dbfPeriod || x.Period == targetPeriod) && x.Times == targetTimes)
                    .ToListAsync();

                var deduplicatedList = rawList
                    .GroupBy(x => x.CompanyCode.Trim().ToUpper())
                    .Select(g => g.First())
                    .ToList();

                var companies = await _context.CompanyMasters.AsNoTracking().ToListAsync();
                var companyDict = companies
                    .GroupBy(c => c.CompanyCode.Trim().ToUpper())
                    .ToDictionary(g => g.Key, g => g.First());

                foreach (var item in deduplicatedList)
                {
                    var code = item.CompanyCode.Trim().ToUpper();

                    if (companyDict.TryGetValue(code, out var comp))
                    {
                        item.CompanyName = comp.CompanyName.Trim();
                        item.CompanyAddr = comp.Address.Trim();
                        if (string.IsNullOrWhiteSpace(item.CompanyShortName))
                            item.CompanyShortName = !string.IsNullOrWhiteSpace(comp.ShortName) ? comp.ShortName.Trim() : comp.CompanyName.Trim();
                        if (string.IsNullOrWhiteSpace(item.UnifiedNo))
                            item.UnifiedNo = comp.UnifiedNo.Trim();
                        if (string.IsNullOrWhiteSpace(item.TaxNo))
                            item.TaxNo = comp.TaxNo.Trim();

                        item.City = ExtractCity(comp.Address);
                        item.PlaceCode = comp.PlaceCode?.Trim() ?? string.Empty;
                        item.EmpCode = comp.EmpCode?.Trim() ?? string.Empty;
                    }
                    else
                    {
                        item.CompanyName = string.Empty;
                        item.CompanyAddr = string.Empty;
                        item.City = string.Empty;
                        item.PlaceCode = string.Empty;
                        item.EmpCode = string.Empty;
                    }
                }

                IEnumerable<InvoicePurchaseMaster> filtered = deduplicatedList;

                // Input mode condition filtering & sorting (performed safely in memory to support [NotMapped] City, PlaceCode, EmpCode)
                if (!string.IsNullOrWhiteSpace(inputMode))
                {
                    var mode = inputMode.Trim();
                    var cond = (inputCondition ?? "").Trim().ToLower();

                    switch (mode)
                    {
                        case "1": // 稅籍編號
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                filtered = filtered.Where(x => (x.TaxNo ?? "").ToLower().Contains(cond));
                            }
                            filtered = filtered.OrderBy(x => x.TaxNo ?? "").ThenBy(x => x.CompanyCode);
                            break;
                        case "2": // 統一編號
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                filtered = filtered.Where(x => (x.UnifiedNo ?? "").ToLower().Contains(cond));
                            }
                            filtered = filtered.OrderBy(x => x.UnifiedNo ?? "").ThenBy(x => x.CompanyCode);
                            break;
                        case "3": // 客戶編號
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                filtered = filtered.Where(x => (x.CompanyCode ?? "").ToLower().Contains(cond));
                            }
                            filtered = filtered.OrderBy(x => x.CompanyCode);
                            break;
                        case "4": // 上次次序
                            filtered = filtered.OrderBy(x => x.CompanyCode);
                            break;
                        case "5": // 依縣市別
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                filtered = filtered.Where(x => (x.City != null && x.City.ToLower().Contains(cond)) || (x.CompanyAddr != null && x.CompanyAddr.ToLower().Contains(cond)));
                            }
                            filtered = filtered.OrderBy(x => x.City ?? "").ThenBy(x => x.CompanyCode);
                            break;
                        case "6": // 購買地點
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                filtered = filtered.Where(x => (x.PlaceCode != null && x.PlaceCode.ToLower().Contains(cond)));
                            }
                            filtered = filtered.OrderBy(x => x.PlaceCode ?? "").ThenBy(x => x.CompanyCode);
                            break;
                        case "7": // 登入人員
                            if (!string.IsNullOrWhiteSpace(cond))
                            {
                                filtered = filtered.Where(x => (x.EmpCode != null && x.EmpCode.ToLower().Contains(cond)));
                            }
                            filtered = filtered.OrderBy(x => x.EmpCode ?? "").ThenBy(x => x.CompanyCode);
                            break;
                        default:
                            filtered = filtered.OrderBy(x => x.CompanyCode);
                            break;
                    }
                }
                else
                {
                    filtered = filtered.OrderBy(x => x.CompanyCode);
                }

                // General keyword search
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var kw = keyword.Trim().ToLower();
                    filtered = filtered.Where(x =>
                        (x.CompanyCode != null && x.CompanyCode.ToLower().Contains(kw)) ||
                        (x.CompanyShortName != null && x.CompanyShortName.ToLower().Contains(kw)) ||
                        (x.CompanyName != null && x.CompanyName.ToLower().Contains(kw)) ||
                        (x.UnifiedNo != null && x.UnifiedNo.ToLower().Contains(kw)) ||
                        (x.TaxNo != null && x.TaxNo.ToLower().Contains(kw))
                    );
                }

                return Ok(filtered.ToList());
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3020 GetList error: {ex.Message}");
                return StatusCode(500, new { message = $"查詢發票購買資料失敗: {ex.Message}" });
            }
        }

        // GET: api/wbase3020/{period}/{times}/{companyCode}
        [HttpGet("{period}/{times}/{companyCode}")]
        public async Task<ActionResult<InvoicePurchaseMaster>> GetByCode(string period, string times, string companyCode)
        {
            try
            {
                var p = NormalizeToDbfPeriod(period);
                var t = times.Trim();
                var c = companyCode.Trim();

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

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
            if (model == null || string.IsNullOrWhiteSpace(model.Period) || string.IsNullOrWhiteSpace(model.CompanyCode))
            {
                return BadRequest(new { message = "期別與公司編號為必填欄位" });
            }

            var p = NormalizeToDbfPeriod(model.Period);
            var t = string.IsNullOrWhiteSpace(model.Times) ? "1" : model.Times.Trim();
            var c = model.CompanyCode.Trim().ToUpper();

            model.Period = p;
            model.Times = t;
            model.CompanyCode = c;
            model.CompanyShortName = model.CompanyShortName?.Trim() ?? string.Empty;
            model.UnifiedNo = model.UnifiedNo?.Trim() ?? string.Empty;
            model.TaxNo = model.TaxNo?.Trim() ?? string.Empty;

            var existing = await _context.InvoicePurchaseMasters.FindAsync(p, t, c);
            var operation = existing != null ? "UPDATE" : "INSERT";
            var keyVal = $"{p},{t},{c}";

            // 1. 組裝 DBF 欄位清單
            var fields = AssembleDbfFields(model, p, t, c);

            // 2. 核心原則：DBF 絕對權威！先寫 DBF
            var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, operation, KeyField, keyVal, fields);
            if (!dbfResult.Success)
            {
                if (dbfResult.ErrorType == "LOCK_TIMEOUT")
                {
                    return StatusCode(StatusCodes.Status409Conflict, new
                    {
                        error = dbfResult.Error,
                        message = dbfResult.Message ?? "資料正被地端其他工作站編輯中，存檔取消"
                    });
                }
                return BadRequest(new
                {
                    error = dbfResult.Error,
                    message = "地端 DBF 寫入失敗: " + (dbfResult.Message ?? dbfResult.Error)
                });
            }

            // 3. DBF 成功後才寫入 PostgreSQL
            if (existing != null)
            {
                UpdateEntityValues(existing, model);
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                return Ok(existing);
            }

            if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
            _context.InvoicePurchaseMasters.Add(model);
            await _context.SaveChangesAsync();
            var newCsum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
            if (!string.IsNullOrEmpty(newCsum))
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newCsum);

            return CreatedAtAction(nameof(GetByCode), new { period = model.Period, times = model.Times, companyCode = model.CompanyCode }, model);
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
                var p = NormalizeToDbfPeriod(System.Net.WebUtility.UrlDecode(period ?? model.Period ?? ""));
                var rawTimes = System.Net.WebUtility.UrlDecode(times ?? model.Times ?? "1").Trim();
                var tMatch = System.Text.RegularExpressions.Regex.Match(rawTimes, @"\d+");
                var t = tMatch.Success ? tMatch.Value : "1";
                var c = System.Net.WebUtility.UrlDecode(companyCode ?? model.CompanyCode ?? "").Trim().ToUpper();

                if (string.IsNullOrWhiteSpace(c))
                {
                    return BadRequest(new { message = "公司編號不可為空" });
                }

                model.Period = p;
                model.Times = t;
                model.CompanyCode = c;
                model.CompanyShortName = model.CompanyShortName?.Trim() ?? string.Empty;
                model.UnifiedNo = model.UnifiedNo?.Trim() ?? string.Empty;
                model.TaxNo = model.TaxNo?.Trim() ?? string.Empty;

                var existing = await _context.InvoicePurchaseMasters.FindAsync(p, t, c);
                var operation = existing != null ? "UPDATE" : "INSERT";
                var keyVal = $"{p},{t},{c}";

                // 1. 組裝 DBF 欄位清單
                var fields = AssembleDbfFields(model, p, t, c);

                // 2. 核心原則：DBF 絕對權威！先寫 DBF
                var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, operation, KeyField, keyVal, fields);
                if (!dbfResult.Success)
                {
                    if (dbfResult.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfResult.Error,
                            message = dbfResult.Message ?? "資料正被地端其他工作站編輯中，存檔取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfResult.Error,
                        message = "地端 DBF 寫入失敗: " + (dbfResult.Message ?? dbfResult.Error)
                    });
                }

                // 3. DBF 成功後才寫入 PostgreSQL
                if (existing == null)
                {
                    if (dbfResult.Recno > 0) model.RecordNumber = dbfResult.Recno;
                    _context.InvoicePurchaseMasters.Add(model);
                    await _context.SaveChangesAsync();
                    var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                    if (!string.IsNullOrEmpty(newChecksum))
                        await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                    return Ok(model);
                }

                UpdateEntityValues(existing, model);
                if (dbfResult.Recno > 0) existing.RecordNumber = dbfResult.Recno;

                await _context.SaveChangesAsync();
                var updatedChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(updatedChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, updatedChecksum);

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
                var p = NormalizeToDbfPeriod(period);
                var t = times.Trim();
                var c = companyCode.Trim().ToUpper();

                var existing = await _context.InvoicePurchaseMasters.FindAsync(p, t, c);
                if (existing == null)
                {
                    return NotFound(new { message = "欲刪除的紀錄不存在" });
                }

                var keyVal = $"{p},{t},{c}";

                // 1. 核心原則：DBF 絕對權威！先刪除 DBF
                var dbfResult = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "DELETE", KeyField, keyVal, new Dictionary<string, object?>());
                if (!dbfResult.Success)
                {
                    if (dbfResult.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new
                        {
                            error = dbfResult.Error,
                            message = dbfResult.Message ?? "資料正被地端其他工作站編輯中，刪除取消"
                        });
                    }
                    return BadRequest(new
                    {
                        error = dbfResult.Error,
                        message = "地端 DBF 刪除失敗: " + (dbfResult.Message ?? dbfResult.Error)
                    });
                }

                // 2. DBF 成功刪除後才刪除 PostgreSQL
                _context.InvoicePurchaseMasters.Remove(existing);
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

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

                var p = NormalizeToDbfPeriod(list[0].Period);
                var t = string.IsNullOrWhiteSpace(list[0].Times) ? "1" : list[0].Times.Trim();

                var validItems = list
                    .Where(x => !string.IsNullOrWhiteSpace(x.CompanyCode))
                    .Select(x => new InvoicePurchaseMaster
                    {
                        Period = p,
                        Times = t,
                        CompanyCode = x.CompanyCode.Trim().ToUpper(),
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
                        ManualTwoTrack = x.ManualTwoTrack?.Trim() ?? string.Empty,
                        ManualTwoStartNo = x.ManualTwoStartNo?.Trim() ?? string.Empty,
                        ManualTwoEndNo = x.ManualTwoEndNo?.Trim() ?? string.Empty,
                        ManualTwoSubTrack = x.ManualTwoSubTrack?.Trim() ?? string.Empty,
                        ManualTwoSubStartNo = x.ManualTwoSubStartNo?.Trim() ?? string.Empty,
                        ManualTwoSubEndNo = x.ManualTwoSubEndNo?.Trim() ?? string.Empty,
                        ManualThreeTrack = x.ManualThreeTrack?.Trim() ?? string.Empty,
                        ManualThreeStartNo = x.ManualThreeStartNo?.Trim() ?? string.Empty,
                        ManualThreeEndNo = x.ManualThreeEndNo?.Trim() ?? string.Empty,
                        ManualThreeSubTrack = x.ManualThreeSubTrack?.Trim() ?? string.Empty,
                        ManualThreeSubStartNo = x.ManualThreeSubStartNo?.Trim() ?? string.Empty,
                        ManualThreeSubEndNo = x.ManualThreeSubEndNo?.Trim() ?? string.Empty,
                        SpecialTrack = x.SpecialTrack?.Trim() ?? string.Empty,
                        SpecialStartNo = x.SpecialStartNo?.Trim() ?? string.Empty,
                        SpecialEndNo = x.SpecialEndNo?.Trim() ?? string.Empty,
                        CashTwoTrack = x.CashTwoTrack?.Trim() ?? string.Empty,
                        CashTwoStartNo = x.CashTwoStartNo?.Trim() ?? string.Empty,
                        CashTwoEndNo = x.CashTwoEndNo?.Trim() ?? string.Empty,
                        CashThreeTrack = x.CashThreeTrack?.Trim() ?? string.Empty,
                        CashThreeStartNo = x.CashThreeStartNo?.Trim() ?? string.Empty,
                        CashThreeEndNo = x.CashThreeEndNo?.Trim() ?? string.Empty,
                        CashThreeSubTrack = x.CashThreeSubTrack?.Trim() ?? string.Empty,
                        CashThreeSubStartNo = x.CashThreeSubStartNo?.Trim() ?? string.Empty,
                        CashThreeSubEndNo = x.CashThreeSubEndNo?.Trim() ?? string.Empty,
                        City = x.City?.Trim() ?? string.Empty,
                        PlaceCode = x.PlaceCode?.Trim() ?? string.Empty,
                        EmpCode = x.EmpCode?.Trim() ?? string.Empty,
                    }).ToList();

                // 依序寫入 DBF (DBF 絕對權威)
                foreach (var item in validItems)
                {
                    var existing = await _context.InvoicePurchaseMasters.FindAsync(p, t, item.CompanyCode);
                    var op = existing != null ? "UPDATE" : "INSERT";
                    var keyVal = $"{p},{t},{item.CompanyCode}";
                    var fields = AssembleDbfFields(item, p, t, item.CompanyCode);

                    var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, op, KeyField, keyVal, fields);
                    if (!dbfRes.Success)
                    {
                        if (dbfRes.ErrorType == "LOCK_TIMEOUT")
                        {
                            return StatusCode(StatusCodes.Status409Conflict, new
                            {
                                error = dbfRes.Error,
                                message = $"發票購買紀錄 [{item.CompanyCode}] 正被地端其他工作站編輯中，批次存檔取消"
                            });
                        }
                        return BadRequest(new
                        {
                            error = dbfRes.Error,
                            message = $"地端 DBF 寫入失敗 [{item.CompanyCode}]: " + (dbfRes.Message ?? dbfRes.Error)
                        });
                    }
                    if (dbfRes.Recno > 0) item.RecordNumber = dbfRes.Recno;

                    if (existing != null)
                    {
                        UpdateEntityValues(existing, item);
                        existing.RecordNumber = item.RecordNumber;
                    }
                    else
                    {
                        _context.InvoicePurchaseMasters.Add(item);
                    }
                }

                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

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
                var targetPeriod = NormalizeToDbfPeriod(req.Period);
                var targetTimes = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

                var companies = await _context.CompanyMasters.AsNoTracking().ToListAsync();
                var existingPurchases = await _context.InvoicePurchaseMasters
                    .Where(x => x.Period == targetPeriod && (x.Times == targetTimes || x.Times == targetTimes.TrimStart('0')))
                    .ToListAsync();
                var existingMap = existingPurchases
                    .GroupBy(x => x.CompanyCode.Trim().ToUpper())
                    .ToDictionary(g => g.Key, g => g.First());

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
                            CompanyShortName = !string.IsNullOrWhiteSpace(c.ShortName) ? c.ShortName : (!string.IsNullOrWhiteSpace(c.CompanyName) ? c.CompanyName : string.Empty),
                            UnifiedNo = c.UnifiedNo,
                            TaxNo = c.TaxNo
                        };

                        var fields = AssembleDbfFields(item, targetPeriod, targetTimes, code);
                        var keyVal = $"{targetPeriod},{targetTimes},{code}";
                        var dbfRes = await _dbfSyncService.WriteRecordAsync(DbfPath, DbfName, "INSERT", KeyField, keyVal, fields);
                        if (dbfRes.Success && dbfRes.Recno > 0)
                            item.RecordNumber = dbfRes.Recno;

                        _context.InvoicePurchaseMasters.Add(item);
                    }
                }
                await _context.SaveChangesAsync();
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, DbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, DbfName, newChecksum);

                var totalCount = await _context.InvoicePurchaseMasters
                    .CountAsync(x => x.Period == targetPeriod && x.Times == targetTimes);

                return Ok(new
                {
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

        public class BuyinvPrintQueryRequest
        {
            public string? Period { get; set; }
            public string? Times { get; set; }
            public string? Year { get; set; }
            public string? StartMonth { get; set; }
            public string? EndMonth { get; set; }
            public string? Mode { get; set; }
            public string? CityCondition { get; set; }
            public string? PlaceCondition { get; set; }
            public string? SortOrder { get; set; }
        }

        // POST: api/wbase3020/buyinv-print-query
        [HttpPost("buyinv-print-query")]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> BuyinvPrintQuery([FromBody] BuyinvPrintQueryRequest req)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, SyncKeyField);

                var rawPeriod = string.IsNullOrWhiteSpace(req.Period) ? "11505-06" : req.Period.Trim();
                var cleanPeriod = rawPeriod.Replace("-", "").Trim();
                var dbfPeriod = NormalizeToDbfPeriod(rawPeriod);
                var times = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

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

                var query = from p in _context.InvoicePurchaseMasters.AsNoTracking()
                            where (p.Period == rawPeriod || p.Period == cleanPeriod || p.Period == hyphenPeriod || p.Period == dbfPeriod)
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
                if (mode == "1")
                {
                    var city = (req.CityCondition ?? "*").Trim();
                    if (city != "*" && !string.IsNullOrWhiteSpace(city))
                    {
                        query = query.Where(x => x.c != null && x.c.Address != null && x.c.Address.Contains(city));
                    }
                }
                else if (mode == "2")
                {
                    var place = (req.PlaceCondition ?? "").Trim();
                    if (!string.IsNullOrWhiteSpace(place))
                    {
                        query = query.Where(x => x.c != null && x.c.PlaceCode != null && x.c.PlaceCode.Contains(place));
                    }
                }

                var sortOrder = (req.SortOrder ?? "1").Trim();
                if (sortOrder == "2")
                {
                    query = query.OrderBy(x => !string.IsNullOrEmpty(x.p.TaxNo) ? x.p.TaxNo : (x.c != null ? x.c.TaxNo : ""))
                                 .ThenBy(x => x.p.CompanyCode);
                }
                else
                {
                    query = query.OrderBy(x => !string.IsNullOrEmpty(x.p.UnifiedNo) ? x.p.UnifiedNo : (x.c != null ? x.c.UnifiedNo : ""))
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
                        : (!string.IsNullOrWhiteSpace(c?.UnifiedNo) ? c.UnifiedNo.Trim() : string.Empty);

                    p.TaxNo = !string.IsNullOrWhiteSpace(p.TaxNo) ? p.TaxNo.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.TaxNo) ? c.TaxNo.Trim() : string.Empty);

                    p.CompanyShortName = !string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName.Trim() : string.Empty));

                    p.CompanyName = !string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName.Trim()
                        : (!string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim() : string.Empty));

                    p.CompanyAddr = !string.IsNullOrWhiteSpace(c?.Address) ? c.Address.Trim()
                        : (!string.IsNullOrWhiteSpace(p.City) ? p.City.Trim() : string.Empty);

                    p.CompanyTel = !string.IsNullOrWhiteSpace(c?.Tel) ? c.Tel.Trim() : string.Empty;
                    p.CompanyFax = !string.IsNullOrWhiteSpace(c?.Fax) ? c.Fax.Trim() : string.Empty;
                    p.City = ExtractCity(c?.Address);
                    p.PlaceCode = c?.PlaceCode?.Trim() ?? string.Empty;
                    p.EmpCode = c?.EmpCode?.Trim() ?? string.Empty;

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

        public class PrintRangeQuery
        {
            public string? Period { get; set; }
            public string? Times { get; set; }
            public string? CodeStart { get; set; }
            public string? CodeEnd { get; set; }
        }

        // POST: api/wbase3020/print
        [HttpPost("print")]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> PrintRange([FromBody] PrintRangeQuery query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, DbfName, PgSchema, PgTable, KeyField);

                var period = string.IsNullOrWhiteSpace(query.Period) ? "11505-06" : query.Period.Trim();
                var times = string.IsNullOrWhiteSpace(query.Times) ? "1" : query.Times.Trim();

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

                    p.UnifiedNo = !string.IsNullOrWhiteSpace(c?.UnifiedNo) ? c.UnifiedNo.Trim()
                        : (!string.IsNullOrWhiteSpace(p.UnifiedNo) ? p.UnifiedNo.Trim() : string.Empty);

                    p.TaxNo = !string.IsNullOrWhiteSpace(c?.TaxNo) ? c.TaxNo.Trim()
                        : (!string.IsNullOrWhiteSpace(p.TaxNo) ? p.TaxNo.Trim() : string.Empty);

                    p.CompanyShortName = !string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName.Trim()
                        : (!string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim() : string.Empty));

                    p.CompanyName = !string.IsNullOrWhiteSpace(c?.CompanyName) ? c.CompanyName.Trim()
                        : (!string.IsNullOrWhiteSpace(c?.ShortName) ? c.ShortName.Trim()
                        : (!string.IsNullOrWhiteSpace(p.CompanyShortName) ? p.CompanyShortName.Trim() : string.Empty));

                    p.CompanyAddr = !string.IsNullOrWhiteSpace(c?.Address) ? c.Address.Trim()
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

        private static Dictionary<string, object?> AssembleDbfFields(InvoicePurchaseMaster model, string period, string times, string companyCode)
        {
            return new Dictionary<string, object?>
            {
                ["yymm"] = period,
                ["times"] = times,
                ["no"] = companyCode,
                ["name"] = model.CompanyShortName,
                ["unino"] = model.UnifiedNo,
                ["taxno"] = model.TaxNo,
                ["a02"] = model.ManualTwoDup,
                ["a02b"] = model.ManualTwoDupSub,
                ["a03"] = model.ManualThreeDup,
                ["a03b"] = model.ManualThreeDupSub,
                ["spec"] = model.ManualSpecial,
                ["c02"] = model.CashTwoDup,
                ["c03"] = model.CashThreeDup,
                ["c03b"] = model.CashThreeDupSub,
                ["a02beg"] = model.ManualTwoTrack,
                ["a02begno"] = model.ManualTwoStartNo,
                ["a02endno"] = model.ManualTwoEndNo,
                ["a02bbeg"] = model.ManualTwoSubTrack,
                ["a02bbegno"] = model.ManualTwoSubStartNo,
                ["a02bendno"] = model.ManualTwoSubEndNo,
                ["a03beg"] = model.ManualThreeTrack,
                ["a03begno"] = model.ManualThreeStartNo,
                ["a03endno"] = model.ManualThreeEndNo,
                ["a03bbeg"] = model.ManualThreeSubTrack,
                ["a03bbegno"] = model.ManualThreeSubStartNo,
                ["a03bendno"] = model.ManualThreeSubEndNo,
                ["specbeg"] = model.SpecialTrack,
                ["specbegno"] = model.SpecialStartNo,
                ["specendno"] = model.SpecialEndNo,
                ["c02beg"] = model.CashTwoTrack,
                ["c02begno"] = model.CashTwoStartNo,
                ["c02endno"] = model.CashTwoEndNo,
                ["c03beg"] = model.CashThreeTrack,
                ["c03begno"] = model.CashThreeStartNo,
                ["c03endno"] = model.CashThreeEndNo,
                ["c03bbeg"] = model.CashThreeSubTrack,
                ["c03bbegno"] = model.CashThreeSubStartNo,
                ["c03bendno"] = model.CashThreeSubEndNo
            };
        }

        private static void UpdateEntityValues(InvoicePurchaseMaster target, InvoicePurchaseMaster src)
        {
            target.CompanyShortName = src.CompanyShortName?.Trim() ?? string.Empty;
            target.UnifiedNo = src.UnifiedNo?.Trim() ?? string.Empty;
            target.TaxNo = src.TaxNo?.Trim() ?? string.Empty;
            target.ManualTwoDup = src.ManualTwoDup;
            target.ManualTwoDupSub = src.ManualTwoDupSub;
            target.ManualThreeDup = src.ManualThreeDup;
            target.ManualThreeDupSub = src.ManualThreeDupSub;
            target.ManualSpecial = src.ManualSpecial;
            target.CashTwoDup = src.CashTwoDup;
            target.CashThreeDup = src.CashThreeDup;
            target.CashThreeDupSub = src.CashThreeDupSub;
            target.ManualTwoTrack = src.ManualTwoTrack?.Trim() ?? string.Empty;
            target.ManualTwoStartNo = src.ManualTwoStartNo?.Trim() ?? string.Empty;
            target.ManualTwoEndNo = src.ManualTwoEndNo?.Trim() ?? string.Empty;
            target.ManualTwoSubTrack = src.ManualTwoSubTrack?.Trim() ?? string.Empty;
            target.ManualTwoSubStartNo = src.ManualTwoSubStartNo?.Trim() ?? string.Empty;
            target.ManualTwoSubEndNo = src.ManualTwoSubEndNo?.Trim() ?? string.Empty;
            target.ManualThreeTrack = src.ManualThreeTrack?.Trim() ?? string.Empty;
            target.ManualThreeStartNo = src.ManualThreeStartNo?.Trim() ?? string.Empty;
            target.ManualThreeEndNo = src.ManualThreeEndNo?.Trim() ?? string.Empty;
            target.ManualThreeSubTrack = src.ManualThreeSubTrack?.Trim() ?? string.Empty;
            target.ManualThreeSubStartNo = src.ManualThreeSubStartNo?.Trim() ?? string.Empty;
            target.ManualThreeSubEndNo = src.ManualThreeSubEndNo?.Trim() ?? string.Empty;
            target.SpecialTrack = src.SpecialTrack?.Trim() ?? string.Empty;
            target.SpecialStartNo = src.SpecialStartNo?.Trim() ?? string.Empty;
            target.SpecialEndNo = src.SpecialEndNo?.Trim() ?? string.Empty;
            target.CashTwoTrack = src.CashTwoTrack?.Trim() ?? string.Empty;
            target.CashTwoStartNo = src.CashTwoStartNo?.Trim() ?? string.Empty;
            target.CashTwoEndNo = src.CashTwoEndNo?.Trim() ?? string.Empty;
            target.CashThreeTrack = src.CashThreeTrack?.Trim() ?? string.Empty;
            target.CashThreeStartNo = src.CashThreeStartNo?.Trim() ?? string.Empty;
            target.CashThreeEndNo = src.CashThreeEndNo?.Trim() ?? string.Empty;
            target.CashThreeSubTrack = src.CashThreeSubTrack?.Trim() ?? string.Empty;
            target.CashThreeSubStartNo = src.CashThreeSubStartNo?.Trim() ?? string.Empty;
            target.CashThreeSubEndNo = src.CashThreeSubEndNo?.Trim() ?? string.Empty;
            target.City = src.City?.Trim() ?? string.Empty;
            target.PlaceCode = src.PlaceCode?.Trim() ?? string.Empty;
            target.EmpCode = src.EmpCode?.Trim() ?? string.Empty;
        }
    }
}
