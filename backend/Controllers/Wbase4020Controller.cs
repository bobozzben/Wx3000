using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
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
    public class Wbase4020Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        public Wbase4020Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        private static string SafeFirstChar(string? s, string fallback = " ")
        {
            if (string.IsNullOrEmpty(s)) return fallback;
            var trimmed = s.Trim();
            return trimmed.Length > 0 ? trimmed.Substring(0, 1) : fallback;
        }

        // =========================================================================
        // 4-2 營業稅設定 (wbase4020 / customer.dbf)
        // =========================================================================

        // GET: api/wbase4020/taxop?keyword=xxx
        [HttpGet("taxop")]
        public async Task<ActionResult<IEnumerable<CustomerTaxDto>>> GetTaxOpList([FromQuery] string? keyword = null)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var whereSql = "";
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    whereSql = @"WHERE (LOWER(""no"") LIKE @kw OR LOWER(""name"") LIKE @kw OR LOWER(""abbr"") LIKE @kw)";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@kw";
                    p.Value = $"%{keyword.Trim().ToLower()}%";
                    cmd.Parameters.Add(p);
                }

                cmd.CommandText = $@"
                    SELECT ""no"", ""abbr"", ""name"", ""bydno"", ""bycno"", ""bybkdno"", ""bybkcno"",
                           ""sadno"", ""sacno"", ""sabkdno"", ""sabkcno"", ""casaccno"",
                           ""mediatype"", ""t401"", ""fileno"", ""tpay"", ""mainunino"", ""monthv"",
                           ""serial"", ""_record_number""
                    FROM ""{PgSchema}"".""customer""
                    {whereSql}
                    ORDER BY COALESCE(""serial"", 0), ""no"";";

                var list = new List<CustomerTaxDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new CustomerTaxDto
                    {
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Abbr = reader["abbr"]?.ToString()?.Trim() ?? string.Empty,
                        Name = reader["name"]?.ToString()?.Trim() ?? string.Empty,
                        Bydno = reader["bydno"]?.ToString()?.Trim() ?? string.Empty,
                        Bycno = reader["bycno"]?.ToString()?.Trim() ?? string.Empty,
                        Bybkdno = reader["bybkdno"]?.ToString()?.Trim() ?? string.Empty,
                        Bybkcno = reader["bybkcno"]?.ToString()?.Trim() ?? string.Empty,
                        Sadno = reader["sadno"]?.ToString()?.Trim() ?? string.Empty,
                        Sacno = reader["sacno"]?.ToString()?.Trim() ?? string.Empty,
                        Sabkdno = reader["sabkdno"]?.ToString()?.Trim() ?? string.Empty,
                        Sabkcno = reader["sabkcno"]?.ToString()?.Trim() ?? string.Empty,
                        Casaccno = reader["casaccno"]?.ToString()?.Trim() ?? string.Empty,
                        Mediatype = reader["mediatype"]?.ToString()?.Trim() ?? "0",
                        T401 = reader["t401"]?.ToString()?.Trim() ?? string.Empty,
                        Fileno = reader["fileno"]?.ToString()?.Trim() ?? string.Empty,
                        Tpay = reader["tpay"]?.ToString()?.Trim() ?? "0",
                        Mainunino = reader["mainunino"]?.ToString()?.Trim() ?? string.Empty,
                        Monthv = reader["monthv"]?.ToString()?.Trim() ?? "0",
                        Serial = reader["serial"] != DBNull.Value ? Convert.ToInt32(reader["serial"]) : null,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // PUT: api/wbase4020/taxop/{no}
        [HttpPut("taxop/{no}")]
        public async Task<IActionResult> UpdateTaxOp(string no, [FromBody] CustomerTaxDto model)
        {
            if (string.IsNullOrWhiteSpace(no) || model == null) return BadRequest("無效的資料");

            var trimmedNo = no.Trim().ToUpper();
            var fields = new Dictionary<string, object?>
            {
                ["bydno"] = (model.Bydno ?? "").Trim(),
                ["bycno"] = (model.Bycno ?? "").Trim(),
                ["bybkdno"] = (model.Bybkdno ?? "").Trim(),
                ["bybkcno"] = (model.Bybkcno ?? "").Trim(),
                ["sadno"] = (model.Sadno ?? "").Trim(),
                ["sacno"] = (model.Sacno ?? "").Trim(),
                ["sabkdno"] = (model.Sabkdno ?? "").Trim(),
                ["sabkcno"] = (model.Sabkcno ?? "").Trim(),
                ["casaccno"] = (model.Casaccno ?? "").Trim(),
                ["mediatype"] = SafeFirstChar(model.Mediatype, "0"),
                ["t401"] = SafeFirstChar(model.T401, " "),
                ["fileno"] = (model.Fileno ?? "").Trim(),
                ["tpay"] = SafeFirstChar(model.Tpay, "0"),
                ["mainunino"] = (model.Mainunino ?? "").Trim(),
                ["monthv"] = SafeFirstChar(model.Monthv, "0"),
            };

            // 1. 寫入 DBF (DBF 絕對權威，優先以 RECNO 精準定位，避免代號特殊字元或重複代號問題)
            DbfWriteResult writeRes;
            if (model.RecordNumber.HasValue && model.RecordNumber.Value > 0)
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "RECNO()", model.RecordNumber.Value.ToString(), fields);
                if (!writeRes.Success)
                {
                    writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
                }
            }
            else
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
            }

            if (!writeRes.Success)
            {
                if (writeRes.ErrorType == "LOCK_TIMEOUT")
                {
                    return StatusCode(StatusCodes.Status409Conflict, new { error = writeRes.Error, message = "資料正被地端其他工作站鎖定中，存檔取消" });
                }
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = writeRes.Message ?? writeRes.Error ?? "寫入 DBF 失敗" });
            }

            // 2. 同步寫入 PostgreSQL
            await UpdateCustomerFieldsInPg(trimmedNo, fields, model.RecordNumber);

            // 3. 更新 Checksum
            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "customer");
            if (!string.IsNullOrEmpty(chk))
            {
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "customer", chk);
            }

            return Ok(new { success = true });
        }

        // POST: api/wbase4020/taxop/apply-default/{no}
        [HttpPost("taxop/apply-default/{no}")]
        public async Task<IActionResult> ApplyDefaultTaxOp(string no)
        {
            if (string.IsNullOrWhiteSpace(no)) return BadRequest("客戶代號不可為空");

            // 讀取 accpara 標準科目
            var defaultAccs = await GetAccParaTaxDtoInternal();
            if (defaultAccs == null)
            {
                return BadRequest(new { message = "標準會計科目檔 (accpara) 尚未設定或無資料" });
            }

            var trimmedNo = no.Trim().ToUpper();
            var fields = new Dictionary<string, object?>
            {
                ["bydno"] = defaultAccs.Bydno,
                ["bycno"] = defaultAccs.Bycno,
                ["bybkdno"] = defaultAccs.Bybkdno,
                ["bybkcno"] = defaultAccs.Bybkcno,
                ["sadno"] = defaultAccs.Sadno,
                ["sacno"] = defaultAccs.Sacno,
                ["sabkdno"] = defaultAccs.Sabkdno,
                ["sabkcno"] = defaultAccs.Sabkcno,
                ["casaccno"] = defaultAccs.Casaccno
            };

            var recno = await GetCustomerRecordNumber(trimmedNo);
            DbfWriteResult writeRes;
            if (recno.HasValue && recno.Value > 0)
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "RECNO()", recno.Value.ToString(), fields);
                if (!writeRes.Success)
                {
                    writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
                }
            }
            else
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
            }

            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = writeRes.Message ?? writeRes.Error ?? "套用標準參數至 DBF 失敗" });
            }

            await UpdateCustomerFieldsInPg(trimmedNo, fields, recno);

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "customer");
            if (!string.IsNullOrEmpty(chk))
            {
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "customer", chk);
            }

            return Ok(new { success = true, applied = fields });
        }

        // GET: api/wbase4020/accpara/tax-accounts
        [HttpGet("accpara/tax-accounts")]
        public async Task<ActionResult<AccParaTaxDto>> GetAccParaTaxAccounts()
        {
            var res = await GetAccParaTaxDtoInternal();
            return Ok(res ?? new AccParaTaxDto());
        }

        // PUT: api/wbase4020/accpara/tax-accounts
        [HttpPut("accpara/tax-accounts")]
        public async Task<IActionResult> UpdateAccParaTaxAccounts([FromBody] AccParaTaxDto model)
        {
            if (model == null) return BadRequest("無效的資料");

            var fields = new Dictionary<string, object?>
            {
                ["bydno"] = (model.Bydno ?? "").Trim(),
                ["bycno"] = (model.Bycno ?? "").Trim(),
                ["bybkdno"] = (model.Bybkdno ?? "").Trim(),
                ["bybkcno"] = (model.Bybkcno ?? "").Trim(),
                ["sadno"] = (model.Sadno ?? "").Trim(),
                ["sacno"] = (model.Sacno ?? "").Trim(),
                ["sabkdno"] = (model.Sabkdno ?? "").Trim(),
                ["sabkcno"] = (model.Sabkcno ?? "").Trim(),
                ["casaccno"] = (model.Casaccno ?? "").Trim(),
            };

            // DBF update accpara (1 row)
            var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "accpara", "UPDATE", "RECNO()", "1", fields);
            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = "更新標準科目至 DBF 失敗" });
            }

            await UpdateSingleRowTableInPg("accpara", fields);

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "accpara");
            if (!string.IsNullOrEmpty(chk))
            {
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "accpara", chk);
            }

            return Ok(new { success = true });
        }

        // =========================================================================
        // 4-3 營業稅傳票轉檔設定 (wbase4030 / customer.dbf)
        // =========================================================================

        // GET: api/wbase4020/voucher?keyword=xxx
        [HttpGet("voucher")]
        public async Task<ActionResult<IEnumerable<CustomerVoucherDto>>> GetVoucherList([FromQuery] string? keyword = null)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var whereSql = "";
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    whereSql = @"WHERE (LOWER(""no"") LIKE @kw OR LOWER(""name"") LIKE @kw OR LOWER(""abbr"") LIKE @kw)";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@kw";
                    p.Value = $"%{keyword.Trim().ToLower()}%";
                    cmd.Parameters.Add(p);
                }

                cmd.CommandText = $@"
                    SELECT ""no"", ""abbr"", ""name"", ""monthv"", ""mediatype"",
                           ""trantype"", ""trankind"", ""trandate"",
                           ""trantypeb"", ""trankindb"", ""trandateb"",
                           ""fileno"", ""tpay"", ""serial"", ""_record_number""
                    FROM ""{PgSchema}"".""customer""
                    {whereSql}
                    ORDER BY COALESCE(""serial"", 0), ""no"";";

                var list = new List<CustomerVoucherDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new CustomerVoucherDto
                    {
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Abbr = reader["abbr"]?.ToString()?.Trim() ?? string.Empty,
                        Name = reader["name"]?.ToString()?.Trim() ?? string.Empty,
                        Monthv = reader["monthv"]?.ToString()?.Trim() ?? "0",
                        Mediatype = reader["mediatype"]?.ToString()?.Trim() ?? "0",
                        Trantype = reader["trantype"]?.ToString()?.Trim() ?? "1",
                        Trankind = reader["trankind"]?.ToString()?.Trim() ?? "1",
                        Trandate = reader["trandate"] != DBNull.Value ? Convert.ToDecimal(reader["trandate"]) : 0,
                        Trantypeb = reader["trantypeb"]?.ToString()?.Trim() ?? "1",
                        Trankindb = reader["trankindb"]?.ToString()?.Trim() ?? "1",
                        Trandateb = reader["trandateb"] != DBNull.Value ? Convert.ToDecimal(reader["trandateb"]) : 0,
                        Fileno = reader["fileno"]?.ToString()?.Trim() ?? string.Empty,
                        Tpay = reader["tpay"]?.ToString()?.Trim() ?? "0",
                        Serial = reader["serial"] != DBNull.Value ? Convert.ToInt32(reader["serial"]) : null,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // PUT: api/wbase4020/voucher/{no}
        [HttpPut("voucher/{no}")]
        public async Task<IActionResult> UpdateVoucher(string no, [FromBody] CustomerVoucherDto model)
        {
            if (string.IsNullOrWhiteSpace(no) || model == null) return BadRequest("無效的資料");

            var trimmedNo = no.Trim().ToUpper();
            var fields = new Dictionary<string, object?>
            {
                ["monthv"] = SafeFirstChar(model.Monthv, "0"),
                ["mediatype"] = SafeFirstChar(model.Mediatype, "0"),
                ["trantype"] = SafeFirstChar(model.Trantype, "1"),
                ["trankind"] = SafeFirstChar(model.Trankind, "1"),
                ["trandate"] = model.Trandate ?? 0m,
                ["trantypeb"] = SafeFirstChar(model.Trantypeb, "1"),
                ["trankindb"] = SafeFirstChar(model.Trankindb, "1"),
                ["trandateb"] = model.Trandateb ?? 0m,
                ["fileno"] = (model.Fileno ?? "").Trim(),
                ["tpay"] = SafeFirstChar(model.Tpay, "0"),
            };

            // 1. 寫入 DBF (DBF 絕對權威，優先以 RECNO 精準定位)
            DbfWriteResult writeRes;
            if (model.RecordNumber.HasValue && model.RecordNumber.Value > 0)
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "RECNO()", model.RecordNumber.Value.ToString(), fields);
                if (!writeRes.Success)
                {
                    writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
                }
            }
            else
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
            }

            if (!writeRes.Success)
            {
                if (writeRes.ErrorType == "LOCK_TIMEOUT")
                {
                    return StatusCode(StatusCodes.Status409Conflict, new { error = writeRes.Error, message = "資料正被地端其他工作站鎖定中，存檔取消" });
                }
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = writeRes.Message ?? writeRes.Error ?? "寫入 DBF 失敗" });
            }

            await UpdateCustomerFieldsInPg(trimmedNo, fields, model.RecordNumber);

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "customer");
            if (!string.IsNullOrEmpty(chk))
            {
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "customer", chk);
            }

            return Ok(new { success = true });
        }

        // POST: api/wbase4020/voucher/apply-default/{no}
        [HttpPost("voucher/apply-default/{no}")]
        public async Task<IActionResult> ApplyDefaultVoucher(string no)
        {
            if (string.IsNullOrWhiteSpace(no)) return BadRequest("客戶代號不可為空");

            var def = await GetAccParaVoucherDtoInternal();
            if (def == null)
            {
                return BadRequest(new { message = "標準轉傳票參數檔 (accpara) 尚未設定或無資料" });
            }

            var trimmedNo = no.Trim().ToUpper();
            var fields = new Dictionary<string, object?>
            {
                ["monthv"] = SafeFirstChar(def.SmMonthv, "0"),
                ["mediatype"] = SafeFirstChar(def.SmMedia, "2"),
                ["trantype"] = SafeFirstChar(def.SmType, "1"),
                ["trankind"] = SafeFirstChar(def.SmKind, "2"),
                ["trandate"] = def.SmDate ?? 1m,
                ["trantypeb"] = SafeFirstChar(def.SmTypeb, "1"),
                ["trankindb"] = SafeFirstChar(def.SmKindb, "2"),
                ["trandateb"] = def.SmDateb ?? 1m,
            };

            var recno = await GetCustomerRecordNumber(trimmedNo);
            DbfWriteResult writeRes;
            if (recno.HasValue && recno.Value > 0)
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "RECNO()", recno.Value.ToString(), fields);
                if (!writeRes.Success)
                {
                    writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
                }
            }
            else
            {
                writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fields);
            }

            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = writeRes.Message ?? writeRes.Error ?? "套用標準轉傳票參數至 DBF 失敗" });
            }

            await UpdateCustomerFieldsInPg(trimmedNo, fields, recno);

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "customer");
            if (!string.IsNullOrEmpty(chk))
            {
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "customer", chk);
            }

            return Ok(new { success = true, applied = fields });
        }

        // GET: api/wbase4020/accpara/voucher-params
        [HttpGet("accpara/voucher-params")]
        public async Task<ActionResult<AccParaVoucherDto>> GetAccParaVoucherParams()
        {
            var res = await GetAccParaVoucherDtoInternal();
            return Ok(res ?? new AccParaVoucherDto());
        }

        // PUT: api/wbase4020/accpara/voucher-params
        [HttpPut("accpara/voucher-params")]
        public async Task<IActionResult> UpdateAccParaVoucherParams([FromBody] AccParaVoucherDto model)
        {
            if (model == null) return BadRequest("無效的資料");

            var fields = new Dictionary<string, object?>
            {
                ["sm_monthv"] = SafeFirstChar(model.SmMonthv, "0"),
                ["sm_media"] = SafeFirstChar(model.SmMedia, "2"),
                ["sm_type"] = SafeFirstChar(model.SmType, "1"),
                ["sm_kind"] = SafeFirstChar(model.SmKind, "2"),
                ["sm_date"] = model.SmDate ?? 1m,
                ["sm_typeb"] = SafeFirstChar(model.SmTypeb, "1"),
                ["sm_kindb"] = SafeFirstChar(model.SmKindb, "2"),
                ["sm_dateb"] = model.SmDateb ?? 1m,
            };

            var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "accpara", "UPDATE", "RECNO()", "1", fields);
            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = "更新標準轉傳票參數至 DBF 失敗" });
            }

            await UpdateSingleRowTableInPg("accpara", fields);

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "accpara");
            if (!string.IsNullOrEmpty(chk))
            {
                await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "accpara", chk);
            }

            return Ok(new { success = true });
        }

        // =========================================================================
        // 4-4 期末存貨計算方式 / 進銷存方式設定 (wbase4040 / acc_st.dbf)
        // =========================================================================

        // GET: api/wbase4020/stock-mode?keyword=xxx
        [HttpGet("stock-mode")]
        public async Task<ActionResult<IEnumerable<AccStDto>>> GetStockModeList([FromQuery] string? keyword = null)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "acc_st", PgSchema, "acc_st", "no");
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var whereSql = "";
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    whereSql = @"WHERE (LOWER(c.""no"") LIKE @kw OR LOWER(c.""name"") LIKE @kw)";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@kw";
                    p.Value = $"%{keyword.Trim().ToLower()}%";
                    cmd.Parameters.Add(p);
                }

                cmd.CommandText = $@"
                    SELECT c.""no"", c.""name"", 
                           COALESCE(NULLIF(TRIM(s.""stock""), ''), NULLIF(TRIM(c.""stock""), ''), 'A') AS ""stock"",
                           COALESCE(NULLIF(TRIM(s.""acctype""), ''), NULLIF(TRIM(c.""acctype""), ''), 'A') AS ""acctype"",
                           COALESCE(s.""serial"", c.""serial"", 0) AS ""serial"",
                           COALESCE(s.""_record_number"", c.""_record_number"") AS ""_record_number""
                    FROM ""{PgSchema}"".""customer"" c
                    LEFT JOIN ""{PgSchema}"".""acc_st"" s ON TRIM(s.""no"") = TRIM(c.""no"")
                    {whereSql}
                    ORDER BY COALESCE(s.""serial"", c.""serial"", 0), c.""no"";";

                var list = new List<AccStDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var stockVal = reader["stock"]?.ToString()?.Trim() ?? "A";
                    if (string.IsNullOrEmpty(stockVal)) stockVal = "A";
                    var acctypeVal = reader["acctype"]?.ToString()?.Trim() ?? "A";
                    if (string.IsNullOrEmpty(acctypeVal)) acctypeVal = "A";

                    list.Add(new AccStDto
                    {
                        No = reader["no"]?.ToString()?.Trim() ?? string.Empty,
                        Name = reader["name"]?.ToString()?.Trim() ?? string.Empty,
                        Stock = stockVal,
                        Acctype = acctypeVal,
                        Serial = reader["serial"] != DBNull.Value ? Convert.ToInt32(reader["serial"]) : null,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        private ObjectResult StockModeWriteFailure(DbfWriteResult writeRes, string context)
        {
            var status = writeRes.ErrorType == "LOCK_TIMEOUT" ? StatusCodes.Status409Conflict : StatusCodes.Status500InternalServerError;
            return StatusCode(status, new { error = $"{context}: {writeRes.Error ?? writeRes.Message}", message = context });
        }

        // PUT: api/wbase4020/stock-mode/{no}
        [HttpPut("stock-mode/{no}")]
        public async Task<IActionResult> UpdateStockMode(string no, [FromBody] AccStDto model)
        {
            if (string.IsNullOrWhiteSpace(no) || model == null) return BadRequest("無效的資料");

            var trimmedNo = no.Trim().ToUpper();
            var stockCode = SafeFirstChar(model.Stock, "A").ToUpper();
            var acctypeCode = SafeFirstChar(model.Acctype, "A").ToUpper();

            // 1. 寫入 acc_st.dbf
            var fieldsAccSt = new Dictionary<string, object?>
            {
                ["stock"] = stockCode,
                ["acctype"] = acctypeCode
            };
            var writeRes1 = await _dbfSyncService.WriteRecordAsync(DbfPath, "acc_st", "UPDATE", "no", trimmedNo, fieldsAccSt);
            // 只有確定查無記錄才新增；鎖定逾時等其他失敗若也新增，會產生重複的 no
            if (!writeRes1.Success && writeRes1.ErrorType == "RECORD_NOT_FOUND")
            {
                var fieldsAccStInsert = new Dictionary<string, object?>
                {
                    ["no"] = trimmedNo,
                    ["name"] = model.Name ?? "",
                    ["stock"] = stockCode,
                    ["acctype"] = acctypeCode,
                    ["serial"] = model.Serial ?? 0
                };
                writeRes1 = await _dbfSyncService.WriteRecordAsync(DbfPath, "acc_st", "INSERT", "no", trimmedNo, fieldsAccStInsert);
            }
            if (!writeRes1.Success)
            {
                return StockModeWriteFailure(writeRes1, "寫入 acc_st.dbf 失敗");
            }

            // 2. 原生 VFP 規範：連動更新 customer.dbf 的 stock 與 acctype
            var fieldsCustomer = new Dictionary<string, object?>
            {
                ["stock"] = stockCode,
                ["acctype"] = acctypeCode
            };
            var custRecno = await GetCustomerRecordNumber(trimmedNo);
            DbfWriteResult writeRes2;
            if (custRecno.HasValue && custRecno.Value > 0)
            {
                writeRes2 = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "RECNO()", custRecno.Value.ToString(), fieldsCustomer);
                if (!writeRes2.Success)
                {
                    writeRes2 = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fieldsCustomer);
                }
            }
            else
            {
                writeRes2 = await _dbfSyncService.WriteRecordAsync(DbfPath, "customer", "UPDATE", "no", trimmedNo, fieldsCustomer);
            }
            if (!writeRes2.Success)
            {
                // PostgreSQL 與 Checksum 都還沒更新，下次查詢會從 DBF 重新同步；重送一次即可補上 customer
                return StockModeWriteFailure(writeRes2, "acc_st.dbf 已寫入，但連動更新 customer.dbf 失敗");
            }

            // 3. 同步至 PostgreSQL
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = $@"
                    UPDATE ""{PgSchema}"".""customer""
                    SET ""stock"" = @stock, ""acctype"" = @acctype
                    WHERE TRIM(""no"") = @no;

                    UPDATE ""{PgSchema}"".""acc_st""
                    SET ""stock"" = @stock, ""acctype"" = @acctype
                    WHERE TRIM(""no"") = @no;

                    INSERT INTO ""{PgSchema}"".""acc_st"" (""no"", ""name"", ""stock"", ""acctype"", ""serial"", ""_record_number"")
                    SELECT @no, @name, @stock, @acctype, @serial, COALESCE(MAX(""_record_number""), 0) + 1
                    FROM ""{PgSchema}"".""acc_st""
                    WHERE NOT EXISTS (SELECT 1 FROM ""{PgSchema}"".""acc_st"" WHERE TRIM(""no"") = @no);";

                var pNo = cmd.CreateParameter();
                pNo.ParameterName = "@no";
                pNo.Value = trimmedNo;
                cmd.Parameters.Add(pNo);

                var pName = cmd.CreateParameter();
                pName.ParameterName = "@name";
                pName.Value = model.Name ?? "";
                cmd.Parameters.Add(pName);

                var pStock = cmd.CreateParameter();
                pStock.ParameterName = "@stock";
                pStock.Value = stockCode;
                cmd.Parameters.Add(pStock);

                var pAcc = cmd.CreateParameter();
                pAcc.ParameterName = "@acctype";
                pAcc.Value = acctypeCode;
                cmd.Parameters.Add(pAcc);

                var pSerial = cmd.CreateParameter();
                pSerial.ParameterName = "@serial";
                pSerial.Value = (object?)model.Serial ?? DBNull.Value;
                cmd.Parameters.Add(pSerial);

                await cmd.ExecuteNonQueryAsync();
            }

            // 4. 更新 Checksum
            var chk1 = await _dbfSyncService.GetChecksumAsync(DbfPath, "acc_st");
            if (!string.IsNullOrEmpty(chk1)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "acc_st", chk1);

            var chk2 = await _dbfSyncService.GetChecksumAsync(DbfPath, "customer");
            if (!string.IsNullOrEmpty(chk2)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "customer", chk2);

            return Ok(new { success = true });
        }

        // =========================================================================
        // 4-5 共用會計科目摘要 (wbase4050 / descrip.dbf + xmaster.dbf)
        // =========================================================================

        // GET: api/wbase4020/descrip?accno=xxx
        [HttpGet("descrip")]
        public async Task<ActionResult<IEnumerable<DescripItemDto>>> GetDescripList([FromQuery] string? accno = null)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "descrip", PgSchema, "descrip", "");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var whereSql = "";
                if (!string.IsNullOrWhiteSpace(accno))
                {
                    whereSql = @"WHERE TRIM(""accno"") = @accno";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@accno";
                    p.Value = accno.Trim().ToUpper();
                    cmd.Parameters.Add(p);
                }

                cmd.CommandText = $@"
                    SELECT ""accno"", ""descrip"", ""serial"", ""_record_number""
                    FROM ""{PgSchema}"".""descrip""
                    {whereSql}
                    ORDER BY TRIM(""accno""), COALESCE(""serial"", 0);";

                var list = new List<DescripItemDto>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new DescripItemDto
                    {
                        Accno = reader["accno"]?.ToString()?.Trim() ?? string.Empty,
                        Descrip = reader["descrip"]?.ToString()?.Trim() ?? string.Empty,
                        Serial = reader["serial"] != DBNull.Value ? Convert.ToDecimal(reader["serial"]) : null,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // GET: api/wbase4020/descrip/accounts
        [HttpGet("descrip/accounts")]
        public async Task<ActionResult<IEnumerable<AccountMaster>>> GetDescripAccounts([FromQuery] string? keyword = null)
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "xmaster", PgSchema, "xmaster", "accno");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                var whereSql = "";
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    whereSql = @"WHERE (LOWER(""accno"") LIKE @kw OR LOWER(""accname"") LIKE @kw)";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@kw";
                    p.Value = $"%{keyword.Trim().ToLower()}%";
                    cmd.Parameters.Add(p);
                }

                cmd.CommandText = $@"
                    SELECT ""accno"", ""accname"", ""dept"", ""taxcode"", ""serial"", ""_record_number""
                    FROM ""{PgSchema}"".""xmaster""
                    {whereSql}
                    ORDER BY ""accno"";";

                var list = new List<AccountMaster>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new AccountMaster
                    {
                        Accno = reader["accno"]?.ToString()?.Trim() ?? string.Empty,
                        Accname = reader["accname"]?.ToString()?.Trim() ?? string.Empty,
                        Dept = reader["dept"]?.ToString()?.Trim() ?? string.Empty,
                        Taxcode = reader["taxcode"]?.ToString()?.Trim() ?? string.Empty,
                        Serial = reader["serial"] != DBNull.Value ? Convert.ToInt32(reader["serial"]) : null,
                        RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // POST: api/wbase4020/descrip
        [HttpPost("descrip")]
        public async Task<ActionResult<DescripItemDto>> CreateDescrip([FromBody] DescripItemDto model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Accno)) return BadRequest("科目代號不可為空");

            var trimmedAccno = model.Accno.Trim().ToUpper();

            // 取得目前該科目下最大 serial
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            decimal nextSerial = 1;
            using (var maxCmd = conn.CreateCommand())
            {
                maxCmd.CommandText = $@"SELECT COALESCE(MAX(""serial""), 0) + 1 FROM ""{PgSchema}"".""descrip"" WHERE TRIM(""accno"") = @accno;";
                var p = maxCmd.CreateParameter();
                p.ParameterName = "@accno";
                p.Value = trimmedAccno;
                maxCmd.Parameters.Add(p);
                var obj = await maxCmd.ExecuteScalarAsync();
                if (obj != null && obj != DBNull.Value) nextSerial = Convert.ToDecimal(obj);
            }

            var fields = new Dictionary<string, object?>
            {
                ["accno"] = trimmedAccno,
                ["descrip"] = (model.Descrip ?? "").Trim(),
                ["serial"] = nextSerial
            };

            var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "descrip", "INSERT", "accno", trimmedAccno, fields);
            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = "新增摘要至 DBF 失敗" });
            }

            // 同步寫入 PostgreSQL
            int targetRecno = writeRes.Recno;
            using (var insCmd = conn.CreateCommand())
            {
                insCmd.CommandText = $@"
                    INSERT INTO ""{PgSchema}"".""descrip"" (""accno"", ""descrip"", ""serial"", ""_record_number"")
                    VALUES (@accno, @descrip, @serial, @recno);";
                var p1 = insCmd.CreateParameter(); p1.ParameterName = "@accno"; p1.Value = trimmedAccno; insCmd.Parameters.Add(p1);
                var p2 = insCmd.CreateParameter(); p2.ParameterName = "@descrip"; p2.Value = (model.Descrip ?? "").Trim(); insCmd.Parameters.Add(p2);
                var p3 = insCmd.CreateParameter(); p3.ParameterName = "@serial"; p3.Value = nextSerial; insCmd.Parameters.Add(p3);
                var p4 = insCmd.CreateParameter(); p4.ParameterName = "@recno"; p4.Value = targetRecno; insCmd.Parameters.Add(p4);
                await insCmd.ExecuteNonQueryAsync();
            }

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "descrip");
            if (!string.IsNullOrEmpty(chk)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "descrip", chk);

            model.Accno = trimmedAccno;
            model.Serial = nextSerial;
            model.RecordNumber = targetRecno;

            return Ok(model);
        }

        // PUT: api/wbase4020/descrip/{recno}
        [HttpPut("descrip/{recno}")]
        public async Task<IActionResult> UpdateDescrip(int recno, [FromBody] DescripItemDto model)
        {
            if (recno <= 0 || model == null) return BadRequest("無效的資料");

            var trimmedAccno = (model.Accno ?? "").Trim().ToUpper();
            var desc = (model.Descrip ?? "").Trim();

            var fields = new Dictionary<string, object?>
            {
                ["descrip"] = desc
            };

            var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "descrip", "UPDATE", "RECNO()", recno.ToString(), fields);
            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = "更新摘要至 DBF 失敗" });
            }

            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = $@"UPDATE ""{PgSchema}"".""descrip"" SET ""descrip"" = @desc WHERE ""_record_number"" = @recno;";
                var p1 = cmd.CreateParameter(); p1.ParameterName = "@desc"; p1.Value = desc; cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@recno"; p2.Value = recno; cmd.Parameters.Add(p2);
                await cmd.ExecuteNonQueryAsync();
            }

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "descrip");
            if (!string.IsNullOrEmpty(chk)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "descrip", chk);

            return Ok(new { success = true });
        }

        // DELETE: api/wbase4020/descrip/{recno}
        [HttpDelete("descrip/{recno}")]
        public async Task<IActionResult> DeleteDescrip(int recno)
        {
            if (recno <= 0) return BadRequest("無效的記錄編號");

            var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "descrip", "DELETE", "RECNO()", recno.ToString(), new Dictionary<string, object?>());
            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = "刪除 DBF 摘要記錄失敗" });
            }

            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = $@"DELETE FROM ""{PgSchema}"".""descrip"" WHERE ""_record_number"" = @recno;";
                var p = cmd.CreateParameter(); p.ParameterName = "@recno"; p.Value = recno; cmd.Parameters.Add(p);
                await cmd.ExecuteNonQueryAsync();
            }

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "descrip");
            if (!string.IsNullOrEmpty(chk)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "descrip", chk);

            return Ok(new { success = true, deletedRecno = recno });
        }

        public class ReorderDescripRequest
        {
            public int Recno1 { get; set; }
            public decimal Serial1 { get; set; }
            public int Recno2 { get; set; }
            public decimal Serial2 { get; set; }
        }

        // POST: api/wbase4020/descrip/swap-order
        [HttpPost("descrip/swap-order")]
        public async Task<IActionResult> SwapDescripOrder([FromBody] ReorderDescripRequest req)
        {
            if (req.Recno1 <= 0 || req.Recno2 <= 0) return BadRequest("無效的記錄編號");

            // 交換兩筆之 serial
            var fields1 = new Dictionary<string, object?> { ["serial"] = req.Serial2 };
            var fields2 = new Dictionary<string, object?> { ["serial"] = req.Serial1 };

            await _dbfSyncService.WriteRecordAsync(DbfPath, "descrip", "UPDATE", "RECNO()", req.Recno1.ToString(), fields1);
            await _dbfSyncService.WriteRecordAsync(DbfPath, "descrip", "UPDATE", "RECNO()", req.Recno2.ToString(), fields2);

            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = $@"
                    UPDATE ""{PgSchema}"".""descrip"" SET ""serial"" = @s2 WHERE ""_record_number"" = @r1;
                    UPDATE ""{PgSchema}"".""descrip"" SET ""serial"" = @s1 WHERE ""_record_number"" = @r2;";
                var p1 = cmd.CreateParameter(); p1.ParameterName = "@s2"; p1.Value = req.Serial2; cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@r1"; p2.Value = req.Recno1; cmd.Parameters.Add(p2);
                var p3 = cmd.CreateParameter(); p3.ParameterName = "@s1"; p3.Value = req.Serial1; cmd.Parameters.Add(p3);
                var p4 = cmd.CreateParameter(); p4.ParameterName = "@r2"; p4.Value = req.Recno2; cmd.Parameters.Add(p4);
                await cmd.ExecuteNonQueryAsync();
            }

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "descrip");
            if (!string.IsNullOrEmpty(chk)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "descrip", chk);

            return Ok(new { success = true });
        }

        // =========================================================================
        // 4-6 共用參數設定 (wbase4060 / pub_para.dbf)
        // =========================================================================

        // GET: api/wbase4020/pub-para
        [HttpGet("pub-para")]
        public async Task<ActionResult<PubParaDto>> GetPubPara()
        {
            try
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "pub_para", PgSchema, "pub_para", "");

                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = $@"SELECT ""qqsel"" FROM ""{PgSchema}"".""pub_para"" LIMIT 1;";
                var obj = await cmd.ExecuteScalarAsync();
                var qqsel = obj?.ToString()?.Trim() ?? "0";
                if (string.IsNullOrEmpty(qqsel)) qqsel = "0";

                return Ok(new PubParaDto { Qqsel = qqsel });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // PUT: api/wbase4020/pub-para
        [HttpPut("pub-para")]
        public async Task<IActionResult> UpdatePubPara([FromBody] PubParaDto model)
        {
            if (model == null) return BadRequest("無效的資料");

            var sel = SafeFirstChar(model.Qqsel, "0");
            var fields = new Dictionary<string, object?>
            {
                ["qqsel"] = sel
            };

            var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, "pub_para", "UPDATE", "RECNO()", "1", fields);
            if (!writeRes.Success)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeRes.Error, message = "更新共用參數至 DBF 失敗" });
            }

            await UpdateSingleRowTableInPg("pub_para", fields);

            var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, "pub_para");
            if (!string.IsNullOrEmpty(chk)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, "pub_para", chk);

            return Ok(new { success = true, qqsel = sel });
        }

        // =========================================================================
        // Helper Methods
        // =========================================================================

        private async Task UpdateCustomerFieldsInPg(string no, Dictionary<string, object?> fields, int? recordNumber = null)
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            var setClauses = string.Join(", ", fields.Keys.Select(k => $"\"{k}\" = @{k}"));
            if (recordNumber.HasValue && recordNumber.Value > 0)
            {
                cmd.CommandText = $@"UPDATE ""{PgSchema}"".""customer"" SET {setClauses} WHERE ""_record_number"" = @recno;";
                var pRec = cmd.CreateParameter();
                pRec.ParameterName = "@recno";
                pRec.Value = recordNumber.Value;
                cmd.Parameters.Add(pRec);
            }
            else
            {
                cmd.CommandText = $@"UPDATE ""{PgSchema}"".""customer"" SET {setClauses} WHERE TRIM(""no"") = @no;";
                var pKey = cmd.CreateParameter();
                pKey.ParameterName = "@no";
                pKey.Value = no.Trim().ToUpper();
                cmd.Parameters.Add(pKey);
            }

            foreach (var kvp in fields)
            {
                var p = cmd.CreateParameter();
                p.ParameterName = $"@{kvp.Key}";
                p.Value = kvp.Value ?? DBNull.Value;
                cmd.Parameters.Add(p);
            }

            await cmd.ExecuteNonQueryAsync();
        }

        private async Task<int?> GetCustomerRecordNumber(string no)
        {
            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = $@"SELECT ""_record_number"" FROM ""{PgSchema}"".""customer"" WHERE TRIM(""no"") = @no LIMIT 1;";
                var p = cmd.CreateParameter();
                p.ParameterName = "@no";
                p.Value = no.Trim().ToUpper();
                cmd.Parameters.Add(p);

                var obj = await cmd.ExecuteScalarAsync();
                if (obj != null && obj != DBNull.Value)
                {
                    return Convert.ToInt32(obj);
                }
            }
            catch
            {
            }
            return null;
        }

        private async Task UpdateSingleRowTableInPg(string tableName, Dictionary<string, object?> fields)
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            var setClauses = string.Join(", ", fields.Keys.Select(k => $"\"{k}\" = @{k}"));
            cmd.CommandText = $@"
                UPDATE ""{PgSchema}"".""{tableName}""
                SET {setClauses}
                WHERE ""_record_number"" = 1 OR ctid = (SELECT ctid FROM ""{PgSchema}"".""{tableName}"" LIMIT 1);";

            foreach (var kvp in fields)
            {
                var p = cmd.CreateParameter();
                p.ParameterName = $"@{kvp.Key}";
                p.Value = kvp.Value ?? DBNull.Value;
                cmd.Parameters.Add(p);
            }

            await cmd.ExecuteNonQueryAsync();
        }

        private async Task<AccParaTaxDto?> GetAccParaTaxDtoInternal()
        {
            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "accpara", PgSchema, "accpara", "");

            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"
                SELECT ""bydno"", ""bycno"", ""bybkdno"", ""bybkcno"",
                       ""sadno"", ""sacno"", ""sabkdno"", ""sabkcno"", ""casaccno""
                FROM ""{PgSchema}"".""accpara""
                LIMIT 1;";

            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new AccParaTaxDto
                {
                    Bydno = reader["bydno"]?.ToString()?.Trim() ?? string.Empty,
                    Bycno = reader["bycno"]?.ToString()?.Trim() ?? string.Empty,
                    Bybkdno = reader["bybkdno"]?.ToString()?.Trim() ?? string.Empty,
                    Bybkcno = reader["bybkcno"]?.ToString()?.Trim() ?? string.Empty,
                    Sadno = reader["sadno"]?.ToString()?.Trim() ?? string.Empty,
                    Sacno = reader["sacno"]?.ToString()?.Trim() ?? string.Empty,
                    Sabkdno = reader["sabkdno"]?.ToString()?.Trim() ?? string.Empty,
                    Sabkcno = reader["sabkcno"]?.ToString()?.Trim() ?? string.Empty,
                    Casaccno = reader["casaccno"]?.ToString()?.Trim() ?? string.Empty
                };
            }
            return null;
        }

        private async Task<AccParaVoucherDto?> GetAccParaVoucherDtoInternal()
        {
            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, "accpara", PgSchema, "accpara", "");

            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"
                SELECT ""sm_monthv"", ""sm_media"", ""sm_type"", ""sm_kind"", ""sm_date"",
                       ""sm_typeb"", ""sm_kindb"", ""sm_dateb""
                FROM ""{PgSchema}"".""accpara""
                LIMIT 1;";

            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new AccParaVoucherDto
                {
                    SmMonthv = reader["sm_monthv"]?.ToString()?.Trim() ?? "0",
                    SmMedia = reader["sm_media"]?.ToString()?.Trim() ?? "2",
                    SmType = reader["sm_type"]?.ToString()?.Trim() ?? "1",
                    SmKind = reader["sm_kind"]?.ToString()?.Trim() ?? "2",
                    SmDate = reader["sm_date"] != DBNull.Value ? Convert.ToDecimal(reader["sm_date"]) : 1m,
                    SmTypeb = reader["sm_typeb"]?.ToString()?.Trim() ?? "1",
                    SmKindb = reader["sm_kindb"]?.ToString()?.Trim() ?? "2",
                    SmDateb = reader["sm_dateb"] != DBNull.Value ? Convert.ToDecimal(reader["sm_dateb"]) : 1m
                };
            }
            return null;
        }
    }
}
