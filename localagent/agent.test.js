const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const {
  collectUtf8,
  isAllowedDllCall,
  genericCall,
  validateDbfWrite,
  buildWhereClause,
  toVfpLiteral,
  validateInsertGuard,
  buildDbfWriteScript,
  shouldCheckDuplicateKey,
  parseWriteResult,
  runDbfBridge,
  enqueueDbf,
  enqueueDbfWithin,
  executeDbfWrite,
  dbfChecksum,
  onlyExpectedChanges,
  validateCustbakRequest,
  buildCustbakExportScript,
  buildCustbakImportScript,
  parseCustbakResult,
  executeCustbakExport,
  executeCustbakImport,
  WORD_TEMPLATES,
  resolveWordTemplate,
  toWordText,
  validateWordMerge,
  buildWordMergeJob,
  WORD_MERGE_SCRIPT,
  OFFICE_OPEN_SCRIPT,
  openWordTemplate,
  mergeWordTemplate,
  isAllowedOrigin,
  authorizeRequest,
  buildDbfBridgeRequest,
  releasePreviewChild,
  handleRequest
} = require('./agent');

test('collectUtf8 decodes a character split across chunks', () => {
  const stream = new PassThrough();
  const getText = collectUtf8(stream);
  const bytes = Buffer.from('統一編號', 'utf8');
  stream.emit('data', bytes.subarray(0, 4)); // cuts the second 3-byte character
  stream.emit('data', bytes.subarray(4));
  assert.equal(getText(), '統一編號');
});

test('isAllowedOrigin accepts local and LAN frontends only', () => {
  for (const origin of [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'http://192.168.1.10:5007',
    'http://10.0.0.5:5007',
    'http://172.16.0.1:5007',
    'http://172.31.255.1:5007',
    'http://SERVER01:5007'
  ]) {
    assert.equal(isAllowedOrigin(origin), true, origin);
  }
  for (const origin of [
    'https://evil.example.com',
    'http://10.evil.com',
    'http://192.168.1.10.evil.com',
    'http://172.32.0.1:5007',
    'http://8.8.8.8',
    'http://[2001:db8::1]',
    'null',
    'file://',
    'chrome-extension://abc'
  ]) {
    assert.equal(isAllowedOrigin(origin), false, origin);
  }
});

const makeReq = (method, headers = {}) => ({ method, headers: { host: 'localhost:5009', ...headers } });

test('authorizeRequest lets the real callers through', () => {
  // ASP.NET backend and PowerShell diagnostics send no browser headers
  assert.equal(authorizeRequest(makeReq('POST'), '/api/dbf/write'), null);
  assert.equal(authorizeRequest(makeReq('GET'), '/api/dbf/ping'), null);
  // Frontend served from the LAN server
  assert.equal(authorizeRequest(makeReq('POST', { origin: 'http://192.168.1.10:5007', 'sec-fetch-site': 'cross-site' }), '/report'), null);
  assert.equal(authorizeRequest(makeReq('OPTIONS', { origin: 'http://192.168.1.10:5007' }), '/api/call'), null);
  // Electron file:// page: observed to send no Origin and Sec-Fetch-Site: cross-site
  assert.equal(authorizeRequest(makeReq('POST', { 'sec-fetch-site': 'cross-site' }), '/api/call'), null);
  assert.equal(authorizeRequest(makeReq('GET', { 'sec-fetch-site': 'cross-site' }), '/api/check-drive'), null);
  // test.html served by the agent itself
  assert.equal(authorizeRequest(makeReq('GET', { 'sec-fetch-site': 'same-origin' }), '/config'), null);
});

test('authorizeRequest blocks web pages and rebinding', () => {
  assert.ok(authorizeRequest(makeReq('POST', { origin: 'https://evil.example.com' }), '/api/call'));
  assert.ok(authorizeRequest(makeReq('POST', { origin: 'null' }), '/api/call'));
  assert.ok(authorizeRequest(makeReq('GET', { origin: 'https://evil.example.com' }), '/'));
  // <img src="http://localhost:5009/api/call?..."> has no Origin
  assert.ok(authorizeRequest(makeReq('GET', { 'sec-fetch-site': 'cross-site' }), '/api/call'));
  assert.ok(authorizeRequest(makeReq('GET', { 'sec-fetch-site': 'cross-site' }), '/report'));
  // DBF endpoints are never for browsers, even from an allowed origin
  assert.ok(authorizeRequest(makeReq('POST', { origin: 'http://localhost:5173' }), '/api/dbf/write'));
  assert.ok(authorizeRequest(makeReq('POST', { 'sec-fetch-site': 'cross-site' }), '/api/dbf/write'));
  // DNS rebinding
  assert.ok(authorizeRequest({ method: 'GET', headers: { host: 'evil.example.com:5009' } }, '/config'));
  assert.ok(authorizeRequest({ method: 'GET', headers: {} }, '/config'));
});

test('isAllowedDllCall only accepts functions registered in dlls.json', () => {
  assert.equal(isAllowedDllCall('wbaseRP', 'waccrep3101_b'), true);
  assert.equal(isAllowedDllCall('wbaseRP', 'wbase320_buyinv'), true);
  assert.equal(isAllowedDllCall('wbaseRP', 'wbase350_buyinv_list'), true);
  for (const func of ['wbase1010_cstore_list', 'wbase1050_taxno_list', 'wbase1060_recitem_list', 'wbase1070_recnote_list', 'wbase1080_feesummary_list', 'wbase3010_ticketplace_list']) {
    assert.equal(isAllowedDllCall('wbaseRP', func), true, func);
  }
  assert.equal(isAllowedDllCall('\\\\evil\\share\\x.dll', 'DllMain'), false);
  assert.equal(isAllowedDllCall('C:/Windows/System32/kernel32.dll', 'WinExec'), false);
  assert.equal(isAllowedDllCall('wbaseRP', 'report'), false);
  assert.equal(isAllowedDllCall('__proto__', 'toString'), false);
  assert.equal(isAllowedDllCall('wbaseRP', 'constructor'), false);
  assert.equal(isAllowedDllCall(undefined, undefined), false);
});

test('genericCall refuses unregistered DLLs without spawning anything', async () => {
  const result = await genericCall('\\\\evil\\share\\x.dll', 'DllMain', []);
  assert.equal(result.success, false);
  assert.equal(result.errorType, 'FORBIDDEN');
});

test('releasePreviewChild leaves the pipes open so the bridge can still report when the preview closes', async () => {
  // unref 之後事件迴圈可能沒有其他工作，測試期間要自己撐住
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const script = "setTimeout(() => process.stdout.write('OK:0\\n', (err) => process.exit(err ? 1 : 0)), 200); process.stdout.on('error', () => process.exit(1));";
    const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    const getStdout = collectUtf8(child.stdout);
    collectUtf8(child.stderr);
    releasePreviewChild(child);
    const code = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(code, 0);
    assert.equal(getStdout().trim(), 'OK:0');
  } finally {
    clearInterval(keepAlive);
  }
});

test('buildDbfBridgeRequest cannot be steered to EXEC_VFP', () => {
  assert.equal(buildDbfBridgeRequest('EXEC_VFP', { script: 'x' }), null);
  assert.equal(buildDbfBridgeRequest('CALL', { action: 'EXEC_VFP', script: 'x' }), null);
  assert.equal(buildDbfBridgeRequest('PING', { action: 'EXEC_VFP', script: 'x' }).action, 'PING');
  assert.equal(buildDbfBridgeRequest('GET_PG_SCRIPT', { dbfName: 'cpa' }).dbfName, 'cpa');
});

test('validateDbfWrite accepts every key form the backend uses', () => {
  for (const key of ['no', 'accno', 'seq', 'serial', 'itemno', 'noteno', 'mno', 'RECNO()', 'yymm,times,no', 'ALLTRIM(no)']) {
    assert.equal(validateDbfWrite('customer', key, { name: 'x', desc: 'y' }), null, key);
  }
  assert.equal(validateDbfWrite('公司', 'no', { 名稱: 'x' }), null);
});

test('validateDbfWrite rejects VFP injection', () => {
  assert.ok(validateDbfWrite('customer', 'no) \r\nRUN calc.exe\r\n* ', {}));
  assert.ok(validateDbfWrite('customer', 'RECNO() OR .T.', {}));
  assert.ok(validateDbfWrite('customer', 'SYS(2000)', {}));
  assert.ok(validateDbfWrite('customer', 'no', { 'name WITH 1\r\nRUN calc.exe\r\nREPLACE x': 'v' }));
  assert.ok(validateDbfWrite('x\r\nRUN calc', 'no', {}));
});

test('buildWhereClause trims plain keys so RECNO() matches the record number', () => {
  assert.equal(buildWhereClause('RECNO()', '1'), "ALLTRIM(TRANSFORM(RECNO())) == '1'");
  assert.equal(buildWhereClause('yymm,times,no', '11311,1,A01'),
    "ALLTRIM(TRANSFORM(yymm)) == '11311' AND ALLTRIM(TRANSFORM(times)) == '1' AND ALLTRIM(TRANSFORM(no)) == 'A01'");
  // STR() 等函數鍵原樣比較；VFP 的 STR(1) 是右靠補空白的 10 字元，不會 == '1'
  assert.equal(buildWhereClause('STR(RECNO())', '1'), "STR(RECNO()) == '1'");
});

test('backend never keys a DBF write on STR()', () => {
  // STR(RECNO()) == '1' 永遠 RECORD_NOT_FOUND (已用 DBFBridge 對 accpara/pub_para 複本實測)，要定位單筆參數表請用 RECNO()
  const backendDir = path.join(__dirname, '..', 'backend');
  const sources = fs.readdirSync(backendDir, { recursive: true })
    .filter((f) => f.endsWith('.cs') && !/^(bin|obj)[\\/]/.test(f));
  const offenders = [];
  for (const file of sources) {
    const text = fs.readFileSync(path.join(backendDir, file), 'utf8');
    for (const m of text.matchAll(/WriteRecordAsync\([^;]*?"STR\(/g)) {
      offenders.push(`${file}:${text.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('date field values become VFP strict date literals', () => {
  assert.equal(toVfpLiteral({ $date: '2025-03-12' }), '{^2025-03-12}');
  assert.equal(toVfpLiteral({ $date: '' }), '{}');
  assert.equal(toVfpLiteral({ $date: null }), '{}');
  // 長得像日期的一般字串仍是字元值
  assert.equal(toVfpLiteral('2025-03-12'), "'2025-03-12'");
});

test('validateDbfWrite accepts date values and rejects malformed ones', () => {
  for (const v of [{ $date: '2025-03-12' }, { $date: '2024-02-29' }, { $date: '' }, { $date: null }]) {
    assert.equal(validateDbfWrite('recmom', 'rno', { recdate: v }), null, JSON.stringify(v));
  }
  for (const v of [
    { $date: '2025-02-29' },
    { $date: '2025/03/12' },
    { $date: '114-03-12' },
    { $date: "2025-03-12}\r\nRUN calc.exe\r\n*" },
    { $date: 20250312 },
    { $date: '2025-03-12', extra: 1 },
    { other: '2025-03-12' },
    ['2025-03-12'],
    NaN,
    Infinity
  ]) {
    assert.ok(validateDbfWrite('recmom', 'rno', { recdate: v }), JSON.stringify(v));
  }
});

test('executeDbfWrite validates before touching the bridge', async () => {
  const result = await executeDbfWrite({
    dbfPath: 'C:\\does-not-exist',
    dbfName: 'customer',
    keyField: 'no) \r\nRUN calc.exe\r\n* ',
    keyValue: '1',
    fields: {}
  });
  assert.equal(result.errorType, 'INVALID_REQUEST');
});

test('INSERT checks for an existing key in the same VFP script', () => {
  const opts = { operation: 'INSERT', vfpFullPath: 'V:\\\\w3000\\\\comm\\\\customer.dbf', cAlias: 'customer', keyField: 'no', keyValue: 'A01', fields: { no: 'A01', name: 'x' } };
  const checked = buildDbfWriteScript({ ...opts, checkDuplicate: true }).split('\r\n');
  const lock = checked.findIndex((l) => l.startsWith('IF !RLOCK("0"'));
  const locate = checked.findIndex((l) => l.startsWith('LOCATE FOR'));
  const insert = checked.findIndex((l) => l.startsWith('INSERT INTO'));
  assert.ok(lock >= 0 && lock < locate && locate < insert, '先鎖檔頭、再找、再新增');
  assert.equal(checked[locate], "LOCATE FOR (ALLTRIM(TRANSFORM(no)) == 'A01') AND NOT DELETED()");
  assert.ok(checked.some((l) => l.includes('RETURN "DUPLICATE_KEY:"')));

  const unchecked = buildDbfWriteScript({ ...opts, checkDuplicate: false });
  assert.ok(!unchecked.includes('LOCATE') && !unchecked.includes('RLOCK'));
  assert.equal(buildDbfWriteScript({ ...opts, operation: 'MERGE', checkDuplicate: true }), null);
});

test('duplicate check is skipped only for keys that may repeat', () => {
  assert.equal(shouldCheckDuplicateKey('INSERT', 'no', undefined), true);
  assert.equal(shouldCheckDuplicateKey('INSERT', 'yymm,times,no', false), true);
  assert.equal(shouldCheckDuplicateKey('INSERT', 'rno', true), false, '收費明細一張單有多筆，後端傳 allowDuplicateKey');
  assert.equal(shouldCheckDuplicateKey('INSERT', 'RECNO()', false), false);
  assert.equal(shouldCheckDuplicateKey('UPDATE', 'no', false), false);
});

test('enqueueDbfWithin never runs a write after its caller gave up', async (t) => {
  // 先放一個卡住的動作，模擬 VFP 正在產生大表的重灌腳本
  let release;
  const blocker = enqueueDbf(() => new Promise((r) => { release = r; }));

  await t.test('times out while waiting and skips the task', async () => {
    let ran = false;
    const started = Date.now();
    const res = await enqueueDbfWithin(async () => { ran = true; }, { timeoutMs: 50 });
    assert.deepEqual(res, { skipped: 'QUEUE_TIMEOUT' });
    assert.ok(Date.now() - started < 1000, '逾時就回覆，不必等前面的動作做完');
    release();
    await blocker;
    await enqueueDbf(async () => {});
    assert.equal(ran, false);
  });

  await t.test('skips the task when the caller disconnected', async () => {
    let ran = false;
    const res = await enqueueDbfWithin(async () => { ran = true; }, { isCancelled: () => true });
    assert.deepEqual(res, { skipped: 'CLIENT_GONE' });
    assert.equal(ran, false);
  });

  await t.test('runs normally and keeps the queue moving', async () => {
    assert.deepEqual(await enqueueDbfWithin(async () => 42, { timeoutMs: 1000 }), { value: 42 });
    const failed = await enqueueDbfWithin(async () => { throw new Error('boom'); });
    assert.equal(failed.error.message, 'boom');
    assert.equal(await enqueueDbf(async () => 'next'), 'next');
  });
});

// 組一個最小的 DBF：欄位 no C(2)、tel C(4)、fax C(4)，每筆 11 個位元組 (含刪除旗標)，結尾有 0x1A
function makeDbf(rows) {
  const fieldDefs = [['NO', 2], ['TEL', 4], ['FAX', 4]];
  const headerLen = 32 + fieldDefs.length * 32 + 1;
  const recLen = 1 + fieldDefs.reduce((a, [, len]) => a + len, 0);
  const buf = Buffer.alloc(headerLen + rows.length * recLen + 1, 0x20);
  buf.fill(0, 0, headerLen);
  buf[0] = 0x30;
  buf.writeUInt32LE(rows.length, 4);
  buf.writeUInt16LE(headerLen, 8);
  buf.writeUInt16LE(recLen, 10);
  fieldDefs.forEach(([name, len], i) => {
    const off = 32 + i * 32;
    buf.write(name, off, 'latin1');
    buf[off + 11] = 0x43; // 'C'
    buf[off + 16] = len;
  });
  buf[headerLen - 1] = 0x0d;
  rows.forEach((r, i) => {
    const base = headerLen + i * recLen;
    buf.write(r.no.padEnd(2), base + 1, 'latin1');
    buf.write(r.tel.padEnd(4), base + 3, 'latin1');
    buf.write(r.fax.padEnd(4), base + 7, 'latin1');
  });
  buf[buf.length - 1] = 0x1a;
  return buf;
}

const baseRows = [{ no: '01', tel: '1111', fax: '2222' }, { no: '02', tel: '3333', fax: '4444' }];

test('dbfChecksum matches the DBFBridge CHECKSUM format', () => {
  const buf = makeDbf(baseRows);
  assert.match(dbfChecksum(buf), new RegExp(`^[0-9a-f]{64}:${buf.length}$`));
});

test('onlyExpectedChanges accepts a write that touched only its own bytes', () => {
  const before = makeDbf(baseRows);

  const updated = makeDbf([{ ...baseRows[0], tel: '9999' }, baseRows[1]]);
  updated[1] = 0x7e; // VFP 更新檔頭的最後修改日期
  assert.equal(onlyExpectedChanges(before, updated, { operation: 'UPDATE', recno: 1, fieldNames: ['tel'] }), true);

  const inserted = makeDbf([...baseRows, { no: '03', tel: '5555', fax: '6666' }]);
  assert.equal(onlyExpectedChanges(before, inserted, { operation: 'INSERT', recno: 3, fieldNames: ['no', 'tel', 'fax'] }), true);

  const deleted = Buffer.from(before);
  deleted[before.readUInt16LE(8) + before.readUInt16LE(10)] = 0x2a; // 第 2 筆的刪除旗標
  assert.equal(onlyExpectedChanges(before, deleted, { operation: 'DELETE', recno: 2 }), true);
});

test('onlyExpectedChanges notices changes made by someone else at the same time', () => {
  const before = makeDbf(baseRows);

  // 寫第 1 筆的 tel 時，舊系統改了第 2 筆
  const otherRecord = makeDbf([{ ...baseRows[0], tel: '9999' }, { ...baseRows[1], fax: '0000' }]);
  assert.equal(onlyExpectedChanges(before, otherRecord, { operation: 'UPDATE', recno: 1, fieldNames: ['tel'] }), false);

  // 同一筆，但舊系統改的是沒有寫的欄位
  const otherField = makeDbf([{ ...baseRows[0], tel: '9999', fax: '0000' }, baseRows[1]]);
  assert.equal(onlyExpectedChanges(before, otherField, { operation: 'UPDATE', recno: 1, fieldNames: ['tel'] }), false);

  // 新增時舊系統也新增了一筆
  const twoInserts = makeDbf([...baseRows, { no: '03', tel: '5555', fax: '6666' }, { no: '04', tel: '7777', fax: '8888' }]);
  assert.equal(onlyExpectedChanges(before, twoInserts, { operation: 'INSERT', recno: 3, fieldNames: ['no', 'tel', 'fax'] }), false);

  // 新增時舊系統改了既有的一筆
  const insertAndEdit = makeDbf([{ ...baseRows[0], fax: '0000' }, baseRows[1], { no: '03', tel: '5555', fax: '6666' }]);
  assert.equal(onlyExpectedChanges(before, insertAndEdit, { operation: 'INSERT', recno: 3, fieldNames: ['no', 'tel', 'fax'] }), false);

  // 刪除時舊系統改了別筆
  const deleteAndEdit = makeDbf([{ ...baseRows[0], fax: '0000' }, baseRows[1]]);
  deleteAndEdit[before.readUInt16LE(8) + before.readUInt16LE(10)] = 0x2a;
  assert.equal(onlyExpectedChanges(before, deleteAndEdit, { operation: 'DELETE', recno: 2 }), false);

  // 讀不到檔案、欄位不存在、記錄號不合理時一律視為有其他變動
  assert.equal(onlyExpectedChanges(null, before, { operation: 'UPDATE', recno: 1, fieldNames: ['tel'] }), false);
  assert.equal(onlyExpectedChanges(before, before, { operation: 'UPDATE', recno: 1, fieldNames: ['nope'] }), false);
  assert.equal(onlyExpectedChanges(before, before, { operation: 'UPDATE', recno: 0, fieldNames: ['tel'] }), false);
});

// ---------- 新增時的防重複與取號 (unique / autoNumber) ----------

test('validateInsertGuard accepts what the backend sends', () => {
  assert.equal(validateInsertGuard('INSERT', {}), null);
  assert.equal(validateInsertGuard('UPDATE', { unique: false, autoNumber: null }), null, 'absent options are fine on any operation');
  assert.equal(validateInsertGuard('INSERT', { unique: true }), null);
  assert.equal(validateInsertGuard('INSERT', { autoNumber: { field: 'seq', assignTo: ['serial'] } }), null);
  assert.equal(validateInsertGuard('INSERT', { autoNumber: { field: 'serial', scopeField: 'accno', scopeValue: '1101' } }), null);
  assert.equal(validateInsertGuard('INSERT', { autoNumber: { field: 'rno', prefix: 'A114', width: 6 } }), null);
  assert.equal(validateInsertGuard('INSERT', { unique: true, autoNumber: { field: 'seq' } }), null);
});

test('validateInsertGuard rejects misuse and VFP injection', () => {
  assert.ok(validateInsertGuard('UPDATE', { unique: true }), 'unique only makes sense for INSERT');
  assert.ok(validateInsertGuard('DELETE', { autoNumber: { field: 'seq' } }));
  assert.ok(validateInsertGuard('INSERT', { unique: 'yes' }));
  for (const autoNumber of [
    'seq',
    ['seq'],
    {},
    { field: 'seq) TO x\r\nRUN calc.exe\r\n*' },
    { field: 'seq', assignTo: 'serial' },
    { field: 'seq', assignTo: ['serial WITH 1'] },
    { field: 'serial', scopeField: 'accno OR .T.', scopeValue: '1' },
    { field: 'serial', scopeField: 'accno', scopeValue: 1 },
    { field: 'rno', prefix: 'A"+x+"', width: 6 },
    { field: 'rno', prefix: 'A114' },
    { field: 'rno', prefix: 'A114', width: 0 },
    { field: 'rno', prefix: 'A114', width: 19 },
    { field: 'seq', width: 6 }
  ]) {
    assert.ok(validateInsertGuard('INSERT', { autoNumber }), JSON.stringify(autoNumber));
  }
});

const scriptOf = (opts) => buildDbfWriteScript({
  operation: 'INSERT', vfpFullPath: 'X:\\\\w3000\\\\comm\\\\t.dbf', cAlias: 't', keyField: 'no', keyValue: 'A1', fields: { no: 'A1', name: 'x' }, ...opts
});
const lineIndex = (script, re) => script.split('\r\n').findIndex((l) => re.test(l));

test('plain INSERT keeps the original script without any lock', () => {
  const s = scriptOf({});
  assert.ok(!/RLOCK|LOCATE|CALCULATE/.test(s), s);
  assert.match(s, /INSERT INTO t \(no, name\) VALUES \('A1', 'x'\)\r\nlnRec = RECNO\("t"\)/);
  assert.match(s, /RETURN TRANSFORM\(lnRec\)$/);
});

test('unique INSERT checks the key inside the header lock before inserting', () => {
  const s = scriptOf({ unique: true });
  const lock = lineIndex(s, /^IF !RLOCK\("0", "t"\)$/);
  const locate = lineIndex(s, /^LOCATE FOR \(ALLTRIM\(TRANSFORM\(no\)\) == 'A1'\) AND NOT DELETED\(\)$/);
  const dup = lineIndex(s, /RETURN "DUPLICATE_KEY:"/);
  const insert = lineIndex(s, /^INSERT INTO t /);
  const unlock = lineIndex(s, /^UNLOCK IN t$/);
  assert.ok(lock > 0 && lock < locate && locate < dup && dup < insert, s);
  assert.ok(lineIndex(s, /^SET DELETED ON$/) >= 0, 'deleted records must not count as duplicates');
  assert.ok(lineIndex(s, /^SET REPROCESS TO \d+ SECONDS$/) >= 0);
  assert.ok(s.split('\r\n').lastIndexOf('UNLOCK IN t') > insert && unlock >= 0);
  assert.ok(!/CALCULATE/.test(s));
});

test('autoNumber computes MAX()+1 in VFP and writes it to every numbered field', () => {
  const s = scriptOf({
    keyField: 'seq', keyValue: '0',
    fields: { seq: 7, no: '', desc: 'x', serial: 7 },
    autoNumber: { field: 'seq', assignTo: ['serial'] }
  });
  const calc = lineIndex(s, /^CALCULATE MAX\(seq\) TO lnWxMax$/);
  assert.ok(calc > lineIndex(s, /^IF !RLOCK\("0", "t"\)$/), s);
  assert.ok(lineIndex(s, /^lvWxNo = lnWxMax \+ 1$/) > calc);
  // fields 裡的 7 是給舊版 LocalAgent 用的，新版一律寫 VFP 算出的號碼
  assert.match(s, /INSERT INTO t \(no, desc, seq, serial\) VALUES \('', 'x', lvWxNo, lvWxNo\)/);
  assert.match(s, /RETURN "OK" \+ CHR\(9\) \+ TRANSFORM\(lnRec\) \+ CHR\(9\) \+ TRANSFORM\(lvWxNo\)$/);

  const scoped = scriptOf({ fields: { accno: '1101', descrip: 'x' }, autoNumber: { field: 'serial', scopeField: 'accno', scopeValue: '1101' } });
  assert.match(scoped, /CALCULATE MAX\(serial\) TO lnWxMax FOR ALLTRIM\(TRANSFORM\(accno\)\) == '1101'/);
  assert.match(scoped, /INSERT INTO t \(accno, descrip, serial\) VALUES \('1101', 'x', lvWxNo\)/);
});

test('autoNumber with a prefix numbers character keys like VFP recmom', () => {
  const s = scriptOf({ keyField: 'rno', keyValue: 'A114000001', fields: { rno: 'A114000001', amt: 0 }, autoNumber: { field: 'rno', prefix: 'A114', width: 6 } });
  assert.match(s, /CALCULATE MAX\(VAL\(SUBSTR\(ALLTRIM\(rno\), 5\)\)\) TO lnWxMax FOR LEFT\(ALLTRIM\(rno\), 4\) == 'A114'/);
  assert.match(s, /lvWxNo = 'A114' \+ PADL\(TRANSFORM\(lnWxMax \+ 1\), 6, "0"\)/);
  assert.match(s, /INSERT INTO t \(amt, rno\) VALUES \(0, lvWxNo\)/);
});

test('parseWriteResult reads plain and guarded results', () => {
  assert.deepEqual(parseWriteResult('12'), { recno: 12, autoNumber: '' });
  assert.deepEqual(parseWriteResult('OK\t5\t'), { recno: 5, autoNumber: '' });
  assert.deepEqual(parseWriteResult('OK\t5\t17'), { recno: 5, autoNumber: '17' });
  assert.deepEqual(parseWriteResult('OK\t5\tA114000003'), { recno: 5, autoNumber: 'A114000003' });
});

function makeDbfFixture(t, rows = baseRows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx3000-write-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 't.dbf');
  fs.writeFileSync(file, makeDbf(rows));
  return { dir, file };
}

test('executeDbfWrite returns the number VFP assigned together with the checksums', async (t) => {
  const { dir, file } = makeDbfFixture(t);
  const before = fs.readFileSync(file);
  let sent;
  const result = await executeDbfWrite({
    operation: 'INSERT', dbfPath: dir, dbfName: 't', keyField: 'no', keyValue: '03',
    fields: { no: '03', tel: '5555', fax: '0' }, unique: true, autoNumber: { field: 'fax' }
  }, {
    runBridge: async (req) => {
      sent = req;
      fs.writeFileSync(file, makeDbf([...baseRows, { no: '03', tel: '5555', fax: '7' }]));
      return { success: true, result: 'OK\t3\t7', elapsedMs: 1 };
    }
  });
  assert.equal(sent.action, 'EXEC_VFP');
  assert.match(sent.script, /RETURN "DUPLICATE_KEY:"/);
  assert.equal(result.success, true);
  assert.equal(result.recno, 3);
  assert.equal(result.autoNumber, '7');
  assert.equal(result.checksumBefore, dbfChecksum(before));
  assert.equal(result.checksumAfter, dbfChecksum(fs.readFileSync(file)));
  assert.equal(result.otherChanges, false);
});

test('executeDbfWrite reports a duplicate key as DUPLICATE_KEY without touching checksums', async (t) => {
  const { dir } = makeDbfFixture(t);
  const result = await executeDbfWrite({
    operation: 'INSERT', dbfPath: dir, dbfName: 't', keyField: 'no', keyValue: '01', fields: { no: '01' }, unique: true
  }, { runBridge: async () => ({ success: true, result: 'DUPLICATE_KEY', elapsedMs: 1 }) });
  assert.equal(result.success, false);
  assert.equal(result.errorType, 'DUPLICATE_KEY');
  assert.match(result.message, /01/);
  assert.equal(result.checksumAfter, undefined);

  const locked = await executeDbfWrite({
    operation: 'INSERT', dbfPath: dir, dbfName: 't', keyField: 'no', keyValue: '04', fields: { no: '04' }, unique: true
  }, { runBridge: async () => ({ success: true, result: 'LOCK_TIMEOUT', elapsedMs: 1 }) });
  assert.equal(locked.errorType, 'LOCK_TIMEOUT', 'the backend turns this into 409 like other lock errors');
  assert.ok(locked.message);
});

test('executeDbfWrite keeps plain writes unchanged and refuses guards on UPDATE', async (t) => {
  const { dir, file } = makeDbfFixture(t);
  // 鍵值本來就會重複的表 (allowDuplicateKey) 既不查重也不取號，腳本不鎖檔頭
  const plain = await executeDbfWrite({
    operation: 'INSERT', dbfPath: dir, dbfName: 't', keyField: 'no', keyValue: '03', fields: { no: '03' }, allowDuplicateKey: true
  }, {
    runBridge: async (req) => {
      assert.ok(!/RLOCK/.test(req.script));
      fs.writeFileSync(file, makeDbf([...baseRows, { no: '03', tel: '', fax: '' }]));
      return { success: true, result: '3', elapsedMs: 1 };
    }
  });
  assert.equal(plain.recno, 3);
  assert.ok(!('autoNumber' in plain));

  let called = false;
  const bad = await executeDbfWrite({
    operation: 'UPDATE', dbfPath: dir, dbfName: 't', keyField: 'no', keyValue: '01', fields: { tel: '1' }, unique: true
  }, { runBridge: async () => { called = true; return { success: true, result: '1' }; } });
  assert.equal(bad.errorType, 'INVALID_REQUEST');
  assert.equal(called, false);
});

// ---------- 用真的 VFP 驗證腳本 (需要 DBFBridge.exe 與 w3000_dbf.dll；找不到時略過) ----------
// 預設找 localagent\DBFBridge.exe 與 localagent\bridge\lazarus\DBFBridge.exe，也可用環境變數 WX3000_DBFBRIDGE 指定
const REAL_BRIDGE = [process.env.WX3000_DBFBRIDGE, path.join(__dirname, 'DBFBridge.exe'), path.join(__dirname, 'bridge', 'lazarus', 'DBFBridge.exe')]
  .find((p) => p && fs.existsSync(p));

test('guarded INSERT against real VFP', { skip: REAL_BRIDGE ? false : '找不到 DBFBridge.exe' }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx3000-vfp-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const vfp = (script) => runDbfBridge({ action: 'EXEC_VFP', script: script.join('\r\n') }, REAL_BRIDGE);
  const tablePath = path.join(dir, 'wxg.dbf');
  const created = await vfp([
    `CREATE TABLE "${tablePath}" FREE (no C(4), accno C(8), seq N(11), serial N(4), rno C(10))`,
    "INSERT INTO wxg (no, accno, seq, serial, rno) VALUES ('A1', '1101', 1, 1, 'A114000001')",
    "INSERT INTO wxg (no, accno, seq, serial, rno) VALUES ('A2', '1101', 9, 9, 'A114000009')",
    "INSERT INTO wxg (no, accno, seq, serial, rno) VALUES ('A3', '2201', 3, 3, 'A113000050')",
    "DELETE FOR ALLTRIM(no) == 'A2'",
    'USE IN wxg',
    "RETURN 'OK'"
  ]);
  assert.equal(created.result, 'OK', JSON.stringify(created));
  const write = (payload) => executeDbfWrite({ operation: 'INSERT', dbfPath: dir, dbfName: 'wxg', ...payload }, { runBridge: (req) => runDbfBridge(req, REAL_BRIDGE) });

  await t.test('unique refuses a key that already exists', async () => {
    const r = await write({ keyField: 'no', keyValue: 'A1', fields: { no: 'A1' }, unique: true });
    assert.equal(r.errorType, 'DUPLICATE_KEY', JSON.stringify(r));
  });

  await t.test('unique ignores deleted records, like VFP with SET DELETED ON', async () => {
    const r = await write({ keyField: 'no', keyValue: 'A2', fields: { no: 'A2', accno: '9999' }, unique: true });
    assert.equal(r.success, true, JSON.stringify(r));
    assert.equal(r.recno, 4);
    assert.equal(r.otherChanges, false);
  });

  await t.test('composite keys are checked as a whole', async () => {
    const dup = await write({ keyField: 'no,accno', keyValue: 'A3,2201', fields: { no: 'A3', accno: '2201' }, unique: true });
    assert.equal(dup.errorType, 'DUPLICATE_KEY');
    const ok = await write({ keyField: 'no,accno', keyValue: 'A3,1101', fields: { no: 'A3', accno: '1101' }, unique: true });
    assert.equal(ok.success, true, JSON.stringify(ok));
  });

  await t.test('autoNumber skips deleted records and fills every numbered field', async () => {
    // 未刪除的最大 seq 是 3 (seq 9 那筆已刪除)；新增的兩筆 seq 都是空的 0
    const r = await write({ keyField: 'seq', keyValue: '0', fields: { no: 'N1', seq: 99, serial: 99 }, autoNumber: { field: 'seq', assignTo: ['serial'] } });
    assert.equal(r.success, true, JSON.stringify(r));
    assert.equal(r.autoNumber, '4');
    const r2 = await write({ keyField: 'seq', keyValue: '0', fields: { no: 'N2' }, autoNumber: { field: 'seq', assignTo: ['serial'] } });
    assert.equal(r2.autoNumber, '5');
  });

  await t.test('autoNumber within a scope', async () => {
    const r = await write({ keyField: 'accno', keyValue: '2201', fields: { accno: '2201' }, autoNumber: { field: 'serial', scopeField: 'accno', scopeValue: '2201' } });
    assert.equal(r.autoNumber, '4');
  });

  await t.test('autoNumber with a prefix', async () => {
    const r = await write({ keyField: 'rno', keyValue: '', fields: { no: 'R1' }, autoNumber: { field: 'rno', prefix: 'A114', width: 6 } });
    assert.equal(r.autoNumber, 'A114000002', 'A114000009 is deleted');
    const other = await write({ keyField: 'rno', keyValue: '', fields: { no: 'R2' }, autoNumber: { field: 'rno', prefix: 'A115', width: 6 } });
    assert.equal(other.autoNumber, 'A115000001');
  });

  await t.test('rows written by VFP match the returned numbers', async () => {
    const r = await vfp([
      `USE "${tablePath}" IN 0 ALIAS wxg SHARED AGAIN`,
      'SELECT wxg',
      'lcOut = ""',
      "SCAN FOR INLIST(ALLTRIM(no), 'N1', 'N2', 'R1')",
      '  lcOut = lcOut + ALLTRIM(no) + "=" + TRANSFORM(seq) + "/" + TRANSFORM(serial) + "/" + ALLTRIM(rno) + ";"',
      'ENDSCAN',
      'USE IN wxg',
      'RETURN lcOut'
    ]);
    assert.equal(r.result, 'N1=4/4/;N2=5/5/;R1=0/0/A114000002;');
  });

  await t.test('waits for a header lock held by another workstation, then gives up', async () => {
    // 另一個 DBFBridge 程序 (不經 LocalAgent 隊列，等同舊系統) 鎖住檔頭 4 秒
    const holder = vfp([
      'SET MULTILOCKS ON',
      `USE "${tablePath}" IN 0 ALIAS wxg SHARED AGAIN`,
      "llOk = RLOCK('0', 'wxg')",
      'lnT = SECONDS()',
      'DO WHILE SECONDS() - lnT < 4',
      'ENDDO',
      'USE IN wxg',
      'RETURN TRANSFORM(llOk)'
    ]);
    await new Promise((r) => setTimeout(r, 700));
    const started = Date.now();
    const r = await write({ keyField: 'no', keyValue: 'L1', fields: { no: 'L1' }, unique: true });
    assert.equal(r.errorType, 'LOCK_TIMEOUT', JSON.stringify(r));
    assert.ok(Date.now() - started >= 1500, 'should retry for about INSERT_LOCK_SECONDS');
    assert.equal((await holder).result, '.T.');
    const again = await write({ keyField: 'no', keyValue: 'L1', fields: { no: 'L1' }, unique: true });
    assert.equal(again.success, true, JSON.stringify(again));
  });
});

// 只建空檔，validateCustbakRequest 只檢查路徑，不讀內容
function makeCustbakFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wx3000-custbak-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dbfPath = path.join(root, 'comm');
  const work = path.join(root, 'work');
  fs.mkdirSync(dbfPath);
  fs.mkdirSync(work);
  fs.writeFileSync(path.join(dbfPath, 'customer.dbf'), '');
  const sourceFile = path.join(work, 'custbak.dbf');
  fs.writeFileSync(sourceFile, '');
  return { dbfPath, work, sourceFile, targetFile: path.join(work, 'new.dbf') };
}

test('validateCustbakRequest accepts what the backend sends', (t) => {
  const f = makeCustbakFixture(t);
  assert.equal(validateCustbakRequest('export', { dbfPath: f.dbfPath, keys: ['A001', ' B02 ', '統一'], targetFile: f.targetFile }), null);
  assert.equal(validateCustbakRequest('import', { dbfPath: f.dbfPath, keys: ['A001'], sourceFile: f.sourceFile }), null);
});

test('validateCustbakRequest rejects bad paths and keys', (t) => {
  const f = makeCustbakFixture(t);
  const exp = (over) => validateCustbakRequest('export', { dbfPath: f.dbfPath, keys: ['A001'], targetFile: f.targetFile, ...over });
  const imp = (over) => validateCustbakRequest('import', { dbfPath: f.dbfPath, keys: ['A001'], sourceFile: f.sourceFile, ...over });
  // 路徑
  assert.ok(exp({ dbfPath: 'comm' }));
  assert.ok(exp({ dbfPath: f.dbfPath + '"\r\nRUN calc.exe' }));
  assert.ok(exp({ dbfPath: path.join(f.work, 'missing') }), 'customer.dbf must exist');
  assert.ok(exp({ targetFile: 'custbak.dbf' }));
  assert.ok(exp({ targetFile: path.join(f.work, 'custbak.txt') }));
  assert.ok(exp({ targetFile: path.join(f.work, 'x".dbf') }));
  assert.ok(exp({ targetFile: path.join(f.work, 'nodir', 'custbak.dbf') }));
  assert.ok(exp({ targetFile: f.sourceFile }), 'export never overwrites an existing file');
  assert.ok(exp({ targetFile: path.join(f.dbfPath, 'CUSTOMER.DBF') }));
  assert.ok(imp({ sourceFile: path.join(f.work, 'missing.dbf') }));
  assert.ok(imp({ sourceFile: path.join(f.dbfPath, 'customer.dbf') }), 'customer.dbf cannot import itself');
  // 代號
  for (const keys of [[], undefined, 'A001', [''], ['   '], ['A|B'], ['123456789'], ['A\r\nB'], [1], [null]]) {
    assert.ok(exp({ keys }), JSON.stringify(keys));
  }
});

test('custbak scripts read keys from a file and never embed them', () => {
  const paths = { dbfPath: 'X:\\w3000\\comm', keysFile: 'C:\\Temp\\Wx3000\\keys.txt' };
  const exp = buildCustbakExportScript({ ...paths, targetFile: 'C:\\Temp\\Wx3000\\custbak\\g\\custbak.dbf' });
  assert.match(exp, /FILETOSTR\("C:\\Temp\\Wx3000\\keys\.txt"\)/);
  assert.match(exp, /USE "X:\\w3000\\comm\\customer\.dbf" IN 0 ALIAS wx_cust SHARED AGAIN/);
  assert.match(exp, /COPY TO "C:\\Temp\\Wx3000\\custbak\\g\\custbak\.dbf" FOR/);
  assert.match(exp, /REPLACE sel WITH "=>" ALL IN wx_bak/, 'output file carries sel like the VFP export');
  assert.ok(!/RETURN/.test(exp.split('ENDTRY')[0]), 'RETURN is not allowed inside TRY');

  const imp = buildCustbakImportScript({ ...paths, sourceFile: 'C:\\Temp\\Wx3000\\custbak\\g\\custbak.dbf' });
  assert.match(imp, /CREATE CURSOR wx_src FROM ARRAY laF/);
  assert.match(imp, /APPEND FROM "C:\\Temp\\Wx3000\\custbak\\g\\custbak\.dbf"/);
  // 既有客戶保留 sel，新客戶 sel 空白
  assert.match(imp, /m\.sel = wx_cust\.sel\r\n\s+SELECT wx_cust\r\n\s+GATHER MEMVAR/);
  assert.match(imp, /m\.sel = ""\r\n\s+INSERT INTO wx_cust FROM MEMVAR/);
  assert.ok(!/APPEND BLANK/.test(imp));
  assert.ok(!/RETURN/.test(imp.split(/\r\nENDTRY/)[0]), 'RETURN is not allowed inside TRY');
});

test('parseCustbakResult reads counts, row failures and lock errors', () => {
  assert.deepEqual(parseCustbakResult('export', 'OK\n12'), { success: true, count: 12 });
  const imp = parseCustbakResult('import', 'OK\n2\n3\nA001\tLOCK\nB002\t1884 Uniqueness of index NO is violated.\n');
  assert.equal(imp.success, true);
  assert.equal(imp.inserted, 2);
  assert.equal(imp.updated, 3);
  assert.equal(imp.failed.length, 2);
  assert.equal(imp.failed[0].key, 'A001');
  assert.match(imp.failed[0].reason, /其他工作站/);
  assert.match(imp.failed[1].reason, /^1884 /);
  assert.deepEqual(parseCustbakResult('import', 'OK\n0\n0\n'), { success: true, inserted: 0, updated: 0, failed: [] });

  const lock = parseCustbakResult('import', 'ERR\n1705\nFile access is denied.\n0\n0');
  assert.equal(lock.errorType, 'LOCK_TIMEOUT');
  assert.match(lock.message, /獨佔/);
  const bad = parseCustbakResult('import', 'ERR\n15\nNot a table.\n0\n0');
  assert.equal(bad.errorType, 'VFP_ERROR');
  assert.match(bad.error, /Not a table/);
  assert.equal(parseCustbakResult('export', 'garbage').success, false);
});

test('executeCustbak validates before touching the bridge', async () => {
  for (const run of [executeCustbakExport, executeCustbakImport]) {
    const result = await run({ dbfPath: 'C:\\does-not-exist', keys: ['A|B'], targetFile: 'x.dbf', sourceFile: 'x.dbf' });
    assert.equal(result.errorType, 'INVALID_REQUEST');
  }
});

test('resolveWordTemplate only builds the fixed <drive>:\\W3000\\comm path', () => {
  assert.equal(resolveWordTemplate('bsdesc', 'f').filePath, 'F:\\W3000\\comm\\wbase001.DOC');
  for (const drive of ['', 'CC', 'C:', 'C:\\', '..', '1', null, 5]) {
    assert.ok(resolveWordTemplate('bsdesc', drive).error, String(drive));
  }
  for (const template of ['wbase001.DOC', '../bsdesc', 'toString', '__proto__', '', null]) {
    assert.ok(resolveWordTemplate(template, 'C').error, String(template));
  }
});

test('validateWordMerge accepts what 5-6 sends and rejects anything else', () => {
  const ok = { template: 'bsdesc', drive: 'C', paragraphs: ['第一條', ''], copies: [{ NAME: '【委任人名稱】', COMPHIDNO: 'A123456789' }] };
  assert.equal(validateWordMerge(ok), null);
  const bad = [
    { ...ok, template: 'other' },
    { ...ok, drive: 'C:\\temp' },
    { ...ok, paragraphs: '第一條' },
    { ...ok, paragraphs: [1] },
    { ...ok, paragraphs: ['x'.repeat(20001)] },
    { ...ok, copies: [] },
    { ...ok, copies: {} },
    { ...ok, copies: Array.from({ length: 201 }, () => ({})) },
    { ...ok, copies: [['NAME']] },
    { ...ok, copies: [{ EVIL: 'x' }] },
    { ...ok, copies: [{ THINGS: 'x' }] }, // 清單巨集只能由 paragraphs 提供
    { ...ok, copies: [{ NAME: 1 }] },
    { ...ok, copies: [JSON.parse('{"__proto__": "x"}')] }
  ];
  for (const payload of bad) assert.ok(validateWordMerge(payload), JSON.stringify(payload).slice(0, 80));
});

test('buildWordMergeJob lines values up with the macros and turns newlines into Word line breaks', () => {
  const spec = WORD_TEMPLATES.bsdesc;
  const job = buildWordMergeJob(spec, {
    templatePath: 'C:\\W3000\\comm\\wbase001.DOC',
    workPath: 'w.doc',
    outputPath: 'o.docx',
    paragraphs: ['第一條', '第二條\r\n第二行', 'a\x07b'],
    copies: [{ NAME: '甲\n乙', RPDATE: '一一五 年 一 月 一 日 ' }, {}]
  });
  assert.equal(job.macros[0], '[THINGS]');
  assert.equal(job.macros.length, spec.macros.length + 1);
  assert.equal(job.copies.length, 2);
  assert.equal(job.copies[0][0], '第一條\r第二條\v第二行\rab');
  assert.equal(job.copies[0][job.macros.indexOf('[NAME]')], '甲\v乙');
  assert.equal(job.copies[0][job.macros.indexOf('[RPDATE]')], '一一五 年 一 月 一 日 ');
  assert.equal(job.copies[0][job.macros.indexOf('[TEL]')], '');
  assert.deepEqual(job.copies[1].slice(1), spec.macros.map(() => ''));
  assert.equal(job.open, true);
  assert.equal(toWordText(null), '');
});

test('Word scripts are fixed text that only read their input from environment variables', () => {
  for (const script of [WORD_MERGE_SCRIPT, OFFICE_OPEN_SCRIPT]) {
    assert.ok(!script.includes('${'), 'no JS interpolation left in the script');
    assert.ok(script.includes('$env:WX3000_OFFICE_RESULT'));
  }
  assert.ok(WORD_MERGE_SCRIPT.includes('$env:WX3000_OFFICE_JOB'));
  assert.ok(WORD_MERGE_SCRIPT.includes('AutomationSecurity = 3'), 'template macros must not run');
  assert.ok(!/Replacement\.Text/.test(WORD_MERGE_SCRIPT), 'Replacement.Text is limited to 255 chars and expands ^ codes');
  assert.ok(OFFICE_OPEN_SCRIPT.includes('Start-Process -FilePath $env:WX3000_OFFICE_FILE'));
});

test('Word endpoints validate before starting PowerShell', async () => {
  assert.equal((await openWordTemplate({ template: 'bsdesc', drive: '..' })).errorType, 'INVALID_REQUEST');
  assert.equal((await mergeWordTemplate({ template: 'bsdesc', drive: 'C', paragraphs: [], copies: [{ EVIL: 'x' }] })).errorType, 'INVALID_REQUEST');
  // 路徑合法但範本不存在時回 NOT_FOUND，也不啟動 PowerShell
  if (!fs.existsSync('Q:\\W3000\\comm\\wbase001.DOC')) {
    assert.equal((await openWordTemplate({ template: 'bsdesc', drive: 'Q' })).errorType, 'NOT_FOUND');
    assert.equal((await mergeWordTemplate({ template: 'bsdesc', drive: 'Q', paragraphs: [], copies: [{}] })).errorType, 'NOT_FOUND');
  }
});

test('HTTP surface', async (t) => {
  const server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();

  const send = (method, path, headers, chunks = []) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const parts = [];
      res.on('data', (d) => parts.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts).toString('utf8') }));
    });
    req.on('error', reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });

  await t.test('preflight from an allowed origin is reflected', async () => {
    const res = await send('OPTIONS', '/api/call', { Origin: 'http://192.168.1.10:5007', 'Access-Control-Request-Headers': 'content-type' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://192.168.1.10:5007');
  });

  await t.test('preflight from a web page gets no CORS grant', async () => {
    const res = await send('OPTIONS', '/api/call', { Origin: 'https://evil.example.com' });
    assert.equal(res.status, 403);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  await t.test('custbak endpoints are for the backend only and validate input', async () => {
    const body = JSON.stringify({ dbfPath: 'comm', keys: ['A001'], targetFile: 'x.dbf' });
    assert.equal((await send('POST', '/api/dbf/export_custbak', { Origin: 'http://localhost:5173' }, [body])).status, 403);
    assert.equal((await send('POST', '/api/dbf/import_custbak', { 'Sec-Fetch-Site': 'cross-site' }, [body])).status, 403);
    const res = await send('POST', '/api/dbf/export_custbak', {}, [body]);
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).errorType, 'INVALID_REQUEST');
  });

  await t.test('raw bridge endpoints no longer exist', async () => {
    const body = JSON.stringify({ action: 'EXEC_VFP', script: 'RETURN 1' });
    assert.equal((await send('POST', '/api/dbf/call', {}, [body])).status, 404);
    assert.equal((await send('POST', '/api/dbf/exec_vfp', {}, [body])).status, 404);
  });

  await t.test('Word status is readable from the frontend and from Electron file:// pages', async () => {
    for (const headers of [{ Origin: 'http://192.168.1.10:5007' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
      const res = await send('GET', '/api/office/status', headers);
      assert.equal(res.status, 200);
      assert.equal(typeof JSON.parse(res.body).word, 'boolean');
    }
    assert.equal((await send('GET', '/api/office/status', { Origin: 'https://evil.example.com' })).status, 403);
  });

  await t.test('Word open / merge refuse other sites and bad input', async () => {
    const body = JSON.stringify({ template: 'bsdesc', drive: 'C', paragraphs: [], copies: [{ EVIL: 'x' }] });
    assert.equal((await send('POST', '/api/office/word/merge', { Origin: 'https://evil.example.com' }, [body])).status, 403);
    const res = await send('POST', '/api/office/word/merge', { Origin: 'http://localhost:5173' }, [body]);
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).errorType, 'INVALID_REQUEST');
    const open = await send('POST', '/api/office/word/open', { Origin: 'http://localhost:5173' }, [JSON.stringify({ template: 'bsdesc', drive: 'C:\\Windows' })]);
    assert.equal(JSON.parse(open.body).errorType, 'INVALID_REQUEST');
    assert.equal((await send('POST', '/api/office/word/open', { Origin: 'http://localhost:5173' }, ['{bad'])).status, 400);
  });

  await t.test('request bodies split inside a character stay intact', async () => {
    const bytes = Buffer.from(JSON.stringify({ dll: 'wbaseRP', func: '統一編號' }), 'utf8');
    const cut = bytes.indexOf(Buffer.from('統', 'utf8')) + 1;
    const res = await send('POST', '/api/call', { 'Transfer-Encoding': 'chunked' }, [bytes.subarray(0, cut), bytes.subarray(cut)]);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.errorType, 'FORBIDDEN');
    assert.ok(parsed.error.includes('統一編號'), parsed.error);
  });

  await t.test('printers and direct print enforce origin rules and validate payloads', async () => {
    assert.equal((await send('GET', '/api/printers', { Origin: 'https://evil.example.com' })).status, 403);
    assert.equal((await send('POST', '/api/print/direct', { Origin: 'https://evil.example.com' }, ['{}'])).status, 403);
    const badJson = await send('POST', '/api/print/direct', { Origin: 'http://localhost:5173' }, ['{bad']);
    assert.equal(badJson.status, 400);
    const emptyPages = await send('POST', '/api/print/direct', { Origin: 'http://localhost:5173' }, [JSON.stringify({ pages: [] })]);
    assert.equal(emptyPages.status, 400);
    assert.equal(JSON.parse(emptyPages.body).errorType, 'INVALID_REQUEST');
  });
});
