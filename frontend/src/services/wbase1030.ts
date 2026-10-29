import axios from 'axios';
import { localagentApi } from './localagent';
import {
  isValidEmail,
  EMAIL_WARNING_TEXT,
  EMAIL_SAVE_WARNING_TOAST,
  checkTaxId,
  checkBig5Compatible,
  truncateBig5,
  checkRocDate,
  checkPhoneDigits,
  isSupervisor,
} from './validation';

export { EMAIL_SAVE_WARNING_TOAST };

export interface EmpItem {
  no: string;
  name: string;
  psw?: string;
  birthday?: string;
  tel?: string;
  id?: string;
  addr?: string;
  memo?: string;
  oneuserid?: string;
  onepassno?: string;
  phone?: string;
  email?: string;
  _record_number?: number;

  // 相容舊有別名 (Legacy Aliases)
  empCode?: string;
  empName?: string;
  depName?: string;
  mobile?: string;
  oneUserId?: string;
  onePassNo?: string;
  address?: string;
}

/**
 * keyin.dbf 欄位規則定義 (對齊 wbase130.pas FieldUpper, FieldDigitOnly, LoadFieldLengths)
 */
export const EMP_FIELD_RULES: Record<
  string,
  {
    label: string;
    maxBytes: number;
    required?: boolean;
    uppercase?: boolean;
    digitOnly?: boolean;
  }
> = {
  no: { label: '編號', maxBytes: 10, required: true, uppercase: true },
  name: { label: '姓名', maxBytes: 20, required: true },
  psw: { label: '密碼', maxBytes: 8, uppercase: true },
  birthday: { label: '生日', maxBytes: 9 },
  tel: { label: '電話', maxBytes: 20 },
  id: { label: '身份證字號', maxBytes: 10, uppercase: true },
  addr: { label: '住址', maxBytes: 60 },
  memo: { label: '備註', maxBytes: 20 },
  oneuserid: { label: '工商一站式帳號', maxBytes: 20 },
  onepassno: { label: '一站式會計軟體驗證碼', maxBytes: 15 },
  phone: { label: '電子送達手機', maxBytes: 10, digitOnly: true },
  email: { label: '電子送達收件人EMAIL', maxBytes: 60 },
};

export interface EmpValidationResult {
  isValid: boolean;
  blockingErrors: string[];
  warnings: string[];
  normalizedRow: EmpItem;
}

/**
 * 完整人員資料單列檢核 (對齊 wbase130.pas MyOnSetText 與 QueryBeforePost)
 * @param row 待檢核的員工資料
 * @param existingRows 目前清單中已有的所有列
 * @param originalCode 編輯前原代號 (用於排除自身重複檢驗與 SUPERVISOR 保護)
 */
export const validateEmpRow = (
  row: EmpItem,
  existingRows: EmpItem[] = [],
  originalCode?: string
): EmpValidationResult => {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  const orig = (originalCode || '').trim().toUpperCase();
  const rawCode = (row.no || row.empCode || '').trim();
  const code = rawCode.toUpperCase();
  const name = (row.name || row.empName || '').trim();

  // 1. 編號必填 (wbase130.pas: cNew = '' -> Warn('編號不可空白!'))
  if (!code) {
    blockingErrors.push('編號不可空白！');
  }

  // 2. SUPERVISOR 保留帳號保護 (wbase130.pas: if OldValue='SUPERVISOR' and aText<>'SUPERVISOR' then Warn('SUPERVISOR 為保留帳號,編號不可更改'))
  if (orig === 'SUPERVISOR' && code !== 'SUPERVISOR') {
    blockingErrors.push('SUPERVISOR 為保留帳號，編號不可更改！');
  }

  // 3. 編號不可重複 (wbase130.pas: if dup then Warn('編號 ' + cNew + ' 不可重複!'))
  if (code && code !== orig) {
    const isDup = existingRows.some(
      (r) => (r.no || r.empCode || '').trim().toUpperCase() === code
    );
    if (isDup) {
      blockingErrors.push(`編號 ${code} 已存在，不可重複！`);
    }
  }

  // 4. 姓名必填
  if (!name) {
    blockingErrors.push('姓名不可空白！');
  }

  // 5. 生日民國年檢查與正規化 (wbase130.pas: d := ROCStringToDate(aText))
  let normalizedBirthday = (row.birthday || '').trim();
  if (normalizedBirthday) {
    const bCheck = checkRocDate(normalizedBirthday);
    if (!bCheck.valid) {
      blockingErrors.push(`生日錯誤：${bCheck.message}`);
    } else if (bCheck.normalized !== undefined) {
      normalizedBirthday = bCheck.normalized;
    }
  }

  // 6. 電子送達手機純數字檢查 (wbase130.pas: FieldDigitOnly 'phone')
  const phoneStr = (row.phone || row.mobile || '').trim();
  if (phoneStr) {
    const phoneCheck = checkPhoneDigits(phoneStr);
    if (!phoneCheck.valid) {
      blockingErrors.push(phoneCheck.message);
    }
  }

  // 7. 身分證字號 / 統編檢查 (wbase130.pas: ChkIdWarnMsg 僅提示不阻擋，仍可存檔)
  const idStr = (row.id || '').trim().toUpperCase();
  if (idStr) {
    const idCheck = checkTaxId(idStr);
    if (!idCheck.valid && idCheck.message) {
      warnings.push(`身份證字號：${idCheck.message.trim()} (提示，仍可正常存檔)`);
    }
  }

  // 8. 電子郵件格式檢查 (提示性檢核，仍可存檔)
  const emailStr = (row.email || '').trim();
  if (emailStr && !isValidEmail(emailStr)) {
    warnings.push(`電子郵件：${EMAIL_WARNING_TEXT}`);
  }

  // 9. Big5 可存性哨兵 (全欄位統一入口, wbase130.pas FromBig5(ToBig5(aText)) <> aText)
  const fieldsToCheck = [
    name,
    row.addr,
    row.memo,
    row.psw,
    phoneStr,
    idStr,
    emailStr,
  ];
  for (const f of fieldsToCheck) {
    const b5 = checkBig5Compatible(f);
    if (!b5.valid) {
      blockingErrors.push(b5.message);
      break;
    }
  }

  // 10. 長度超限截斷整理
  const normalizedRow: EmpItem = {
    ...row,
    no: truncateBig5(code, EMP_FIELD_RULES.no.maxBytes),
    name: truncateBig5(name, EMP_FIELD_RULES.name.maxBytes),
    psw: truncateBig5((row.psw || '').trim().toUpperCase(), EMP_FIELD_RULES.psw.maxBytes),
    birthday: normalizedBirthday,
    tel: truncateBig5((row.tel || '').trim(), EMP_FIELD_RULES.tel.maxBytes),
    id: truncateBig5(idStr, EMP_FIELD_RULES.id.maxBytes),
    addr: truncateBig5((row.addr || '').trim(), EMP_FIELD_RULES.addr.maxBytes),
    memo: truncateBig5((row.memo || '').trim(), EMP_FIELD_RULES.memo.maxBytes),
    oneuserid: truncateBig5((row.oneuserid || '').trim(), EMP_FIELD_RULES.oneuserid.maxBytes),
    onepassno: truncateBig5((row.onepassno || '').trim(), EMP_FIELD_RULES.onepassno.maxBytes),
    phone: phoneStr,
    email: truncateBig5(emailStr, EMP_FIELD_RULES.email.maxBytes),

    empCode: code,
    empName: name,
    depName: (row.memo || '').trim(),
    mobile: phoneStr,
    oneUserId: (row.oneuserid || '').trim(),
    onePassNo: (row.onepassno || '').trim(),
    address: (row.addr || '').trim(),
  };

  return {
    isValid: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    normalizedRow,
  };
};

/**
 * 檢查是否可刪除該人員 (SUPERVISOR 為保留帳號不可刪除)
 */
export const canDeleteEmp = (
  row?: EmpItem | null
): { canDelete: boolean; message: string } => {
  if (!row) return { canDelete: true, message: '' };
  const code = (row.no || row.empCode || '').trim();
  if (isSupervisor(code)) {
    return {
      canDelete: false,
      message: 'SUPERVISOR 為保留帳號，不可刪除！',
    };
  }
  return { canDelete: true, message: '' };
};

export const normalizeEmpItem = (raw: any): EmpItem => {
  if (!raw) {
    return {
      no: '',
      name: '',
      psw: '',
      birthday: '',
      tel: '',
      id: '',
      addr: '',
      memo: '',
      oneuserid: '',
      onepassno: '',
      phone: '',
      email: '',
      _record_number: 0,
      empCode: '',
      empName: '',
      depName: '',
      mobile: '',
      oneUserId: '',
      onePassNo: '',
      address: '',
    };
  }

  const no = (raw.no || raw.empCode || '').trim().toUpperCase();
  const name = (raw.name || raw.empName || '').trim();
  const psw = (raw.psw || '').trim();
  const birthday = (raw.birthday || '').trim();
  const tel = (raw.tel || '').trim();
  const id = (raw.id || '').trim();
  const addr = (raw.addr || raw.address || '').trim();
  const memo = (raw.memo || raw.depName || '').trim();
  const oneuserid = (raw.oneuserid || raw.oneUserId || '').trim();
  const onepassno = (raw.onepassno || raw.onePassNo || '').trim();
  const phone = (raw.phone || raw.mobile || '').trim();
  const email = (raw.email || '').trim();

  return {
    no,
    name,
    psw,
    birthday,
    tel,
    id,
    addr,
    memo,
    oneuserid,
    onepassno,
    phone,
    email,
    _record_number: raw._record_number || raw.recordNumber || 0,

    empCode: no,
    empName: name,
    depName: memo,
    mobile: phone,
    oneUserId: oneuserid,
    onePassNo: onepassno,
    address: addr,
  };
};

export const sanitizeEmpItemForSave = (item: EmpItem): any => {
  const norm = normalizeEmpItem(item);
  return {
    no: norm.no,
    name: norm.name,
    psw: norm.psw,
    birthday: norm.birthday,
    tel: norm.tel,
    id: norm.id,
    addr: norm.addr,
    memo: norm.memo,
    oneuserid: norm.oneuserid,
    onepassno: norm.onepassno,
    phone: norm.phone,
    email: norm.email,

    empCode: norm.no,
    empName: norm.name,
    mobile: norm.phone,
    depName: norm.memo,
    oneUserId: norm.oneuserid,
    onePassNo: norm.onepassno,
  };
};

export type EmpPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1030';

export const fetchEmps = async (keyword?: string): Promise<EmpItem[]> => {
  const response = await axios.get<any[]>(API_BASE, {
    params: { keyword },
  });
  return Array.isArray(response.data) ? response.data.map(normalizeEmpItem) : [];
};

export const getEmpList = fetchEmps;

export const fetchEmpByCode = async (code: string): Promise<EmpItem> => {
  const response = await axios.get<any>(`${API_BASE}/${encodeURIComponent(code)}`);
  return normalizeEmpItem(response.data);
};

export const createEmp = async (item: EmpItem): Promise<EmpItem> => {
  const payload = sanitizeEmpItemForSave(item);
  const response = await axios.post<any>(API_BASE, payload);
  return normalizeEmpItem(response.data);
};

export const updateEmp = async (code: string, item: EmpItem): Promise<EmpItem> => {
  const cleanCode = (code || item.no || item.empCode || '').trim();
  const payload = sanitizeEmpItemForSave(item);
  const response = await axios.put<any>(`${API_BASE}/${encodeURIComponent(cleanCode)}`, payload);
  return normalizeEmpItem(response.data);
};

export const deleteEmp = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
  empCodeStart?: string;
  empCodeEnd?: string;
}

export const fetchPrintEmps = async (query: PrintRangeQuery): Promise<EmpItem[]> => {
  const payload = {
    codeStart: query.codeStart || query.empCodeStart || '',
    codeEnd: query.codeEnd || query.empCodeEnd || '',
  };
  const response = await axios.post<any[]>(`${API_BASE}/print`, payload);
  return Array.isArray(response.data) ? response.data.map(normalizeEmpItem) : [];
};

export const printEmpList = fetchPrintEmps;

export interface Waccrep3101bParams {
  dllPath?: string;
  hs_chk?: number;
  top_mag?: number;
  left_mag?: number;
  PrtIndex?: number;
  IsPrint?: number;
  path?: string;
}

export const callWaccrep3101b = async (
  params: Waccrep3101bParams = {}
): Promise<{ success: boolean; result: string; raw?: string; error?: string }> => {
  const payload = {
    dllPath: params.dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll',
    hs_chk: params.hs_chk ?? 0.125,
    top_mag: params.top_mag ?? 0.0,
    left_mag: params.left_mag ?? 0.0,
    PrtIndex: params.PrtIndex ?? 0,
    IsPrint: params.IsPrint ?? 0,
    path: params.path ?? '',
  };

  try {
    const response = await localagentApi.post('/report', payload, {
      timeout: 10000,
    });
    return response.data;
  } catch (err: any) {
    console.warn('POST /report failed, attempting fallback to POST /api/call...', err?.message);
    try {
      const fallbackRes = await localagentApi.post(
        '/api/call',
        {
          dll: 'wbaseRP',
          func: 'waccrep3101_b',
          args: [
            payload.hs_chk,
            payload.top_mag,
            payload.left_mag,
            payload.PrtIndex,
            payload.IsPrint,
            payload.path,
          ],
        },
        {
          timeout: 10000,
        }
      );
      return {
        success: fallbackRes.data?.success ?? true,
        result: String(fallbackRes.data?.retCode ?? '0'),
        raw: JSON.stringify(fallbackRes.data),
      };
    } catch (fallbackErr: any) {
      console.error('LocalAgent error:', fallbackErr);
      throw new Error(
        '無法連線至 LocalAgent 本地列印元件 (http://localhost:18889)，請確認 LocalAgent 服務已啟動。'
      );
    }
  }
};

export type Waccrep3106bParams = Waccrep3101bParams;
export const callWaccrep3106b = callWaccrep3101b;
