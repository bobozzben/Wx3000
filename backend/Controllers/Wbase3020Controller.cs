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

        public Wbase3020Controller(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableCreatedAndSeededAsync(string period, string times)
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE SCHEMA IF NOT EXISTS ""e3000__comm"";
                    CREATE TABLE IF NOT EXISTS ""e3000__comm"".""基本發票購買"" (
                        ""期別"" character varying(20) NOT NULL,
                        ""次數"" character varying(10) NOT NULL DEFAULT '1',
                        ""公司編號"" character varying(30) NOT NULL,
                        ""公司簡稱"" character varying(255) DEFAULT '',
                        ""公司統編"" character varying(20) DEFAULT '',
                        ""稅籍編號"" character varying(30) DEFAULT '',
                        ""手開二聯"" integer NOT NULL DEFAULT 0,
                        ""手開二聯副"" integer NOT NULL DEFAULT 0,
                        ""手開三聯"" integer NOT NULL DEFAULT 0,
                        ""手開三聯副"" integer NOT NULL DEFAULT 0,
                        ""手開特種"" integer NOT NULL DEFAULT 0,
                        ""收銀二聯"" integer NOT NULL DEFAULT 0,
                        ""收銀三聯"" integer NOT NULL DEFAULT 0,
                        ""收銀三聯副"" integer NOT NULL DEFAULT 0,
                        ""縣市別"" character varying(50) DEFAULT '',
                        ""購買地點"" character varying(50) DEFAULT '',
                        ""建檔人員"" character varying(50) DEFAULT '',
                        ""guid"" character varying(50) DEFAULT '',
                        CONSTRAINT ""PK_基本發票購買"" PRIMARY KEY (""期別"", ""次數"", ""公司編號"")
                    );
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""期別"" TYPE character varying(30);
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""公司編號"" TYPE character varying(50);
                    DO $$ BEGIN ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""序"" DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END $$;
                    DO $$ BEGIN ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""流水號"" DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END $$;
                    DO $$ BEGIN ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""上次順序"" DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END $$;
                    DO $$ BEGIN ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""購買次數"" DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END $$;
                    DO $$ BEGIN ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""guid"" DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END $$;
                    DO $$ BEGIN ALTER TABLE ""e3000__comm"".""基本發票購買"" ALTER COLUMN ""guid"" TYPE character varying(100); EXCEPTION WHEN OTHERS THEN END $$;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""次數"" character varying(10) NOT NULL DEFAULT '1';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""公司簡稱"" character varying(255) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""公司統編"" character varying(20) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""稅籍編號"" character varying(30) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""手開二聯"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""手開二聯副"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""手開三聯"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""手開三聯副"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""手開特種"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""收銀二聯"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""收銀三聯"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""收銀三聯副"" integer NOT NULL DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""縣市別"" character varying(50) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""購買地點"" character varying(50) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""建檔人員"" character varying(50) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""guid"" character varying(50) DEFAULT '';
                ");

                // Check if any record exists for this period & times
                var hasRecords = await _context.InvoicePurchaseMasters
                    .AnyAsync(x => x.Period == period && x.Times == times);

                if (!hasRecords)
                {
                    var newItems = new List<InvoicePurchaseMaster>();

                    try
                    {
                        var companies = await _context.CompanyMasters.AsNoTracking().ToListAsync();
                        foreach (var c in companies)
                        {
                            if (string.IsNullOrWhiteSpace(c.CompanyCode)) continue;
                            newItems.Add(new InvoicePurchaseMaster
                            {
                                Period = period,
                                Times = times,
                                CompanyCode = c.CompanyCode.Trim(),
                                CompanyShortName = c.ShortName?.Trim() ?? c.CompanyName?.Trim() ?? string.Empty,
                                UnifiedNo = c.UnifiedNo?.Trim() ?? string.Empty,
                                TaxNo = c.TaxNo?.Trim() ?? string.Empty,
                                Guid = Guid.NewGuid().ToString("N"),
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"CompanyMasters fetch info: {ex.Message}");
                    }

                    var existingCodes = new HashSet<string>(newItems.Select(x => x.CompanyCode));

                    // Demo sample seed data matching standard specification
                    var defaultCompanies = new[]
                    {
                        new { Code = "H-002", Name = "", Ban = "48973517", Tax = "", M2 = 0, M2S = 0, M3 = 0, M3S = 0, MS = 13, C2 = 2, C3 = 17, C3S = 1 },
                        new { Code = "104", Name = "", Ban = "", Tax = "", M2 = 0, M2S = 0, M3 = 0, M3S = 5, MS = 16, C2 = 0, C3 = 0, C3S = 8 },
                        new { Code = "000", Name = "財法人", Ban = "", Tax = "", M2 = 0, M2S = 0, M3 = 0, M3S = 0, MS = 0, C2 = 0, C3 = 5, C3S = 0 },
                        new { Code = "3-902", Name = "", Ban = "", Tax = "", M2 = 17, M2S = 1, M3 = 8, M3S = 0, MS = 2, C2 = 0, C3 = 0, C3S = 9 },
                        new { Code = "0003", Name = "", Ban = "", Tax = "", M2 = 0, M2S = 18, M3 = 1, M3S = 4, MS = 2, C2 = 8, C3 = 27, C3S = 4 },
                        new { Code = "117", Name = "", Ban = "", Tax = "", M2 = 19, M2S = 9, M3 = 0, M3S = 0, MS = 0, C2 = 0, C3 = 0, C3S = 13 },
                        new { Code = "A02", Name = "", Ban = "00292977", Tax = "", M2 = 0, M2S = 6, M3 = 0, M3S = 3, MS = 16, C2 = 0, C3 = 12, C3S = 3 },
                        new { Code = "0008-1", Name = "", Ban = "28327787", Tax = "", M2 = 0, M2S = 0, M3 = 6, M3S = 0, MS = 19, C2 = 10, C3 = 7, C3S = 0 },
                        new { Code = "0008-5", Name = "", Ban = "72830125", Tax = "", M2 = 15, M2S = 0, M3 = 0, M3S = 9, MS = 0, C2 = 5, C3 = 0, C3S = 5 },
                        new { Code = "001", Name = "", Ban = "", Tax = "", M2 = 9, M2S = 5, M3 = 0, M3S = 9, MS = 0, C2 = 0, C3 = 0, C3S = 9 },
                        new { Code = "A01", Name = "", Ban = "27585532", Tax = "", M2 = 19, M2S = 9, M3 = 0, M3S = 0, MS = 0, C2 = 0, C3 = 0, C3S = 14 },
                        new { Code = "A0088", Name = "", Ban = "", Tax = "", M2 = 18, M2S = 1, M3 = 0, M3S = 0, MS = 6, C2 = 14, C3 = 25, C3S = 7 },
                        new { Code = "A003", Name = "", Ban = "", Tax = "", M2 = 13, M2S = 0, M3 = 0, M3S = 0, MS = 0, C2 = 0, C3 = 7, C3S = 10 },
                        new { Code = "005", Name = "", Ban = "", Tax = "", M2 = 0, M2S = 15, M3 = 8, M3S = 8, MS = 16, C2 = 0, C3 = 0, C3S = 0 },
                        new { Code = "005-1", Name = "", Ban = "86941142", Tax = "", M2 = 0, M2S = 0, M3 = 8, M3S = 4, MS = 11, C2 = 15, C3 = 0, C3S = 0 },
                        new { Code = "1-1209", Name = "", Ban = "27670559", Tax = "", M2 = 15, M2S = 0, M3 = 5, M3S = 0, MS = 12, C2 = 0, C3 = 9, C3S = 10 },
                        new { Code = "1-1215", Name = "", Ban = "69725578", Tax = "", M2 = 18, M2S = 0, M3 = 0, M3S = 0, MS = 4, C2 = 0, C3 = 0, C3S = 13 },
                        new { Code = "40042", Name = "", Ban = "", Tax = "", M2 = 1, M2S = 0, M3 = 9, M3S = 0, MS = 0, C2 = 9, C3 = 0, C3S = 5 },
                        new { Code = "41", Name = "", Ban = "", Tax = "", M2 = 0, M2S = 17, M3 = 0, M3S = 1, MS = 0, C2 = 17, C3 = 5, C3S = 0 }
                    };

                    foreach (var d in defaultCompanies)
                    {
                        if (!existingCodes.Contains(d.Code))
                        {
                            newItems.Add(new InvoicePurchaseMaster
                            {
                                Period = period,
                                Times = times,
                                CompanyCode = d.Code,
                                CompanyShortName = d.Name,
                                UnifiedNo = d.Ban,
                                TaxNo = d.Tax,
                                ManualTwoDup = d.M2,
                                ManualTwoDupSub = d.M2S,
                                ManualThreeDup = d.M3,
                                ManualThreeDupSub = d.M3S,
                                ManualSpecial = d.MS,
                                CashTwoDup = d.C2,
                                CashThreeDup = d.C3,
                                CashThreeDupSub = d.C3S,
                                Guid = Guid.NewGuid().ToString("N"),
                            });
                        }
                    }

                    if (newItems.Count > 0)
                    {
                        _context.InvoicePurchaseMasters.AddRange(newItems);
                        await _context.SaveChangesAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EnsureTableCreatedAndSeededAsync error: {ex.Message}");
            }
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
                return Ok(list);
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
                var period = string.IsNullOrWhiteSpace(query.Period) ? "11505-06" : query.Period.Trim();
                var times = string.IsNullOrWhiteSpace(query.Times) ? "1" : query.Times.Trim();

                await EnsureTableCreatedAndSeededAsync(period, times);

                var queryable = _context.InvoicePurchaseMasters
                    .AsNoTracking()
                    .Where(x => x.Period == period && x.Times == times);

                if (!string.IsNullOrWhiteSpace(query.CodeStart))
                {
                    var start = query.CodeStart.Trim();
                    queryable = queryable.Where(f => f.CompanyCode.Trim().CompareTo(start) >= 0);
                }

                if (!string.IsNullOrWhiteSpace(query.CodeEnd))
                {
                    var end = query.CodeEnd.Trim();
                    queryable = queryable.Where(f => f.CompanyCode.Trim().CompareTo(end) <= 0);
                }

                var list = await queryable.OrderBy(f => f.CompanyCode).ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase3020 Print error: {ex.Message}");
                return Ok(new List<InvoicePurchaseMaster>());
            }
        }
    }
}
