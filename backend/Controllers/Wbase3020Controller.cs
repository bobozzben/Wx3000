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
            await _seedLock.WaitAsync();
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
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""購買次數"" character varying(10) NOT NULL DEFAULT '1';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""公司名稱"" character varying(255) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""公司簡稱"" character varying(255) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""公司統編"" character varying(20) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""稅籍編號"" character varying(30) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""公司地址"" character varying(255) DEFAULT '';
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
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""購票地點編號"" character varying(50) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""建檔人員"" character varying(50) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""登打人員編號"" character varying(50) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""序"" integer DEFAULT 1;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""流水號"" integer DEFAULT 1;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""上次順序"" integer DEFAULT 0;
                    ALTER TABLE ""e3000__comm"".""基本發票購買"" ADD COLUMN IF NOT EXISTS ""guid"" character varying(50) DEFAULT '';

                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""購票地點編號"" character varying(50) DEFAULT '';
                    ALTER TABLE ""e3000__comm"".""公司資料"" ADD COLUMN IF NOT EXISTS ""登打人員編號"" character varying(50) DEFAULT '';

                    DELETE FROM ""e3000__comm"".""基本發票購買"" a
                    USING ""e3000__comm"".""基本發票購買"" b
                    WHERE a.ctid < b.ctid
                      AND a.""期別"" = b.""期別""
                      AND a.""次數"" = b.""次數""
                      AND a.""公司編號"" = b.""公司編號"";
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EnsureTableCreatedAndSeededAsync error: {ex.Message}");
            }
            finally
            {
                _seedLock.Release();
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

                var cleanPeriod = targetPeriod.Replace("'", "''");
                var cleanTimes = targetTimes.Replace("'", "''");

                var sql = $@"
DO $$ 
DECLARE
  myRec RECORD;
  aa text := '';
BEGIN
  FOR myRec IN 
    SELECT 
      ""公司編號"", 
      COALESCE(""公司名稱"", '') AS ""公司名稱"", 
      COALESCE(""公司簡稱"", '') AS ""公司簡稱"", 
      COALESCE(""公司統編"", '') AS ""公司統編"", 
      COALESCE(""稅籍編號"", '') AS ""稅籍編號"", 
      COALESCE(""公司地址"", '') AS ""公司地址"", 
      COALESCE(""購票地點編號"", '') AS ""購票地點編號"", 
      COALESCE(""登打人員編號"", '') AS ""登打人員編號""
    FROM ""e3000__comm"".""公司資料"" 
    WHERE ""公司編號"" IS NOT NULL AND TRIM(""公司編號"") <> ''
    ORDER BY ""公司編號""
  LOOP
    SELECT ""公司編號"" FROM ""e3000__comm"".""基本發票購買"" 
    WHERE ""公司編號"" = myRec.""公司編號"" 
      AND ""期別"" = '{cleanPeriod}' 
      AND (""購買次數"" = '{cleanTimes}' OR ""次數"" = '{cleanTimes}') 
    INTO aa; 

    IF NOT FOUND THEN 
      INSERT INTO ""e3000__comm"".""基本發票購買"" (
        ""序"", ""流水號"", ""上次順序"", ""期別"", ""次數"", ""購買次數"", 
        ""公司編號"", ""公司名稱"", ""公司簡稱"", ""公司統編"", ""稅籍編號"", 
        ""公司地址"", ""購票地點編號"", ""購買地點"", ""登打人員編號"", ""建檔人員"", ""guid""
      ) VALUES (
        1, 1, 0, '{cleanPeriod}', '{cleanTimes}', '{cleanTimes}', 
        myRec.""公司編號"", myRec.""公司名稱"", myRec.""公司簡稱"", myRec.""公司統編"", myRec.""稅籍編號"", 
        myRec.""公司地址"", myRec.""購票地點編號"", myRec.""購票地點編號"", myRec.""登打人員編號"", myRec.""登打人員編號"",
        md5(random()::text || clock_timestamp()::text)
      ); 
    ELSE 
      UPDATE ""e3000__comm"".""基本發票購買"" 
      SET 
        ""公司名稱"" = myRec.""公司名稱"", 
        ""公司簡稱"" = myRec.""公司簡稱"", 
        ""公司統編"" = myRec.""公司統編"", 
        ""稅籍編號"" = myRec.""稅籍編號"", 
        ""公司地址"" = myRec.""公司地址"", 
        ""購票地點編號"" = myRec.""購票地點編號"", 
        ""購買地點"" = myRec.""購票地點編號"", 
        ""登打人員編號"" = myRec.""登打人員編號"", 
        ""建檔人員"" = myRec.""登打人員編號"",
        ""次數"" = '{cleanTimes}',
        ""購買次數"" = '{cleanTimes}'
      WHERE ""公司編號"" = myRec.""公司編號"" 
        AND ""期別"" = '{cleanPeriod}' 
        AND (""購買次數"" = '{cleanTimes}' OR ""次數"" = '{cleanTimes}');
    END IF; 
  END LOOP; 
END; 
$$;
";

                await _context.Database.ExecuteSqlRawAsync(sql);

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
            public string? Period { get; set; }          // 依列印期別 (e.g. "11505-06")
            public string? Times { get; set; }           // 次數 (e.g. "1")
            public string? Mode { get; set; }            // "1": 依地址縣市, "2": 依購買地點
            public string? CityCondition { get; set; }   // e.g. "*" 代表全部, 或特定縣市
            public string? PlaceCondition { get; set; }  // e.g. 購買地點代碼/名稱
            public string? SortOrder { get; set; }       // "1": 依統一編號, "2": 依稅籍編號
        }

        // POST: api/wbase3020/buyinv-print-query
        [HttpPost("buyinv-print-query")]
        public async Task<ActionResult<IEnumerable<InvoicePurchaseMaster>>> BuyinvPrintQuery([FromBody] BuyinvPrintQueryRequest req)
        {
            try
            {
                var period = string.IsNullOrWhiteSpace(req.Period) ? "11505-06" : req.Period.Trim();
                var times = string.IsNullOrWhiteSpace(req.Times) ? "1" : req.Times.Trim();

                await EnsureTableCreatedAndSeededAsync(period, times);

                var query = from p in _context.InvoicePurchaseMasters.AsNoTracking()
                            where p.Period == period && p.Times == times
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
                if (sortOrder == "2") // 2.依稅籍編號
                {
                    query = query.OrderBy(x => x.c != null && !string.IsNullOrWhiteSpace(x.c.TaxNo) ? x.c.TaxNo : x.p.TaxNo)
                                 .ThenBy(x => x.p.CompanyCode);
                }
                else // 1.依統一編號 (預設)
                {
                    query = query.OrderBy(x => x.c != null && !string.IsNullOrWhiteSpace(x.c.UnifiedNo) ? x.c.UnifiedNo : x.p.UnifiedNo)
                                 .ThenBy(x => x.p.CompanyCode);
                }

                var rawList = await query.ToListAsync();
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
