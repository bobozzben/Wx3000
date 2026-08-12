const { WebSocketServer } = require('ws');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const WS_PORT = 18888;
const HTTP_PORT = 18889;

console.log('========================================');
console.log('  Wx3000 LocalAgent v19.3 - Bitness Fixed');
console.log('========================================');

function getPowerShellExe(bitness = 64) {
  if (bitness === 32) {
    const p32 = 'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe';
    if (fs.existsSync(p32)) return p32;
  }
  const p64 = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  if (fs.existsSync(p64)) return p64;
  return 'powershell.exe';
}

function callTsdll2(dllPath, hs) {
  return new Promise((resolve, reject) => {
    dllPath = dllPath.replace(/\//g, '\\');
    const psExe = getPowerShellExe(32); // tsdll2.dll is 32-bit (x86)
    const safeDllPath = dllPath.replace(/'/g, "''");
    const safeHs = String(hs);

    const psFinal = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
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
`;

    const tmpPs = path.join(os.tmpdir(), 'rx_mac_' + Date.now() + '.ps1');
    fs.writeFileSync(tmpPs, '\uFEFF' + psFinal, 'utf8'); // UTF-8 BOM to preserve Chinese and allow debugging

    console.log('[DEBUG] Retained PS script:', tmpPs);

    exec(`"${psExe}" -ExecutionPolicy Bypass -File "${tmpPs}"`, { maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
      // Retain temporary PS script file for debugging as requested by user
      if (err) reject((stderr || stdout || err.message).trim());
      else {
        const clean = stdout.trim();
        if (clean.startsWith('ERR_')) reject(clean);
        else resolve({ result: clean, psPath: tmpPs });
      }
    });
  });
}

/**
 * Call waccrep3101_b in wbaseRP.dll (64-bit DLL)
 * Signature: Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const path: ansistring): integer; stdcall;
 */
function callWbaseRP(dllPath, params = {}) {
  return new Promise((resolve, reject) => {
    dllPath = (dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll').replace(/\//g, '\\');
    const psExe = getPowerShellExe(64); // wbaseRP.dll is 64-bit (x64)
    const safeDllPath = dllPath.replace(/'/g, "''");

    const hs_chk = params.hs_chk !== undefined ? Number(params.hs_chk) : 0.125;
    const top_mag = params.top_mag !== undefined ? Number(params.top_mag) : 0.0;
    const left_mag = params.left_mag !== undefined ? Number(params.left_mag) : 0.0;
    const PrtIndex = params.PrtIndex !== undefined ? Number(params.PrtIndex) : 0;
    const IsPrint = params.IsPrint !== undefined ? Number(params.IsPrint) : 0;
    const pathVal = String(params.path || '').replace(/'/g, "''").replace(/\//g, '\\');

    const psFinal = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference='Stop'
$dllPath = '${safeDllPath}'
if (-not (Test-Path $dllPath)) { Write-Output "ERR_DLL_NOT_FOUND:$dllPath"; exit 1 }
$code = @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

public class WbaseRP {
  [DllImport(@"MYDLL", CharSet=CharSet.Ansi, CallingConvention=CallingConvention.StdCall)]
  public static extern int waccrep3101_b(
    double hs_chk,
    double top_mag,
    double left_mag,
    int PrtIndex,
    int IsPrint,
    [MarshalAs(UnmanagedType.LPStr)] string path
  );

  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

  public static void FocusWindow() {
    try {
      AllowSetForegroundWindow(-1);
      int pid = Process.GetCurrentProcess().Id;
      Task.Run(async () => {
        for (int i = 0; i < 50; i++) {
          await Task.Delay(100);
          IntPtr targetHWnd = IntPtr.Zero;
          EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
              uint wPid = 0;
              GetWindowThreadProcessId(hWnd, out wPid);
              if (wPid == pid) {
                targetHWnd = hWnd;
                return false;
              }
            }
            return true;
          }, IntPtr.Zero);

          if (targetHWnd != IntPtr.Zero) {
            ShowWindow(targetHWnd, 9); // SW_RESTORE
            SetWindowPos(targetHWnd, (IntPtr)(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040); // HWND_TOPMOST
            SetForegroundWindow(targetHWnd);
            SetWindowPos(targetHWnd, (IntPtr)(-2), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040); // HWND_NOTOPMOST
            break;
          }
        }
      });
    } catch {}
  }
}
'@
$code = $code.Replace('MYDLL', $dllPath)
Add-Type -TypeDefinition $code
[WbaseRP]::FocusWindow()
$result = [WbaseRP]::waccrep3101_b(${hs_chk}, ${top_mag}, ${left_mag}, ${PrtIndex}, ${IsPrint}, '${pathVal}')
Write-Output "RET:$result"
`;

    const tmpPs = path.join(os.tmpdir(), 'wx_report_' + Date.now() + '.ps1');
    fs.writeFileSync(tmpPs, '\uFEFF' + psFinal, 'utf8'); // UTF-8 BOM to preserve Chinese and allow debugging

    console.log('[DEBUG] Retained PS script:', tmpPs);

    exec(`"${psExe}" -ExecutionPolicy Bypass -File "${tmpPs}"`, { maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
      // Retain temporary PS script file for debugging as requested by user
      if (err) reject((stderr || stdout || err.message).trim());
      else {
        const clean = stdout.trim();
        if (clean.startsWith('ERR_')) reject(clean);
        else resolve({ result: clean, psPath: tmpPs });
      }
    });
  });
}

const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'v19.3 ready', arch: getPowerShellExe(64) }));
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);

      // Handle tsdll2.dll MAC address check (32-bit)
      if (msg.action === 'CALL_DLL_TSDLL2' || msg.action === 'GET_MAC') {
        try {
          const resObj = await callTsdll2(msg.dllPath || 'F:\\W3000\\Dll\\tsdll2.dll', msg.hs_chk || 0.125);
          const macs = resObj.result.split(',').map(s => s.trim()).filter(Boolean);
          ws.send(JSON.stringify({ type: 'success', macs, raw: resObj.result, psPath: resObj.psPath, message: `RESULT:${resObj.result}` }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: String(e) }));
        }
        return;
      }

      // Handle wbaseRP.dll Report generation (waccrep3101_b) (64-bit)
      if (msg.action === 'CALL_WBASE_RP' || msg.action === 'CALL_WACCREP3101_B') {
        try {
          const dllPath = msg.dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll';
          const resObj = await callWbaseRP(dllPath, msg);
          const retCode = resObj.result.replace(/^RET:/, '').trim();
          ws.send(JSON.stringify({ type: 'success', result: retCode, raw: resObj.result, psPath: resObj.psPath, message: `RESULT:${retCode}` }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: String(e) }));
        }
        return;
      }

    } catch (e) { ws.send(JSON.stringify({ type: 'error', message: e.message })); }
  });
});

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // HTTP endpoint for GET_MAC (32-bit)
  if (req.url.startsWith('/mac')) {
    try {
      const dllPath = 'F:\\W3000\\Dll\\tsdll2.dll';
      const resObj = await callTsdll2(dllPath, 0.125);
      const macs = resObj.result.split(',').map(s => s.trim()).filter(Boolean);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, macs, raw: resObj.result, psPath: resObj.psPath, timestamp: new Date().toISOString(), psArch: getPowerShellExe(32) }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: String(e) }));
    }
    return;
  }

  // HTTP endpoint for wbaseRP.dll report call (waccrep3101_b) (64-bit)
  if (req.url.startsWith('/report') || req.url.startsWith('/waccrep3101_b')) {
    try {
      let params = {};
      if (req.method === 'POST') {
        const bodyText = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        try { params = JSON.parse(bodyText); } catch (e) { }
      } else {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        for (const [k, v] of parsedUrl.searchParams.entries()) {
          params[k] = v;
        }
      }
      const dllPath = params.dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll';
      const resObj = await callWbaseRP(dllPath, params);
      const retCode = resObj.result.replace(/^RET:/, '').trim();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, result: retCode, raw: resObj.result, psPath: resObj.psPath, timestamp: new Date().toISOString(), psArch: getPowerShellExe(64) }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
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
      res.end('<h1>Wx3000 Agent v19.3 Running</h1><p>API http://localhost:' + HTTP_PORT + '/mac</p>');
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(HTTP_PORT, () => {
  console.log(`WS   ws://localhost:${WS_PORT}`);
  console.log(`HTTP http://localhost:${HTTP_PORT}/mac`);
  console.log(`HTTP http://localhost:${HTTP_PORT}/report`);
  console.log(`PS64 ${getPowerShellExe(64)}`);
  console.log(`PS32 ${getPowerShellExe(32)}`);
});
