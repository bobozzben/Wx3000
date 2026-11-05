// 直接讀取 DBF 檔 (不經 LocalAgent / VFP)，壓力測試用來核對 DBF 的實際內容。
// 只解析驗證需要的欄位型別：C、N、F、D、I、Y、L、B；備註、通用、日期時間欄位回傳 null。
import { readFileSync } from 'node:fs';

const big5 = new TextDecoder('big5');

function decodeField(buf, offset, field) {
  const raw = buf.subarray(offset, offset + field.len);
  switch (field.type) {
    case 'C':
      return big5.decode(raw).replace(/[\s\0]+$/, '');
    case 'N':
    case 'F': {
      const s = raw.toString('latin1').trim();
      if (s === '' || /^\*+$/.test(s)) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case 'D': {
      const s = raw.toString('latin1').trim();
      return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';
    }
    case 'I':
      return raw.readInt32LE(0);
    case 'Y':
      return Number(raw.readBigInt64LE(0)) / 10000;
    case 'B':
      return raw.readDoubleLE(0);
    case 'L':
      return /^[TtYy]$/.test(raw.toString('latin1'));
    default:
      return null;
  }
}

/**
 * 讀取整個 DBF，回傳欄位定義與所有記錄 (含已刪除記錄，以 _deleted 標示；_recno 為實體 RECNO)。
 * options.fields 可只解碼指定的欄位 (小寫欄位名)：大檔只需核對少數欄位時快很多。
 */
export function readDbf(filePath, options = {}) {
  const buf = readFileSync(filePath);
  const count = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);

  const fields = [];
  let off = 32;
  let pos = 1; // 第 0 個位元組是刪除旗標
  while (off + 32 <= headerLen && buf[off] !== 0x0d) {
    const name = buf.toString('latin1', off, off + 11).replace(/\0[\s\S]*$/, '').toLowerCase();
    const type = String.fromCharCode(buf[off + 11]);
    const len = buf[off + 16];
    fields.push({ name, type, len, pos });
    pos += len;
    off += 32;
  }

  const wanted = options.fields ? new Set(options.fields.map((n) => n.toLowerCase())) : null;
  const decoded = wanted ? fields.filter((f) => wanted.has(f.name)) : fields;

  const rows = [];
  for (let i = 0; i < count; i++) {
    const base = headerLen + i * recLen;
    if (base + recLen > buf.length) break;
    const row = { _recno: i + 1, _deleted: buf[base] === 0x2a };
    for (const f of decoded) row[f.name] = decodeField(buf, base + f.pos, f);
    rows.push(row);
  }
  return { fields, rows };
}

/** 只回傳未刪除的記錄 (等同 VFP SET DELETED ON)。 */
export function readActiveRows(filePath, options = {}) {
  return readDbf(filePath, options).rows.filter((r) => !r._deleted);
}
