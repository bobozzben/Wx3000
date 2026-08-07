
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const WS_PORT = 18888;
const HTTP_PORT = 18889;

console.log('========================================');
console.log('  Rx3000 LocalAgent v18.1 - Service Fixed');
console.log('========================================');

function getPowerShellExe() {
  const p32 = 'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe';
  if (fs.existsSync(p32)) return p32;
  return 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
}

function callTsdll2(dllPath, hs) {
  return new Promise((resolve, reject) => {
    dllPath = dllPath.replace(/\//g, '\\');
    const psExe = getPowerShellExe();
    const safeDllPath = dllPath.replace(/'/g, "''");
    const safeHs = String(hs);

    const psFinal = `
$ErrorActionPreference='Stop'
$dllPath = '${safeDllPath}'
$hs = ${safeHs}
if (-not (Test-Path $dllPath)) { Write-Output "ERR_DLL_NOT_FOUND:$dllPath"; exit 1 }
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class TsDll2 {
  [DllImport(@"MYDLL", CharSet=CharSet.Ansi, CallingConvention=CallingConvention.StdCall)]
  public static extern IntPtr GetALLLocalIPMAC(double hs_chk, StringBuilder cstring);
}
'@
$code = $code.Replace('MYDLL', $dllPath)
Add-Type -TypeDefinition $code
$sb = New-Object System.Text.StringBuilder 500
[void]$sb.Append(' ' * 250)
$ptr = [TsDll2]::GetALLLocalIPMAC($hs, $sb)
$result = [Runtime.InteropServices.Marshal]::PtrToStringAnsi($ptr)
if ([string]::IsNullOrEmpty($result)) { $result = $sb.ToString() }
$clean = $result.Replace("-","").Trim()
Write-Output $clean
`.replace('${safeDllPath}', safeDllPath).replace('${safeHs}', safeHs);

    const tmpPs = path.join(os.tmpdir(), 'rx_mac_' + Date.now() + '.ps1');
    fs.writeFileSync(tmpPs, psFinal, 'utf8');

    exec(`"${psExe}" -ExecutionPolicy Bypass -File "${tmpPs}"`, { maxBuffer: 2*1024*1024 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpPs); } catch(e){}
      if (err) reject((stderr || stdout || err.message).trim());
      else {
        const clean = stdout.trim();
        if (clean.startsWith('ERR_')) reject(clean);
        else resolve(clean);
      }
    });
  });
}

const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'v18.1 fixed', arch: getPowerShellExe() }));
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.action === 'CALL_DLL_TSDLL2' || msg.action === 'GET_MAC') {
        try {
          const result = await callTsdll2(msg.dllPath || 'F:\\W3000\\Dll\\tsdll2.dll', msg.hs_chk || 0.125);
          const macs = result.split(',').map(s=>s.trim()).filter(Boolean);
          ws.send(JSON.stringify({ type: 'success', macs, raw: result, message: `RESULT:${result}` }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: String(e) }));
        }
      }
    } catch(e){ ws.send(JSON.stringify({ type: 'error', message: e.message })); }
  });
});

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.url.startsWith('/mac')) {
    try {
      const dllPath = 'F:\\W3000\\Dll\\tsdll2.dll';
      const raw = await callTsdll2(dllPath, 0.125);
      const macs = raw.split(',').map(s=>s.trim()).filter(Boolean);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, macs, raw, timestamp: new Date().toISOString(), psArch: getPowerShellExe() }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: String(e) }));
    }
    return;
  }
  if (req.url === '/' || req.url.startsWith('/test')) {
    const testPath = path.join(__dirname, 'test.html');
    if (fs.existsSync(testPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(testPath, 'utf8'));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Rx3000 Agent v18.1 Running</h1><p>API http://localhost:'+HTTP_PORT+'/mac</p>');
    }
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(HTTP_PORT, () => {
  console.log(`WS   ws://localhost:${WS_PORT}`);
  console.log(`HTTP http://localhost:${HTTP_PORT}/mac`);
  console.log(`PS   ${getPowerShellExe()}`);
});
