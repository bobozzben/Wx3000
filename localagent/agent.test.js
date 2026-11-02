const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const {
  collectUtf8,
  isAllowedDllCall,
  genericCall,
  validateDbfWrite,
  executeDbfWrite,
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
