import axios from 'axios';
import {
  isValidEmail,
  checkTaxId,
  checkUnifiedNo,
  checkBig5Compatible,
  getBig5ByteLength,
} from './validation';

export * from './validation';

const API_BASE = '/api/wbase1020';

/**
 * 依據 cpa.dbf (VFP wbase1020 / Lazarus wbase120.pas) 之欄位規格與限制
 */
export interface CpaFieldRule {
  key: keyof CpaItem;
  label: string;
  maxBytes: number;
  required?: boolean;
  uppercase?: boolean;
  description?: string;
}

export const CPA_FIELD_RULES: Record<string, CpaFieldRule> = {
  cpaCode: { key: 'cpaCode', label: '代號', maxBytes: 10, required: true, uppercase: true, description: '不可為空且不可重複' },
  certType: { key: 'certType', label: '證書別', maxBytes: 1, required: false, uppercase: false, description: '空白/1:會計師 2:記帳士 3:報稅代理人' },
  cpaName: { key: 'cpaName', label: '姓名', maxBytes: 40, required: true, uppercase: false, description: '必填，最多40位元組' },
  taxId: { key: 'taxId', label: '申報ID', maxBytes: 10, required: false, uppercase: true, description: '身分證/新舊居留證/8碼統編 (提示性驗證)' },
  licenseNo: { key: 'licenseNo', label: '證書年度或國稅別', maxBytes: 3, required: false, uppercase: false, description: '如 097' },
  docTrack: { key: 'docTrack', label: '發文字軌', maxBytes: 20, required: false, uppercase: false, description: '依證書別連動選項 (如 證/證換/財北等)' },
  certNo: { key: 'certNo', label: '證書編號', maxBytes: 8, required: false, uppercase: false, description: '如 1234567' },
  tel: { key: 'tel', label: '電話', maxBytes: 20, required: false, uppercase: false, description: '聯絡電話' },
  mobile: { key: 'mobile', label: '手機', maxBytes: 20, required: false, uppercase: false, description: '行動電話' },
  fax: { key: 'fax', label: '傳真', maxBytes: 20, required: false, uppercase: false, description: '傳真號碼' },
  unifiedNo: { key: 'unifiedNo', label: '統一編號', maxBytes: 8, required: false, uppercase: true, description: '8碼營利事業統編 (提示性驗證)' },
  address: { key: 'address', label: '地址', maxBytes: 60, required: false, uppercase: false, description: '最多60位元組' },
  guildNo1: { key: 'guildNo1', label: '公會名稱', maxBytes: 40, required: false, uppercase: false, description: '公會名稱' },
  guildNo2: { key: 'guildNo2', label: '會員證號', maxBytes: 20, required: false, uppercase: false, description: '會員證號' },
  email: { key: 'email', label: 'E-MAIL', maxBytes: 255, required: false, uppercase: false, description: '電子郵件 (提示性驗證)' },
};

/**
 * 檢查會計師/記帳士輸入欄位 (對齊 wbase120.pas 前置檢查)
 */
export interface CpaValidationResult {
  isValid: boolean;
  blockingErrors: string[];
  warnings: string[];
}

export const validateCpaForm = (
  formData: CpaFormInput,
  existingRows: CpaItem[] = [],
  mode: 'add' | 'edit' | 'grid' = 'edit',
  originalCode?: string
): CpaValidationResult => {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  const code = (formData.cpaCode || '').trim().toUpperCase();
  const name = (formData.cpaName || '').trim();

  // 1. 代號必填
  if (!code) {
    blockingErrors.push('代號不可空白！');
  } else {
    // 2. 代號唯一性檢查 (新增或代號變更時排除自身)
    const isCodeChanged = mode === 'add' || (originalCode && originalCode.trim().toUpperCase() !== code);
    if (isCodeChanged) {
      const isDuplicate = existingRows.some(
        (r) => (r.cpaCode || '').trim().toUpperCase() === code
      );
      if (isDuplicate) {
        blockingErrors.push(`代號 ${code} 已存在，不可重複！`);
      }
    }
  }

  // 3. 姓名必填
  if (!name) {
    blockingErrors.push('姓名不可空白！');
  }

  // 4. Big5 可存性哨兵 (全欄位檢查)
  const fieldsToCheck = [
    formData.cpaName,
    formData.taxId,
    formData.docTrack,
    formData.address,
    formData.guildNo1,
    formData.email,
  ];
  for (const f of fieldsToCheck) {
    const b5 = checkBig5Compatible(f);
    if (!b5.valid) {
      blockingErrors.push(b5.message);
      break;
    }
  }

  // 5. 提示性檢查：申報ID (身分證/居留證/8碼統編)
  const taxIdCheck = checkTaxId(formData.taxId);
  if (!taxIdCheck.valid && taxIdCheck.message) {
    warnings.push(`申報ID：${taxIdCheck.message.trim()}`);
  }

  // 6. 提示性檢查：統一編號 (8碼統編)
  const uninoCheck = checkUnifiedNo(formData.unifiedNo);
  if (!uninoCheck.valid && uninoCheck.message) {
    warnings.push(`統一編號：${uninoCheck.message.trim()}`);
  }

  // 7. 提示性檢查：E-mail 格式
  if (formData.email && !isValidEmail(formData.email)) {
    warnings.push('E-MAIL：格式非標準');
  }

  // 8. 欄位位元組超長提示
  if (getBig5ByteLength(formData.cpaName) > 40) {
    warnings.push('姓名長度超過 40 位元組，存入 DBF 時將自動截斷');
  }
  if (getBig5ByteLength(formData.address) > 60) {
    warnings.push('地址長度超過 60 位元組，存入 DBF 時將自動截斷');
  }

  return {
    isValid: blockingErrors.length === 0,
    blockingErrors,
    warnings,
  };
};

export interface CpaItem {
  cpaCode: string;
  certType?: string;
  cpaName: string;
  taxId?: string;
  licenseNo?: string;
  docTrack?: string;
  certNo?: string;
  tel?: string;
  mobile?: string;
  fax?: string;
  unifiedNo?: string;
  address?: string;
  guildNo1?: string;
  guildNo2?: string;
  email?: string;
  officeName?: string;
  memberNo?: string;
  memo?: string;
  recordNumber?: number;
  guid?: string;
  updatedAt?: string;
}

export interface CpaFormInput {
  cpaCode: string;
  certType?: string;
  cpaName: string;
  taxId?: string;
  licenseNo?: string;
  docTrack?: string;
  certNo?: string;
  tel?: string;
  mobile?: string;
  fax?: string;
  unifiedNo?: string;
  address?: string;
  guildNo1?: string;
  guildNo2?: string;
  email?: string;
  officeName?: string;
  memberNo?: string;
  memo?: string;
  recordNumber?: number;
  guid?: string;
}

export interface CpaPrintFilter {
  cpaCodeStart: string;
  cpaCodeEnd: string;
}

export const getCpaList = async (keyword?: string): Promise<CpaItem[]> => {
  const res = await axios.get<CpaItem[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(res.data) ? res.data : [];
};

export const getCpaDetail = async (code: string): Promise<CpaItem> => {
  const res = await axios.get<CpaItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return res.data;
};

export const createCpa = async (input: CpaFormInput): Promise<CpaItem> => {
  const res = await axios.post<CpaItem>(API_BASE, input);
  return res.data;
};

export const updateCpa = async (code: string, input: CpaFormInput): Promise<CpaItem> => {
  const res = await axios.put<CpaItem>(`${API_BASE}/${encodeURIComponent(code)}`, input);
  return res.data;
};

export const deleteCpa = async (code: string): Promise<void> => {
  await axios.delete(`${API_BASE}/${encodeURIComponent(code)}`);
};

export const printCpaList = async (filter: CpaPrintFilter): Promise<CpaItem[]> => {
  const res = await axios.post<CpaItem[]>(`${API_BASE}/print`, filter);
  return res.data;
};
