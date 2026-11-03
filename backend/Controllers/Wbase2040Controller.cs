using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading;
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
    /// 2-4 客戶收費資料輸入 (VFP FORMS\recmom.scx「客戶收費金額登錄」與 recmoney.scx「客戶收費明細登錄」)
    /// recmom.dbf 表頭以單號 rno 定位；recmod.dbf 明細沒有唯一鍵，以 RECNO() 搭配 rno 定位
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class Wbase2040Controller : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbfSyncService _dbfSyncService;
        private readonly ISystemConfigService _configService;

        private string DbfPath => _configService.CurrentDbfPath;
        private string PgSchema => _configService.CurrentPgSchema;

        private const string MomTable = "recmom";
        private const string ModTable = "recmod";
        private const string SharedMemoTable = "recsmemo";
        // VFP PACK 會讓 RECNO 重排，加上 rno 一起比對，RECNO 過期時回 RECORD_NOT_FOUND 而不是改錯列
        private const string LineKeyField = "RECNO(),rno";
        private const string Paid = "*";

        // DBF 欄寬 (Big5 位元組)
        private const int RnoBytes = 10, CnoBytes = 8, AbbrBytes = 10, RecmanBytes = 10, NoteBytes = 60, ItemnoBytes = 4, ItemBytes = 40;

        private static readonly Dictionary<string, string> SyncKeys = new()
        {
            [MomTable] = "",
            [ModTable] = "",
            [SharedMemoTable] = "",
            ["customer"] = "no",
            ["recitem"] = "itemno",
            ["recmemo"] = "mno",
            ["base"] = ""
        };

        // F7 排序，對齊 VFP recmom 索引 tag 1..7 (rno1, rno, cno, recdate1, recdate, cnodate, datecno)
        private static readonly string[] SortOrders =
        {
            @"TRIM(""rno"") COLLATE ""C"" DESC",
            @"TRIM(""rno"") COLLATE ""C""",
            @"TRIM(""cno"") COLLATE ""C""",
            @"""recdate"" DESC",
            @"""recdate""",
            @"TRIM(""cno"") COLLATE ""C"", ""recdate""",
            @"""recdate"", TRIM(""cno"") COLLATE ""C"""
        };

        // 新增單號取「本年度最大號 + 1」，同一個後端內序列化，避免兩個請求拿到同一個號碼
        private static readonly SemaphoreSlim NumberingLock = new(1, 1);

        private static readonly Encoding Big5Strict = CreateBig5();

        private static Encoding CreateBig5()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(950, EncoderFallback.ExceptionFallback, DecoderFallback.ReplacementFallback);
        }

        public Wbase2040Controller(AppDbContext context, IDbfSyncService dbfSyncService, ISystemConfigService configService)
        {
            _context = context;
            _dbfSyncService = dbfSyncService;
            _configService = configService;
        }

        // =========================================================================
        // 表頭 (recmom)
        // =========================================================================

        // GET: api/wbase2040?sort=1..7
        [HttpGet]
        public async Task<IActionResult> GetList([FromQuery] int sort = 1)
        {
            try
            {
                await SyncAsync(MomTable);
                var order = SortOrders[Math.Clamp(sort, 1, SortOrders.Length) - 1];
                var list = await QueryReceiptsAsync($@"ORDER BY {order}, ""_record_number""", includeMemo: false);
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取收費資料失敗: " + ex.Message });
            }
        }

        // GET: api/wbase2040/{rno}
        [HttpGet("{rno}")]
        public async Task<IActionResult> GetDetail(string rno)
        {
            try
            {
                await SyncAsync(MomTable, ModTable);
                var receipt = await FindReceiptAsync(rno, includeMemo: true);
                if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });
                return Ok(new FeeReceiptDetailDto { Receipt = receipt, Lines = await QueryLinesAsync(receipt.Rno) });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "讀取收費單失敗: " + ex.Message });
            }
        }

        // POST: api/wbase2040 (Ins 新增：VFP recmom.insert.Click)
        [HttpPost]
        public async Task<IActionResult> Create()
        {
            await NumberingLock.WaitAsync();
            try
            {
                await SyncAsync(MomTable, "recmemo");
                var today = DateTime.Today;
                var rno = (await NextReceiptNumbersAsync(today, 1))[0];
                var memo = await FirstSummaryMemoAsync();

                var fields = new Dictionary<string, object?>
                {
                    ["rno"] = rno,
                    ["recdate"] = DbfDate(today),
                    ["amt"] = 0m,
                    ["tax"] = 0m,
                    ["sum"] = 0m,
                    ["memo"] = memo
                };
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, MomTable, "INSERT", "rno", rno, fields);
                if (!res.Success) return DbfError(res, "新增收費單");

                var receipt = new FeeReceiptDto { Rno = rno, Recdate = FormatDate(today), Memo = memo, RecordNumber = res.Recno };
                await PgWriteAsync(MomTable, () => InsertReceiptPgAsync(receipt));
                return Ok(new FeeReceiptDetailDto { Receipt = receipt });
            }
            finally
            {
                NumberingLock.Release();
            }
        }

        // PUT: api/wbase2040/{rno} (表頭欄位離開時寫回：VFP Text1.LostFocus)
        [HttpPut("{rno}")]
        public async Task<IActionResult> Update(string rno, [FromBody] FeeReceiptUpdateRequest req)
        {
            if (req == null) return BadRequest(new { message = "缺少修改內容" });
            await SyncAsync(MomTable, ModTable, "customer");
            var receipt = await FindReceiptAsync(rno, includeMemo: true);
            if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });

            var fields = new Dictionary<string, object?>();
            string? warning = null;
            DateTime? newDate = null;

            if (req.Recdate != null)
            {
                if (!TryParseIsoDate(req.Recdate, out var d)) return BadRequest(new { message = "請款日格式錯誤" });
                if (FormatDate(d) != receipt.Recdate) newDate = d;
            }
            var cno = req.Cno?.Trim().ToUpperInvariant();
            var recman = req.Recman?.Trim();
            var note = req.Note?.Trim();

            var invalid = CheckText(cno, CnoBytes, "客戶代號") ?? CheckText(recman, RecmanBytes, "收款人") ?? CheckText(note, NoteBytes, "註記") ?? CheckText(req.Memo, null, "收據摘要");
            if (invalid != null) return BadRequest(new { message = invalid });

            var changesHeaderFields = newDate.HasValue || (cno != null && cno != receipt.Cno) || (recman != null && recman != receipt.Recman) || (note != null && note != receipt.Note);
            if (changesHeaderFields && receipt.Isover == Paid)
            {
                return Conflict(new { message = "此收費單已全部收款，不可修改。如需修改，請先在明細取消已收註記。" });
            }

            if (newDate.HasValue) fields["recdate"] = DbfDate(newDate.Value);
            if (cno != null && cno != receipt.Cno)
            {
                fields["cno"] = cno;
                var abbr = await CustomerAbbrAsync(cno);
                if (abbr != null) fields["abbr"] = TruncateBig5(abbr, AbbrBytes);
                else warning = $"查無客戶代號「{cno}」，客戶簡稱未更新。";
            }
            if (recman != null && recman != receipt.Recman) fields["recman"] = recman;
            if (note != null && note != receipt.Note) fields["note"] = note;
            if (req.Memo != null && req.Memo != (receipt.Memo ?? string.Empty)) fields["memo"] = req.Memo;

            if (fields.Count > 0)
            {
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, MomTable, "UPDATE", "rno", receipt.Rno, fields);
                if (!res.Success) return DbfError(res, "修改收費單");
                await PgWriteAsync(MomTable, () => UpdatePgAsync(MomTable, fields, @"TRIM(""rno"") = @key", receipt.Rno));

                // 請款日連動明細：VFP 執行 UPDATE recmod SET recdate=recmom.recdate WHERE rno=recmom.rno
                if (newDate.HasValue)
                {
                    var cascadeError = await CascadeLinesAsync(receipt.Rno, new Dictionary<string, object?> { ["recdate"] = DbfDate(newDate.Value) }, "請款日連動明細");
                    if (cascadeError != null) return cascadeError;
                }
            }

            var updated = await FindReceiptAsync(receipt.Rno, includeMemo: true);
            return Ok(new FeeReceiptDetailDto { Receipt = updated!, Lines = await QueryLinesAsync(receipt.Rno), Warning = warning });
        }

        // PUT: api/wbase2040/{rno}/rename (單號修改連動明細：VFP 1100927 #1575)
        [HttpPut("{rno}/rename")]
        public async Task<IActionResult> Rename(string rno, [FromBody] FeeReceiptRenameRequest req)
        {
            var newRno = (req?.NewRno ?? string.Empty).Trim();
            if (newRno.Length == 0) return BadRequest(new { message = "單號不可空白" });
            var invalid = CheckText(newRno, RnoBytes, "單號");
            if (invalid != null) return BadRequest(new { message = invalid });

            await NumberingLock.WaitAsync();
            try
            {
                await SyncAsync(MomTable, ModTable);
                var receipt = await FindReceiptAsync(rno, includeMemo: false);
                if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });
                if (newRno == receipt.Rno) return Ok(new FeeReceiptDetailDto { Receipt = receipt, Lines = await QueryLinesAsync(receipt.Rno) });
                if (receipt.Isover == Paid) return Conflict(new { message = "此收費單已全部收款，不可修改單號。" });
                if (await FindReceiptAsync(newRno, includeMemo: false) != null) return Conflict(new { message = "單號重覆，請檢查!" });

                // 先改明細再改表頭，順序同 VFP
                var cascadeError = await CascadeLinesAsync(receipt.Rno, new Dictionary<string, object?> { ["rno"] = newRno }, "單號連動明細");
                if (cascadeError != null) return cascadeError;

                var fields = new Dictionary<string, object?> { ["rno"] = newRno };
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, MomTable, "UPDATE", "rno", receipt.Rno, fields);
                if (!res.Success) return DbfError(res, "修改單號 (明細已改為新單號，請重新整理後再試)");
                await PgWriteAsync(MomTable, () => UpdatePgAsync(MomTable, fields, @"TRIM(""rno"") = @key", receipt.Rno));

                var updated = await FindReceiptAsync(newRno, includeMemo: true);
                return Ok(new FeeReceiptDetailDto { Receipt = updated!, Lines = await QueryLinesAsync(newRno) });
            }
            finally
            {
                NumberingLock.Release();
            }
        }

        // DELETE: api/wbase2040/{rno} (Del 刪除整張單：先刪明細再刪表頭，同 VFP 不檢查已收)
        [HttpDelete("{rno}")]
        public async Task<IActionResult> Delete(string rno)
        {
            await SyncAsync(MomTable, ModTable);
            var receipt = await FindReceiptAsync(rno, includeMemo: false);
            if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });

            foreach (var line in await QueryLinesAsync(receipt.Rno))
            {
                var lineRes = await _dbfSyncService.WriteRecordAsync(DbfPath, ModTable, "DELETE", LineKeyField, LineKeyValue(line), new Dictionary<string, object?>());
                if (!lineRes.Success) return DbfError(lineRes, "刪除收費明細");
                await PgWriteAsync(ModTable, () => DeletePgAsync(ModTable, @"""_record_number"" = @key", line.RecordNumber));
            }

            var res = await _dbfSyncService.WriteRecordAsync(DbfPath, MomTable, "DELETE", "rno", receipt.Rno, new Dictionary<string, object?>());
            if (!res.Success) return DbfError(res, "刪除收費單");
            await PgWriteAsync(MomTable, () => DeletePgAsync(MomTable, @"TRIM(""rno"") = @key", receipt.Rno));
            return Ok(new { success = true, rno = receipt.Rno });
        }

        // =========================================================================
        // 明細 (recmod)
        // =========================================================================

        // POST: api/wbase2040/{rno}/lines (明細 Ins：VFP recmoney.insert.Click)
        [HttpPost("{rno}/lines")]
        public async Task<IActionResult> CreateLine(string rno)
        {
            await SyncAsync(MomTable, ModTable);
            var receipt = await FindReceiptAsync(rno, includeMemo: false);
            if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });

            // VFP 填 recman = meuser (登入者代號)；Wx3000 尚無登入身分，先留空白
            var fields = new Dictionary<string, object?>
            {
                ["rno"] = receipt.Rno,
                ["recdate"] = DbfDate(ParseStoredDate(receipt.Recdate)),
                ["money"] = 0m,
                ["recman"] = string.Empty
            };
            var res = await _dbfSyncService.WriteRecordAsync(DbfPath, ModTable, "INSERT", "rno", receipt.Rno, fields);
            if (!res.Success) return DbfError(res, "新增收費明細");

            var line = new FeeReceiptLineDto { RecordNumber = res.Recno, Rno = receipt.Rno, Recdate = receipt.Recdate };
            await PgWriteAsync(ModTable, () => InsertLinePgAsync(line));
            return await RecalcAndRespondAsync(receipt.Rno, null, line.RecordNumber);
        }

        // PUT: api/wbase2040/{rno}/lines/{recno} (明細欄位寫回：VFP recmoney Text1.Valid)
        [HttpPut("{rno}/lines/{recno:int}")]
        public async Task<IActionResult> UpdateLine(string rno, int recno, [FromBody] FeeReceiptLineUpdateRequest req)
        {
            if (req == null) return BadRequest(new { message = "缺少修改內容" });
            await SyncAsync(MomTable, ModTable, "recitem");
            var receipt = await FindReceiptAsync(rno, includeMemo: false);
            if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });
            if (receipt.Isover == Paid) return Conflict(new { message = "此收費單已全部收款，明細不可修改。如需修改，請先以 Space 取消已收註記。" });
            var line = await FindLineAsync(receipt.Rno, recno);
            if (line == null) return LineGone();

            var itemno = req.Itemno?.Trim();
            var item = req.Item?.Trim();
            var note = req.Note?.Trim();
            var invalid = CheckText(itemno, ItemnoBytes, "收費項目") ?? CheckText(item, ItemBytes, "項目名稱") ?? CheckText(note, NoteBytes, "備註");
            if (invalid != null) return BadRequest(new { message = invalid });
            if (req.Money.HasValue && (req.Money.Value < 0 || req.Money.Value > 999_999_999m)) return BadRequest(new { message = "收費金額超出範圍" });

            var fields = new Dictionary<string, object?>();
            string? warning = null;
            if (itemno != null && itemno != line.Itemno)
            {
                fields["itemno"] = itemno;
                // 收費項目代號異動時帶出名稱與金額 (會覆蓋已輸入的金額，同 VFP)
                var feeItem = await FeeItemAsync(itemno);
                if (feeItem != null)
                {
                    fields["item"] = TruncateBig5(feeItem.Value.Item, ItemBytes);
                    fields["money"] = feeItem.Value.Amt;
                }
                else
                {
                    warning = $"查無收費項目「{itemno}」，項目名稱與金額未帶入。";
                }
            }
            if (item != null && item != line.Item && !fields.ContainsKey("item")) fields["item"] = item;
            if (req.Money.HasValue && req.Money.Value != line.Money && !fields.ContainsKey("money")) fields["money"] = req.Money.Value;
            if (note != null && note != line.Note) fields["note"] = note;

            if (fields.Count > 0)
            {
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, ModTable, "UPDATE", LineKeyField, LineKeyValue(line), fields);
                if (!res.Success) return DbfError(res, "修改收費明細");
                await PgWriteAsync(ModTable, () => UpdatePgAsync(ModTable, fields, @"""_record_number"" = @key", line.RecordNumber));
            }
            return await RecalcAndRespondAsync(receipt.Rno, warning, line.RecordNumber);
        }

        // POST: api/wbase2040/{rno}/lines/{recno}/toggle-paid (明細 Space 收費：不受已收鎖定限制，同 VFP)
        [HttpPost("{rno}/lines/{recno:int}/toggle-paid")]
        public async Task<IActionResult> TogglePaid(string rno, int recno)
        {
            await SyncAsync(MomTable, ModTable);
            var line = await FindLineAsync(rno.Trim(), recno);
            if (line == null) return LineGone();

            var fields = new Dictionary<string, object?> { ["isover"] = line.Isover == Paid ? string.Empty : Paid };
            var res = await _dbfSyncService.WriteRecordAsync(DbfPath, ModTable, "UPDATE", LineKeyField, LineKeyValue(line), fields);
            if (!res.Success) return DbfError(res, "切換已收註記");
            await PgWriteAsync(ModTable, () => UpdatePgAsync(ModTable, fields, @"""_record_number"" = @key", line.RecordNumber));
            return await RecalcAndRespondAsync(line.Rno, null, line.RecordNumber);
        }

        // DELETE: api/wbase2040/{rno}/lines/{recno} (明細 Del：表頭已註明收費時不可刪)
        [HttpDelete("{rno}/lines/{recno:int}")]
        public async Task<IActionResult> DeleteLine(string rno, int recno)
        {
            await SyncAsync(MomTable, ModTable);
            var receipt = await FindReceiptAsync(rno, includeMemo: false);
            if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });
            if (!string.IsNullOrEmpty(receipt.Isover)) return Conflict(new { message = "已註明收費,無法刪除,如欲刪除請將<收費>清空!" });
            var line = await FindLineAsync(receipt.Rno, recno);
            if (line == null) return LineGone();

            var res = await _dbfSyncService.WriteRecordAsync(DbfPath, ModTable, "DELETE", LineKeyField, LineKeyValue(line), new Dictionary<string, object?>());
            if (!res.Success) return DbfError(res, "刪除收費明細");
            await PgWriteAsync(ModTable, () => DeletePgAsync(ModTable, @"""_record_number"" = @key", line.RecordNumber));
            return await RecalcAndRespondAsync(receipt.Rno, null, null);
        }

        // POST: api/wbase2040/{rno}/recalc (明細視窗關閉時重算：VFP recmoney Destroy)
        [HttpPost("{rno}/recalc")]
        public async Task<IActionResult> Recalc(string rno)
        {
            await SyncAsync(MomTable, ModTable);
            return await RecalcAndRespondAsync(rno.Trim(), null, null);
        }

        // =========================================================================
        // F8 共用說明 (recsmemo，只有一筆)
        // =========================================================================

        // GET: api/wbase2040/shared-memo
        [HttpGet("shared-memo")]
        public async Task<IActionResult> GetSharedMemo()
        {
            await SyncAsync(SharedMemoTable);
            var (memo, _) = await SharedMemoAsync();
            return Ok(new FeeSharedMemoDto { Memo = memo });
        }

        // PUT: api/wbase2040/shared-memo
        [HttpPut("shared-memo")]
        public async Task<IActionResult> UpdateSharedMemo([FromBody] FeeSharedMemoDto req)
        {
            var memo = req?.Memo ?? string.Empty;
            var invalid = CheckText(memo, null, "共用說明");
            if (invalid != null) return BadRequest(new { message = invalid });

            await SyncAsync(SharedMemoTable);
            var (_, recno) = await SharedMemoAsync();
            var fields = new Dictionary<string, object?> { ["memo"] = memo };
            if (recno > 0)
            {
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, SharedMemoTable, "UPDATE", "RECNO()", recno.ToString(CultureInfo.InvariantCulture), fields);
                if (!res.Success) return DbfError(res, "儲存共用說明");
                await PgWriteAsync(SharedMemoTable, () => UpdatePgAsync(SharedMemoTable, fields, @"""_record_number"" = @key", recno));
            }
            else
            {
                // VFP：go top 若 eof() 則 append blank
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, SharedMemoTable, "INSERT", "RECNO()", "0", fields);
                if (!res.Success) return DbfError(res, "儲存共用說明");
                await PgWriteAsync(SharedMemoTable, () => ExecPgAsync(
                    $@"INSERT INTO ""{PgSchema}"".""{SharedMemoTable}"" (""memo"", ""_record_number"") VALUES (@memo, @recno);",
                    ("@memo", memo, null), ("@recno", res.Recno, null)));
            }
            return Ok(new FeeSharedMemoDto { Memo = memo });
        }

        // =========================================================================
        // F5 批次產生帳款收據 (VFP rec_all.scx)
        // =========================================================================

        // POST: api/wbase2040/batch
        [HttpPost("batch")]
        public async Task<IActionResult> Batch([FromBody] FeeReceiptBatchRequest req)
        {
            if (req == null) return BadRequest(new { message = "缺少批次條件" });
            var month = (req.Month ?? string.Empty).Trim();
            if (month.Length == 0) return BadRequest(new { message = "請輸入月份資料!" });
            if (!TryParseIsoDate(req.Recdate, out var recdate)) return BadRequest(new { message = "帳款日期格式錯誤" });
            var cycle = (req.Cycle ?? string.Empty).Trim();
            var invalid = CheckText(month, 10, "帳款月份") ?? CheckText(cycle, 1, "帳款週期");
            if (invalid != null) return BadRequest(new { message = invalid });

            await NumberingLock.WaitAsync();
            try
            {
                await SyncAsync(MomTable, ModTable, "customer", "recitem", "recmemo");

                var firstItem = await FirstFeeItemAsync();
                if (firstItem == null) return BadRequest(new { message = "尚未設定收費項目 (1-6)，無法產生收據" });
                var itemText = month + " " + firstItem.Value.Item;
                var memo = await FirstSummaryMemoAsync();
                var customers = await BatchCustomersAsync(cycle, req.CnoFrom?.Trim() ?? string.Empty, req.CnoTo?.Trim() ?? string.Empty);
                if (customers.Count == 0) return BadRequest(new { message = "沒有符合條件且有設定記帳費金額的客戶" });

                if (!req.Force)
                {
                    var dup = await CustomersWithReceiptOnAsync(customers.Select(c => c.No).ToList(), recdate);
                    if (dup.Count > 0)
                    {
                        return Conflict(new
                        {
                            needConfirm = true,
                            duplicates = dup,
                            message = $"有 {dup.Count} 位客戶在 {FormatDate(recdate)} 已有收費單 (例如 {string.Join("、", dup.Take(5))})，確定仍要產生？"
                        });
                    }
                }

                var numbers = await NextReceiptNumbersAsync(recdate, customers.Count);
                var created = 0;
                for (var i = 0; i < customers.Count; i++)
                {
                    var c = customers[i];
                    var rno = numbers[i];
                    var momFields = new Dictionary<string, object?>
                    {
                        ["rno"] = rno,
                        ["recdate"] = DbfDate(recdate),
                        ["amt"] = 0m,
                        ["notamt"] = c.Recamt,
                        ["cno"] = c.No,
                        ["abbr"] = TruncateBig5(c.Abbr, AbbrBytes),
                        ["memo"] = memo,
                        ["note"] = TruncateBig5(itemText, NoteBytes)
                    };
                    var res = await _dbfSyncService.WriteRecordAsync(DbfPath, MomTable, "INSERT", "rno", rno, momFields);
                    if (!res.Success) return BatchFailure(res, created, numbers);
                    var receipt = new FeeReceiptDto
                    {
                        Rno = rno, Recdate = FormatDate(recdate), Notamt = c.Recamt, Cno = c.No,
                        Abbr = (string)momFields["abbr"]!, Memo = memo, Note = (string)momFields["note"]!, RecordNumber = res.Recno
                    };
                    await PgWriteAsync(MomTable, () => InsertReceiptPgAsync(receipt));

                    var modFields = new Dictionary<string, object?>
                    {
                        ["rno"] = rno,
                        ["recdate"] = DbfDate(recdate),
                        ["itemno"] = firstItem.Value.Itemno,
                        ["item"] = TruncateBig5(itemText, ItemBytes),
                        ["cno"] = c.No,
                        ["money"] = c.Recamt
                    };
                    var lineRes = await _dbfSyncService.WriteRecordAsync(DbfPath, ModTable, "INSERT", "rno", rno, modFields);
                    if (!lineRes.Success) return BatchFailure(lineRes, created, numbers);
                    var line = new FeeReceiptLineDto
                    {
                        RecordNumber = lineRes.Recno, Rno = rno, Cno = c.No, Recdate = FormatDate(recdate),
                        Itemno = firstItem.Value.Itemno, Item = (string)modFields["item"]!, Money = c.Recamt
                    };
                    await PgWriteAsync(ModTable, () => InsertLinePgAsync(line));
                    created++;
                }

                return Ok(new FeeReceiptBatchResult { Created = created, FirstRno = numbers[0], LastRno = numbers[^1], Message = "批次作業完成!" });
            }
            finally
            {
                NumberingLock.Release();
            }
        }

        // =========================================================================
        // 查詢與列印
        // =========================================================================

        // GET: api/wbase2040/lookup/customers?keyword=xxx (F2 客戶開窗)
        [HttpGet("lookup/customers")]
        public async Task<IActionResult> LookupCustomers([FromQuery] string? keyword = null)
        {
            await SyncAsync("customer");
            using var cmd = await CommandAsync();
            var where = "";
            if (!string.IsNullOrWhiteSpace(keyword))
            {
                where = @"WHERE (LOWER(""no"") LIKE @kw OR LOWER(""abbr"") LIKE @kw OR LOWER(""name"") LIKE @kw)";
                AddParam(cmd, "@kw", "%" + keyword.Trim().ToLowerInvariant() + "%");
            }
            cmd.CommandText = $@"SELECT ""no"", ""abbr"", ""name"", ""recamt"", ""rectime"" FROM ""{PgSchema}"".""customer"" {where} ORDER BY TRIM(""no"") COLLATE ""C"";";
            var list = new List<FeeCustomerLookupDto>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new FeeCustomerLookupDto
                {
                    No = Str(reader, "no"), Abbr = Str(reader, "abbr"), Name = Str(reader, "name"),
                    Recamt = Dec(reader, "recamt"), Rectime = Str(reader, "rectime")
                });
            }
            return Ok(list);
        }

        // GET: api/wbase2040/office (報表頁首的事務所資料：VFP 由 base.dbf 讀入 compname/compunino/compaddr)
        [HttpGet("office")]
        public async Task<IActionResult> GetOffice()
        {
            await SyncAsync("base");
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT TRIM(""no"") AS ""no"", ""data"" FROM ""{PgSchema}"".""base"" ORDER BY ""_record_number"";";
            var values = new Dictionary<string, string>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var no = Str(reader, "no");
                if (!values.ContainsKey(no)) values[no] = Str(reader, "data");
            }
            string Get(string no) => values.TryGetValue(no, out var v) ? v : string.Empty;
            return Ok(new FeeOfficeInfoDto
            {
                Name = Get("000A"),
                TaxNo = Get("000B"),
                Addr = Get("0001"),
                Tel = Get("0002"),
                Fax = Get("0003"),
                Boss = Get("0004")
            });
        }

        // GET: api/wbase2040/print/receipts (F4 收據列印：VFP recpr1.scx)
        [HttpGet("print/receipts")]
        public async Task<IActionResult> PrintReceipts(
            [FromQuery] string? dateFrom, [FromQuery] string? dateTo,
            [FromQuery] string? cnoFrom, [FromQuery] string? cnoTo,
            [FromQuery] string? rnoFrom, [FromQuery] string? rnoTo,
            [FromQuery] bool unpaidOnly = false)
        {
            if (!TryParseIsoDate(dateFrom, out var d1) || !TryParseIsoDate(dateTo, out var d2)) return BadRequest(new { message = "日期格式錯誤" });
            await SyncAsync(MomTable, ModTable, SharedMemoTable, "customer");
            var (doc, _) = await SharedMemoAsync();

            using var cmd = await CommandAsync();
            var where = new List<string> { @"m.""recdate"" BETWEEN @d1 AND @d2" };
            AddParam(cmd, "@d1", d1, DbType.Date);
            AddParam(cmd, "@d2", d2, DbType.Date);
            AddRange(cmd, where, @"m.""cno""", cnoFrom, cnoTo, "c");
            AddRange(cmd, where, @"m.""rno""", rnoFrom, rnoTo, "r");
            if (unpaidOnly) where.Add(@"TRIM(m.""isover"") = '' AND TRIM(d.""isover"") = ''");
            cmd.CommandText = $@"
                SELECT {CustomerColumns}, m.""rno"", m.""recdate"", m.""recman"", m.""amt"", m.""memo"", m.""note"" AS ""mmnote"",
                       d.""itemno"", d.""item"", d.""money"", d.""note""
                FROM ""{PgSchema}"".""recmom"" m
                JOIN ""{PgSchema}"".""recmod"" d ON TRIM(d.""rno"") = TRIM(m.""rno"")
                LEFT JOIN ""{PgSchema}"".""customer"" c ON TRIM(c.""no"") = TRIM(m.""cno"")
                WHERE {string.Join(" AND ", where)}
                ORDER BY TRIM(m.""rno"") COLLATE ""C"", d.""_record_number"";";
            return Ok(await ReadPrintRowsAsync(cmd, doc));
        }

        // GET: api/wbase2040/print/bill?year=114&month=3 (F6 請款單：VFP recpr2.scx)
        [HttpGet("print/bill")]
        public async Task<IActionResult> PrintBill([FromQuery] int year, [FromQuery] int month, [FromQuery] string? cnoFrom, [FromQuery] string? cnoTo)
        {
            if (year < 1 || month < 1 || month > 12) return BadRequest(new { message = "帳款年月錯誤" });
            var periodStart = new DateTime(year + 1911, month, 1);
            var periodEnd = periodStart.AddMonths(1).AddDays(-1);
            await SyncAsync(MomTable, ModTable, SharedMemoTable, "customer");
            var (doc, _) = await SharedMemoAsync();

            // 帳款月份(含)以前、尚未收清的表頭
            using var cmd = await CommandAsync();
            var where = new List<string> { @"TRIM(m.""isover"") = ''", @"m.""recdate"" <= @pend" };
            AddParam(cmd, "@pend", periodEnd, DbType.Date);
            AddRange(cmd, where, @"m.""cno""", cnoFrom, cnoTo, "c");
            cmd.CommandText = $@"
                SELECT {CustomerColumns}, m.""rno"", m.""recdate"", m.""recman"", m.""amt"", m.""notamt"", m.""memo"", m.""note"" AS ""mmnote""
                FROM ""{PgSchema}"".""recmom"" m
                LEFT JOIN ""{PgSchema}"".""customer"" c ON TRIM(c.""no"") = TRIM(m.""cno"")
                WHERE {string.Join(" AND ", where)};";
            var headers = new List<(FeeReceiptPrintRow Row, DateTime Date, decimal Notamt)>();
            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var row = ReadPrintRow(reader, doc, includeLine: false);
                    headers.Add((row, ParseStoredDate(row.Recdate), Dec(reader, "notamt")));
                }
            }

            var result = new List<FeeReceiptPrintRow>();
            foreach (var (row, date, notamt) in headers)
            {
                if (date < periodStart)
                {
                    // 前期：每張單一列「yyy年mm月 應收款:」，金額為表頭未收
                    row.Rno = $"{date.Year - 1911:D3}年{date.Month:D2}月";
                    row.Item = "應收款:";
                    row.Money = notamt;
                    row.Amt = notamt;
                    row.Mm = string.Empty;
                    row.Mmnote = string.Empty;
                    result.Add(row);
                    continue;
                }
                foreach (var line in await QueryLinesAsync(row.Rno))
                {
                    if (!string.IsNullOrEmpty(line.Isover)) continue;
                    result.Add(new FeeReceiptPrintRow
                    {
                        No = row.No, Name = row.Name, Abbr = row.Abbr, Addr = row.Addr, Unino = row.Unino, Tel = row.Tel, Fax = row.Fax,
                        Linkman = row.Linkman, Linktel = row.Linktel, Bkaddr = row.Bkaddr, Sbkaddr = row.Sbkaddr, Haddr = row.Haddr,
                        Invaddr = row.Invaddr, Cusmemo = row.Cusmemo, Rno = row.Rno, Recdate = row.Recdate, Recman = row.Recman,
                        Amt = row.Amt, Mm = row.Mm, Mmnote = row.Mmnote, Doc = doc,
                        Itemno = line.Itemno, Item = line.Item, Money = line.Money, Note = line.Note
                    });
                }
            }
            // VFP：Index On no+Dtoc(recdate)
            return Ok(result.OrderBy(r => r.No, StringComparer.Ordinal).ThenBy(r => r.Recdate, StringComparer.Ordinal).ToList());
        }

        // GET: api/wbase2040/stats (F9 收費統計表：VFP recpr3.scx，客戶 × 收費項目)
        [HttpGet("stats")]
        public async Task<IActionResult> Stats([FromQuery] string? dateFrom, [FromQuery] string? dateTo, [FromQuery] string? cnoFrom, [FromQuery] string? cnoTo)
        {
            if (!TryParseIsoDate(dateFrom, out var d1) || !TryParseIsoDate(dateTo, out var d2)) return BadRequest(new { message = "日期格式錯誤" });
            await SyncAsync(MomTable, ModTable, "recitem");

            var result = new FeeStatResultDto();
            using (var itemCmd = await CommandAsync())
            {
                itemCmd.CommandText = $@"SELECT ""itemno"", ""item"" FROM ""{PgSchema}"".""recitem"" ORDER BY TRIM(""itemno"") COLLATE ""C"";";
                using var reader = await itemCmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) result.Items.Add(new FeeStatItemDto { Itemno = Str(reader, "itemno"), Item = Str(reader, "item") });
            }
            var known = new HashSet<string>(result.Items.Select(i => i.Itemno));

            using var cmd = await CommandAsync();
            var where = new List<string> { @"m.""recdate"" BETWEEN @d1 AND @d2" };
            AddParam(cmd, "@d1", d1, DbType.Date);
            AddParam(cmd, "@d2", d2, DbType.Date);
            AddRange(cmd, where, @"m.""cno""", cnoFrom, cnoTo, "c");
            cmd.CommandText = $@"
                SELECT m.""cno"", m.""abbr"", d.""itemno"", d.""money""
                FROM ""{PgSchema}"".""recmom"" m
                JOIN ""{PgSchema}"".""recmod"" d ON TRIM(d.""rno"") = TRIM(m.""rno"")
                WHERE {string.Join(" AND ", where)}
                ORDER BY m.""_record_number"", d.""_record_number"";";
            var rows = new Dictionary<string, FeeStatRowDto>();
            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var itemno = Str(reader, "itemno");
                    if (!known.Contains(itemno)) continue; // 不在 recitem 的項目不計 (同 VFP)
                    var cno = Str(reader, "cno");
                    if (!rows.TryGetValue(cno, out var row))
                    {
                        row = new FeeStatRowDto { Cno = cno, Abbr = Str(reader, "abbr") };
                        rows[cno] = row;
                    }
                    row.Amounts[itemno] = row.Amounts.GetValueOrDefault(itemno) + Dec(reader, "money");
                }
            }
            result.Rows = rows.Values.OrderBy(r => r.Cno, StringComparer.Ordinal).ToList();
            return Ok(result);
        }

        // =========================================================================
        // 共用邏輯
        // =========================================================================

        /// <summary>依明細重算表頭已收、未收與已收註記 (VFP recmoney Destroy，已收註記統一為 "*")</summary>
        private async Task<IActionResult> RecalcAndRespondAsync(string rno, string? warning, int? focusRecno)
        {
            var receipt = await FindReceiptAsync(rno, includeMemo: true);
            if (receipt == null) return NotFound(new { message = $"找不到單號 {rno}" });
            var lines = await QueryLinesAsync(receipt.Rno);

            var amt = lines.Where(l => !string.IsNullOrEmpty(l.Isover)).Sum(l => l.Money);
            var notamt = lines.Where(l => string.IsNullOrEmpty(l.Isover)).Sum(l => l.Money);
            var isover = lines.Count > 0 && lines.All(l => !string.IsNullOrEmpty(l.Isover)) ? Paid : string.Empty;

            if (amt != receipt.Amt || notamt != receipt.Notamt || isover != receipt.Isover)
            {
                var fields = new Dictionary<string, object?> { ["amt"] = amt, ["notamt"] = notamt, ["isover"] = isover };
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, MomTable, "UPDATE", "rno", receipt.Rno, fields);
                if (!res.Success) return DbfError(res, "重算收費單合計");
                await PgWriteAsync(MomTable, () => UpdatePgAsync(MomTable, fields, @"TRIM(""rno"") = @key", receipt.Rno));
                receipt.Amt = amt;
                receipt.Notamt = notamt;
                receipt.Isover = isover;
            }
            return Ok(new FeeReceiptDetailDto { Receipt = receipt, Lines = lines, Warning = warning, FocusRecordNumber = focusRecno });
        }

        /// <summary>對單號下所有明細套用同一組欄位 (單號、請款日連動)；中途失敗回傳錯誤並保留已完成部分</summary>
        private async Task<IActionResult?> CascadeLinesAsync(string rno, Dictionary<string, object?> fields, string action)
        {
            var lines = await QueryLinesAsync(rno);
            for (var i = 0; i < lines.Count; i++)
            {
                var res = await _dbfSyncService.WriteRecordAsync(DbfPath, ModTable, "UPDATE", LineKeyField, LineKeyValue(lines[i]), fields);
                if (!res.Success)
                {
                    var err = DbfError(res, $"{action} (第 {i + 1}/{lines.Count} 筆，前 {i} 筆已完成，請重新整理後再試)");
                    return err;
                }
                var recno = lines[i].RecordNumber;
                await PgWriteAsync(ModTable, () => UpdatePgAsync(ModTable, fields, @"""_record_number"" = @key", recno));
            }
            return null;
        }

        private async Task SyncAsync(params string[] tables)
        {
            foreach (var t in tables)
            {
                await _dbfSyncService.EnsureTableSyncedAsync(DbfPath, t, PgSchema, t, SyncKeys[t]);
            }
        }

        /// <summary>DBF 已寫入後同步 PostgreSQL 並更新 Checksum；PG 失敗時不更新 Checksum，下次讀取會自動重灌快照</summary>
        private async Task PgWriteAsync(string table, Func<Task> pgAction)
        {
            try
            {
                await pgAction();
                var chk = await _dbfSyncService.GetChecksumAsync(DbfPath, table);
                if (!string.IsNullOrEmpty(chk)) await _dbfSyncService.UpdateDictionaryChecksumAsync(DbfPath, table, chk);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Wbase2040 PostgreSQL 同步失敗 ({table})，下次讀取將重灌快照: {ex.Message}");
            }
        }

        private static (int Status, string Message) DescribeDbfError(DbfWriteResult res, string action)
        {
            if (res.ErrorType == "LOCK_TIMEOUT")
            {
                return (StatusCodes.Status409Conflict,
                    $"{action}失敗：{res.Message ?? "資料正被地端其他工作站使用中"} (VFP 進入 2-4 客戶收費資料輸入時會獨佔收費資料)");
            }
            if (res.ErrorType == "RECORD_NOT_FOUND")
            {
                return (StatusCodes.Status409Conflict, $"{action}失敗：地端資料已變動，請重新整理後再試");
            }
            return (StatusCodes.Status500InternalServerError, $"{action}失敗：{res.Message ?? res.Error}");
        }

        private ObjectResult DbfError(DbfWriteResult res, string action)
        {
            var (status, message) = DescribeDbfError(res, action);
            return StatusCode(status, new { error = res.Error, message });
        }

        private ObjectResult BatchFailure(DbfWriteResult res, int created, List<string> numbers)
        {
            var done = created > 0 ? $"已產生 {created} 張 ({numbers[0]} ~ {numbers[created - 1]})，" : "尚未產生任何收據，";
            var (status, message) = DescribeDbfError(res, "批次產生收據");
            return StatusCode(status, new { created, error = res.Error, message = done + message });
        }

        private ObjectResult LineGone() =>
            StatusCode(StatusCodes.Status409Conflict, new { message = "找不到這筆明細，地端資料可能已變動，請重新整理後再試" });

        private static string LineKeyValue(FeeReceiptLineDto line) =>
            line.RecordNumber.ToString(CultureInfo.InvariantCulture) + "," + line.Rno;

        /// <summary>單號 = "A" + 民國年 3 碼 + 流水號 6 碼，取該年度最大號加 1 (VFP recmom.insert.Click)</summary>
        private async Task<List<string>> NextReceiptNumbersAsync(DateTime date, int count)
        {
            var roc = date.Year > 1911 ? date.Year - 1911 : date.Year;
            var prefix = "A" + roc.ToString("D3", CultureInfo.InvariantCulture);
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT TRIM(""rno"") FROM ""{PgSchema}"".""recmom"" WHERE LEFT(TRIM(""rno""), 4) = @p;";
            AddParam(cmd, "@p", prefix);
            var existing = new HashSet<string>();
            long max = 0;
            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var rno = reader.GetString(0);
                    existing.Add(rno);
                    // VFP VAL(SUBSTR(rno,5))：取開頭的數字
                    var digits = new string(rno.Substring(4).TakeWhile(char.IsDigit).ToArray());
                    if (digits.Length > 0 && long.TryParse(digits, out var n) && n > max) max = n;
                }
            }
            var list = new List<string>();
            var next = max + 1;
            while (list.Count < count)
            {
                var candidate = prefix + next.ToString("D6", CultureInfo.InvariantCulture);
                if (!existing.Contains(candidate)) list.Add(candidate);
                next++;
            }
            return list;
        }

        private async Task<string> FirstSummaryMemoAsync()
        {
            // VFP：use recmemo / go top (實體第一筆)
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT ""memo"" FROM ""{PgSchema}"".""recmemo"" ORDER BY ""_record_number"" LIMIT 1;";
            var v = await cmd.ExecuteScalarAsync();
            return v == null || v == DBNull.Value ? string.Empty : v.ToString() ?? string.Empty;
        }

        private async Task<(string Memo, int Recno)> SharedMemoAsync()
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT ""memo"", ""_record_number"" FROM ""{PgSchema}"".""{SharedMemoTable}"" ORDER BY ""_record_number"" LIMIT 1;";
            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return (string.Empty, 0);
            return (reader["memo"]?.ToString() ?? string.Empty, Convert.ToInt32(reader["_record_number"], CultureInfo.InvariantCulture));
        }

        private async Task<string?> CustomerAbbrAsync(string cno)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT ""abbr"" FROM ""{PgSchema}"".""customer"" WHERE TRIM(""no"") = @no LIMIT 1;";
            AddParam(cmd, "@no", cno);
            var v = await cmd.ExecuteScalarAsync();
            return v == null || v == DBNull.Value ? null : v.ToString()?.Trim() ?? string.Empty;
        }

        private async Task<(string Itemno, string Item, decimal Amt)?> FeeItemAsync(string itemno)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT ""itemno"", ""item"", ""amt"" FROM ""{PgSchema}"".""recitem"" WHERE TRIM(""itemno"") = @no LIMIT 1;";
            AddParam(cmd, "@no", itemno);
            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return null;
            return (Str(reader, "itemno"), Str(reader, "item"), Dec(reader, "amt"));
        }

        private async Task<(string Itemno, string Item)?> FirstFeeItemAsync()
        {
            // VFP rec_all：recitem 依 itemno 索引的第一筆
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT ""itemno"", ""item"" FROM ""{PgSchema}"".""recitem"" ORDER BY TRIM(""itemno"") COLLATE ""C"" LIMIT 1;";
            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return null;
            return (Str(reader, "itemno"), Str(reader, "item"));
        }

        private async Task<List<FeeCustomerLookupDto>> BatchCustomersAsync(string cycle, string cnoFrom, string cnoTo)
        {
            using var cmd = await CommandAsync();
            var where = new List<string> { @"""recamt"" > 0", @"TRIM(""no"") <> ''" };
            if (cycle.Length > 0)
            {
                where.Add(@"TRIM(""rectime"") = @cycle");
                AddParam(cmd, "@cycle", cycle);
            }
            // VFP：只有填了「迄」才套用客戶區間
            if (cnoTo.Length > 0)
            {
                where.Add(@"TRIM(""no"") COLLATE ""C"" >= @c1 AND TRIM(""no"") COLLATE ""C"" <= @c2");
                AddParam(cmd, "@c1", cnoFrom);
                AddParam(cmd, "@c2", cnoTo);
            }
            cmd.CommandText = $@"SELECT ""no"", ""abbr"", ""name"", ""recamt"", ""rectime"" FROM ""{PgSchema}"".""customer"" WHERE {string.Join(" AND ", where)} ORDER BY TRIM(""no"") COLLATE ""C"";";
            var list = new List<FeeCustomerLookupDto>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new FeeCustomerLookupDto { No = Str(reader, "no"), Abbr = Str(reader, "abbr"), Name = Str(reader, "name"), Recamt = Dec(reader, "recamt"), Rectime = Str(reader, "rectime") });
            }
            return list;
        }

        private async Task<List<string>> CustomersWithReceiptOnAsync(List<string> cnos, DateTime date)
        {
            using var cmd = await CommandAsync();
            cmd.CommandText = $@"SELECT DISTINCT TRIM(""cno"") FROM ""{PgSchema}"".""recmom"" WHERE ""recdate"" = @d AND TRIM(""cno"") = ANY(@cnos) ORDER BY 1;";
            AddParam(cmd, "@d", date, DbType.Date);
            AddParam(cmd, "@cnos", cnos.ToArray());
            var list = new List<string>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync()) list.Add(reader.GetString(0));
            return list;
        }

        private async Task<FeeReceiptDto?> FindReceiptAsync(string rno, bool includeMemo)
        {
            var list = await QueryReceiptsAsync(@"WHERE TRIM(""rno"") = @rno LIMIT 1", includeMemo, ("@rno", (rno ?? string.Empty).Trim()));
            return list.FirstOrDefault();
        }

        private async Task<List<FeeReceiptDto>> QueryReceiptsAsync(string tailSql, bool includeMemo, params (string Name, object Value)[] args)
        {
            using var cmd = await CommandAsync();
            foreach (var (name, value) in args) AddParam(cmd, name, value);
            var memoCol = includeMemo ? @", ""memo""" : "";
            cmd.CommandText = $@"
                SELECT ""rno"", ""recdate"", ""cno"", ""abbr"", ""isover"", ""recman"", ""amt"", ""tax"", ""sum"", ""notamt"", ""note"", ""_record_number""{memoCol}
                FROM ""{PgSchema}"".""recmom"" {tailSql};";
            var list = new List<FeeReceiptDto>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new FeeReceiptDto
                {
                    Rno = Str(reader, "rno"),
                    Recdate = DateStr(reader, "recdate"),
                    Cno = Str(reader, "cno"),
                    Abbr = Str(reader, "abbr"),
                    Isover = Str(reader, "isover"),
                    Recman = Str(reader, "recman"),
                    Amt = Dec(reader, "amt"),
                    Tax = Dec(reader, "tax"),
                    Sum = Dec(reader, "sum"),
                    Notamt = Dec(reader, "notamt"),
                    Note = Str(reader, "note"),
                    Memo = includeMemo ? reader["memo"]?.ToString() ?? string.Empty : null,
                    RecordNumber = Convert.ToInt32(reader["_record_number"], CultureInfo.InvariantCulture)
                });
            }
            return list;
        }

        private async Task<List<FeeReceiptLineDto>> QueryLinesAsync(string rno, int? recno = null)
        {
            using var cmd = await CommandAsync();
            AddParam(cmd, "@rno", rno.Trim());
            var recnoSql = "";
            if (recno.HasValue)
            {
                recnoSql = @" AND ""_record_number"" = @recno";
                AddParam(cmd, "@recno", recno.Value);
            }
            cmd.CommandText = $@"
                SELECT ""_record_number"", ""rno"", ""cno"", ""recdate"", ""money"", ""isover"", ""itemno"", ""item"", ""note"", ""recman""
                FROM ""{PgSchema}"".""recmod""
                WHERE TRIM(""rno"") = @rno{recnoSql}
                ORDER BY ""_record_number"";";
            var list = new List<FeeReceiptLineDto>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new FeeReceiptLineDto
                {
                    RecordNumber = Convert.ToInt32(reader["_record_number"], CultureInfo.InvariantCulture),
                    Rno = Str(reader, "rno"),
                    Cno = Str(reader, "cno"),
                    Recdate = DateStr(reader, "recdate"),
                    Money = Dec(reader, "money"),
                    Isover = Str(reader, "isover"),
                    Itemno = Str(reader, "itemno"),
                    Item = Str(reader, "item"),
                    Note = Str(reader, "note"),
                    Recman = Str(reader, "recman")
                });
            }
            return list;
        }

        private async Task<FeeReceiptLineDto?> FindLineAsync(string rno, int recno) =>
            (await QueryLinesAsync(rno, recno)).FirstOrDefault();

        private Task InsertReceiptPgAsync(FeeReceiptDto r) => ExecPgAsync($@"
            INSERT INTO ""{PgSchema}"".""recmom""
                (""rno"", ""recdate"", ""memo"", ""cno"", ""abbr"", ""isover"", ""recman"", ""amt"", ""tax"", ""sum"", ""notamt"", ""note"", ""_record_number"")
            VALUES (@rno, @recdate, @memo, @cno, @abbr, @isover, @recman, @amt, @tax, @sum, @notamt, @note, @recno);",
            ("@rno", r.Rno, null), ("@recdate", ParseStoredDate(r.Recdate), DbType.Date), ("@memo", r.Memo ?? string.Empty, null),
            ("@cno", r.Cno, null), ("@abbr", r.Abbr, null), ("@isover", r.Isover, null), ("@recman", r.Recman, null),
            ("@amt", r.Amt, null), ("@tax", r.Tax, null), ("@sum", r.Sum, null), ("@notamt", r.Notamt, null),
            ("@note", r.Note, null), ("@recno", r.RecordNumber, null));

        private Task InsertLinePgAsync(FeeReceiptLineDto l) => ExecPgAsync($@"
            INSERT INTO ""{PgSchema}"".""recmod""
                (""cno"", ""abbr"", ""recdate"", ""money"", ""isover"", ""itemno"", ""item"", ""note"", ""recman"", ""recmanname"", ""rno"", ""_record_number"")
            VALUES (@cno, '', @recdate, @money, @isover, @itemno, @item, @note, @recman, '', @rno, @recno);",
            ("@cno", l.Cno, null), ("@recdate", ParseStoredDate(l.Recdate), DbType.Date), ("@money", l.Money, null),
            ("@isover", l.Isover, null), ("@itemno", l.Itemno, null), ("@item", l.Item, null), ("@note", l.Note, null),
            ("@recman", l.Recman, null), ("@rno", l.Rno, null), ("@recno", l.RecordNumber, null));

        /// <summary>以寫入 DBF 的同一組欄位更新 PostgreSQL (日期值 {"$date": ...} 轉回 date)</summary>
        private Task UpdatePgAsync(string table, Dictionary<string, object?> fields, string whereSql, object key)
        {
            var sets = new List<string>();
            var args = new List<(string, object?, DbType?)> { ("@key", key, null) };
            var i = 0;
            foreach (var (name, value) in fields)
            {
                var p = "@f" + i++;
                sets.Add($@"""{name}"" = {p}");
                if (value is Dictionary<string, string?> d && d.TryGetValue("$date", out var iso))
                    args.Add((p, string.IsNullOrEmpty(iso) ? DateTime.MinValue.Date : DateTime.ParseExact(iso, "yyyy-MM-dd", CultureInfo.InvariantCulture), DbType.Date));
                else
                    args.Add((p, value ?? string.Empty, null));
            }
            return ExecPgAsync($@"UPDATE ""{PgSchema}"".""{table}"" SET {string.Join(", ", sets)} WHERE {whereSql};", args.ToArray());
        }

        private Task DeletePgAsync(string table, string whereSql, object key) =>
            ExecPgAsync($@"DELETE FROM ""{PgSchema}"".""{table}"" WHERE {whereSql};", ("@key", key, null));

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

        /// <summary>區間條件：起或迄有填才套用，未填的一端不設限</summary>
        private static void AddRange(DbCommand cmd, List<string> where, string column, string? from, string? to, string tag)
        {
            var f = from?.Trim() ?? string.Empty;
            var t = to?.Trim() ?? string.Empty;
            if (f.Length > 0)
            {
                where.Add($@"TRIM({column}) COLLATE ""C"" >= @{tag}1");
                AddParam(cmd, $"@{tag}1", f);
            }
            if (t.Length > 0)
            {
                where.Add($@"TRIM({column}) COLLATE ""C"" <= @{tag}2");
                AddParam(cmd, $"@{tag}2", t);
            }
        }

        private const string CustomerColumns = @"COALESCE(c.""no"", m.""cno"") AS ""no"", c.""name"", COALESCE(c.""abbr"", m.""abbr"") AS ""abbr"", c.""addr"", c.""unino"", c.""tel"", c.""fax"",
                       c.""linkman"", c.""linktel"", c.""bkaddr"", c.""sbkaddr"", c.""haddr"", c.""invaddr"", c.""memo"" AS ""cusmemo""";

        private static async Task<List<FeeReceiptPrintRow>> ReadPrintRowsAsync(DbCommand cmd, string doc)
        {
            var list = new List<FeeReceiptPrintRow>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync()) list.Add(ReadPrintRow(reader, doc, includeLine: true));
            return list;
        }

        private static FeeReceiptPrintRow ReadPrintRow(DbDataReader reader, string doc, bool includeLine) => new()
        {
            No = Str(reader, "no"), Name = Str(reader, "name"), Abbr = Str(reader, "abbr"), Addr = Str(reader, "addr"),
            Unino = Str(reader, "unino"), Tel = Str(reader, "tel"), Fax = Str(reader, "fax"), Linkman = Str(reader, "linkman"),
            Linktel = Str(reader, "linktel"), Bkaddr = Str(reader, "bkaddr"), Sbkaddr = Str(reader, "sbkaddr"), Haddr = Str(reader, "haddr"),
            Invaddr = Str(reader, "invaddr"), Cusmemo = Str(reader, "cusmemo"), Rno = Str(reader, "rno"), Recdate = DateStr(reader, "recdate"),
            Recman = Str(reader, "recman"), Amt = Dec(reader, "amt"), Mm = reader["memo"]?.ToString() ?? string.Empty, Mmnote = Str(reader, "mmnote"),
            Doc = doc,
            Itemno = includeLine ? Str(reader, "itemno") : string.Empty,
            Item = includeLine ? Str(reader, "item") : string.Empty,
            Money = includeLine ? Dec(reader, "money") : 0m,
            Note = includeLine ? Str(reader, "note") : string.Empty
        };

        private static string Str(DbDataReader r, string col) => r[col] == DBNull.Value ? string.Empty : r[col]?.ToString()?.Trim() ?? string.Empty;

        private static decimal Dec(DbDataReader r, string col) => r[col] == DBNull.Value ? 0m : Convert.ToDecimal(r[col], CultureInfo.InvariantCulture);

        private static string DateStr(DbDataReader r, string col) => r[col] is DateTime d ? FormatDate(d) : string.Empty;

        private static string FormatDate(DateTime d) => d.Year <= 1 ? string.Empty : d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        private static DateTime ParseStoredDate(string iso) =>
            TryParseIsoDate(iso, out var d) ? d : DateTime.MinValue.Date;

        private static bool TryParseIsoDate(string? iso, out DateTime date) =>
            DateTime.TryParseExact(iso?.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

        /// <summary>LocalAgent 的日期值：{"$date":"yyyy-MM-dd"} 轉成 VFP {^yyyy-MM-dd}，空字串為空日期</summary>
        private static Dictionary<string, string?> DbfDate(DateTime d) => new() { ["$date"] = FormatDate(d) };

        /// <summary>檢查使用者輸入能否存入 DBF：Big5 可編碼且不超過欄寬 (maxBytes 為 null 時只檢查編碼，用於 memo)</summary>
        private static string? CheckText(string? value, int? maxBytes, string label)
        {
            if (value == null) return null;
            int bytes;
            try
            {
                bytes = Big5Strict.GetByteCount(value);
            }
            catch (EncoderFallbackException)
            {
                return $"{label}含有無法存入 DBF 的字元 (罕用字或表情符號)";
            }
            if (maxBytes.HasValue && bytes > maxBytes.Value) return $"{label}超過 {maxBytes.Value} 個位元組 (中文字佔 2 個位元組)";
            return null;
        }

        /// <summary>帶入的文字 (客戶簡稱、項目名稱) 依 DBF 欄寬截斷，避免 VFP 截斷後與 PostgreSQL 內容不一致</summary>
        private static string TruncateBig5(string value, int maxBytes)
        {
            var sb = new StringBuilder();
            var used = 0;
            foreach (var ch in value)
            {
                int n;
                try { n = Big5Strict.GetByteCount(ch.ToString()); }
                catch (EncoderFallbackException) { continue; }
                if (used + n > maxBytes) break;
                sb.Append(ch);
                used += n;
            }
            return sb.ToString().TrimEnd();
        }
    }
}
