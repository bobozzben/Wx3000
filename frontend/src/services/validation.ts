/**
 * 電子郵件與通用欄位格式驗證工具 (對齊 FoxPro / Lazarus wbase120.pas 與 util_w3000valid.pas)
 */

/**
 * 檢查電子郵件格式
 * @param email 待檢驗的字串
 * @returns boolean: 空值或未輸入視為 true（選填欄位），若有輸入則需符合基本 email 格式
 */
export const isValidEmail = (email?: string | null): boolean => {
  if (!email || !email.trim()) return true;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

/**
 * 電子郵件非阻斷性提示文字
 */
export const EMAIL_WARNING_TEXT = '電子郵件格式可能不正確（範例: user@example.com）';
export const EMAIL_SAVE_WARNING_TOAST = '已成功儲存！(⚠️ 提示：電子郵件格式非標準，已照常存檔)';

/**
 * 台灣身分證字號與居留證代碼對照表 (STRA: 'ABCDEFGHJKLMNPQRSTUVXYWZIO')
 */
const ID_LETTER_CODES: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17,
  J: 18, K: 19, L: 20, M: 21, N: 22, P: 23, Q: 24, R: 25,
  S: 26, T: 27, U: 28, V: 29, X: 30, Y: 31, W: 32, Z: 33,
  I: 34, O: 35,
};

/**
 * 台灣身分證字號 / 2021 新式外來人口統一證號檢查 (IsTwNationalId)
 * 格式 [A-Z] + 性別碼 [1, 2, 8, 9] + 8 數字 (共 10 碼)
 */
export const isTwNationalId = (id?: string | null): boolean => {
  if (!id) return false;
  const s = id.trim().toUpperCase();
  if (s.length !== 10) return false;
  if (!/^[A-Z][1289]\d{8}$/.test(s)) return false;

  const letterVal = ID_LETTER_CODES[s[0]];
  if (!letterVal) return false;

  const tens = Math.floor(letterVal / 10);
  const units = letterVal % 10;
  let sum = tens * 1 + units * 9;

  // 後續 8 個數字 (index 1..8)，權重 8..1
  for (let i = 1; i <= 8; i++) {
    sum += (9 - i) * parseInt(s[i], 10);
  }
  // 檢查碼 (index 9) * 1
  sum += parseInt(s[9], 10);

  return sum % 10 === 0;
};

/**
 * 舊式外來人口統一證號 (IsTwOldResidentId, 2021 前)
 * 格式: 2 字母 + 8 數字 (共 10 碼), 第 2 碼為 A~D
 */
export const isTwOldResidentId = (id?: string | null): boolean => {
  if (!id) return false;
  const s = id.trim().toUpperCase();
  if (s.length !== 10) return false;
  if (!/^[A-Z][A-D]\d{8}$/.test(s)) return false;

  const letterVal1 = ID_LETTER_CODES[s[0]];
  const letterVal2 = ID_LETTER_CODES[s[1]];
  if (!letterVal1 || !letterVal2) return false;

  const tens1 = Math.floor(letterVal1 / 10);
  const units1 = letterVal1 % 10;
  let sum = tens1 * 1 + units1 * 9;

  // 第 2 字母: 對照數個位 * 8
  sum += (letterVal2 % 10) * 8;

  // 後 7 碼數字 (index 2..8)，權重 7..1
  for (let i = 2; i <= 8; i++) {
    sum += (10 - (i + 1)) * parseInt(s[i], 10);
  }
  // 檢查碼 (index 9) * 1
  sum += parseInt(s[9], 10);

  return sum % 10 === 0;
};

/**
 * 台灣統一編號 8 位檢查碼驗證 (IsTwBusinessId, 加權 [1,2,1,2,1,2,4,1])
 * 相容 2023 新制與舊制 (第 7 碼為 7 時和或和+1 為 5 的倍數)
 */
export const isTwBusinessId = (id?: string | null): boolean => {
  if (!id) return false;
  const s = id.trim();
  if (s.length !== 8 || !/^\d{8}$/.test(s)) return false;

  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const prod = parseInt(s[i], 10) * weights[i];
    sum += Math.floor(prod / 10) + (prod % 10);
  }

  // 第 7 碼 (index 6) 為 '7' 時，和或和+1 為 5 的倍數皆可
  if (s[6] === '7') {
    return sum % 5 === 0 || (sum + 1) % 5 === 0;
  }
  return sum % 5 === 0;
};

/**
 * VFP 原文提示訊息 (w3000func.prg chkid, 對齊 util_w3000valid.pas)
 */
export const MSG_BAD_UNINO = ' 統一編號輸入錯誤 。';
export const MSG_BAD_ID = '身份證編號,可能錯誤...';

/**
 * 證書別檢查 (空白:會計師, 2:記帳士, 3:報稅代理人)
 */
export const checkCertType = (certType?: string | null): { valid: boolean; message: string } => {
  if (!certType) return { valid: true, message: '' };
  const t = certType.trim();
  if (t === '' || t === '1' || t === '2' || t === '3') {
    return { valid: true, message: '' };
  }
  return {
    valid: false,
    message: '證書別僅允許 空白(會計師)、2(記帳士)、3(報稅代理人)',
  };
};

/**
 * 申報ID / 身分證欄提示性檢查 (對齊 ChkIdWarnMsg)
 * - 空白放行
 * - 8 碼走統一編號檢查
 * - 10 碼走身分證或新/舊式居留證檢查
 * - 長度非 8 碼且非 10 碼視為錯誤
 * - 回傳錯誤提示訊息（若合法則回傳空字串）
 */
export const checkTaxId = (id?: string | null): { valid: boolean; message: string } => {
  if (!id) return { valid: true, message: '' };
  const s = id.trim().toUpperCase();
  if (s === '') return { valid: true, message: '' };

  if (s.length !== 8 && s.length !== 10) {
    return {
      valid: false,
      message: '申報ID長度需為8碼(統編)或10碼(身分證/居留證)',
    };
  }

  if (s.length === 8) {
    if (!isTwBusinessId(s)) {
      return { valid: false, message: MSG_BAD_UNINO };
    }
    return { valid: true, message: '' };
  }

  if (s.length === 10) {
    if (isTwNationalId(s) || isTwOldResidentId(s)) {
      return { valid: true, message: '' };
    }
    return { valid: false, message: MSG_BAD_ID };
  }

  return { valid: false, message: MSG_BAD_ID };
};

/**
 * 統一編號欄提示性檢查 (對齊 UninoWarnMsg)
 * - 空白放行
 * - 輸入時必須剛好為 8 碼數字且符合加權檢核
 */
export const checkUnifiedNo = (unino?: string | null): { valid: boolean; message: string } => {
  if (!unino) return { valid: true, message: '' };
  const s = unino.trim();
  if (s === '') return { valid: true, message: '' };

  if (s.length !== 8 || !/^\d{8}$/.test(s)) {
    return { valid: false, message: '統一編號格式需為8位數字' };
  }

  if (!isTwBusinessId(s)) {
    return { valid: false, message: MSG_BAD_UNINO };
  }
  return { valid: true, message: '' };
};

/**
 * 計算字串的 Big5 位元組長度 (ASCII 1 byte，中文字/全形 2 bytes)
 */
export const getBig5ByteLength = (str?: string | null): number => {
  if (!str) return 0;
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // ASCII (0x00 ~ 0x7F)
    len += code <= 127 ? 1 : 2;
  }
  return len;
};

/**
 * 截斷字串以符合 Big5 位元組長度上限 (不切半個中文字)
 */
export const truncateBig5 = (str: string, maxBytes: number): string => {
  if (!str || maxBytes <= 0) return '';
  let curBytes = 0;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    const bLen = code <= 127 ? 1 : 2;
    if (curBytes + bLen > maxBytes) break;
    curBytes += bLen;
    result += ch;
  }
  return result;
};

/**
 * Big5 可存性哨兵檢查 (對齊 wbase120.pas MyOnSetText Big5 哨兵)
 * 偵測是否含有 Emoji 或非 BMP 字元等無法存入 DBF 的特殊 Unicode
 */
export const checkBig5Compatible = (
  str?: string | null
): { valid: boolean; message: string; invalidChars: string[] } => {
  if (!str) return { valid: true, message: '', invalidChars: [] };
  const invalidChars: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 檢查 surrogate pairs (Emoji 或罕見擴展字)
    if (code >= 0xd800 && code <= 0xdfff) {
      invalidChars.push(str.slice(i, i + 2));
      i++; // 跳過 low surrogate
    }
  }

  if (invalidChars.length > 0) {
    return {
      valid: false,
      message: '內容含 Big5 無法儲存的字元(罕字/Emoji等)，請改用相容字！',
      invalidChars,
    };
  }

  return { valid: true, message: '', invalidChars: [] };
};

/**
 * 依證書別 (kind) 取得建議的發文字軌選項 (對齊 wbase120.pas SelectCword)
 * kind '2' (記帳士): 證、證換
 * kind '3' (報稅代理人): 財北、財高、北區、中區、南區
 */
export const DOC_TRACK_SUGGESTIONS: Record<string, string[]> = {
  '2': ['證', '證換'],
  '3': ['財北', '財高', '北區', '中區', '南區'],
};

/**
 * 計算下一個自動編號 (對齊 wbase120.pas NextAutoNo)
 * 提取現有最大號尾部數字遞增，前綴保留並自動補零
 */
export const getNextAutoNo = (existingCodes: string[]): string => {
  if (!existingCodes || existingCodes.length === 0) return '01';

  // 排序找出最大的代號
  const sorted = [...existingCodes]
    .map((c) => (c || '').trim().toUpperCase())
    .filter((c) => c !== '')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (sorted.length === 0) return '01';

  const maxCode = sorted[sorted.length - 1];

  // 尋找尾部數字碼
  const match = maxCode.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const digitsStr = match[2];
    const nextNum = parseInt(digitsStr, 10) + 1;
    const padded = String(nextNum).padStart(digitsStr.length, '0');
    return prefix + padded;
  }

  // 退路: 純數字代號 max + 1
  const numericCodes = existingCodes
    .map((c) => parseInt((c || '').trim(), 10))
    .filter((n) => !isNaN(n));

  if (numericCodes.length > 0) {
    const maxNum = Math.max(...numericCodes);
    const nextNum = maxNum + 1;
    return nextNum <= 99 ? String(nextNum).padStart(2, '0') : String(nextNum);
  }

  return '01';
};
