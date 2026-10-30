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
 * 台灣身分證 / 居留證提示性檢查 (10 碼)
 * - 空白放行
 * - 輸入時必須為 10 碼且符合身分證或新/舊式居留證加權檢核
 */
export const checkNationalId = (id?: string | null): { valid: boolean; message: string } => {
  if (!id) return { valid: true, message: '' };
  const s = id.trim().toUpperCase();
  if (s === '') return { valid: true, message: '' };

  if (s.length !== 10) {
    return { valid: false, message: '身分證字號長度需為10碼' };
  }

  if (isTwNationalId(s) || isTwOldResidentId(s)) {
    return { valid: true, message: '' };
  }
  return { valid: false, message: MSG_BAD_ID };
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

/**
 * 民國年日期檢查與正規化 (對齊 util_rocdate.pas ROCStringToDate 與 DateToROC9)
 * 支援格式:
 * - 9碼民國字串: '115/10/08' 或 '075/01/01'
 * - 8碼民國字串: '15/10/08' 或 '75/01/01' (epoch 33: 00..33 -> 100..133; 34..99 -> 034..099)
 * - 7碼純數字: '0750101' 或 '1151008'
 * - 6碼純數字: '750101' (補百年為 '075/01/01')
 * - 8碼西元年: '20261008' 或 '2026/10/08' (轉民國 '115/10/08')
 * - 空白或無數字: 視為合法清空
 */
export const checkRocDate = (
  dateStr?: string | null
): { valid: boolean; message: string; normalized?: string } => {
  if (!dateStr || !dateStr.trim()) {
    return { valid: true, message: '', normalized: '' };
  }

  let text = dateStr.trim().replace(/-/g, '/');
  // 空白遮罩視為清空
  if (text === '//' || text === '/  /' || text === '___/__/__' || text === '___/__') {
    return { valid: true, message: '', normalized: '' };
  }

  const digits = text.replace(/\D/g, '');
  if (digits === '') {
    return { valid: true, message: '', normalized: '' };
  }

  let rocYear = 0;
  let month = 0;
  let day = 0;

  if (text.includes('/')) {
    const parts = text.split('/').filter((p) => p.trim() !== '');
    if (parts.length === 3) {
      const yVal = parseInt(parts[0], 10);
      const mVal = parseInt(parts[1], 10);
      const dVal = parseInt(parts[2], 10);

      if (isNaN(yVal) || isNaN(mVal) || isNaN(dVal)) {
        return { valid: false, message: '生日日期格式不正確！需為有效數字' };
      }

      // 西元年判斷 (大於 1911)
      if (yVal > 1911) {
        rocYear = yVal - 1911;
      } else if (parts[0].length <= 2) {
        // 兩碼民國年補百年 (epoch 33)
        rocYear = yVal <= 33 ? 100 + yVal : yVal;
      } else {
        rocYear = yVal;
      }
      month = mVal;
      day = dVal;
    } else {
      return { valid: false, message: '生日格式錯誤！需為 年/月/日 (如 075/01/01)' };
    }
  } else {
    // 純數字字串
    if (digits.length === 6) {
      // 6 碼 YYMMDD
      const yVal = parseInt(digits.slice(0, 2), 10);
      rocYear = yVal <= 33 ? 100 + yVal : yVal;
      month = parseInt(digits.slice(2, 4), 10);
      day = parseInt(digits.slice(4, 6), 10);
    } else if (digits.length === 7) {
      // 7 碼 YYYMMDD
      rocYear = parseInt(digits.slice(0, 3), 10);
      month = parseInt(digits.slice(3, 5), 10);
      day = parseInt(digits.slice(5, 7), 10);
    } else if (digits.length === 8) {
      // 8 碼西元 YYYYMMDD
      const westYear = parseInt(digits.slice(0, 4), 10);
      rocYear = westYear - 1911;
      month = parseInt(digits.slice(4, 6), 10);
      day = parseInt(digits.slice(6, 8), 10);
    } else {
      return {
        valid: false,
        message: '生日長度錯誤！需為 6 碼(750101)、7 碼(0750101) 或 9 碼(075/01/01)',
      };
    }
  }

  // 驗證年份、月份、日期之曆法有效性
  if (rocYear <= 0 || rocYear > 200) {
    return { valid: false, message: `民國年份 (${rocYear}) 不在合理範圍！` };
  }
  if (month < 1 || month > 12) {
    return { valid: false, message: `月份 (${month}) 錯誤！需介於 01 ~ 12 月` };
  }

  // 判斷西元閏年
  const adYear = rocYear + 1911;
  const isLeap = (adYear % 4 === 0 && adYear % 100 !== 0) || adYear % 400 === 0;
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDays = daysInMonth[month] || 31;

  if (day < 1 || day > maxDays) {
    return {
      valid: false,
      message: `日期 (${day}日) 不存在！民國 ${rocYear} 年 ${month} 月僅有 ${maxDays} 天`,
    };
  }

  const normalized = `${String(rocYear).padStart(3, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  return { valid: true, message: '', normalized };
};

/**
 * 簡易取得正規化民國年 9 碼格式 (若格式不合法則原樣傳回)
 */
export const normalizeRocDate = (dateStr?: string | null): string => {
  const check = checkRocDate(dateStr);
  return check.valid && check.normalized !== undefined ? check.normalized : (dateStr || '').trim();
};

/**
 * 純數字手機檢核 (對齊 wbase130.pas FieldDigitOnly 'phone')
 */
export const checkPhoneDigits = (phone?: string | null): { valid: boolean; message: string } => {
  if (!phone || !phone.trim()) return { valid: true, message: '' };
  const s = phone.trim();
  if (!/^\d+$/.test(s)) {
    return { valid: false, message: '電子送達手機僅允許輸入數字 (0~9)！' };
  }
  if (s.length > 10) {
    return { valid: false, message: '電子送達手機長度不可超過 10 碼！' };
  }
  return { valid: true, message: '' };
};

/**
 * SUPERVISOR 保留帳號檢查
 */
export const isSupervisor = (code?: string | null): boolean => {
  return (code || '').trim().toUpperCase() === 'SUPERVISOR';
};

/**
 * ============================================================================
 * w3000 位移式加解密演算法 (對齊 util_w3000crypt.pas 與 wbase130.pas)
 * - psw: 8 bytes, 各 byte 位移 +1..+8 (解密 -1..-8)
 * - onepassno: 15 bytes, 各 byte 位移 i mod 8 (解密 -(i mod 8))
 * ============================================================================
 */

/**
 * 密碼加密 (8 bytes, 對齊 util_w3000crypt.pas W3000_Encrypt)
 * @param plain 明文字串
 * @returns 8 位元組加密密文字串
 */
export const w3000EncryptPsw = (plain?: string | null): string => {
  const p = (plain || '').trim();
  // 最多 8 位元組，不足補空白到 8 碼 (對齊 Copy(ToBig5(aText), 1, 8) + while < 8 do raw += ' ')
  let padded = truncateBig5(p, 8);
  while (getBig5ByteLength(padded) < 8) {
    padded += ' ';
  }

  let result = '';
  for (let i = 1; i <= 8; i++) {
    const code = i <= padded.length ? padded.charCodeAt(i - 1) : 32;
    const enc = (code + i) % 256;
    result += String.fromCharCode(enc);
  }
  return result;
};

/**
 * 密碼解密 (8 bytes, 對齊 util_w3000crypt.pas W3000_Decrypt 與 wbase130.pas MyOnGetText)
 * 支援 16 碼 Hex 字串或 8 位元組原始密文字串 (如 !"#$%&'()
 * @param cipherOrHex 密文字串或 Hex
 * @returns 解密後明文字串 (TrimRight 結尾空白，全空白解密為空字串)
 */
export const w3000DecryptPsw = (cipherOrHex?: string | null): string => {
  if (!cipherOrHex) return '';
  const str = cipherOrHex.trim();
  if (!str) return '';

  let rawBytes = str;
  // 若為 16 碼 16進位字串 (PG hex 存法)
  if (/^[0-9A-Fa-f]{16}$/.test(str)) {
    let converted = '';
    for (let i = 0; i < 16; i += 2) {
      converted += String.fromCharCode(parseInt(str.slice(i, i + 2), 16));
    }
    rawBytes = converted;
  }

  let decrypted = '';
  for (let i = 1; i <= 8; i++) {
    const code = i <= rawBytes.length ? rawBytes.charCodeAt(i - 1) : 0;
    const dec = (code - i + 256) % 256;
    decrypted += String.fromCharCode(dec);
  }

  // TrimRight 去除尾部空白 (對齊 Pascal TrimRight(FromBig5(...)))
  return decrypted.replace(/\s+$/, '');
};

/**
 * 一站式驗證碼加密 (15 bytes, 對齊 util_w3000crypt.pas W3000_Encrypt15)
 * @param plain 明文字串
 * @returns 15 位元組加密密文字串
 */
export const w3000EncryptOnepass = (plain?: string | null): string => {
  const p = (plain || '').trim();
  let padded = truncateBig5(p, 15);
  while (getBig5ByteLength(padded) < 15) {
    padded += ' ';
  }

  let result = '';
  for (let i = 1; i <= 15; i++) {
    const code = i <= padded.length ? padded.charCodeAt(i - 1) : 32;
    const xmei = i % 8;
    const enc = (code + xmei) % 256;
    result += String.fromCharCode(enc);
  }
  return result;
};

/**
 * 一站式驗證碼解密 (15 bytes, 對齊 util_w3000crypt.pas W3000_Decrypt15 與 wbase130.pas MyOnGetText)
 * 支援 30 碼 Hex 字串或 15 位元組原始密文字串
 * @param cipherOrHex 密文字串或 Hex
 * @returns 解密後明文字串 (TrimRight 結尾空白)
 */
export const w3000DecryptOnepass = (cipherOrHex?: string | null): string => {
  if (!cipherOrHex) return '';
  const str = cipherOrHex.trim();
  if (!str) return '';

  let rawBytes = str;
  // 若為 30 碼 16進位字串
  if (/^[0-9A-Fa-f]{30}$/.test(str)) {
    let converted = '';
    for (let i = 0; i < 30; i += 2) {
      converted += String.fromCharCode(parseInt(str.slice(i, i + 2), 16));
    }
    rawBytes = converted;
  }

  let decrypted = '';
  for (let i = 1; i <= 15; i++) {
    const code = i <= rawBytes.length ? rawBytes.charCodeAt(i - 1) : 0;
    const xmei = i % 8;
    const dec = (code - xmei + 256) % 256;
    decrypted += String.fromCharCode(dec);
  }

  return decrypted.replace(/\s+$/, '');
};

/**
 * 密碼欄位規則檢核 (8 bytes, 大寫, Big5 相容)
 */
export const checkPswRule = (psw?: string | null): { valid: boolean; message: string } => {
  if (!psw) return { valid: true, message: '' };
  const val = psw.trim();
  if (getBig5ByteLength(val) > 8) {
    return { valid: false, message: '密碼長度超過上限 (最多 8 位元組)！' };
  }
  const b5 = checkBig5Compatible(val);
  if (!b5.valid) {
    return { valid: false, message: b5.message };
  }
  return { valid: true, message: '' };
};

/**
 * 一站式驗證碼規則檢核 (15 bytes, Big5 相容)
 */
export const checkOnepassRule = (onepass?: string | null): { valid: boolean; message: string } => {
  if (!onepass) return { valid: true, message: '' };
  const val = onepass.trim();
  if (getBig5ByteLength(val) > 15) {
    return { valid: false, message: '一站式驗證碼長度超過上限 (最多 15 位元組)！' };
  }
  const b5 = checkBig5Compatible(val);
  if (!b5.valid) {
    return { valid: false, message: b5.message };
  }
  return { valid: true, message: '' };
};

/**
 * 營業稅稅籍編號檢查 (wbase210.pas: 9 碼，第 1~4 碼為數字，第 5 碼為數字或 F/G/H，第 6~9 碼為數字)
 */
export const checkTaxNo = (taxNo?: string | null): { valid: boolean; message: string } => {
  if (!taxNo) return { valid: true, message: '' };
  const s = taxNo.trim().toUpperCase();
  if (s === '') return { valid: true, message: '' };

  if (s.length !== 9) {
    return { valid: false, message: '稅籍編號可能有誤 (需為9碼，如 1234F5678)' };
  }
  for (let i = 0; i < 9; i++) {
    const ch = s[i];
    if (i === 4) {
      if (!/[\dFGH]/.test(ch)) {
        return { valid: false, message: '稅籍編號可能有誤 (第5碼需為數字或F/G/H)' };
      }
    } else {
      if (!/\d/.test(ch)) {
        return { valid: false, message: '稅籍編號可能有誤 (其餘碼需為數字)' };
      }
    }
  }
  return { valid: true, message: '' };
};

/**
 * 房屋稅籍編號檢查 (wbase210.pas: 12 碼，第 1 碼英文大寫，第 2~3 碼數字，第 4 碼英文或數字，第 5~12 碼數字)
 */
export const checkHouseTaxNo = (house?: string | null): { valid: boolean; message: string } => {
  if (!house) return { valid: true, message: '' };
  const s = house.trim().toUpperCase();
  if (s === '') return { valid: true, message: '' };

  if (s.length !== 12) {
    return { valid: false, message: '房屋稅籍編號可能有誤 (需為12碼)' };
  }
  for (let i = 0; i < 12; i++) {
    const ch = s[i];
    if (i === 0) {
      if (!/[A-Z]/.test(ch)) return { valid: false, message: '房屋稅籍編號可能有誤 (第1碼需為英文字母)' };
    } else if (i === 3) {
      if (!/[A-Z0-9]/.test(ch)) return { valid: false, message: '房屋稅籍編號可能有誤 (第4碼需為英文字母或數字)' };
    } else {
      if (!/\d/.test(ch)) return { valid: false, message: '房屋稅籍編號可能有誤 (需為數字)' };
    }
  }
  return { valid: true, message: '' };
};

/**
 * 電話格式提示性檢查 (wbase210.pas: 輸入非空且不含 '-' 時提示標準格式)
 */
export const checkPhoneFormat = (phone?: string | null): { valid: boolean; message: string } => {
  if (!phone) return { valid: true, message: '' };
  const s = phone.trim();
  if (s === '') return { valid: true, message: '' };
  if (!s.includes('-')) {
    return { valid: false, message: '電話建議格式[區域號碼-電話號碼#分機號碼]，如 02-12345678#123' };
  }
  return { valid: true, message: '' };
};

/**
 * 月日格式檢查 (wbase210.pas Mask: MD。4 碼 MMDD，如記帳起始日 0101、結束日 1231)
 */
export const checkMonthDay = (mdStr?: string | null): { valid: boolean; message: string } => {
  if (!mdStr) return { valid: true, message: '' };
  const s = mdStr.trim();
  if (s === '') return { valid: true, message: '' };

  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length !== 4) {
    return { valid: false, message: '月/日不正確 (例如 01/01 或 0101)' };
  }
  const month = parseInt(digits.slice(0, 2), 10);
  const day = parseInt(digits.slice(2, 4), 10);
  if (month < 1 || month > 12) {
    return { valid: false, message: '月份需介於 01~12' };
  }
  if (day < 1 || day > 31) {
    return { valid: false, message: '日期需介於 01~31' };
  }
  return { valid: true, message: '' };
};

/**
 * 限定輸入值的欄位定義表 (wbase210.pas F210_CHOICES 與 F210_YN)
 */
export interface ChoiceRule {
  allowed: string[];
  label: string;
  msg: string;
}

export const WBASE210_CHOICE_RULES: Record<string, ChoiceRule> = {
  f3_acctType: { allowed: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], label: '會計類別', msg: '會計類別，僅能輸入A~G' },
  f4_monthv: { allowed: ['0', '1'], label: '申報週期', msg: '申報週期請輸入 0 或 1' },
  f4_kind: { allowed: ['0', '1', '2', '3'], label: '申報種類', msg: '申報種類請輸入 0~3' },
  f4_mediatype: { allowed: ['0', '1', '2', '3', '4'], label: '媒體申報(.TXT)', msg: '媒體申報請輸入 0~4' },
  f4_t401: { allowed: ['Y', 'N'], label: '申報書媒體申報(.TET)', msg: '申報書媒體申報請輸入 Y 或 N' },
  f4_tflog: { allowed: ['Y', 'N'], label: '固定資產退稅申報(.T08)', msg: '固定資產退稅申報請輸入 Y 或 N' },
  f4_tzero: { allowed: ['Y', 'N'], label: '零稅率媒體申報(.T02)', msg: '零稅率媒體申報請輸入 Y 或 N' },
  f4_tpay: { allowed: ['0', '1', '2'], label: '彙總註記', msg: '彙總註記請輸入 0~2' },
  f4_datayn: { allowed: ['Y', 'N'], label: '營業稅基本資料轉檔(Y/N)', msg: '請輸入 Y 或 N' },
  f4_pbktype: { allowed: ['1', '2'], label: '營業稅申報', msg: '營業稅申報請輸入 1 或 2' },
  f4_idno401: { allowed: ['Y', 'N'], label: '身份證列印轉檔(Y/N)', msg: '身份證列印轉檔請輸入 Y 或 N' },
  f5_upcode: { allowed: ['Y', 'N'], label: '上市上櫃', msg: '上市上櫃請輸入 Y 或 N' },
  f5_bktype5: { allowed: ['1', '2'], label: '各類扣繳申報', msg: '各類扣繳申報請輸入 1 或 2' },
  f6_orga: { allowed: ['1', '2', '3', '4', '5', '6', '7', '8', '0', 'L', 'M'], label: '公司組織', msg: '公司組織請輸入 1~8、0、L、M' },
  f6_bktype: { allowed: ['1', '2', '3'], label: '帳務處理型態', msg: '帳務處理型態請輸入 1~3' },
  f6_bktax: { allowed: ['Y', 'N'], label: '是否代扣(帳務處理)', msg: '是否代扣請輸入 Y 或 N' },
  f6_bkprior: { allowed: ['1', '2', '3'], label: '委任內容及權限(帳務處理)', msg: '委任內容及權限請輸入 1~3' },
  f6_sbktype: { allowed: ['1', '2', '3', '4'], label: '結算申報處理', msg: '結算申報處理請輸入 1~4' },
  f6_sbktax: { allowed: ['Y', 'N'], label: '是否代扣(結算申報)', msg: '是否代扣請輸入 Y 或 N' },
  f6_sbkprior: { allowed: ['1', '2'], label: '委任內容及權限(結算申報)', msg: '委任內容及權限請輸入 1 或 2' },
  f7_tbktype: { allowed: ['1', '2', '3'], label: '委託代辦情形', msg: '委託代辦情形請輸入 1~3' },
  f8_qbktax: { allowed: ['Y', 'N'], label: '清算是否代扣', msg: '清算是否代扣請輸入 Y 或 N' },
  f8_wendtype: { allowed: ['1', '2'], label: '申報類別', msg: '申報類別請輸入 1 或 2' },
  f8_qbktype: { allowed: ['1', '2', '3', '4'], label: '清算申報型態', msg: '清算申報型態請輸入 1~4' },
  f8_qbkprior: { allowed: ['1', '2'], label: '清算委任內容權限', msg: '清算委任內容權限請輸入 1 或 2' },
};

/**
 * 限定輸入值檢查 (wbase210.pas CheckChoice)
 */
export const checkChoiceField = (fieldId: string, value?: string | null): { valid: boolean; message: string } => {
  const rule = WBASE210_CHOICE_RULES[fieldId];
  if (!rule || !value) return { valid: true, message: '' };
  const s = value.trim().toUpperCase();
  if (s === '') return { valid: true, message: '' };

  if (s.length === 1 && rule.allowed.includes(s)) {
    return { valid: true, message: '' };
  }
  return { valid: false, message: rule.msg };
};

/**
 * 公司組織關鍵字對照表 (wbase210rows.pas ORGA_WORDS)
 */
const ORGA_KEYWORDS = [
  { word: '股份有限公司', code: '1' },
  { word: '有限', code: '2' },
  { word: '無限', code: '3' },
  { word: '兩合', code: '4' },
  { word: '合夥', code: '5' },
  { word: '獨資', code: '6' },
  { word: '國外分公司', code: '7' },
  { word: '國外辦事處', code: '8' },
  { word: '其它', code: '0' },
];

/**
 * 依公司名稱自動判斷公司組織代號 (對齊 wbase210.pas 行 1828-1834)
 */
export const deriveOrganizationFromName = (companyName: string): string => {
  if (!companyName) return '';
  for (const item of ORGA_KEYWORDS) {
    if (companyName.includes(item.word)) {
      return item.code;
    }
  }
  return '';
};
