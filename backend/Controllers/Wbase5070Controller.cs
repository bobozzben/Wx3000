using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    /// <summary>
    /// 5-7 碳健檢企業名單匯出 (VFP base50.prg wbasemenu05cmd07 → wbase4000 選客戶 + wbase5070 條件與 F8 轉出)。
    /// 每家客戶的「年度銷售額合計」= &lt;資料磁碟機&gt;:\w3000\data\&lt;客戶代號&gt;\&lt;年末 2 碼&gt;\t403.dbf (401 資料檔)
    /// 中 mm 在起訖月份內的 t025 加總。t403 以該目錄為 PostgreSQL schema (例如 "c:/w3000/data/001/14") 同步快照後在 SQL 加總。
    /// 只讀資料，不寫任何 DBF；Excel 由前端產生。轉檔列印密碼每個計算請求都要再帶一次。
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase5070Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;
        private readonly ILogger<Wbase5070Controller> _logger;

        /// <summary>每次計算請求最多幾家客戶 (每家至少一次 LocalAgent 呼叫，前端分批送出並顯示進度)</summary>
        public const int MaxBatch = 50;
        private const int NoBytes = 8; // customer.no C(8)
        private const string SalesDbf = "t403";

        private static readonly Encoding Big5 = CreateBig5();

        private static Encoding CreateBig5()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(950);
        }

        public Wbase5070Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService, ILogger<Wbase5070Controller> logger)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
            _logger = logger;
        }

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        /// <summary>VFP datapath = &lt;資料磁碟機&gt;:\w3000\data\ (w3000func.prg w_init_env)</summary>
        private string DataRoot => $@"{_configService.DataDrive}:\w3000\data";

        // GET: api/wbase5070/customers (VFP wbase4000 的 tmpcust：customer 全部客戶，依代號排序，全部未選)
        [HttpGet("customers")]
        public async Task<IActionResult> GetCustomers()
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");
                using var cmd = await CommandAsync();
                // 空白代號沒有對應的資料目錄，不列出
                cmd.CommandText = $@"SELECT ""no"", ""name"" FROM ""{PgSchema}"".""customer"" WHERE TRIM(""no"") <> '' ORDER BY TRIM(""no"") COLLATE ""C"";";
                var list = new List<CarbonCustomerDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new CarbonCustomerDto { No = Str(reader, "no"), Name = Str(reader, "name"), Selected = false });
                }
                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Wbase5070 讀取客戶清單失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取客戶資料失敗: " + ex.Message });
            }
        }

        // POST: api/wbase5070/verify-password (F8 轉出前的轉檔列印密碼，VFP w_get_password_2)
        [HttpPost("verify-password")]
        public IActionResult VerifyPassword([FromBody] TransferPasswordRequest req) =>
            Ok(new { ok = TransferPasswordService.Verify(DbfPath, req?.Password) });

        // POST: api/wbase5070/sales (F8：計算勾選客戶的年度銷售額合計，前端分批呼叫)
        [HttpPost("sales")]
        public async Task<IActionResult> GetSales([FromBody] CarbonSalesRequest req)
        {
            if (!TransferPasswordService.Verify(DbfPath, req?.Password)) return StatusCode(StatusCodes.Status403Forbidden, new { message = "密碼錯誤!" });

            var yearFolder = YearFolder(req!.Year);
            if (yearFolder == null) return BadRequest(new { message = "年度不可空白!" });
            if (req.StartMonth < 1 || req.StartMonth > 12 || req.EndMonth < 1 || req.EndMonth > 12)
                return BadRequest(new { message = "請輸入1至12 月份!" });
            if (req.EndMonth < req.StartMonth) return BadRequest(new { message = "結束月份比起始月份小!" });

            var nos = (req.Nos ?? new List<string>())
                .Select(n => (n ?? string.Empty).Trim())
                .Where(n => n.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToList();
            if (nos.Count == 0) return BadRequest(new { message = "請先選擇客戶" });
            if (nos.Count > MaxBatch) return BadRequest(new { message = $"每次最多計算 {MaxBatch} 家客戶" });
            var badNo = nos.FirstOrDefault(n => Big5.GetByteCount(n) > NoBytes || n.Any(char.IsControl));
            if (badNo != null) return BadRequest(new { message = $"不合法的客戶代號: {badNo}" });

            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");
                var customers = await LoadCustomersAsync(nos);

                var smm = req.StartMonth.ToString("00");
                var emm = req.EndMonth.ToString("00");
                var result = new CarbonSalesResultDto();
                foreach (var no in nos)
                {
                    if (!customers.TryGetValue(no, out var row))
                    {
                        result.Missing.Add(no);
                        continue;
                    }
                    await FillSalesAsync(row, yearFolder, smm, emm);
                    result.Rows.Add(row);
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Wbase5070 計算年度銷售額失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "計算年度銷售額失敗: " + ex.Message });
            }
        }

        /// <summary>
        /// VFP：IF FILE(prntpath+'t403.dbf') → SELECT SUM(t025) FROM t403 WHERE mm>=smm AND mm<=emm；
        /// 沒有檔案或開檔失敗時為 0。t403 以 keyFields "" 同步 (保留全部列，和 VFP 的 SUM 一致)
        /// </summary>
        private async Task FillSalesAsync(CarbonSalesRowDto row, string yearFolder, string smm, string emm)
        {
            row.T025 = 0;
            if (!IsSafePathSegment(row.No))
            {
                row.Source = "nofile";
                return;
            }

            var dir = Path.Combine(DataRoot, row.No, yearFolder);
            if (!System.IO.File.Exists(Path.Combine(dir, SalesDbf + ".dbf")))
            {
                row.Source = "nofile";
                return;
            }

            var schema = $"{_configService.DataDrive.ToLowerInvariant()}:/w3000/data/{row.No.ToLowerInvariant()}/{yearFolder}";
            try
            {
                if (!await _dbfSyncService.EnsureTableSyncedAsync(dir, SalesDbf, schema, SalesDbf, ""))
                {
                    row.Source = "error";
                    row.Message = $"無法同步 {Path.Combine(dir, SalesDbf + ".dbf")} (LocalAgent 未回應或檔案無法讀取)";
                    return;
                }

                using var cmd = await CommandAsync();
                cmd.CommandText = $@"SELECT COALESCE(SUM(""t025""), 0) FROM ""{schema.Replace("\"", "\"\"")}"".""{SalesDbf}"" WHERE ""mm"" >= @smm AND ""mm"" <= @emm;";
                AddParam(cmd, "@smm", smm);
                AddParam(cmd, "@emm", emm);
                var sum = Convert.ToDecimal(await cmd.ExecuteScalarAsync() ?? 0m);
                // VFP 寫回 tmpcust.t025 N(16)：四捨五入到整數
                row.T025 = Math.Round(sum, 0, MidpointRounding.AwayFromZero);
                row.Source = "ok";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Wbase5070 讀取 {Dir}\\t403.dbf 失敗", dir);
                row.Source = "error";
                row.Message = $"讀取 {Path.Combine(dir, SalesDbf + ".dbf")} 失敗: {ex.Message}";
            }
        }

        private async Task<Dictionary<string, CarbonSalesRowDto>> LoadCustomersAsync(List<string> nos)
        {
            using var cmd = await CommandAsync();
            var names = new List<string>();
            for (var i = 0; i < nos.Count; i++)
            {
                names.Add($"@n{i}");
                AddParam(cmd, $"@n{i}", nos[i]);
            }
            cmd.CommandText = $@"
                SELECT ""no"", ""name"", ""linkman"", ""linktel"", ""email"", ""unino"", ""addr"", ""capital"", ""pnostd"", ""_record_number""
                FROM ""{PgSchema}"".""customer""
                WHERE TRIM(""no"") IN ({string.Join(",", names)})
                ORDER BY ""_record_number"";";

            var map = new Dictionary<string, CarbonSalesRowDto>(StringComparer.Ordinal);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var no = Str(reader, "no");
                if (map.ContainsKey(no)) continue; // 同代號以 RECNO 最小的一筆為準 (VFP SEEK)
                map[no] = new CarbonSalesRowDto
                {
                    No = no,
                    Name = Str(reader, "name"),
                    Linkman = Str(reader, "linkman"),
                    Linktel = Str(reader, "linktel"),
                    Email = Str(reader, "email"),
                    Unino = Str(reader, "unino"),
                    Addr = Str(reader, "addr"),
                    Capital = reader["capital"] == DBNull.Value ? 0m : Convert.ToDecimal(reader["capital"]),
                    Pnostd = Str(reader, "pnostd"),
                };
            }
            return map;
        }

        /// <summary>
        /// VFP RIGHT(pyear,2)：pyear 是 3 碼民國年字串 (yy3)，例如 114 → "14"。1~3 位數字先補滿 3 碼再取末 2 碼；其他輸入回傳 null
        /// </summary>
        public static string? YearFolder(string? year)
        {
            var y = (year ?? string.Empty).Trim();
            if (y.Length == 0 || y.Length > 3 || !y.All(char.IsAsciiDigit)) return null;
            return y.PadLeft(3, '0')[1..];
        }

        /// <summary>客戶代號要當成目錄名稱：不可含路徑字元，也不可是 . 或 ..</summary>
        private static bool IsSafePathSegment(string no) =>
            no.Length > 0 && no != "." && no != ".." && no.IndexOfAny(Path.GetInvalidFileNameChars()) < 0 && no.Trim() == no;

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
    }
}
