const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

console.log('Level 2: Obfuscating (preserve require/ws for pkg)...');

const code = fs.readFileSync('agent.js', 'utf8');
const result = JavaScriptObfuscator.obfuscate(code, {
  //transformObjectKeys: false,
  compact: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.5,      // 不能太高
  stringArrayCallsTransform: true,
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  shuffleStringArray: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  unicodeEscapeSequence: false,
  // 下面這 4 個是關鍵，pkg 必備
  // 關鍵：保留這些字串不要混淆，否則 pkg 找不到模組
  reservedNames: ['^require$', '^ws$', '^fs$', '^path$', '^os$', '^http$', '^child_process$', '^WebSocketServer$'],
  reservedStrings: ['ws', 'fs', 'path', 'os', 'http', 'child_process', './test.html', 'test.html']

  // 這幾個絕對不能開，開了就崩
  // selfDefending: false
  // controlFlowFlattening: false  
  // deadCodeInjection: false
  // splitStrings: false

});

let obfCode = result.getObfuscatedCode();

// 保險：把被混淆掉的 require('ws') 強制換回來
obfCode = obfCode.replace(/require\s*\(\s*['"]ws['"]\s*\)/g, "require('ws')");
// 如果還是被編碼成 _0x...('xxx') 形式，我們在最前面強制再 require 一次，讓 pkg 掃描到
const header = "// pkg force include\nrequire('ws');\nrequire('fs');\nrequire('path');\nrequire('os');\nrequire('http');\nrequire('child_process');\n";
obfCode = header + obfCode;

fs.writeFileSync('agent.obf.js', obfCode);
console.log('OK agent.obf.js', fs.statSync('agent.obf.js').size);

// 用這個檔 package.obf.json 打包成執行檔,執行會跳出來,這個看似沒作用
fs.writeFileSync('package.obf.json', JSON.stringify({
  name: 'Wx3000-obf',
  main: 'agent.obf.js',
  bin: 'agent.obf.js',
  pkg: {
    assets: ['test.html', 'node_modules/ws/**/*'],
    targets: ['node18-win-x64'],
    outputPath: 'dist'
  },
  dependencies: { ws: '^8.16.0' }
}, null, 2));

console.log('Done. Now pkg will include ws');
