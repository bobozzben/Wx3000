using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase5010Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;
        private readonly ILogger<Wbase5010Controller> _logger;

        public Wbase5010Controller(
            AppDbContext context,
            IDbfSyncService dbfSyncService,
            ISystemConfigService configService,
            ILogger<Wbase5010Controller> logger)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
            _logger = logger;
        }

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        /// <summary>
        /// 第一段選擇的客戶代號：以單一陣列參數 <c>TRIM(c.no) = ANY(@selectedNos)</c> 篩選 (選幾千家也只有一個參數)。
        /// 沒有傳入時不篩選。
        /// </summary>
        private static void AddSelectedNosCondition(System.Data.Common.DbCommand cmd, List<string> conditions, List<string>? selectedNos)
        {
            if (selectedNos == null || selectedNos.Count == 0) return;
            var p = cmd.CreateParameter();
            p.ParameterName = "@selectedNos";
            p.Value = selectedNos.Select(n => (n ?? string.Empty).Trim()).ToArray();
            cmd.Parameters.Add(p);
            conditions.Add(@"TRIM(c.""no"") = ANY(@selectedNos)");
        }

        private static string GetOrgaName(string? orga)
        {
            var code = orga?.Trim() ?? "";
            return code switch
            {
                "1" => "股份有限公司",
                "2" => "有限公司",
                "3" => "無限公司",
                "4" => "兩合公司",
                "5" => "合夥",
                "6" => "獨資",
                "7" => "國外分公司",
                "8" => "國外辦事處",
                "9" => "其它",
                _ => ""
            };
        }

        // =========================================================================
        // 1. GET: api/wbase5010/customers (供 5-1, 5-2 等客戶清單快選/設定張數)
        // =========================================================================
        [HttpGet("customers")]
        public async Task<ActionResult<IEnumerable<LabelCustomerItemDto>>> GetCustomerList([FromQuery] string? keyword = null)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var whereSql = "";
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    whereSql = @"WHERE (LOWER(c.""no"") LIKE @kw OR LOWER(c.""name"") LIKE @kw OR LOWER(c.""abbr"") LIKE @kw OR c.""unino"" LIKE @kw)";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@kw";
                    p.Value = $"%{keyword.Trim().ToLower()}%";
                    cmd.Parameters.Add(p);
                }

                cmd.CommandText = $@"
                    SELECT c.""no"", c.""abbr"", c.""name"", c.""unino"", c.""hname"", c.""linkman"", 
                           c.""tel"", c.""addr"", c.""invaddr"", c.""_record_number""
                    FROM ""{PgSchema}"".""customer"" c
                    {whereSql}
                    ORDER BY COALESCE(c.""serial"", 0), c.""no"";";

                var list = new List<LabelCustomerItemDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new LabelCustomerItemDto
                    {
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Abbr = reader["abbr"]?.ToString()?.Trim() ?? string.Empty,
                        Name = reader["name"]?.ToString()?.Trim() ?? string.Empty,
                        Unino = reader["unino"]?.ToString()?.Trim() ?? string.Empty,
                        Hname = reader["hname"]?.ToString()?.Trim() ?? string.Empty,
                        Linkman = reader["linkman"]?.ToString()?.Trim() ?? string.Empty,
                        Tel = reader["tel"]?.ToString()?.Trim() ?? string.Empty,
                        Addr = reader["addr"]?.ToString()?.Trim() ?? string.Empty,
                        Invaddr = reader["invaddr"]?.ToString()?.Trim() ?? string.Empty,
                        Prn = 1,
                        Selected = false,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetCustomerList 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // =========================================================================
        // 2. POST: api/wbase5010/print/customer-data (5-1 客戶資料列印)
        // =========================================================================
        [HttpPost("print/customer-data")]
        public async Task<ActionResult<IEnumerable<CustomerPrintItemDto>>> QueryCustomerPrintData([FromBody] CustomerPrintQueryDto query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "keyin", PgSchema, "keyin", "no");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var conditions = new List<string>();

                if (!string.IsNullOrWhiteSpace(query.StartNo))
                {
                    conditions.Add(@"c.""no"" >= @startNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@startNo";
                    p.Value = query.StartNo.Trim();
                    cmd.Parameters.Add(p);
                }

                if (!string.IsNullOrWhiteSpace(query.EndNo))
                {
                    conditions.Add(@"c.""no"" <= @endNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@endNo";
                    p.Value = query.EndNo.Trim();
                    cmd.Parameters.Add(p);
                }

                AddSelectedNosCondition(cmd, conditions, query.SelectedNos);

                var whereSql = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

                // 排序邏輯 (依 VFP requery)
                // groupType = 1 (依客戶編號), 2 (依登打人員)
                // orderType = 1 (客戶編號), 2 (統一編號), 3 (稅籍編號)
                string orderBySql;
                if (query.GroupType == 2)
                {
                    orderBySql = query.OrderType switch
                    {
                        2 => @"ORDER BY COALESCE(k.""no"", c.""keyin"", ''), c.""unino"", c.""no""",
                        3 => @"ORDER BY COALESCE(k.""no"", c.""keyin"", ''), c.""taxno"", c.""no""",
                        _ => @"ORDER BY COALESCE(k.""no"", c.""keyin"", ''), c.""no"""
                    };
                }
                else
                {
                    orderBySql = query.OrderType switch
                    {
                        2 => @"ORDER BY c.""unino"", c.""no""",
                        3 => @"ORDER BY c.""taxno"", c.""no""",
                        _ => @"ORDER BY c.""no"""
                    };
                }

                cmd.CommandText = $@"
                    SELECT c.""no"", c.""abbr"", c.""name"", c.""unino"", c.""taxno"", c.""hname"", 
                           c.""linkman"", c.""tel"", c.""mobile"", c.""fax"", c.""addr"", c.""invaddr"", 
                           c.""email"", c.""keyin"", k.""name"" AS ""keyinna"", c.""orga"", c.""pno"", 
                           c.""pnostd"", c.""offno"", c.""offno1"", c.""cpano"", c.""capital"", 
                           c.""serial"", c.""_record_number""
                    FROM ""{PgSchema}"".""customer"" c
                    LEFT JOIN ""{PgSchema}"".""keyin"" k ON TRIM(k.""no"") = TRIM(c.""keyin"")
                    {whereSql}
                    {orderBySql};";

                var list = new List<CustomerPrintItemDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var orgaCode = reader["orga"]?.ToString()?.Trim() ?? "";
                    list.Add(new CustomerPrintItemDto
                    {
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Abbr = reader["abbr"]?.ToString()?.Trim() ?? string.Empty,
                        Name = reader["name"]?.ToString()?.Trim() ?? string.Empty,
                        Unino = reader["unino"]?.ToString()?.Trim() ?? string.Empty,
                        Taxno = reader["taxno"]?.ToString()?.Trim() ?? string.Empty,
                        Hname = reader["hname"]?.ToString()?.Trim() ?? string.Empty,
                        Linkman = reader["linkman"]?.ToString()?.Trim() ?? string.Empty,
                        Tel = reader["tel"]?.ToString()?.Trim() ?? string.Empty,
                        Mobile = reader["mobile"]?.ToString()?.Trim() ?? string.Empty,
                        Fax = reader["fax"]?.ToString()?.Trim() ?? string.Empty,
                        Addr = reader["addr"]?.ToString()?.Trim() ?? string.Empty,
                        Invaddr = reader["invaddr"]?.ToString()?.Trim() ?? string.Empty,
                        Email = reader["email"]?.ToString()?.Trim() ?? string.Empty,
                        Keyin = reader["keyin"]?.ToString()?.Trim() ?? string.Empty,
                        Keyinna = reader["keyinna"]?.ToString()?.Trim() ?? string.Empty,
                        Orga = orgaCode,
                        Organame = GetOrgaName(orgaCode),
                        Pno = reader["pno"]?.ToString()?.Trim() ?? string.Empty,
                        Pnostd = reader["pnostd"]?.ToString()?.Trim() ?? string.Empty,
                        Offno = reader["offno"]?.ToString()?.Trim() ?? string.Empty,
                        Offno1 = reader["offno1"]?.ToString()?.Trim() ?? string.Empty,
                        Cpano = reader["cpano"]?.ToString()?.Trim() ?? string.Empty,
                        Capital = reader["capital"] != DBNull.Value ? Convert.ToDecimal(reader["capital"]) : null,
                        Serial = reader["serial"] != DBNull.Value ? Convert.ToInt32(reader["serial"]) : null,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null,
                        Selected = true
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "QueryCustomerPrintData 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // =========================================================================
        // 3. POST: api/wbase5010/print/labels (5-2 郵寄標籤展開)
        // =========================================================================
        [HttpPost("print/labels")]
        public async Task<ActionResult<IEnumerable<LabelCustomerItemDto>>> GenerateLabels([FromBody] LabelPrintQueryDto query)
        {
            try
            {
                var result = new List<LabelCustomerItemDto>();

                // 若前端傳入了已勾選與指定份數的 items，優先使用
                if (query.Items != null && query.Items.Count > 0)
                {
                    foreach (var item in query.Items)
                    {
                        var copies = item.Prn > 0 ? item.Prn : 1;
                        for (int i = 0; i < copies; i++)
                        {
                            result.Add(new LabelCustomerItemDto
                            {
                                No = item.No,
                                Abbr = item.Abbr,
                                Name = item.Name,
                                Unino = item.Unino,
                                Hname = item.Hname,
                                Linkman = item.Linkman,
                                Tel = item.Tel,
                                Addr = item.Addr,
                                Invaddr = item.Invaddr,
                                Prn = 1,
                                Selected = true
                            });
                        }
                    }
                }
                else
                {
                    // 根據起訖編號查詢
                    await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");

                    var conn = _context.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                    using var cmd = conn.CreateCommand();
                    var conditions = new List<string>();

                    if (!string.IsNullOrWhiteSpace(query.StartNo))
                    {
                        conditions.Add(@"c.""no"" >= @startNo");
                        var p = cmd.CreateParameter();
                        p.ParameterName = "@startNo";
                        p.Value = query.StartNo.Trim();
                        cmd.Parameters.Add(p);
                    }

                    if (!string.IsNullOrWhiteSpace(query.EndNo))
                    {
                        conditions.Add(@"c.""no"" <= @endNo");
                        var p = cmd.CreateParameter();
                        p.ParameterName = "@endNo";
                        p.Value = query.EndNo.Trim();
                        cmd.Parameters.Add(p);
                    }

                    var whereSql = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

                    cmd.CommandText = $@"
                        SELECT c.""no"", c.""abbr"", c.""name"", c.""unino"", c.""hname"", 
                               c.""linkman"", c.""tel"", c.""addr"", c.""invaddr""
                        FROM ""{PgSchema}"".""customer"" c
                        {whereSql}
                        ORDER BY c.""no"";";

                    var copies = query.Copies > 0 ? query.Copies : 1;
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var no = reader["no"]?.ToString()?.Trim() ?? string.Empty;
                        var abbr = reader["abbr"]?.ToString()?.Trim() ?? string.Empty;
                        var name = reader["name"]?.ToString()?.Trim() ?? string.Empty;
                        var unino = reader["unino"]?.ToString()?.Trim() ?? string.Empty;
                        var hname = reader["hname"]?.ToString()?.Trim() ?? string.Empty;
                        var linkman = reader["linkman"]?.ToString()?.Trim() ?? string.Empty;
                        var tel = reader["tel"]?.ToString()?.Trim() ?? string.Empty;
                        var addr = reader["addr"]?.ToString()?.Trim() ?? string.Empty;
                        var invaddr = reader["invaddr"]?.ToString()?.Trim() ?? string.Empty;

                        for (int i = 0; i < copies; i++)
                        {
                            result.Add(new LabelCustomerItemDto
                            {
                                No = no,
                                Abbr = abbr,
                                Name = name,
                                Unino = unino,
                                Hname = hname,
                                Linkman = linkman,
                                Tel = tel,
                                Addr = addr,
                                Invaddr = invaddr,
                                Prn = 1,
                                Selected = true
                            });
                        }
                    }
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GenerateLabels 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // =========================================================================
        // 4. POST: api/wbase5010/print/keyin-stats (5-3 登打人員統計表)
        // =========================================================================
        [HttpPost("print/keyin-stats")]
        public async Task<ActionResult<IEnumerable<KeyinStatsItemDto>>> QueryKeyinStats([FromBody] KeyinStatsQueryDto query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "keyin", PgSchema, "keyin", "no");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var conditions = new List<string>();

                if (!string.IsNullOrWhiteSpace(query.StartNo))
                {
                    conditions.Add(@"c.""no"" >= @startNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@startNo";
                    p.Value = query.StartNo.Trim();
                    cmd.Parameters.Add(p);
                }

                if (!string.IsNullOrWhiteSpace(query.EndNo))
                {
                    conditions.Add(@"c.""no"" <= @endNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@endNo";
                    p.Value = query.EndNo.Trim();
                    cmd.Parameters.Add(p);
                }

                if (!string.IsNullOrWhiteSpace(query.StartKeyin))
                {
                    conditions.Add(@"c.""keyin"" >= @startKeyin");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@startKeyin";
                    p.Value = query.StartKeyin.Trim();
                    cmd.Parameters.Add(p);
                }

                if (!string.IsNullOrWhiteSpace(query.EndKeyin))
                {
                    conditions.Add(@"c.""keyin"" <= @endKeyin");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@endKeyin";
                    p.Value = query.EndKeyin.Trim();
                    cmd.Parameters.Add(p);
                }

                AddSelectedNosCondition(cmd, conditions, query.SelectedNos);

                var whereSql = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

                cmd.CommandText = $@"
                    SELECT c.""no"" AS ""custNo"", c.""name"" AS ""custName"", c.""unino"", c.""taxno"", 
                           c.""keyin"", COALESCE(k.""name"", '') AS ""keyinna"", c.""tel"", c.""addr"", c.""pno""
                    FROM ""{PgSchema}"".""customer"" c
                    LEFT JOIN ""{PgSchema}"".""keyin"" k ON TRIM(k.""no"") = TRIM(c.""keyin"")
                    {whereSql}
                    ORDER BY c.""keyin"", c.""no"";";

                var list = new List<KeyinStatsItemDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new KeyinStatsItemDto
                    {
                        CustNo = reader["custNo"]?.ToString()?.Trim() ?? string.Empty,
                        CustName = reader["custName"]?.ToString()?.Trim() ?? string.Empty,
                        Unino = reader["unino"]?.ToString()?.Trim() ?? string.Empty,
                        Taxno = reader["taxno"]?.ToString()?.Trim() ?? string.Empty,
                        Keyin = reader["keyin"]?.ToString()?.Trim() ?? string.Empty,
                        Keyinna = reader["keyinna"]?.ToString()?.Trim() ?? string.Empty,
                        Tel = reader["tel"]?.ToString()?.Trim() ?? string.Empty,
                        Addr = reader["addr"]?.ToString()?.Trim() ?? string.Empty,
                        Pno = reader["pno"]?.ToString()?.Trim() ?? string.Empty
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "QueryKeyinStats 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // =========================================================================
        // 5. POST: api/wbase5010/print/business-status (5-4 營業狀況表)
        // =========================================================================
        [HttpPost("print/business-status")]
        public async Task<ActionResult<IEnumerable<BusinessStatusItemDto>>> QueryBusinessStatus([FromBody] BusinessStatusQueryDto query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var conditions = new List<string>();

                if (!string.IsNullOrWhiteSpace(query.StartNo))
                {
                    conditions.Add(@"c.""no"" >= @startNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@startNo";
                    p.Value = query.StartNo.Trim();
                    cmd.Parameters.Add(p);
                }

                if (!string.IsNullOrWhiteSpace(query.EndNo))
                {
                    conditions.Add(@"c.""no"" <= @endNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@endNo";
                    p.Value = query.EndNo.Trim();
                    cmd.Parameters.Add(p);
                }

                AddSelectedNosCondition(cmd, conditions, query.SelectedNos);

                var whereSql = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

                cmd.CommandText = $@"
                    SELECT c.""no"", c.""name"", c.""unino"", c.""taxno"", c.""hname"", 
                           c.""tel"", c.""addr"", c.""pno"", c.""capital""
                    FROM ""{PgSchema}"".""customer"" c
                    {whereSql}
                    ORDER BY c.""no"";";

                var list = new List<BusinessStatusItemDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new BusinessStatusItemDto
                    {
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Name = reader["name"]?.ToString()?.Trim() ?? string.Empty,
                        Unino = reader["unino"]?.ToString()?.Trim() ?? string.Empty,
                        Taxno = reader["taxno"]?.ToString()?.Trim() ?? string.Empty,
                        Hname = reader["hname"]?.ToString()?.Trim() ?? string.Empty,
                        Tel = reader["tel"]?.ToString()?.Trim() ?? string.Empty,
                        Addr = reader["addr"]?.ToString()?.Trim() ?? string.Empty,
                        Pno = reader["pno"]?.ToString()?.Trim() ?? string.Empty,
                        Capital = reader["capital"] != DBNull.Value ? Convert.ToDecimal(reader["capital"]) : null,
                        StartMonth = query.StartMonth ?? "01",
                        EndMonth = query.EndMonth ?? "12"
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "QueryBusinessStatus 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // =========================================================================
        // 6. POST: api/wbase5010/print/finance-status (5-5 財務狀況參考表)
        // =========================================================================
        [HttpPost("print/finance-status")]
        public async Task<ActionResult<IEnumerable<FinanceStatusItemDto>>> QueryFinanceStatus([FromBody] FinanceStatusQueryDto query)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var conditions = new List<string>();

                if (!string.IsNullOrWhiteSpace(query.StartNo))
                {
                    conditions.Add(@"c.""no"" >= @startNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@startNo";
                    p.Value = query.StartNo.Trim();
                    cmd.Parameters.Add(p);
                }

                if (!string.IsNullOrWhiteSpace(query.EndNo))
                {
                    conditions.Add(@"c.""no"" <= @endNo");
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@endNo";
                    p.Value = query.EndNo.Trim();
                    cmd.Parameters.Add(p);
                }

                AddSelectedNosCondition(cmd, conditions, query.SelectedNos);

                var whereSql = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

                cmd.CommandText = $@"
                    SELECT c.""no"", c.""name"", c.""unino"", c.""taxno"", c.""hname"", 
                           c.""tel"", c.""addr"", c.""pno"", c.""capital""
                    FROM ""{PgSchema}"".""customer"" c
                    {whereSql}
                    ORDER BY c.""no"";";

                var list = new List<FinanceStatusItemDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new FinanceStatusItemDto
                    {
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Name = reader["name"]?.ToString()?.Trim() ?? string.Empty,
                        Unino = reader["unino"]?.ToString()?.Trim() ?? string.Empty,
                        Taxno = reader["taxno"]?.ToString()?.Trim() ?? string.Empty,
                        Capital = reader["capital"] != DBNull.Value ? Convert.ToDecimal(reader["capital"]) : null,
                        Hname = reader["hname"]?.ToString()?.Trim() ?? string.Empty,
                        Tel = reader["tel"]?.ToString()?.Trim() ?? string.Empty,
                        Addr = reader["addr"]?.ToString()?.Trim() ?? string.Empty,
                        Pno = reader["pno"]?.ToString()?.Trim() ?? string.Empty,
                        Year = query.Year ?? ""
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "QueryFinanceStatus 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // =========================================================================
        // 7. 5-6 委任書條文維護 (bsdesc.dbf)
        // =========================================================================

        // GET: api/wbase5010/bsdesc
        [HttpGet("bsdesc")]
        public async Task<ActionResult<IEnumerable<BsdescItemDto>>> GetBsdescList()
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "bsdesc", PgSchema, "bsdesc", "seq");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = $@"
                    SELECT b.""seq"", b.""no"", b.""desc"", b.""sel"", b.""serial"", b.""_record_number""
                    FROM ""{PgSchema}"".""bsdesc"" b
                    ORDER BY COALESCE(b.""seq"", 0), b.""serial"";";

                var list = new List<BsdescItemDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var seqStr = reader["seq"]?.ToString()?.Trim() ?? "0";
                    _ = int.TryParse(seqStr, out int seqVal);
                    var serialStr = reader["serial"]?.ToString()?.Trim() ?? "0";
                    _ = int.TryParse(serialStr, out int serialVal);

                    list.Add(new BsdescItemDto
                    {
                        Seq = seqVal,
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Desc = reader["desc"]?.ToString()?.Trim() ?? string.Empty,
                        Sel = reader["sel"]?.ToString()?.Trim() ?? string.Empty,
                        Serial = serialVal,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetBsdescList 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // POST: api/wbase5010/bsdesc (新增一筆條文)
        [HttpPost("bsdesc")]
        public async Task<IActionResult> CreateBsdesc([FromBody] BsdescItemDto model)
        {
            if (model == null) return BadRequest("無效的資料");

            try
            {
                // 1. 決定新 seq
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                int nextSeq = model.Seq;
                if (nextSeq <= 0)
                {
                    using var maxCmd = conn.CreateCommand();
                    maxCmd.CommandText = $@"
                        SELECT COALESCE(MAX(""seq""), 0) + 1 
                        FROM ""{PgSchema}"".""bsdesc"";";
                    nextSeq = Convert.ToInt32(await maxCmd.ExecuteScalarAsync());
                }

                var fields = new Dictionary<string, object?>
                {
                    ["seq"] = nextSeq,
                    ["no"] = model.No ?? "",
                    ["desc"] = model.Desc ?? "",
                    ["sel"] = model.Sel ?? "",
                    ["serial"] = nextSeq
                };

                // 2. 寫入 DBF (DBF 絕對權威原則)
                var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "bsdesc", "INSERT", "seq", nextSeq.ToString(), fields);
                if (!writeRes.Success)
                {
                    return BsdescWriteFailure(writeRes, "寫入 bsdesc.dbf 失敗");
                }

                // 3. 同步至 PostgreSQL
                using (var insertCmd = conn.CreateCommand())
                {
                    insertCmd.CommandText = $@"
                        INSERT INTO ""{PgSchema}"".""bsdesc"" (""seq"", ""no"", ""desc"", ""sel"", ""serial"", ""_record_number"")
                        SELECT @seq, @no, @desc, @sel, @serial, COALESCE(MAX(""_record_number""), 0) + 1
                        FROM ""{PgSchema}"".""bsdesc"";";

                    var pSeq = insertCmd.CreateParameter();
                    pSeq.ParameterName = "@seq";
                    pSeq.Value = nextSeq;
                    insertCmd.Parameters.Add(pSeq);

                    var pNo = insertCmd.CreateParameter();
                    pNo.ParameterName = "@no";
                    pNo.Value = model.No ?? "";
                    insertCmd.Parameters.Add(pNo);

                    var pDesc = insertCmd.CreateParameter();
                    pDesc.ParameterName = "@desc";
                    pDesc.Value = model.Desc ?? "";
                    insertCmd.Parameters.Add(pDesc);

                    var pSel = insertCmd.CreateParameter();
                    pSel.ParameterName = "@sel";
                    pSel.Value = model.Sel ?? "";
                    insertCmd.Parameters.Add(pSel);

                    var pSerial = insertCmd.CreateParameter();
                    pSerial.ParameterName = "@serial";
                    pSerial.Value = nextSeq;
                    insertCmd.Parameters.Add(pSerial);

                    await insertCmd.ExecuteNonQueryAsync();
                }

                // 4. 更新 Checksum
                await _dbfSyncService.CommitWriteChecksumAsync(DbfPath, "bsdesc");

                return Ok(new { success = true, seq = nextSeq });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateBsdesc 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // PUT: api/wbase5010/bsdesc/{seq} (更新一筆條文)
        [HttpPut("bsdesc/{seq}")]
        public async Task<IActionResult> UpdateBsdesc(int seq, [FromBody] BsdescItemDto model)
        {
            if (model == null || seq <= 0) return BadRequest("無效的資料");

            try
            {
                var seqStr = seq.ToString();
                var fields = new Dictionary<string, object?>
                {
                    ["no"] = model.No ?? "",
                    ["desc"] = model.Desc ?? "",
                    ["sel"] = model.Sel ?? ""
                };

                // 1. 寫入 DBF
                var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "bsdesc", "UPDATE", "seq", seqStr, fields);
                if (!writeRes.Success)
                {
                    return BsdescWriteFailure(writeRes, "更新 bsdesc.dbf 失敗");
                }

                // 2. 同步至 PostgreSQL
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"
                        UPDATE ""{PgSchema}"".""bsdesc""
                        SET ""no"" = @no, ""desc"" = @desc, ""sel"" = @sel
                        WHERE ""seq"" = @seq;";

                    var pSeq = cmd.CreateParameter();
                    pSeq.ParameterName = "@seq";
                    pSeq.Value = seq;
                    cmd.Parameters.Add(pSeq);

                    var pNo = cmd.CreateParameter();
                    pNo.ParameterName = "@no";
                    pNo.Value = model.No ?? "";
                    cmd.Parameters.Add(pNo);

                    var pDesc = cmd.CreateParameter();
                    pDesc.ParameterName = "@desc";
                    pDesc.Value = model.Desc ?? "";
                    cmd.Parameters.Add(pDesc);

                    var pSel = cmd.CreateParameter();
                    pSel.ParameterName = "@sel";
                    pSel.Value = model.Sel ?? "";
                    cmd.Parameters.Add(pSel);

                    await cmd.ExecuteNonQueryAsync();
                }

                // 3. 更新 Checksum
                await _dbfSyncService.CommitWriteChecksumAsync(DbfPath, "bsdesc");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateBsdesc 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // DELETE: api/wbase5010/bsdesc/{seq} (刪除條文)
        [HttpDelete("bsdesc/{seq}")]
        public async Task<IActionResult> DeleteBsdesc(int seq)
        {
            if (seq <= 0) return BadRequest("無效的序號");

            try
            {
                var seqStr = seq.ToString();

                // 1. 刪除 DBF
                var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "bsdesc", "DELETE", "seq", seqStr, new Dictionary<string, object?>());
                if (!writeRes.Success)
                {
                    return BsdescWriteFailure(writeRes, "刪除 bsdesc.dbf 失敗");
                }

                // 2. 同步至 PostgreSQL
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"DELETE FROM ""{PgSchema}"".""bsdesc"" WHERE ""seq"" = @seq;";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@seq";
                    p.Value = seq;
                    cmd.Parameters.Add(p);
                    await cmd.ExecuteNonQueryAsync();
                }

                // 3. 更新 Checksum
                await _dbfSyncService.CommitWriteChecksumAsync(DbfPath, "bsdesc");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeleteBsdesc 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // PUT: api/wbase5010/bsdesc/batch (批次重編序號或批次更新)
        [HttpPut("bsdesc/batch")]
        public async Task<IActionResult> BatchSaveBsdesc([FromBody] BsdescBatchUpdateDto model)
        {
            if (model == null || model.Items == null) return BadRequest("無效的資料");

            try
            {
                // 先讓快照與 DBF 一致，_record_number 才等於目前的 RECNO
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "bsdesc", PgSchema, "bsdesc", "seq");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                var snapshot = new List<(int Recno, decimal Serial)>();
                using (var readCmd = conn.CreateCommand())
                {
                    readCmd.CommandText = $@"SELECT ""_record_number"", ""serial"" FROM ""{PgSchema}"".""bsdesc"";";
                    using var reader = await readCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var recno = Convert.ToInt32(reader["_record_number"]);
                        var serial = reader["serial"] == DBNull.Value ? 0m : Convert.ToDecimal(reader["serial"]);
                        snapshot.Add((recno, serial));
                    }
                }

                // 寫入前先決定每筆的 RECNO：重編會讓新舊 serial 互相撞號，不能邊寫邊用 serial 找記錄
                var targets = new List<int>();
                foreach (var item in model.Items)
                {
                    var matches = item.RecordNumber is > 0
                        ? snapshot.Where(s => s.Recno == item.RecordNumber.Value && s.Serial == item.Serial).ToList()
                        : snapshot.Where(s => s.Serial == item.Serial).ToList();
                    if (matches.Count != 1)
                    {
                        return Conflict(new { message = $"條文 (序號 {item.Serial}) 已被其他工作站異動或無法唯一定位，請重新查詢後再試" });
                    }
                    if (targets.Contains(matches[0].Recno))
                    {
                        return BadRequest(new { message = $"條文 (序號 {item.Serial}) 重複出現在批次資料中" });
                    }
                    targets.Add(matches[0].Recno);
                }

                // 逐筆寫 DBF；任一筆失敗就停止，PostgreSQL 與 Checksum 都不動 (已寫入的部分讓下次讀取重灌快照)
                var allFields = new List<Dictionary<string, object?>>();
                for (int i = 0; i < model.Items.Count; i++)
                {
                    var item = model.Items[i];
                    var newSeq = i + 1;
                    var fields = new Dictionary<string, object?>
                    {
                        ["seq"] = newSeq,
                        ["no"] = item.No ?? "",
                        ["desc"] = item.Desc ?? "",
                        ["sel"] = item.Sel ?? "",
                        ["serial"] = newSeq
                    };
                    var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "bsdesc", "UPDATE", "RECNO()", targets[i].ToString(), fields);
                    if (!writeRes.Success)
                    {
                        var context = i > 0 ? $"前 {i} 筆已寫入，批次儲存 bsdesc.dbf 中止" : "批次儲存 bsdesc.dbf 失敗";
                        return BsdescWriteFailure(writeRes, context);
                    }
                    allFields.Add(fields);
                }

                // 同步至 PostgreSQL (參數化，以 _record_number 定位)
                try
                {
                    using var tx = await conn.BeginTransactionAsync();
                    // seq 有唯一索引，逐筆重編會暫時撞號；先把這些列移到負數 (以 _record_number 保證不重複)
                    using (var parkCmd = conn.CreateCommand())
                    {
                        parkCmd.Transaction = tx;
                        parkCmd.CommandText = $@"UPDATE ""{PgSchema}"".""bsdesc"" SET ""seq"" = -""_record_number"" WHERE ""_record_number"" = ANY(@recnos);";
                        AddParam(parkCmd, "@recnos", targets.ToArray());
                        await parkCmd.ExecuteNonQueryAsync();
                    }
                    for (int i = 0; i < targets.Count; i++)
                    {
                        var fields = allFields[i];
                        using var cmd = conn.CreateCommand();
                        cmd.Transaction = tx;
                        cmd.CommandText = $@"
                            UPDATE ""{PgSchema}"".""bsdesc""
                            SET ""seq"" = @seq, ""no"" = @no, ""desc"" = @desc, ""sel"" = @sel, ""serial"" = @serial
                            WHERE ""_record_number"" = @recno;";
                        AddParam(cmd, "@seq", fields["seq"]);
                        AddParam(cmd, "@no", fields["no"]);
                        AddParam(cmd, "@desc", fields["desc"]);
                        AddParam(cmd, "@sel", fields["sel"]);
                        AddParam(cmd, "@serial", fields["serial"]);
                        AddParam(cmd, "@recno", targets[i]);
                        await cmd.ExecuteNonQueryAsync();
                    }
                    await tx.CommitAsync();
                }
                catch (Exception pgEx)
                {
                    // DBF 已寫入；不更新 Checksum，下次讀取會從 DBF 重灌快照
                    _logger.LogWarning(pgEx, "BatchSaveBsdesc PostgreSQL 同步失敗，下次讀取將重灌快照");
                    return Ok(new { success = true });
                }

                await _dbfSyncService.CommitWriteChecksumAsync(DbfPath, "bsdesc");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "BatchSaveBsdesc 失敗");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        /// <summary>bsdesc.dbf 寫入失敗：LOCK_TIMEOUT 回 409，其他錯誤回 500 並附上 LocalAgent 的錯誤訊息</summary>
        private ObjectResult BsdescWriteFailure(DbfWriteResult writeRes, string message)
        {
            if (writeRes.ErrorType == "LOCK_TIMEOUT")
            {
                return StatusCode(StatusCodes.Status409Conflict, new { error = writeRes.Error, message = $"{message}：資料正被地端其他工作站鎖定中" });
            }
            if (writeRes.IsUnconfirmed)
            {
                return StatusCode(StatusCodes.Status504GatewayTimeout, new { error = writeRes.Error, message = $"{message}：{writeRes.Message}" });
            }
            var detail = writeRes.Message ?? writeRes.Error;
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                error = writeRes.Error,
                message = string.IsNullOrWhiteSpace(detail) ? message : $"{message}: {detail}"
            });
        }

        private static void AddParam(System.Data.Common.DbCommand cmd, string name, object? value)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? DBNull.Value;
            cmd.Parameters.Add(p);
        }
    }
}
