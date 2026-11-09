using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
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
    /// 3-4-1 原媒體轉檔 / 3-4-2 網路申購轉檔
    /// (VFP base30.prg wbasemenu0304cmd01 / cmd02 → wbase.vcx wbase3025 / wbase3025n；
    /// 各縣市的列格式在 basefunc.prg 的 blank_tpe / blank_kkk / append_blank 與 _n 版)。
    /// 只讀 buyinv、customer、place、base、pub_para，不寫 DBF；檔案由前端下載，取代 VFP 的磁碟機 / 路徑 / 磁片份數。
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase3025Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;
        private readonly ILogger<Wbase3025Controller> _logger;

        public Wbase3025Controller(
            AppDbContext context,
            IDbfSyncService dbfSyncService,
            ISystemConfigService configService,
            ILogger<Wbase3025Controller> logger)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
            _logger = logger;
        }

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        private static readonly Encoding Big5 = CreateBig5();

        private static Encoding CreateBig5()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            // 無法以 Big5 表示的字以 ? 取代 (VFP 寫 DBF / 檔案時同樣寫不出這些字)
            return Encoding.GetEncoding(950, new EncoderReplacementFallback("?"), DecoderFallback.ReplacementFallback);
        }

        /// <summary>VFP 暫存檔 one_line c(254)：COPY TO ... SDF 每列補滿的寬度</summary>
        private const int SdfLineWidth = 254;

        /// <summary>8 種發票：buyinv 欄位、台灣省檔的種類碼 (append_blank)、台北市檔的旗標 (blank_tpe)</summary>
        private static readonly (string Field, string ProvinceCode, char TaipeiFlag)[] Kinds =
        {
            ("a02", "20", '1'), ("a02b", "21", '2'), ("a03", "10", '3'), ("a03b", "11", '4'),
            ("spec", "40", '5'), ("c02", "30", '6'), ("c03", "60", '7'), ("c03b", "61", '8')
        };

        private const string KaohsiungHeader = "代理人編號;發票期別;統一編號;公司名稱;二聯;二副;三聯;三副;特種;二收;三收;三收副";

        private sealed class BuyRow
        {
            public int Recno;
            public string No = string.Empty;
            public string BuyName = string.Empty;
            public string Yymm = string.Empty;
            public string Times = string.Empty;
            public string BuyUnino = string.Empty;
            public string BuyTaxno = string.Empty;
            public int[] Qty = new int[8];
        }

        private sealed class Cust
        {
            public string No = string.Empty;
            public string Name = string.Empty;
            public string Unino = string.Empty;
            public string Taxno = string.Empty;
            public string Addr = string.Empty;
            public string PlaceNo = string.Empty;
        }

        // =========================================================================
        // GET: api/wbase3025/defaults (VFP Init：最近一期、pub_para.buycity；事務所資料來自 base.dbf)
        // =========================================================================
        [HttpGet("defaults")]
        public async Task<ActionResult<MediaTransferDefaultsDto>> GetDefaults()
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "buyinv", PgSchema, "buyinv", "_record_number");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "pub_para", PgSchema, "pub_para", "");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "base", PgSchema, "base", "");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                // 最近一期：VFP select dist yymm, year100(left(yymm,2),3)+substr(yymm,3) order by desc
                string latest = string.Empty;
                string latestKey = string.Empty;
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"SELECT DISTINCT TRIM(""yymm"") AS yymm FROM ""{PgSchema}"".""buyinv"" WHERE TRIM(COALESCE(""yymm"", '')) <> '';";
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var yymm = S(reader, "yymm");
                        if (yymm.Length < 6) continue;
                        var key = Year100(yymm.Substring(0, 2)) + yymm.Substring(2);
                        if (string.CompareOrdinal(key, latestKey) > 0)
                        {
                            latestKey = key;
                            latest = yymm;
                        }
                    }
                }

                var dto = new MediaTransferDefaultsDto();
                if (latest.Length >= 6)
                {
                    dto.Year = Year100(latest.Substring(0, 2));
                    dto.StartMonth = latest.Substring(2, 2);
                    dto.EndMonth = latest.Substring(4, 2);
                }
                else
                {
                    // 沒有統購資料：以今天所在的雙月期別 (VFP medate)
                    var today = DateTime.Today;
                    var m = today.Month;
                    dto.Year = (today.Year - 1911).ToString("000");
                    if (m % 2 == 0)
                    {
                        dto.StartMonth = (m - 1).ToString("00");
                        dto.EndMonth = m.ToString("00");
                    }
                    else
                    {
                        dto.StartMonth = m.ToString("00");
                        dto.EndMonth = (m + 1).ToString("00");
                    }
                }

                try
                {
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = $@"SELECT ""buycity"" FROM ""{PgSchema}"".""pub_para"" LIMIT 1;";
                    var v = await cmd.ExecuteScalarAsync();
                    dto.City = v == null || v == DBNull.Value ? string.Empty : v.ToString()!.Trim();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "pub_para.buycity 讀取失敗，轉檔縣市不帶預設值");
                }

                var office = await LoadOfficeAsync(conn);
                dto.OfficeName = office.GetValueOrDefault("000A", string.Empty);
                dto.OfficeUnino = office.GetValueOrDefault("000B", string.Empty);
                dto.OfficeAddr = office.GetValueOrDefault("0001", string.Empty);
                dto.OfficeTel = office.GetValueOrDefault("0002", string.Empty);
                dto.OfficeOwner = office.GetValueOrDefault("0004", string.Empty);
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Wbase3025 GetDefaults 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取轉檔預設值失敗", error = ex.Message });
            }
        }

        // =========================================================================
        // POST: api/wbase3025/transfer (VFP f8.Click → tran_data / tran_data2)：產生轉檔內容，預覽與下載共用
        // =========================================================================
        [HttpPost("transfer")]
        public async Task<ActionResult<MediaTransferResultDto>> Transfer([FromBody] MediaTransferRequest req)
        {
            if (req == null) return BadRequest(new { message = "無轉檔條件" });
            var isNet = string.Equals(req.Mode, "net", StringComparison.OrdinalIgnoreCase);

            // 期別檢核 (與 VFP f8.Click 相同字句)
            var periodError = ValidatePeriod(req.Year, req.StartMonth, req.EndMonth);
            if (periodError != null) return BadRequest(new { message = periodError });
            var year3 = Year100((req.Year ?? string.Empty).Trim());
            var bm = (req.StartMonth ?? string.Empty).Trim().PadLeft(2, '0');
            var em = (req.EndMonth ?? string.Empty).Trim().PadLeft(2, '0');
            var bmm = year3.Substring(year3.Length - 2) + bm + em;   // buyinv.yymm (6 碼)
            var bmm2 = em;

            var agentId = (req.AgentId ?? string.Empty).Trim().ToUpperInvariant();
            var filterBy = (req.FilterBy ?? "1").Trim() == "2" ? 2 : 1;
            var city = (req.City ?? string.Empty).Trim();
            var placeNo = (req.PlaceNo ?? string.Empty).Trim();
            if (agentId.Length == 0) return BadRequest(new { message = "記帳業者ID 未輸入!!" });
            if (filterBy == 1 && city.Length == 0) return BadRequest(new { message = "轉檔縣市未輸入!!" });
            if (filterBy == 2 && placeNo.Length == 0) return BadRequest(new { message = "轉檔縣市未輸入!!" });

            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "buyinv", PgSchema, "buyinv", "_record_number");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "place", PgSchema, "place", "no");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "base", PgSchema, "base", "");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                // 購買地點 (VFP pno.Valid：pna = place.place；tran_data2 以地點名稱當 bbcity)
                var placeName = string.Empty;
                if (filterBy == 2)
                {
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = $@"SELECT ""place"" FROM ""{PgSchema}"".""place"" WHERE TRIM(""no"") = @no ORDER BY ""_record_number"" LIMIT 1;";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@no";
                    p.Value = placeNo;
                    cmd.Parameters.Add(p);
                    var v = await cmd.ExecuteScalarAsync();
                    if (v == null || v == DBNull.Value) return BadRequest(new { message = $"購買地點代號 [{placeNo}] 不存在!" });
                    placeName = v.ToString()!.Trim();
                }

                var office = await LoadOfficeAsync(conn);
                var compTel = office.GetValueOrDefault("0002", string.Empty);
                var compName = office.GetValueOrDefault("000A", string.Empty);
                var compAddr = office.GetValueOrDefault("0001", string.Empty);
                var compOwner = office.GetValueOrDefault("0004", string.Empty);

                // 區域：原媒體轉檔由縣市名稱 (依購買地點時是地點名稱) 決定；網路申購轉檔由轉檔格式決定
                var regionCity = filterBy == 1 ? city : placeName;
                string region;
                if (isNet)
                {
                    region = req.Format?.Trim() == "2" ? "kaohsiung" : req.Format?.Trim() == "3" ? "province" : "taipei";
                }
                else
                {
                    region = IsTaipei(regionCity) ? "taipei" : regionCity.StartsWith("高雄市", StringComparison.Ordinal) ? "kaohsiung" : "province";
                }
                // VFP：公司電話空白且縣市為台北市時不能轉檔 (台北市格式用事務所電話後 8 碼當代理人代號)
                if (IsTaipei(city) && compTel.Trim().Length == 0)
                    return BadRequest(new { message = "公司電話空白無法轉檔!!" });

                var customers = await LoadCustomersAsync(conn);
                var buyRows = await LoadBuyRowsAsync(conn, bmm, isNet ? 0 : (req.SortBy?.Trim() == "2" ? 2 : 1));

                // 台北市 (原媒體)：事務所電話 '-' 後 8 碼
                var ll = compTel.IndexOf('-');
                var pptel = PadR(compTel.Substring(ll + 1), 8);
                var anyRegion = isNet && city == "*" && filterBy == 1;   // 網路申購轉檔：* 不分區全部轉出

                var lines = new List<byte[]>();
                var rows = new List<MediaTransferRowDto>();
                var errors = new List<string>();
                var totals = new int[8];

                foreach (var b in buyRows)
                {
                    customers.TryGetValue(b.No, out var c);
                    var addr = c?.Addr ?? string.Empty;
                    var custPlace = c?.PlaceNo ?? string.Empty;

                    // 要不要轉這一列 (各分支的 skip 條件照 VFP)
                    bool skip;
                    if (filterBy == 2)
                        skip = custPlace != placeNo;
                    else if (region == "province")
                        skip = addr.Length == 0 || (!addr.Contains(city) && !anyRegion);
                    else if (!isNet && region == "taipei")
                        skip = addr.Length > 0 && !(addr.Contains("台北市") || addr.Contains("臺北市"));
                    else
                        skip = addr.Length > 0 && !addr.Contains(city) && !anyRegion;
                    if (skip) continue;

                    // 錯誤清單 (VFP DO CASE 只記第一個；這些列仍會轉出，與 VFP 相同)
                    var err = string.Empty;
                    if (c == null) err = $"{b.No} {b.BuyName} 客戶代號不存在!";
                    else if (addr.Length == 0) err = $"{c.No} {c.Name} 地址空白!";
                    else if (filterBy == 1 && !addr.Contains(city) && !anyRegion) err = $"{c.No} {c.Name} 地址不在 {city}!";
                    if (err.Length > 0) errors.Add(err);

                    var unino = PadR(c?.Unino ?? string.Empty, 8);
                    var taxno = PadR(c?.Taxno ?? string.Empty, 9);
                    var cname = (c?.Name ?? string.Empty).Trim();

                    switch (region)
                    {
                        case "taipei":
                            lines.Add(TaipeiLine(b, unino, taxno, cname, isNet ? Left(agentId, 8) : pptel, isNet));
                            break;
                        case "kaohsiung":
                            lines.Add(KaohsiungLine(b, unino, taxno, cname, agentId, isNet));
                            break;
                        default:
                            lines.AddRange(ProvinceLines(b, unino, taxno, cname, agentId, bmm2, isNet, totals));
                            break;
                    }

                    rows.Add(new MediaTransferRowDto
                    {
                        No = b.No,
                        Name = c?.Name.Trim() ?? b.BuyName,
                        Unino = (c?.Unino ?? b.BuyUnino).Trim(),
                        Taxno = (c?.Taxno ?? b.BuyTaxno).Trim(),
                        Addr = addr,
                        PlaceNo = custPlace,
                        Times = b.Times,
                        A02 = b.Qty[0], A02b = b.Qty[1], A03 = b.Qty[2], A03b = b.Qty[3],
                        Spec = b.Qty[4], C02 = b.Qty[5], C03 = b.Qty[6], C03b = b.Qty[7],
                        Error = err
                    });
                }

                if (region == "kaohsiung")
                    lines.Insert(0, Big5.GetBytes(KaohsiungHeader));

                if (region == "province")
                {
                    for (var i = 0; i < Kinds.Length; i++)
                    {
                        if (totals[i] == 0) continue;
                        var t = new StringBuilder("########").Append(Kinds[i].ProvinceCode).Append(StrZero(totals[i], 4)).Append(bmm2).Append(agentId);
                        lines.Add(Big5.GetBytes(t.ToString()));
                    }
                    if (!isNet && req.WithOffice)
                        lines.AddRange(OfficeBoxLines(regionCity, compName, compOwner, agentId, compAddr, compTel));
                }

                // 檔名與寫法 (VFP：原媒體三種都 COPY TO ... SDF；網路申購只有台北市用 SDF，其他兩種 FWRITE 寫 ALLTRIM 後的列)
                string fileName;
                bool padded;
                if (!isNet)
                {
                    fileName = region switch
                    {
                        "taipei" => pptel.Trim() + ".VAX",
                        "kaohsiung" => agentId,
                        _ => req.Format?.Trim() == "2" ? "PODER.TXT" : "PODER.DAT"
                    };
                    padded = true;
                }
                else
                {
                    fileName = region == "taipei" ? agentId + ".VAX" : agentId + ".DAT";
                    padded = region == "taipei";
                }

                var content = BuildFile(lines, padded);
                var totalsDict = new Dictionary<string, int>();
                for (var i = 0; i < Kinds.Length; i++) totalsDict[Kinds[i].Field] = totals[i];
                if (region != "province")
                {
                    // 台北市 / 高雄市格式沒有合計列，但預覽仍顯示各類本數合計
                    foreach (var r in rows)
                    {
                        totalsDict["a02"] += r.A02; totalsDict["a02b"] += r.A02b; totalsDict["a03"] += r.A03; totalsDict["a03b"] += r.A03b;
                        totalsDict["spec"] += r.Spec; totalsDict["c02"] += r.C02; totalsDict["c03"] += r.C03; totalsDict["c03b"] += r.C03b;
                    }
                }

                var regionName = region switch { "taipei" => "台北市", "kaohsiung" => "高雄市", _ => "台灣省" };
                return Ok(new MediaTransferResultDto
                {
                    Region = region,
                    RegionName = regionName,
                    FileName = fileName,
                    ContentBase64 = Convert.ToBase64String(content),
                    ByteLength = content.Length,
                    LineCount = lines.Count,
                    Padded = padded,
                    Rows = rows,
                    Errors = errors,
                    Totals = totalsDict,
                    Message = rows.Count == 0
                        ? $"期別 {year3}{bm}-{em} 沒有符合條件的統購資料"
                        : $"{regionName}格式：共轉出 {rows.Count} 家公司、{lines.Count} 列，檔名 {fileName}" + (errors.Count > 0 ? $"；錯誤清單 {errors.Count} 筆" : string.Empty)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Wbase3025 Transfer 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "轉檔失敗", error = ex.Message });
            }
        }

        // =========================================================================
        // 列格式 (basefunc.prg)
        // =========================================================================

        /// <summary>blank_tpe / blank_tpe_n：統編(8) + 代理人代號(8) + 稅籍(9) + 8 × (旗標 + Str(本數,4)) [+ 公司名稱]</summary>
        private static byte[] TaipeiLine(BuyRow b, string unino, string taxno, string cname, string agent, bool isNet)
        {
            var sb = new StringBuilder();
            sb.Append(unino).Append(agent).Append(taxno);
            for (var i = 0; i < Kinds.Length; i++)
            {
                sb.Append(b.Qty[i] != 0 ? Kinds[i].TaipeiFlag : '0').Append(Str(b.Qty[i], 4));
            }
            if (isNet) sb.Append(cname);
            return Big5.GetBytes(sb.ToString());
        }

        /// <summary>blank_kkk / blank_kkk_n：代理人編號(10);期別;統編;公司名稱;8 種本數 [;稅籍]</summary>
        private static byte[] KaohsiungLine(BuyRow b, string unino, string taxno, string cname, string agentId, bool isNet)
        {
            var yymm = PadR(b.Yymm, 6);
            var period = isNet
                ? Year100(yymm.Substring(0, 2)) + yymm.Substring(4, 2)      // 11506
                : "0" + yymm.Substring(0, 2) + yymm.Substring(4, 2);         // 01506
            var sb = new StringBuilder();
            sb.Append(PadR(agentId, 10)).Append(';').Append(period).Append(';').Append(unino).Append(';').Append(cname).Append(';');
            for (var i = 0; i < Kinds.Length; i++)
            {
                if (i > 0) sb.Append(';');
                sb.Append(Str(b.Qty[i], 4).Trim());
            }
            if (isNet) sb.Append(';').Append(taxno.Trim());
            return Big5.GetBytes(sb.ToString());
        }

        /// <summary>append_blank / append_blank_n：每種本數 ≠ 0 的發票一列：統編(8) + 種類碼 + 本數 4 碼 + 迄月 + 業者ID [;稅籍;公司名稱]</summary>
        private static IEnumerable<byte[]> ProvinceLines(BuyRow b, string unino, string taxno, string cname, string agentId, string bmm2, bool isNet, int[] totals)
        {
            for (var i = 0; i < Kinds.Length; i++)
            {
                if (b.Qty[i] == 0) continue;
                var sb = new StringBuilder();
                sb.Append(unino).Append(Kinds[i].ProvinceCode).Append(StrZero(b.Qty[i], 4)).Append(bmm2).Append(agentId);
                if (isNet) sb.Append(';').Append(taxno).Append(';').Append(cname);
                totals[i] += b.Qty[i];
                yield return Big5.GetBytes(sb.ToString());
            }
        }

        /// <summary>wbase3025 tran_data：Check2 轉出事務所資料時台灣省檔尾的簽章框 (台東縣字句不同)</summary>
        private static IEnumerable<byte[]> OfficeBoxLines(string city, string officeName, string owner, string agentId, string addr, string tel)
        {
            var text = new List<string>
            {
                "┌────────────────────────────────────────────┐",
                city.StartsWith("台東縣", StringComparison.Ordinal)
                    ? "│上列委託營業人之印鑑及請購數量，經本事務所確認無誤，如有虛偽不實或不法情事，願負一切法律│"
                    : "│上列委託營業人之內容及請購數量，經本事務所確認無誤，如有虛偽不實或不法情事，願負一切法律│",
                "│責任。                                                                                  │",
                "├───┬─────────────────┬───┬──────┬─────┬─────┤",
                "│事務所│" + PadR(officeName, 34) + "│負責人│" + PadR(owner, 12) + "│ 統一編號 │" + PadR(agentId, 10) + "│",
                "│名  稱│                                  │      │            │          │          │",
                "├───┼─────────────────┴───┼────┬─┴─────┴─────┤",
                "│事務所│" + PadR(addr, 42) + "│聯絡電話│" + PadR(tel, 26) + "│",
                "│地  址│                                          │        │                          │",
                "└───┴─────────────────────┴────┴─────────────┘"
            };
            return text.Select(t => Big5.GetBytes(t));
        }

        /// <summary>
        /// 組成檔案：padded = VFP COPY TO ... SDF (每列補滿 254 位元組、CRLF，檔尾 0x1A)；
        /// 否則為 FWRITE 寫 ALLTRIM 後的列 + CRLF
        /// </summary>
        private static byte[] BuildFile(List<byte[]> lines, bool padded)
        {
            var ms = new System.IO.MemoryStream();
            foreach (var raw in lines)
            {
                byte[] line;
                if (padded)
                {
                    line = new byte[SdfLineWidth];
                    Array.Fill(line, (byte)' ');
                    Array.Copy(raw, line, Math.Min(raw.Length, SdfLineWidth));
                }
                else
                {
                    var start = 0;
                    var end = raw.Length;
                    while (start < end && raw[start] == (byte)' ') start++;
                    while (end > start && raw[end - 1] == (byte)' ') end--;
                    line = raw[start..end];
                }
                ms.Write(line, 0, line.Length);
                ms.WriteByte((byte)'\r');
                ms.WriteByte((byte)'\n');
            }
            if (padded) ms.WriteByte(0x1A);
            return ms.ToArray();
        }

        // =========================================================================
        // 資料讀取
        // =========================================================================

        private async Task<Dictionary<string, string>> LoadOfficeAsync(DbConnection conn)
        {
            var values = new Dictionary<string, string>();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"SELECT TRIM(""no"") AS ""no"", ""data"" FROM ""{PgSchema}"".""base"" ORDER BY ""_record_number"";";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var no = S(reader, "no");
                if (!values.ContainsKey(no)) values[no] = S(reader, "data");
            }
            return values;
        }

        /// <summary>客戶代號 → 客戶 (同代號多筆時取 RECNO 最小的，與 VFP SEEK 一致)</summary>
        private async Task<Dictionary<string, Cust>> LoadCustomersAsync(DbConnection conn)
        {
            var dict = new Dictionary<string, Cust>();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"SELECT ""no"", ""abbr"", ""name"", ""unino"", ""taxno"", ""addr"", ""placeno"" FROM ""{PgSchema}"".""customer"" ORDER BY ""_record_number"";";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var no = S(reader, "no");
                if (no.Length == 0 || dict.ContainsKey(no)) continue;
                dict[no] = new Cust
                {
                    No = no,
                    Name = S(reader, "name"),
                    Unino = S(reader, "unino"),
                    Taxno = S(reader, "taxno"),
                    Addr = S(reader, "addr"),
                    PlaceNo = S(reader, "placeno")
                };
            }
            return dict;
        }

        /// <summary>
        /// 當期所有購買紀錄 (VFP 不分購買次數，任一本數 ≠ 0 的列)。
        /// sort 1 依統編 (cmd01 SET ORDER TO UNINO)、2 依稅籍 (f8 SET ORDER TO TAXNO)、0 依 RECNO (cmd02 沒有設定索引)
        /// </summary>
        private async Task<List<BuyRow>> LoadBuyRowsAsync(DbConnection conn, string bmm, int sort)
        {
            var orderBy = sort switch
            {
                1 => @"COALESCE(c.""unino"", b.""unino"", ''), b.""_record_number""",
                2 => @"COALESCE(c.""taxno"", b.""taxno"", ''), b.""_record_number""",
                _ => @"b.""_record_number"""
            };
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"
                SELECT b.""_record_number"", b.""no"", b.""name"", b.""yymm"", b.""times"", b.""unino"", b.""taxno"",
                       b.""a02"", b.""a02b"", b.""a03"", b.""a03b"", b.""spec"", b.""c02"", b.""c03"", b.""c03b""
                FROM ""{PgSchema}"".""buyinv"" b
                LEFT JOIN LATERAL (
                    SELECT c.""unino"", c.""taxno"" FROM ""{PgSchema}"".""customer"" c
                    WHERE TRIM(c.""no"") = TRIM(b.""no"") ORDER BY c.""_record_number"" LIMIT 1
                ) c ON TRUE
                WHERE TRIM(COALESCE(b.""yymm"", '')) = @yymm
                  AND (COALESCE(b.""a02"", 0) <> 0 OR COALESCE(b.""a02b"", 0) <> 0 OR COALESCE(b.""a03"", 0) <> 0 OR COALESCE(b.""a03b"", 0) <> 0
                    OR COALESCE(b.""spec"", 0) <> 0 OR COALESCE(b.""c02"", 0) <> 0 OR COALESCE(b.""c03"", 0) <> 0 OR COALESCE(b.""c03b"", 0) <> 0)
                ORDER BY {orderBy};";
            var p = cmd.CreateParameter();
            p.ParameterName = "@yymm";
            p.Value = bmm;
            cmd.Parameters.Add(p);

            var list = new List<BuyRow>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var row = new BuyRow
                {
                    Recno = I(reader, "_record_number"),
                    No = S(reader, "no"),
                    BuyName = S(reader, "name"),
                    Yymm = S(reader, "yymm"),
                    Times = S(reader, "times"),
                    BuyUnino = S(reader, "unino"),
                    BuyTaxno = S(reader, "taxno")
                };
                for (var i = 0; i < Kinds.Length; i++) row.Qty[i] = I(reader, Kinds[i].Field);
                list.Add(row);
            }
            return list;
        }

        // =========================================================================
        // 小工具 (VFP 函數的 Big5 位元組版)
        // =========================================================================

        private static string S(DbDataReader r, string col) => r[col] == DBNull.Value ? string.Empty : r[col]?.ToString()?.Trim() ?? string.Empty;

        private static int I(DbDataReader r, string col) => r[col] == DBNull.Value ? 0 : Convert.ToInt32(Convert.ToDecimal(r[col]));

        private static bool IsTaipei(string city) =>
            city.StartsWith("台北市", StringComparison.Ordinal) || city.StartsWith("臺北市", StringComparison.Ordinal);

        /// <summary>VFP PADR (以 Big5 位元組計)：不足補空白，超過截斷 (不切斷中文字)</summary>
        private static string PadR(string? s, int width)
        {
            var text = s ?? string.Empty;
            var bytes = Big5.GetByteCount(text);
            if (bytes == width) return text;
            if (bytes < width) return text + new string(' ', width - bytes);
            var sb = new StringBuilder();
            var used = 0;
            foreach (var ch in text)
            {
                var n = Big5.GetByteCount(ch.ToString());
                if (used + n > width) break;
                sb.Append(ch);
                used += n;
            }
            return sb.Append(' ', width - used).ToString();
        }

        private static string Left(string s, int n) => s.Length <= n ? s : s.Substring(0, n);

        /// <summary>VFP STR(n, 4)：右靠、不足補空白，放不下顯示 ****</summary>
        private static string Str(int n, int width)
        {
            var s = n.ToString();
            return s.Length > width ? new string('*', width) : s.PadLeft(width);
        }

        /// <summary>VFP STRZERO(n, 4)：左補 0，放不下顯示 ****</summary>
        private static string StrZero(int n, int width)
        {
            var s = n.ToString();
            return s.Length > width ? new string('*', width) : s.PadLeft(width, '0');
        }

        /// <summary>VFP year100(yy, 3)：民國 2 碼年補成 3 碼 (60 以前視為 100 年以後)；已是 3 碼就原樣回傳</summary>
        private static string Year100(string yy)
        {
            var t = (yy ?? string.Empty).Trim();
            if (t.Length >= 3) return t.PadLeft(3, '0');
            if (!int.TryParse(t, out var y)) return t.PadLeft(3, '0');
            return (y < 60 ? y + 100 : y).ToString("000");
        }

        /// <summary>VFP f8.Click 的期別檢核字句</summary>
        private static string? ValidatePeriod(string? year, string? startMonth, string? endMonth)
        {
            var y = (year ?? string.Empty).Trim();
            var bm = (startMonth ?? string.Empty).Trim();
            var em = (endMonth ?? string.Empty).Trim();
            if (y.Length == 0) return "年度不可空白!!";
            if (bm.Length == 0 || em.Length == 0) return "月份不可空白!!";
            if (!int.TryParse(y, out var yv) || yv < 34) return "年度輸入不正確!!";
            if (!int.TryParse(bm, out var b) || b > 12 || b < 1) return "月份輸入不正確!!";
            if (!int.TryParse(em, out var e) || e > 12 || e < 1) return "月份輸入不正確!!";
            if (b % 2 == 0) return "請輸入奇數月份!!";
            if (e < b) return "月份區間不正確!!";
            return null;
        }
    }
}
