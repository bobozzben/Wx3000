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
  toVfpLiteral,
  executeDbfWrite,
  validateCustbakRequest,
  buildCustbakExportScript,
  buildCustbakImportScript,
  parseCustbakResult,
  executeCustbakExport,
  executeCustbakImport,
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
  for (const func of ['wbase1050_taxno_list', 'wbase1060_recitem_list', 'wbase1070_recnote_list', 'wbase1080_feesummary_list', 'wbase3010_ticketplace_list']) {
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
  for (const key of ['no', 'accno', 'seq', 'serial', 'itemno', 'noteno', 'mno', 'RECNO()', 'STR(RECNO())', 'yymm,times,no', 'ALLTRIM(no)']) {
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

  await t.test('request bodies split inside a character stay intact', async () => {
    const bytes = Buffer.from(JSON.stringify({ dll: 'wbaseRP', func: '統一編號' }), 'utf8');
    const cut = bytes.indexOf(Buffer.from('統', 'utf8')) + 1;
    const res = await send('POST', '/api/call', { 'Transfer-Encoding': 'chunked' }, [bytes.subarray(0, cut), bytes.subarray(cut)]);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.errorType, 'FORBIDDEN');
    assert.ok(parsed.error.includes('統一編號'), parsed.error);
  });
});
