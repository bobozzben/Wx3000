using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Text;
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
    public class Wbase4010Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        public Wbase4010Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        public class ModeMeta
        {
            public int Mode { get; set; }
            public string TableName { get; set; } = string.Empty;
            public string Title { get; set; } = string.Empty;
            public string PubDept { get; set; } = string.Empty;
            public bool IsOrgGroup { get; set; }
        }

        private static ModeMeta GetModeMeta(int mode)
        {
            return mode switch
            {
                2 => new ModeMeta { Mode = 2, TableName = "xmaster2", Title = "營造業會計科目", PubDept = "01234567ABCDF ", IsOrgGroup = false },
                3 => new ModeMeta { Mode = 3, TableName = "xmaster3", Title = "建設業會計科目", PubDept = "01234567ABCDF ", IsOrgGroup = false },
                4 => new ModeMeta { Mode = 4, TableName = "xmaster4", Title = "文教團體會計科目", PubDept = "0123456ABCDF ", IsOrgGroup = true },
                5 => new ModeMeta { Mode = 5, TableName = "xmaster5", Title = "社會團體會計科目", PubDept = "0123456ABCDF ", IsOrgGroup = true },
                6 => new ModeMeta { Mode = 6, TableName = "xmaster6", Title = "衛福團體會計科目", PubDept = "0123456ABCDF ", IsOrgGroup = true },
                _ => new ModeMeta { Mode = 1, TableName = "xmaster", Title = "標準會計科目", PubDept = "0123456ABCDF ", IsOrgGroup = false },
            };
        }

        public class BatchCopyRequest
        {
            public int Mode { get; set; } = 1;
            public List<string> Accnos { get; set; } = new();
        }

        // GET: api/wbase4010?mode=1&keyword=xxx
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AccountMaster>>> GetList([FromQuery] int mode = 1, [FromQuery] string? keyword = null)
        {
            try
            {
                var meta = GetModeMeta(mode);
                var dbfName = meta.TableName;

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, dbfName, PgSchema, dbfName, "accno");

                var list = await QueryAccountsFromPg(dbfName, keyword);
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase4010 GetList error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
            }
        }

        // GET: api/wbase4010/{accno}?mode=1
        [HttpGet("{accno}")]
        public async Task<ActionResult<AccountMaster>> GetByAccno(string accno, [FromQuery] int mode = 1)
        {
            if (string.IsNullOrWhiteSpace(accno)) return BadRequest("科目代號不可為空");

            var meta = GetModeMeta(mode);
            var dbfName = meta.TableName;

            await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, dbfName, PgSchema, dbfName, "accno");

            var trimmed = accno.Trim().ToUpper();
            var list = await QueryAccountsFromPg(dbfName, null);
            var item = list.FirstOrDefault(a => a.Accno.Trim().ToUpper() == trimmed);

            if (item == null)
            {
                return NotFound(new { message = $"找不到科目代號為 '{accno}' 的會計科目" });
            }

            return Ok(item);
        }

        // GET: api/wbase4010/ref?mode=1
        [HttpGet("ref")]
        public async Task<ActionResult<IEnumerable<AccountMaster>>> GetRefAccounts([FromQuery] int mode = 1)
        {
            await Task.CompletedTask;
            try
            {
                var meta = GetModeMeta(mode);
                var suffix = mode == 1 ? "" : mode.ToString();
                var refPath = Path.Combine(DbfPath.Substring(0, 3), "w3000", "ref", "80");
                var refDbf = $"xmaster{suffix}";

                if (!Directory.Exists(refPath))
                {
                    refPath = Path.Combine("F:\\w3000\\ref\\80");
                }

                var fullRefDbf = Path.Combine(refPath, refDbf + ".dbf");
                if (!System.IO.File.Exists(fullRefDbf))
                {
                    fullRefDbf = Path.Combine(DbfPath, meta.TableName + ".dbf");
                }

                var list = ParseDbfAccounts(fullRefDbf);
                var generalAccounts = list.Where(a => a.Accno.Trim().Length == 4).OrderBy(a => a.Accno).ToList();
                return Ok(generalAccounts);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase4010 GetRefAccounts error: {ex.Message}");
                return Ok(new List<AccountMaster>());
            }
        }

        // POST: api/wbase4010?mode=1
        [HttpPost]
        public async Task<ActionResult<AccountMaster>> Create([FromBody] AccountMaster model, [FromQuery] int mode = 1)
        {
            try
            {
                if (model == null) return BadRequest(new { message = "無效的資料" });

                var meta = GetModeMeta(mode);
                var dbfName = meta.TableName;
                var accno = model.Accno?.Trim().ToUpper() ?? string.Empty;

                if (string.IsNullOrWhiteSpace(accno) || accno == "新科目")
                {
                    return BadRequest(new { message = "科目代號不可為空白！" });
                }

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, dbfName, PgSchema, dbfName, "accno");

                var currentList = await QueryAccountsFromPg(dbfName, null);

                // 1. 重複檢查
                if (currentList.Any(a => a.Accno.Trim().ToUpper() == accno))
                {
                    return BadRequest(new { message = $"科目代號 [{accno}] 已存在，代號不可重複！" });
                }

                // 2. 總帳科目 (4碼以內) vs 明細科目 (5~8碼) 業務檢核 (對齊 update_accno)
                string inheritAccname = string.Empty;
                string inheritDept = string.Empty;

                if (accno.Length <= 4)
                {
                    if (meta.IsOrgGroup)
                    {
                        if (accno.Length == 4 && (accno.StartsWith("70") || accno.StartsWith("80")))
                        {
                            // 機關團體允許新增 70xx, 80xx 總帳科目
                        }
                        else
                        {
                            return BadRequest(new { message = "機關團體僅允許新增 70 或 80 開頭之總帳科目，其餘總帳科目不可自行新增。" });
                        }
                    }
                    else
                    {
                        return BadRequest(new { message = "一般行業不可自行新增總帳科目，請使用 [F3] 複製標準總帳科目！" });
                    }
                }
                else
                {
                    // 明細科目 (長度 > 4 碼): 母總帳科目 (前 4 碼) 必須存在
                    var parentAccno = accno.Substring(0, 4);
                    var parentAcc = currentList.FirstOrDefault(a => a.Accno.Trim().ToUpper() == parentAccno);
                    if (parentAcc == null)
                    {
                        return BadRequest(new { message = $"無此總帳科目 [{parentAccno}]！新增子科目必須存在對應的4碼總帳科目。" });
                    }

                    // 檢查是否只存在母總帳科目 (k_num == 1) 且已有發生金額或期初金額
                    var samePrefixAccounts = currentList.Where(a => a.Accno.Trim().ToUpper().StartsWith(parentAccno)).ToList();
                    if (samePrefixAccounts.Count == 1)
                    {
                        decimal totalAmt = (parentAcc.Ldamount ?? 0) - (parentAcc.Lcamount ?? 0);
                        // 是否為借方科目
                        bool isDebit = IsDebitAccount(parentAcc.Accno);
                        if (!isDebit)
                        {
                            totalAmt = (parentAcc.Lcamount ?? 0) - (parentAcc.Ldamount ?? 0);
                        }

                        totalAmt += ((parentAcc.Damount1 ?? 0) - (parentAcc.Camount1 ?? 0));
                        totalAmt += ((parentAcc.Damount2 ?? 0) - (parentAcc.Camount2 ?? 0));
                        totalAmt += ((parentAcc.Damount3 ?? 0) - (parentAcc.Camount3 ?? 0));
                        totalAmt += ((parentAcc.Damount4 ?? 0) - (parentAcc.Camount4 ?? 0));
                        totalAmt += ((parentAcc.Damount5 ?? 0) - (parentAcc.Camount5 ?? 0));
                        totalAmt += ((parentAcc.Damount6 ?? 0) - (parentAcc.Camount6 ?? 0));
                        totalAmt += ((parentAcc.Damount7 ?? 0) - (parentAcc.Camount7 ?? 0));
                        totalAmt += ((parentAcc.Damount8 ?? 0) - (parentAcc.Camount8 ?? 0));
                        totalAmt += ((parentAcc.Damount9 ?? 0) - (parentAcc.Camount9 ?? 0));
                        totalAmt += ((parentAcc.Damount10 ?? 0) - (parentAcc.Camount10 ?? 0));
                        totalAmt += ((parentAcc.Damount11 ?? 0) - (parentAcc.Camount11 ?? 0));
                        totalAmt += ((parentAcc.Damount12 ?? 0) - (parentAcc.Camount12 ?? 0));

                        if (totalAmt != 0)
                        {
                            return BadRequest(new { message = "此總帳科目已有傳票資料，若要新增子科目請執行 [F9]-3 建立子目功能轉移資料！" });
                        }
                    }

                    inheritAccname = parentAcc.Accname.Trim();
                    inheritDept = parentAcc.Dept?.Trim() ?? string.Empty;
                }

                var nextSerial = currentList.Count > 0 ? (currentList.Max(a => a.Serial ?? 0) + 1) : 1;

                var finalAccname = !string.IsNullOrWhiteSpace(model.Accname) ? model.Accname.Trim() : inheritAccname;
                var finalDept = !string.IsNullOrWhiteSpace(model.Dept) ? model.Dept.Trim() : inheritDept;

                var deptCode = string.IsNullOrWhiteSpace(finalDept) ? " " : finalDept.Trim().Substring(0, 1).ToUpper();
                var taxCode = string.IsNullOrWhiteSpace(model.Taxcode) ? " " : model.Taxcode.Trim().Substring(0, 1);

                var fields = new Dictionary<string, object?>
                {
                    ["accno"] = accno,
                    ["accname"] = finalAccname,
                    ["dept"] = deptCode,
                    ["taxcode"] = taxCode,
                    ["accnamel"] = (model.Accnamel ?? string.Empty).Trim(),
                    ["engaccname"] = (model.Engaccname ?? string.Empty).Trim(),
                    ["serial"] = nextSerial,
                    ["ldamount"] = model.Ldamount ?? 0,
                    ["lcamount"] = model.Lcamount ?? 0
                };

                // 寫入 DBF 優先
                var writeResult = await _dbfSyncService.WriteRecordAsync(DbfPath, dbfName, "INSERT", "accno", accno, fields);
                if (!writeResult.Success)
                {
                    if (writeResult.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new { error = writeResult.Error, message = writeResult.Message ?? "資料正被地端其他工作站編輯中，存檔取消" });
                    }
                    return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeResult.Error, message = writeResult.Message ?? "寫入 DBF 失敗" });
                }

                // 同步寫入 PostgreSQL
                var recno = await InsertAccountToPg(dbfName, fields, writeResult.Recno);

                // 更新 Checksum 字典表
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, dbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                {
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, dbfName, newChecksum);
                }

                model.Accno = accno;
                model.Accname = finalAccname;
                model.Dept = deptCode.Trim();
                model.Taxcode = taxCode.Trim();
                model.Serial = nextSerial;
                model.RecordNumber = recno;

                return CreatedAtAction(nameof(GetByAccno), new { accno = model.Accno, mode }, model);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase4010 Create error: {ex}");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message, message = $"新增科目失敗: {ex.Message}" });
            }
        }

        // PUT: api/wbase4010/{accno}?mode=1
        [HttpPut("{accno}")]
        public async Task<IActionResult> Update(string accno, [FromBody] AccountMaster model, [FromQuery] int mode = 1)
        {
            try
            {
                if (model == null || string.IsNullOrWhiteSpace(accno)) return BadRequest(new { message = "無效的資料" });

                var meta = GetModeMeta(mode);
                var dbfName = meta.TableName;
                var trimmedAccno = accno.Trim().ToUpper();

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, dbfName, PgSchema, dbfName, "accno");

                var currentList = await QueryAccountsFromPg(dbfName, null);
                var existing = currentList.FirstOrDefault(a => a.Accno.Trim().ToUpper() == trimmedAccno);
                if (existing == null)
                {
                    return NotFound(new { message = $"找不到科目代號為 '{accno}' 的會計科目" });
                }

                // 驗證 Dept 格式
                var deptVal = model.Dept?.Trim() ?? string.Empty;
                if (!string.IsNullOrWhiteSpace(deptVal) && deptVal != "0")
                {
                    var dChar = deptVal.Substring(0, 1).ToUpper();
                    if (!meta.PubDept.Contains(dChar))
                    {
                        return BadRequest(new { message = $"科目明細代碼 '{dChar}' 不符合此行業設定 ({meta.PubDept.Trim()})" });
                    }
                }

                var deptCode = string.IsNullOrWhiteSpace(deptVal) ? " " : deptVal.Trim().Substring(0, 1).ToUpper();
                var taxCode = string.IsNullOrWhiteSpace(model.Taxcode) ? " " : model.Taxcode.Trim().Substring(0, 1);

                var fields = new Dictionary<string, object?>
                {
                    ["accname"] = (model.Accname ?? string.Empty).Trim(),
                    ["dept"] = deptCode,
                    ["taxcode"] = taxCode,
                    ["accnamel"] = (model.Accnamel ?? string.Empty).Trim(),
                    ["engaccname"] = (model.Engaccname ?? string.Empty).Trim()
                };

                // 寫入地端 DBF
                var writeResult = await _dbfSyncService.WriteRecordAsync(DbfPath, dbfName, "UPDATE", "accno", trimmedAccno, fields);
                if (!writeResult.Success)
                {
                    if (writeResult.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new { error = writeResult.Error, message = writeResult.Message ?? "資料正被地端其他工作站編輯中，存檔取消" });
                    }
                    return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeResult.Error, message = writeResult.Message ?? "寫入 DBF 失敗" });
                }

                // 同步寫入 PostgreSQL
                await UpdateAccountInPg(dbfName, trimmedAccno, fields);

                // 更新 Checksum 字典表
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, dbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                {
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, dbfName, newChecksum);
                }

                return Ok(new { success = true, accno = trimmedAccno });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase4010 Update error: {ex}");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message, message = $"更新科目失敗: {ex.Message}" });
            }
        }

        // DELETE: api/wbase4010/{accno}?mode=1
        [HttpDelete("{accno}")]
        public async Task<IActionResult> Delete(string accno, [FromQuery] int mode = 1)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(accno)) return BadRequest(new { message = "科目代號不可為空" });

                var meta = GetModeMeta(mode);
                var dbfName = meta.TableName;
                var trimmedAccno = accno.Trim().ToUpper();

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, dbfName, PgSchema, dbfName, "accno");

                var currentList = await QueryAccountsFromPg(dbfName, null);
                var existing = currentList.FirstOrDefault(a => a.Accno.Trim().ToUpper() == trimmedAccno);
                if (existing == null)
                {
                    return NotFound(new { message = $"找不到科目代號為 '{accno}' 的會計科目" });
                }

                // 1. 總帳科目刪除防呆
                if (trimmedAccno.Length <= 4)
                {
                    if (meta.IsOrgGroup && trimmedAccno.Length == 4 &&
                        ((string.Compare(trimmedAccno, "7021") >= 0 && string.Compare(trimmedAccno, "7099") <= 0) ||
                         (string.Compare(trimmedAccno, "8021") >= 0 && string.Compare(trimmedAccno, "8099") <= 0)))
                    {
                        // 檢查是否已設立子科目
                        var subCount = currentList.Count(a => a.Accno.Trim().ToUpper().StartsWith(trimmedAccno));
                        if (subCount >= 2)
                        {
                            return BadRequest(new { message = "此會計科目已設立子科目，總帳科目不可刪除！" });
                        }
                    }
                    else
                    {
                        return BadRequest(new { message = "總帳科目不可刪除！" });
                    }
                }
                else
                {
                    // 明細科目刪除防呆：檢查年度發生額或期初金額
                    decimal mtotal = (existing.Ldamount ?? 0) + (existing.Lcamount ?? 0);
                    mtotal += (existing.Damount1 ?? 0) + (existing.Camount1 ?? 0);
                    mtotal += (existing.Damount2 ?? 0) + (existing.Camount2 ?? 0);
                    mtotal += (existing.Damount3 ?? 0) + (existing.Camount3 ?? 0);
                    mtotal += (existing.Damount4 ?? 0) + (existing.Camount4 ?? 0);
                    mtotal += (existing.Damount5 ?? 0) + (existing.Camount5 ?? 0);
                    mtotal += (existing.Damount6 ?? 0) + (existing.Camount6 ?? 0);
                    mtotal += (existing.Damount7 ?? 0) + (existing.Camount7 ?? 0);
                    mtotal += (existing.Damount8 ?? 0) + (existing.Camount8 ?? 0);
                    mtotal += (existing.Damount9 ?? 0) + (existing.Camount9 ?? 0);
                    mtotal += (existing.Damount10 ?? 0) + (existing.Camount10 ?? 0);
                    mtotal += (existing.Damount11 ?? 0) + (existing.Camount11 ?? 0);
                    mtotal += (existing.Damount12 ?? 0) + (existing.Camount12 ?? 0);

                    if (mtotal != 0)
                    {
                        return BadRequest(new { message = "此會計科目本年度尚有資料或餘額，請查明後再刪除！" });
                    }
                }

                // 寫入 DBF 刪除
                var writeResult = await _dbfSyncService.WriteRecordAsync(DbfPath, dbfName, "DELETE", "accno", trimmedAccno, new Dictionary<string, object?>());
                if (!writeResult.Success)
                {
                    if (writeResult.ErrorType == "LOCK_TIMEOUT")
                    {
                        return StatusCode(StatusCodes.Status409Conflict, new { error = writeResult.Error, message = writeResult.Message ?? "資料正被地端其他工作站編輯中，刪除取消" });
                    }
                    return StatusCode(StatusCodes.Status500InternalServerError, new { error = writeResult.Error, message = writeResult.Message ?? "刪除 DBF 失敗" });
                }

                // 與 VFP 不同：VFP (wbase401010delete) 刪除後會 update serial=serial-1 where serial>mserial。
                // LocalAgent 沒有批次更新，照做要逐筆寫 DBF，一次刪除最多約 20 秒，因此兩邊都不重編，serial 留空號。
                // 新增科目取 MAX(serial)+1，空號不會造成重號；VFP 開啟會計科目維護時會依 accno 重編全部 serial。

                // 從 PostgreSQL 刪除；失敗時不更新 Checksum，下次讀取會從 DBF 重灌快照
                if (await TryDeleteAccountFromPgAsync(dbfName, trimmedAccno))
                {
                    var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, dbfName);
                    if (!string.IsNullOrEmpty(newChecksum))
                    {
                        await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, dbfName, newChecksum);
                    }
                }

                return Ok(new { success = true, deletedAccno = trimmedAccno });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase4010 Delete error: {ex}");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message, message = $"刪除科目失敗: {ex.Message}" });
            }
        }

        // POST: api/wbase4010/batch-copy
        [HttpPost("batch-copy")]
        public async Task<IActionResult> BatchCopy([FromBody] BatchCopyRequest req)
        {
            try
            {
                if (req == null || req.Accnos == null || req.Accnos.Count == 0)
                {
                    return BadRequest(new { message = "請提供欲複製的科目代號清單" });
                }

                var meta = GetModeMeta(req.Mode);
                var dbfName = meta.TableName;

                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, dbfName, PgSchema, dbfName, "accno");

                var currentList = await QueryAccountsFromPg(dbfName, null);
                var existingAccnos = new HashSet<string>(currentList.Select(a => a.Accno.Trim().ToUpper()));

                // 讀取 Standard Reference Template
                var suffix = req.Mode == 1 ? "" : req.Mode.ToString();
                var refPath = Path.Combine(DbfPath.Substring(0, 3), "w3000", "ref", "80");
                var refDbf = Path.Combine(refPath, $"xmaster{suffix}.dbf");
                if (!System.IO.File.Exists(refDbf))
                {
                    refDbf = Path.Combine("F:\\w3000\\ref\\80", $"xmaster{suffix}.dbf");
                }
                if (!System.IO.File.Exists(refDbf))
                {
                    refDbf = Path.Combine(DbfPath, meta.TableName + ".dbf");
                }

                var refList = ParseDbfAccounts(refDbf);
                var toCopyList = refList.Where(r => req.Accnos.Contains(r.Accno.Trim().ToUpper()) && !existingAccnos.Contains(r.Accno.Trim().ToUpper())).ToList();

                int copiedCount = 0;
                var nextSerial = currentList.Count > 0 ? (currentList.Max(a => a.Serial ?? 0) + 1) : 1;

                foreach (var item in toCopyList)
                {
                    var trimmed = item.Accno.Trim().ToUpper();
                    var deptCode = string.IsNullOrWhiteSpace(item.Dept) ? " " : item.Dept.Trim().Substring(0, 1).ToUpper();
                    var taxCode = string.IsNullOrWhiteSpace(item.Taxcode) ? " " : item.Taxcode.Trim().Substring(0, 1);

                    var fields = new Dictionary<string, object?>
                    {
                        ["accno"] = trimmed,
                        ["accname"] = item.Accname.Trim(),
                        ["dept"] = deptCode,
                        ["taxcode"] = taxCode,
                        ["accnamel"] = (item.Accnamel ?? string.Empty).Trim(),
                        ["engaccname"] = (item.Engaccname ?? string.Empty).Trim(),
                        ["serial"] = nextSerial++,
                        ["ldamount"] = 0,
                        ["lcamount"] = 0
                    };

                    var writeRes = await _dbfSyncService.WriteRecordAsync(DbfPath, dbfName, "INSERT", "accno", trimmed, fields);
                    if (writeRes.Success)
                    {
                        await InsertAccountToPg(dbfName, fields, writeRes.Recno);
                        copiedCount++;
                    }
                }

                // 更新 Checksum 字典表
                var newChecksum = await _dbfSyncService.GetChecksumAsync(DbfPath, dbfName);
                if (!string.IsNullOrEmpty(newChecksum))
                {
                    await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, dbfName, newChecksum);
                }

                return Ok(new { success = true, copiedCount, totalRequested = req.Accnos.Count });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase4010 BatchCopy error: {ex}");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message, message = $"批次複製失敗: {ex.Message}" });
            }
        }

        #region Helper DB & PG Queries

        private static bool IsDebitAccount(string accno)
        {
            if (string.IsNullOrEmpty(accno)) return false;
            var c = accno.Substring(0, 1);
            return "1568".Contains(c) || accno.Trim() == "9999";
        }

        private async Task<List<AccountMaster>> QueryAccountsFromPg(string tableName, string? keyword)
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            var sql = new StringBuilder();
            sql.Append($@"SELECT accno, accname, type, dept, ldamount, lcamount, 
                                 damount1, camount1, damount2, camount2, damount3, camount3, 
                                 damount4, camount4, damount5, camount5, damount6, camount6, 
                                 damount7, camount7, damount8, camount8, damount9, camount9, 
                                 damount10, camount10, damount11, camount11, damount12, camount12, 
                                 bpage1, bpage2, taxcode, serial, engaccname, clsaccno, clsaccname, accnamel, _record_number 
                          FROM ""{PgSchema}"".""{tableName}"" ");

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                sql.Append(@"WHERE accno ILIKE @kw OR accname ILIKE @kw OR accnamel ILIKE @kw OR engaccname ILIKE @kw ");
                var pKw = cmd.CreateParameter();
                pKw.ParameterName = "@kw";
                pKw.Value = $"%{keyword.Trim()}%";
                cmd.Parameters.Add(pKw);
            }

            sql.Append("ORDER BY accno ASC;");
            cmd.CommandText = sql.ToString();

            var list = new List<AccountMaster>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var item = new AccountMaster
                {
                    Accno = reader["accno"]?.ToString()?.Trim() ?? string.Empty,
                    Accname = reader["accname"]?.ToString()?.Trim() ?? string.Empty,
                    Type = reader["type"]?.ToString()?.Trim(),
                    Dept = reader["dept"]?.ToString()?.Trim(),
                    Ldamount = reader["ldamount"] != DBNull.Value ? Convert.ToDecimal(reader["ldamount"]) : 0,
                    Lcamount = reader["lcamount"] != DBNull.Value ? Convert.ToDecimal(reader["lcamount"]) : 0,
                    Damount1 = reader["damount1"] != DBNull.Value ? Convert.ToDecimal(reader["damount1"]) : 0,
                    Camount1 = reader["camount1"] != DBNull.Value ? Convert.ToDecimal(reader["camount1"]) : 0,
                    Damount2 = reader["damount2"] != DBNull.Value ? Convert.ToDecimal(reader["damount2"]) : 0,
                    Camount2 = reader["camount2"] != DBNull.Value ? Convert.ToDecimal(reader["camount2"]) : 0,
                    Damount3 = reader["damount3"] != DBNull.Value ? Convert.ToDecimal(reader["damount3"]) : 0,
                    Camount3 = reader["camount3"] != DBNull.Value ? Convert.ToDecimal(reader["camount3"]) : 0,
                    Damount4 = reader["damount4"] != DBNull.Value ? Convert.ToDecimal(reader["damount4"]) : 0,
                    Camount4 = reader["camount4"] != DBNull.Value ? Convert.ToDecimal(reader["camount4"]) : 0,
                    Damount5 = reader["damount5"] != DBNull.Value ? Convert.ToDecimal(reader["damount5"]) : 0,
                    Camount5 = reader["camount5"] != DBNull.Value ? Convert.ToDecimal(reader["camount5"]) : 0,
                    Damount6 = reader["damount6"] != DBNull.Value ? Convert.ToDecimal(reader["damount6"]) : 0,
                    Camount6 = reader["camount6"] != DBNull.Value ? Convert.ToDecimal(reader["camount6"]) : 0,
                    Damount7 = reader["damount7"] != DBNull.Value ? Convert.ToDecimal(reader["damount7"]) : 0,
                    Camount7 = reader["camount7"] != DBNull.Value ? Convert.ToDecimal(reader["camount7"]) : 0,
                    Damount8 = reader["damount8"] != DBNull.Value ? Convert.ToDecimal(reader["damount8"]) : 0,
                    Camount8 = reader["camount8"] != DBNull.Value ? Convert.ToDecimal(reader["camount8"]) : 0,
                    Damount9 = reader["damount9"] != DBNull.Value ? Convert.ToDecimal(reader["damount9"]) : 0,
                    Camount9 = reader["camount9"] != DBNull.Value ? Convert.ToDecimal(reader["camount9"]) : 0,
                    Damount10 = reader["damount10"] != DBNull.Value ? Convert.ToDecimal(reader["damount10"]) : 0,
                    Camount10 = reader["camount10"] != DBNull.Value ? Convert.ToDecimal(reader["camount10"]) : 0,
                    Damount11 = reader["damount11"] != DBNull.Value ? Convert.ToDecimal(reader["damount11"]) : 0,
                    Camount11 = reader["camount11"] != DBNull.Value ? Convert.ToDecimal(reader["camount11"]) : 0,
                    Damount12 = reader["damount12"] != DBNull.Value ? Convert.ToDecimal(reader["damount12"]) : 0,
                    Camount12 = reader["camount12"] != DBNull.Value ? Convert.ToDecimal(reader["camount12"]) : 0,
                    Bpage1 = reader["bpage1"] != DBNull.Value ? Convert.ToInt32(reader["bpage1"]) : null,
                    Bpage2 = reader["bpage2"] != DBNull.Value ? Convert.ToInt32(reader["bpage2"]) : null,
                    Taxcode = reader["taxcode"]?.ToString()?.Trim(),
                    Serial = reader["serial"] != DBNull.Value ? Convert.ToInt32(reader["serial"]) : null,
                    Engaccname = reader["engaccname"]?.ToString()?.Trim(),
                    Clsaccno = reader["clsaccno"]?.ToString()?.Trim(),
                    Clsaccname = reader["clsaccname"]?.ToString()?.Trim(),
                    Accnamel = reader["accnamel"]?.ToString()?.Trim(),
                    RecordNumber = reader["_record_number"] != DBNull.Value ? Convert.ToInt32(reader["_record_number"]) : null
                };
                list.Add(item);
            }

            return list;
        }

        private async Task<int> InsertAccountToPg(string tableName, Dictionary<string, object?> fields, int dbfRecno = 0)
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            int targetRecno = dbfRecno;
            if (targetRecno <= 0)
            {
                using var maxCmd = conn.CreateCommand();
                maxCmd.CommandText = $@"SELECT COALESCE(MAX(""_record_number""), 0) + 1 FROM ""{PgSchema}"".""{tableName}"";";
                var maxObj = await maxCmd.ExecuteScalarAsync();
                targetRecno = maxObj != null && maxObj != DBNull.Value ? Convert.ToInt32(maxObj) : 1;
            }

            var pgFields = new Dictionary<string, object?>(fields)
            {
                ["_record_number"] = targetRecno
            };

            using var cmd = conn.CreateCommand();
            var cols = string.Join(", ", pgFields.Keys.Select(k => $"\"{k}\""));
            var vals = string.Join(", ", pgFields.Keys.Select(k => $"@{k}"));

            // 先清除可能因重用刪除槽位或空白尾碼造成的唯一索引衝突 (_record_number 或 accno)
            cmd.CommandText = $@"DELETE FROM ""{PgSchema}"".""{tableName}"" 
                                 WHERE TRIM(""accno"") = TRIM(@accno) OR ""_record_number"" = @_record_number;
                                 INSERT INTO ""{PgSchema}"".""{tableName}"" ({cols}) VALUES ({vals});";

            foreach (var kvp in pgFields)
            {
                var p = cmd.CreateParameter();
                p.ParameterName = $"@{kvp.Key}";
                p.Value = kvp.Value ?? DBNull.Value;
                cmd.Parameters.Add(p);
            }

            await cmd.ExecuteNonQueryAsync();
            return targetRecno;
        }

        private async Task UpdateAccountInPg(string tableName, string accno, Dictionary<string, object?> fields)
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            var setClauses = string.Join(", ", fields.Keys.Select(k => $"\"{k}\" = @{k}"));

            cmd.CommandText = $@"UPDATE ""{PgSchema}"".""{tableName}"" SET {setClauses} WHERE TRIM(""accno"") = @accno;";

            var pKey = cmd.CreateParameter();
            pKey.ParameterName = "@accno";
            pKey.Value = accno.Trim().ToUpper();
            cmd.Parameters.Add(pKey);

            foreach (var kvp in fields)
            {
                var p = cmd.CreateParameter();
                p.ParameterName = $"@{kvp.Key}";
                p.Value = kvp.Value ?? DBNull.Value;
                cmd.Parameters.Add(p);
            }

            await cmd.ExecuteNonQueryAsync();
        }

        /// <summary>
        /// DBF 刪除成功後從 PostgreSQL 刪除該列 (不重編 serial，與 DBF 一致)。
        /// 失敗時回傳 false，呼叫端不更新 Checksum，下次讀取會從 DBF 重灌快照。
        /// </summary>
        private async Task<bool> TryDeleteAccountFromPgAsync(string tableName, string accno)
        {
            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = $@"DELETE FROM ""{PgSchema}"".""{tableName}"" WHERE TRIM(""accno"") = @accno;";

                var pKey = cmd.CreateParameter();
                pKey.ParameterName = "@accno";
                pKey.Value = accno.Trim().ToUpper();
                cmd.Parameters.Add(pKey);

                await cmd.ExecuteNonQueryAsync();
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase4010 刪除後 PostgreSQL 同步失敗，下次讀取將重灌快照: {ex.Message}");
                return false;
            }
        }

        private static List<AccountMaster> ParseDbfAccounts(string fullDbfPath)
        {
            var list = new List<AccountMaster>();
            if (!System.IO.File.Exists(fullDbfPath)) return list;

            try
            {
                using var fs = System.IO.File.OpenRead(fullDbfPath);
                using var br = new BinaryReader(fs);

                fs.Position = 4;
                var numRecs = br.ReadInt32();
                var headerLen = br.ReadInt16();
                var recLen = br.ReadInt16();

                System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
                var enc = Encoding.GetEncoding(950);

                for (int i = 0; i < numRecs; i++)
                {
                    fs.Position = headerLen + ((long)i * recLen);
                    var del = br.ReadByte();
                    if (del == 0x2A) continue; // deleted

                    var bytes = br.ReadBytes(recLen - 1);
                    var str = enc.GetString(bytes);

                    var accno = str.Length >= 8 ? str.Substring(0, 8).Trim() : "";
                    var accname = str.Length >= 28 ? str.Substring(8, 20).Trim() : "";
                    var dept = str.Length >= 30 ? str.Substring(29, 1).Trim() : "";

                    if (!string.IsNullOrEmpty(accno))
                    {
                        list.Add(new AccountMaster
                        {
                            Accno = accno,
                            Accname = accname,
                            Dept = dept,
                            Serial = i + 1
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ParseDbfAccounts error: {ex.Message}");
            }

            return list;
        }

        #endregion
    }
}
