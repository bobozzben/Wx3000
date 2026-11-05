using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wx3000.Backend.Data;
using Wx3000.Backend.Models;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    /// <summary>
    /// 1-1 事務所資料維護 (VFP LIBS\wbase.vcx 的 wbase1010 / wbase1010f4 / wbase1010f41，選單 base10.prg wbasemenu01cmd01)。
    /// 預設事務所資料存在 base.dbf (鍵值表) 與 pub_para.dbf；F4 事務所資料是 cstore.dbf。
    /// VFP 存檔時也會把名稱、統編、英文名寫回加密的 store.dbf (版權資料)，網頁版沒有解密元件，只寫 base.dbf。
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase1010Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        private const string BaseTable = "base";
        private const string CstoreTable = "cstore";
        private const string PubParaTable = "pub_para";

        // 三張表都以空 keyFields 同步，畫面要看到全部列；寫入以快照的 RECNO 搭配鍵值定位
        private const string RecnoKeyField = "RECNO(),no";

        // DBF 欄寬 (Big5 位元組)
        private const int BaseDataBytes = 100, PubImgPathBytes = 150;
        private const int NoBytes = 8, NameBytes = 60, TelBytes = 12, FaxBytes = 12, AddrBytes = 60,
            HnameBytes = 10, LinkmanBytes = 10, EmailBytes = 60, EngnameBytes = 60;

        private static readonly Encoding Big5Strict = CreateBig5();

        private static Encoding CreateBig5()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(950, EncoderFallback.ExceptionFallback, DecoderFallback.ReplacementFallback);
        }

        /// <summary>base.dbf 的鍵值與新增時寫入 name 欄的說明 (VFP f8.Click 的寫入順序：0001~0006 再 000A~000C)</summary>
        private static readonly (string No, string Label, string Caption)[] BaseItems =
        {
            ("0001", "地址", "事務所地址"),
            ("0002", "電話", "事務所電話"),
            ("0003", "傳真", "事務所傳真"),
            ("0004", "負責人", "負責人"),
            ("0005", "電子郵件", "電子郵件"),
            ("0006", "聯絡人", "聯絡人"),
            ("000A", "", "事務所名稱"),
            ("000B", "", "事務所統編"),
            ("000C", "", "英文名稱")
        };

        public Wbase1010Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // =========================================================================
        // 預設事務所資料 (base.dbf + pub_para.dbf)
        // =========================================================================

        // GET: api/wbase1010/office (VFP wbase1010.Init)
        [HttpGet("office")]
        public async Task<IActionResult> GetOffice()
        {
            try
            {
                await SyncAsync(BaseTable, PubParaTable);
                return Ok(await ReadOfficeAsync());
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取事務所資料失敗: " + ex.Message });
            }
        }

        // PUT: api/wbase1010/office (VFP wbase1010.f8.Click：只寫有變動的鍵值，查無的鍵值新增)
        [HttpPut("office")]
        public async Task<IActionResult> SaveOffice([FromBody] OfficeInfoDto req)
        {
            if (req == null) return BadRequest(new { message = "缺少事務所資料" });

            var values = OfficeValues(req);
            foreach (var item in BaseItems)
            {
                var invalid = CheckText(values[item.No], BaseDataBytes, item.Caption);
                if (invalid != null) return BadRequest(new { message = invalid });
            }
            var pubImgPath = Clean(req.PubImgPath);
            var invalidPath = CheckText(pubImgPath, PubImgPathBytes, "數位憑證公用目錄");
            if (invalidPath != null) return BadRequest(new { message = invalidPath });

            try
            {
                await SyncAsync(BaseTable, PubParaTable);
                var current = await ReadBaseRowsAsync();

                foreach (var item in BaseItems)
                {
                    var value = values[item.No];
                    if (current.TryGetValue(item.No, out var row))
                    {
                        if (row.Data == value) continue;
                        var fields = new Dictionary<string, object?> { ["data"] = value };
                        var res = await WriteByRecnoAsync(BaseTable, row.Recno, item.No, fields);
                        if (!res.Success) return DbfError(res, $"儲存{item.Caption}");
                        await PgWriteAsync(BaseTable, () => UpdatePgAsync(BaseTable, fields, res.Recno));
                    }
                    else
                    {
                        var fields = new Dictionary<string, object?> { ["no"] = item.No, ["name"] = item.Label, ["data"] = value };
                        var res = await _dbfSyncService.WriteRecordAsync(DbfPath, BaseTable, "INSERT", "no", item.No, fields);
                        if (!res.Success) return DbfError(res, $"新增{item.Caption}");
                        await PgWriteAsync(BaseTable, () => InsertPgAsync(BaseTable, fields, res.Recno));
                    }
                }

                var (pubRecno, currentPath) = await ReadPubImgPathAsync();
                if (pubRecno == 0 || currentPath != pubImgPath)
                {
                    var fields = new Dictionary<string, object?> { ["pubimgpath"] = pubImgPath };
                    // VFP：GO TOP，空檔時 APPEND BLANK
                    var res = pubRecno > 0
                        ? await _dbfSyncService.WriteRecordAsync(DbfPath, PubParaTable, "UPDATE", "RECNO()", pubRecno.ToString(CultureInfo.InvariantCulture), fields)
                        : await _dbfSyncService.WriteRecordAsync(DbfPath, PubParaTable, "INSERT", "RECNO()", "0", fields);
                    if (!res.Success) return DbfError(res, "儲存數位憑證公用目錄");
                    await PgWriteAsync(PubParaTable, () => pubRecno > 0
                        ? UpdatePgAsync(PubParaTable, fields, res.Recno)
                        : InsertPgAsync(PubParaTable, fields, res.Recno));
                }

                await SyncAsync(BaseTable, PubParaTable);
                return Ok(await ReadOfficeAsync());
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "儲存事務所資料失敗: " + ex.Message });
            }
        }

        // =========================================================================
        // F4 事務所資料 (cstore.dbf)
        // =========================================================================

        // GET: api/wbase1010/cstore (VFP wbase1010f4 表格，依 tag no 排序)
        [HttpGet("cstore")]
        public async Task<IActionResult> GetCstoreList()
        {
            try
            {
                await SyncAsync(CstoreTable);
                return Ok(await QueryCstoreAsync(null, null));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取事務所資料檔失敗: " + ex.Message });
            }
        }

        // POST: api/wbase1010/cstore (VFP insert.Click 先新增「新代號」再輸入統號；網頁在輸入統號後才新增)
        [HttpPost("cstore")]
        public async Task<IActionResult> CreateCstore([FromBody] CstoreSaveRequest req)
        {
            if (req == null) return BadRequest(new { message = "缺少事務所資料" });
            var no = Clean(req.No);
            var invalid = CheckNewNo(no) ?? CheckCstoreFields(req);
            if (invalid != null) return BadRequest(new { message = invalid });

            try
            {
                await SyncAsync(CstoreTable);
                var rows = await QueryCstoreAsync(null, null);
                if (rows.Any(r => r.No == no)) return Conflict(new { message = $"統號 {no} 重複" });

                // VFP 新增後依 tag no 重編序號，「新代號」排在最後，所以新列的序號 = 筆數
                var fields = CstoreFields(req);
                fields["no"] = no;
                fields["serial"] = rows.Count + 1;

                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, CstoreTable, "INSERT", "no", no, fields);
                if (!res.Success) return DbfError(res, "新增事務所資料");
                await PgWriteAsync(CstoreTable, () => InsertPgAsync(CstoreTable, fields, res.Recno));

                return Ok(new CstoreSaveResult { Row = await FindCstoreAsync(res.Recno) });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "新增事務所資料失敗: " + ex.Message });
            }
        }

        // PUT: api/wbase1010/cstore (VFP Text1.LostFocus：只寫有變動的欄位；改統號時檢查重複與統編檢查碼)
        [HttpPut("cstore")]
        public async Task<IActionResult> UpdateCstore([FromBody] CstoreSaveRequest req)
        {
            if (req == null) return BadRequest(new { message = "缺少事務所資料" });
            var origNo = Clean(req.OrigNo);
            var no = Clean(req.No);
            if (origNo.Length == 0) return BadRequest(new { message = "缺少原統號" });
            var invalid = (no != origNo ? CheckNewNo(no) : null) ?? CheckCstoreFields(req);
            if (invalid != null) return BadRequest(new { message = invalid });

            try
            {
                await SyncAsync(CstoreTable);
                var rows = await QueryCstoreAsync(null, null);
                var current = rows.FirstOrDefault(r => r.RecordNumber == req.RecordNumber && r.No == origNo)
                              ?? rows.FirstOrDefault(r => r.No == origNo);
                if (current == null) return Conflict(new { message = $"找不到統號 {origNo}，地端資料可能已變動，請重新整理後再試" });
                if (no != origNo && rows.Any(r => r.No == no && r.RecordNumber != current.RecordNumber))
                    return Conflict(new { message = $"統號 {no} 重複" });

                var wanted = CstoreFields(req);
                wanted["no"] = no;
                var fields = wanted
                    .Where(kv => !Equals(kv.Value, CurrentValue(current, kv.Key)))
                    .ToDictionary(kv => kv.Key, kv => kv.Value);
                if (fields.Count == 0) return Ok(new CstoreSaveResult { Row = current });

                var res = await WriteByRecnoAsync(CstoreTable, current.RecordNumber, current.No, fields);
                if (!res.Success) return DbfError(res, "修改事務所資料");
                await PgWriteAsync(CstoreTable, () => UpdatePgAsync(CstoreTable, fields, res.Recno));

                return Ok(new CstoreSaveResult { Row = await FindCstoreAsync(res.Recno) });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "修改事務所資料失敗: " + ex.Message });
            }
        }

        // DELETE: api/wbase1010/cstore/{no}?recno= (VFP Delete.Click：刪除後依 tag no 重編序號)
        [HttpDelete("cstore/{no}")]
        public async Task<IActionResult> DeleteCstore(string no, [FromQuery] int recno = 0)
        {
            var key = Clean(no);
            if (key.Length == 0) return BadRequest(new { message = "統號不可空白" });

            try
            {
                await SyncAsync(CstoreTable);
                var rows = await QueryCstoreAsync(null, null);
                var current = rows.FirstOrDefault(r => r.RecordNumber == recno && r.No == key)
                              ?? rows.FirstOrDefault(r => r.No == key);
                if (current == null) return NotFound(new { message = $"找不到統號 {key}" });

                var res = await WriteByRecnoAsync(CstoreTable, current.RecordNumber, current.No, new Dictionary<string, object?>(), "DELETE");
                if (!res.Success) return DbfError(res, "刪除事務所資料");
                await PgWriteAsync(CstoreTable, () => ExecPgAsync(
                    $@"DELETE FROM ""{PgSchema}"".""{CstoreTable}"" WHERE ""_record_number"" = @recno;", ("@recno", res.Recno, null)));

                return Ok(new CstoreSaveResult { Warning = await ReserialAsync() });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "刪除事務所資料失敗: " + ex.Message });
            }
        }

        // POST: api/wbase1010/cstore/print (VFP wbase1010f41.requery：no >= 起始統編 AND no <= 結束統編 ORDER BY no)
        [HttpPost("cstore/print")]
        public async Task<IActionResult> PrintCstore([FromBody] CstorePrintQuery query)
        {
            try
            {
                await SyncAsync(CstoreTable);
                return Ok(await QueryCstoreAsync(query?.NoStart, query?.NoEnd));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取列印資料失敗: " + ex.Message });
            }
        }

        // =========================================================================
        // 讀取
        // =========================================================================

        private async Task SyncAsync(params string[] tables)
        {
            foreach (var t in tables)
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, t, PgSchema, t, "");
            }
        }

        /// <summary>base.dbf 每個鍵值取 RECNO 最小的一筆 (VFP LOCATE 找到的那筆)</summary>
        private async Task<Dictionary<string, (int Recno, string Data)>> ReadBaseRowsAsync()
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT TRIM(""no"") AS ""no"", ""data"", ""_record_number"" FROM ""{PgSchema}"".""{BaseTable}"" ORDER BY ""_record_number"";";
            var rows = new Dictionary<string, (int, string)>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var no = Str(reader, "no");
                if (!rows.ContainsKey(no)) rows[no] = (Int(reader, "_record_number"), Str(reader, "data"));
            }
            return rows;
        }

        /// <summary>pub_para.dbf 第一筆 (VFP GO TOP)；沒有資料時 RECNO 為 0</summary>
        private async Task<(int Recno, string Path)> ReadPubImgPathAsync()
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT ""pubimgpath"", ""_record_number"" FROM ""{PgSchema}"".""{PubParaTable}"" ORDER BY ""_record_number"" LIMIT 1;";
            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return (0, string.Empty);
            return (Int(reader, "_record_number"), Str(reader, "pubimgpath"));
        }

        private async Task<OfficeInfoDto> ReadOfficeAsync()
        {
            var rows = await ReadBaseRowsAsync();
            string Get(string no) => rows.TryGetValue(no, out var r) ? r.Data : string.Empty;
            var (_, pubImgPath) = await ReadPubImgPathAsync();
            return new OfficeInfoDto
            {
                Name = Get("000A"),
                TaxNo = Get("000B"),
                EngName = Get("000C"),
                Addr = Get("0001"),
                Tel = Get("0002"),
                Fax = Get("0003"),
                Boss = Get("0004"),
                Email = Get("0005"),
                Contact = Get("0006"),
                PubImgPath = pubImgPath
            };
        }

        /// <summary>
        /// cstore 清單，依統號排序 (VFP tag no)。區間對齊 VFP SELECT 在 SET ANSI OFF 下的比較：
        /// 結束統編只比對前段 (輸入 1234 時 12345678 也在範圍內)，起訖空白表示不設限
        /// </summary>
        private async Task<List<CstoreDto>> QueryCstoreAsync(string? noStart, string? noEnd)
        {
            using var cmd = await CommandAsync();
            var where = new List<string>();
            var start = Clean(noStart);
            var end = Clean(noEnd);
            if (start.Length > 0)
            {
                where.Add(@"TRIM(""no"") COLLATE ""C"" >= @s");
                AddParam(cmd, "@s", start);
            }
            if (end.Length > 0)
            {
                where.Add(@"LEFT(TRIM(""no""), @elen) COLLATE ""C"" <= @e");
                AddParam(cmd, "@e", end);
                AddParam(cmd, "@elen", end.Length);
            }
            var whereSql = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : string.Empty;
            cmd.CommandText = $@"
                SELECT ""no"", ""name"", ""tel"", ""fax"", ""addr"", ""hname"", ""linkman"", ""email"", ""engname"", ""serial"", ""_record_number""
                FROM ""{PgSchema}"".""{CstoreTable}""
                {whereSql}
                ORDER BY TRIM(""no"") COLLATE ""C"", ""_record_number"";";
            var list = new List<CstoreDto>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync()) list.Add(ReadCstore(reader));
            return list;
        }

        private async Task<CstoreDto?> FindCstoreAsync(int recno)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"
                SELECT ""no"", ""name"", ""tel"", ""fax"", ""addr"", ""hname"", ""linkman"", ""email"", ""engname"", ""serial"", ""_record_number""
                FROM ""{PgSchema}"".""{CstoreTable}"" WHERE ""_record_number"" = @recno;";
            AddParam(cmd, "@recno", recno);
            using var reader = await cmd.ExecuteReaderAsync();
            return await reader.ReadAsync() ? ReadCstore(reader) : null;
        }

        private static CstoreDto ReadCstore(DbDataReader reader) => new()
        {
            No = Str(reader, "no"),
            Name = Str(reader, "name"),
            Tel = Str(reader, "tel"),
            Fax = Str(reader, "fax"),
            Addr = Str(reader, "addr"),
            Hname = Str(reader, "hname"),
            Linkman = Str(reader, "linkman"),
            Email = Str(reader, "email"),
            Engname = Str(reader, "engname"),
            Serial = reader["serial"] == DBNull.Value ? 0 : Convert.ToInt32(reader["serial"], CultureInfo.InvariantCulture),
            RecordNumber = Int(reader, "_record_number")
        };

        // =========================================================================
        // 寫入
        // =========================================================================

        /// <summary>
        /// 以快照的 RECNO 加鍵值定位 (RECNO 過期時回 RECORD_NOT_FOUND 而不是改錯列)；
        /// 鍵值含逗號無法組成定位條件時，改用鍵值完全比對
        /// </summary>
        private Task<DbfWriteResult> WriteByRecnoAsync(string table, int recno, string no, Dictionary<string, object?> fields, string operation = "UPDATE")
        {
            if (recno > 0 && !no.Contains(','))
            {
                return _dbfSyncService.WriteRecordAsync(DbfPath, table, operation, RecnoKeyField,
                    recno.ToString(CultureInfo.InvariantCulture) + "," + no, fields);
            }
            return _dbfSyncService.WriteRecordAsync(DbfPath, table, operation, "no", no, fields);
        }

        /// <summary>VFP reserial()：依 tag no 順序把 serial 重編為 1..N，只寫序號不同的列；失敗時回傳提示，不影響已完成的刪除</summary>
        private async Task<string?> ReserialAsync()
        {
            var rows = await QueryCstoreAsync(null, null);
            for (var i = 0; i < rows.Count; i++)
            {
                var serial = i + 1;
                if (rows[i].Serial == serial) continue;
                var fields = new Dictionary<string, object?> { ["serial"] = serial };
                var res = await WriteByRecnoAsync(CstoreTable, rows[i].RecordNumber, rows[i].No, fields);
                if (!res.Success)
                {
                    var (_, message) = DescribeDbfError(res, "重編序號");
                    return "已刪除，但" + message;
                }
                await PgWriteAsync(CstoreTable, () => UpdatePgAsync(CstoreTable, fields, res.Recno));
            }
            return null;
        }

        /// <summary>DBF 已寫入後同步 PostgreSQL 並更新 Checksum；PG 失敗時不更新 Checksum，下次讀取會自動重灌快照</summary>
        private async Task PgWriteAsync(string table, Func<Task> pgAction)
        {
            try
            {
                await pgAction();
                await _dbfSyncService.CommitWriteChecksumAsync(DbfPath, table);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase1010 PostgreSQL 同步失敗 ({table})，下次讀取將重灌快照: {ex.Message}");
            }
        }

        private Task UpdatePgAsync(string table, Dictionary<string, object?> fields, int recno)
        {
            var sets = new List<string>();
            var args = new List<(string, object?, DbType?)> { ("@recno", recno, null) };
            var i = 0;
            foreach (var (name, value) in fields)
            {
                var p = "@f" + i++;
                sets.Add($@"""{name}"" = {p}");
                args.Add((p, value ?? string.Empty, null));
            }
            return ExecPgAsync($@"UPDATE ""{PgSchema}"".""{table}"" SET {string.Join(", ", sets)} WHERE ""_record_number"" = @recno;", args.ToArray());
        }

        /// <summary>新增快照列；未列出的欄位用快照表的預設值 ('' / 0)，與 VFP INSERT 留空的欄位一致</summary>
        private Task InsertPgAsync(string table, Dictionary<string, object?> fields, int recno)
        {
            var cols = new List<string> { @"""_record_number""" };
            var vals = new List<string> { "@recno" };
            var args = new List<(string, object?, DbType?)> { ("@recno", recno, null) };
            var i = 0;
            foreach (var (name, value) in fields)
            {
                var p = "@f" + i++;
                cols.Add($@"""{name}""");
                vals.Add(p);
                args.Add((p, value ?? string.Empty, null));
            }
            return ExecPgAsync($@"INSERT INTO ""{PgSchema}"".""{table}"" ({string.Join(", ", cols)}) VALUES ({string.Join(", ", vals)});", args.ToArray());
        }

        private async Task ExecPgAsync(string sql, params (string Name, object? Value, DbType? Type)[] args)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = sql;
            foreach (var (name, value, type) in args) AddParam(cmd, name, value ?? DBNull.Value, type);
            await cmd.ExecuteNonQueryAsync();
        }

        private async Task<DbCommand> CommandAsync()
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();
            return conn.CreateCommand();
        }

        private static void AddParam(DbCommand cmd, string name, object value, DbType? type = null)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value;
            if (type.HasValue) p.DbType = type.Value;
            cmd.Parameters.Add(p);
        }

        // =========================================================================
        // 檢查與轉換
        // =========================================================================

        private static Dictionary<string, string> OfficeValues(OfficeInfoDto req) => new()
        {
            ["0001"] = Clean(req.Addr),
            ["0002"] = Clean(req.Tel),
            ["0003"] = Clean(req.Fax),
            ["0004"] = Clean(req.Boss),
            ["0005"] = Clean(req.Email),
            ["0006"] = Clean(req.Contact),
            ["000A"] = Clean(req.Name),
            ["000B"] = Clean(req.TaxNo),
            ["000C"] = Clean(req.EngName)
        };

        private static Dictionary<string, object?> CstoreFields(CstoreSaveRequest req) => new()
        {
            ["name"] = Clean(req.Name),
            ["tel"] = Clean(req.Tel),
            ["fax"] = Clean(req.Fax),
            ["addr"] = Clean(req.Addr),
            ["hname"] = Clean(req.Hname),
            ["linkman"] = Clean(req.Linkman),
            ["email"] = Clean(req.Email),
            ["engname"] = Clean(req.Engname)
        };

        private static object? CurrentValue(CstoreDto row, string field) => field switch
        {
            "no" => row.No,
            "name" => row.Name,
            "tel" => row.Tel,
            "fax" => row.Fax,
            "addr" => row.Addr,
            "hname" => row.Hname,
            "linkman" => row.Linkman,
            "email" => row.Email,
            "engname" => row.Engname,
            _ => null
        };

        private static string? CheckCstoreFields(CstoreSaveRequest req) =>
            CheckText(Clean(req.Name), NameBytes, "名稱")
            ?? CheckText(Clean(req.Tel), TelBytes, "電話")
            ?? CheckText(Clean(req.Fax), FaxBytes, "傳真")
            ?? CheckText(Clean(req.Addr), AddrBytes, "地址")
            ?? CheckText(Clean(req.Hname), HnameBytes, "負責人")
            ?? CheckText(Clean(req.Linkman), LinkmanBytes, "聯絡人")
            ?? CheckText(Clean(req.Email), EmailBytes, "電子信箱")
            ?? CheckText(Clean(req.Engname), EngnameBytes, "英文名稱");

        /// <summary>新增或改統號時：不可空白、不超過欄寬，且須通過統編檢查碼 (VFP Text1.LostFocus 呼叫 buynochk，不通過就不寫入)</summary>
        private static string? CheckNewNo(string no)
        {
            if (no.Length == 0) return "統號不可空白";
            var invalid = CheckText(no, NoBytes, "統號");
            if (invalid != null) return invalid;
            return IsBusinessNo(no) ? null : $"統號 {no} 不是正確的統一編號";
        }

        /// <summary>
        /// w3000func.prg buynochk：8 碼數字，權重 1,2,1,2,1,2,4,1 各位數相加；
        /// 和為 5 的倍數 (第 7 碼為 7 時和或和+1)。VFP 依 NEWBUYNO.DBF 是否存在決定除 10 或除 5，這裡採 112 年起的新制 (除 5，涵蓋舊制)
        /// </summary>
        private static bool IsBusinessNo(string no)
        {
            if (no.Length != 8 || !no.All(c => c >= '0' && c <= '9')) return false;
            int[] weights = { 1, 2, 1, 2, 1, 2, 4, 1 };
            var sum = 0;
            for (var i = 0; i < 8; i++)
            {
                var prod = (no[i] - '0') * weights[i];
                sum += prod / 10 + prod % 10;
            }
            return no[6] == '7' ? sum % 5 == 0 || (sum + 1) % 5 == 0 : sum % 5 == 0;
        }

        /// <summary>檢查使用者輸入能否存入 DBF：Big5 可編碼且不超過欄寬</summary>
        private static string? CheckText(string value, int maxBytes, string label)
        {
            int bytes;
            try
            {
                bytes = Big5Strict.GetByteCount(value);
            }
            catch (EncoderFallbackException)
            {
                return $"{label}含有無法存入 DBF 的字元 (罕用字或表情符號)";
            }
            return bytes > maxBytes ? $"{label}超過 {maxBytes} 個位元組 (中文字佔 2 個位元組)" : null;
        }

        private static (int Status, string Message) DescribeDbfError(DbfWriteResult res, string action)
        {
            if (res.ErrorType == "LOCK_TIMEOUT")
                return (StatusCodes.Status409Conflict, $"{action}失敗：{res.Message ?? "資料正被地端其他工作站使用中"}");
            if (res.ErrorType == "RECORD_NOT_FOUND")
                return (StatusCodes.Status409Conflict, $"{action}失敗：地端資料已變動，請重新整理後再試");
            if (res.ErrorType == "DUPLICATE_KEY")
                return (StatusCodes.Status409Conflict, $"{action}失敗：{res.Message ?? res.Error}");
            if (res.IsUnconfirmed)
                return (StatusCodes.Status504GatewayTimeout, $"{action}：{res.Message}");
            return (StatusCodes.Status500InternalServerError, $"{action}失敗：{res.Message ?? res.Error}");
        }

        private ObjectResult DbfError(DbfWriteResult res, string action)
        {
            var (status, message) = DescribeDbfError(res, action);
            return StatusCode(status, new { error = res.Error, message });
        }

        private static string Clean(string? value) => (value ?? string.Empty).Trim();

        private static string Str(DbDataReader r, string col) => r[col] == DBNull.Value ? string.Empty : r[col]?.ToString()?.Trim() ?? string.Empty;

        private static int Int(DbDataReader r, string col) => r[col] == DBNull.Value ? 0 : Convert.ToInt32(r[col], CultureInfo.InvariantCulture);
    }
}
