import axios from 'axios';
import { checkBig5Compatible, truncateBig5 } from './validation';

export { checkBig5Compatible, truncateBig5 };

export interface AccountItem {
  accno: string;
  accname: string;
  type?: string;
  dept?: string;
  ldamount?: number;
  lcamount?: number;
  taxcode?: string;
  serial?: number;
  engaccname?: string;
  clsaccno?: string;
  clsaccname?: string;
  accnamel?: string;
  _record_number?: number;
  recordNumber?: number;
  _isNew?: boolean;
}

export interface AccountModeInfo {
  mode: number;
  label: string;
  tableName: string;
  pubdept: string;
  isOrgGroup: boolean;
  memoHint: string;
}

export const ACCOUNT_MODES: Record<number, AccountModeInfo> = {
  1: {
    mode: 1,
    label: '標準會計科目',
    tableName: 'xmaster',
    pubdept: '0123456ABCDF ',
    isOrgGroup: false,
    memoHint: '科目明細 : 1.進貨 2.進退 3.進折 4.銷貨 5.銷退 6.銷折 A.應收帳款 B.應收票據 C.應付帳款 D.應付票據 F.固定資產',
  },
  2: {
    mode: 2,
    label: '營造業會計科目',
    tableName: 'xmaster2',
    pubdept: '01234567ABCDF ',
    isOrgGroup: false,
    memoHint: '科目明細 : 1.進貨 2.進退 3.進折 4.銷貨 5.銷退 6.銷折 7.工程 A.應收款 B.應收票 C.應付款 D.應付票 F.固定資產',
  },
  3: {
    mode: 3,
    label: '建設業會計科目',
    tableName: 'xmaster3',
    pubdept: '01234567ABCDF ',
    isOrgGroup: false,
    memoHint: '科目明細 : 1.進貨 2.進退 3.進折 4.銷貨 5.銷退 6.銷折 7.工程 A.應收款 B.應收票 C.應付款 D.應付票 F.固定資產',
  },
  4: {
    mode: 4,
    label: '文教團體會計科目',
    tableName: 'xmaster4',
    pubdept: '0123456ABCDF ',
    isOrgGroup: true,
    memoHint: '科目明細 : 1.進貨 2.進退 3.進折 4.銷貨 5.銷退 6.銷折 A.應收帳款 B.應收票據 C.應付帳款 D.應付票據 F.固定資產',
  },
  5: {
    mode: 5,
    label: '社會團體會計科目',
    tableName: 'xmaster5',
    pubdept: '0123456ABCDF ',
    isOrgGroup: true,
    memoHint: '科目明細 : 1.進貨 2.進退 3.進折 4.銷貨 5.銷退 6.銷折 A.應收帳款 B.應收票據 C.應付帳款 D.應付票據 F.固定資產',
  },
  6: {
    mode: 6,
    label: '衛福團體會計科目',
    tableName: 'xmaster6',
    pubdept: '0123456ABCDF ',
    isOrgGroup: true,
    memoHint: '科目明細 : 1.進貨 2.進退 3.進折 4.銷貨 5.銷退 6.銷折 A.應收帳款 B.應收票據 C.應付帳款 D.應付票據 F.固定資產',
  },
};

export const DEPT_MAPPINGS: Record<string, string> = {
  '1': '進貨',
  '2': '進退',
  '3': '進折',
  '4': '銷貨',
  '5': '銷退',
  '6': '銷折',
  '7': '工程',
  'A': '應收帳款',
  'B': '應收票據',
  'C': '應付帳款',
  'D': '應付票據',
  'F': '固定資產',
  'G': '客戶廠商',
  'H': '自定對象',
  'I': '外幣',
  'T': '寄銷品',
  'P': '專案',
  '0': '無',
  ' ': '無',
};

export const getDeptDescription = (dept?: string): string => {
  if (!dept || dept.trim() === '' || dept === '0') return '';
  const d = dept.trim().toUpperCase();
  const desc = DEPT_MAPPINGS[d] || '';
  return `${d} ${desc}`;
};

export const isDebitAccount = (accno: string): boolean => {
  if (!accno) return false;
  const first = accno.trim().charAt(0);
  return '1568'.includes(first) || accno.trim() === '9999';
};

const API_BASE = '/api/wbase4010';

export const getAccounts = async (mode: number = 1, keyword?: string): Promise<AccountItem[]> => {
  const resp = await axios.get<AccountItem[]>(API_BASE, {
    params: { mode, keyword: keyword?.trim() || undefined },
  });
  return resp.data;
};

export const getRefAccounts = async (mode: number = 1): Promise<AccountItem[]> => {
  const resp = await axios.get<AccountItem[]>(`${API_BASE}/ref`, {
    params: { mode },
  });
  return resp.data;
};

export const saveAccount = async (
  mode: number,
  row: AccountItem,
  isNew: boolean
): Promise<{ success: boolean; accno: string; data?: AccountItem }> => {
  if (isNew) {
    const resp = await axios.post<AccountItem>(API_BASE, row, { params: { mode } });
    return { success: true, accno: resp.data.accno, data: resp.data };
  } else {
    const trimmedAccno = encodeURIComponent(row.accno.trim().toUpperCase());
    await axios.put(`${API_BASE}/${trimmedAccno}`, row, { params: { mode } });
    return { success: true, accno: row.accno.trim().toUpperCase(), data: row };
  }
};

export const deleteAccount = async (
  mode: number,
  accno: string
): Promise<{ success: boolean; deletedAccno: string }> => {
  const trimmed = encodeURIComponent(accno.trim().toUpperCase());
  const resp = await axios.delete<{ success: boolean; deletedAccno: string }>(
    `${API_BASE}/${trimmed}`,
    { params: { mode } }
  );
  return resp.data;
};

export const batchCopyAccounts = async (
  mode: number,
  accnos: string[]
): Promise<{ success: boolean; copiedCount: number; totalRequested: number }> => {
  const resp = await axios.post<{ success: boolean; copiedCount: number; totalRequested: number }>(
    `${API_BASE}/batch-copy`,
    { mode, accnos }
  );
  return resp.data;
};

export interface AccountValidationResult {
  isValid: boolean;
  message: string;
  normalizedRow: AccountItem;
}

export const validateAccountRow = (
  row: AccountItem,
  mode: number,
  existingRows: AccountItem[],
  isNew: boolean,
  originalAccno?: string,
  rowIndex?: number
): AccountValidationResult => {
  const meta = ACCOUNT_MODES[mode] || ACCOUNT_MODES[1];
  const accno = (row.accno || '').trim().toUpperCase();

  if (!accno || accno === '新科目') {
    return {
      isValid: false,
      message: '科目代號不可為空白！',
      normalizedRow: row,
    };
  }

  if (accno.length > 8) {
    return {
      isValid: false,
      message: '科目代號長度不可超過 8 碼！',
      normalizedRow: row,
    };
  }

  // 重複檢查 (排除自身列索引或原始代號)
  const isDuplicate = existingRows.some((r, idx) => {
    if (rowIndex !== undefined && idx === rowIndex) return false;
    const rCode = r.accno.trim().toUpperCase();
    if (rowIndex === undefined && originalAccno && rCode === originalAccno.trim().toUpperCase()) {
      return false;
    }
    return rCode === accno;
  });
  if (isDuplicate) {
    return {
      isValid: false,
      message: `科目代號 [${accno}] 已重複！`,
      normalizedRow: row,
    };
  }

  let inheritedName = row.accname || '';
  let inheritedDept = row.dept || ' ';

  // 總帳科目 (4碼以內) 檢核
  if (accno.length <= 4) {
    if (isNew) {
      if (meta.isOrgGroup) {
        if (accno.length === 4 && (accno.startsWith('70') || accno.startsWith('80'))) {
          // 允許團體 70xx, 80xx
        } else {
          return {
            isValid: false,
            message: '不可新增總帳科目！機關團體僅開放新增 70 或 80 開頭之總帳科目。',
            normalizedRow: row,
          };
        }
      } else {
        return {
          isValid: false,
          message: '不可新增總帳科目！請使用 [F3] 複製標準總帳科目。',
          normalizedRow: row,
        };
      }
    }
  } else {
    // 明細科目 (長度 > 4 碼): 需檢查母總帳科目是否存在
    const parentAccno = accno.substring(0, 4);
    const parentAcc = existingRows.find((r) => r.accno.trim().toUpperCase() === parentAccno);
    if (!parentAcc) {
      return {
        isValid: false,
        message: `無此總帳科目 [${parentAccno}]！新增明細科目必須先有對應的4碼總帳科目。`,
        normalizedRow: row,
      };
    }

    // 新增明細科目若尚未輸入名稱/明細，自動繼承母科目名稱與明細設定 (對齊 VFP update_accno)
    if (isNew) {
      if (!inheritedName.trim()) {
        inheritedName = parentAcc.accname?.trim() || '';
      }
      if (!inheritedDept.trim()) {
        inheritedDept = parentAcc.dept?.trim() || ' ';
      }
    }
  }

  // 欄位 Big5 檢核
  const b5Name = checkBig5Compatible(inheritedName);
  if (!b5Name.valid) {
    return { isValid: false, message: `科目名稱: ${b5Name.message}`, normalizedRow: row };
  }

  const b5NameL = checkBig5Compatible(row.accnamel || '');
  if (!b5NameL.valid) {
    return { isValid: false, message: `長科目名稱: ${b5NameL.message}`, normalizedRow: row };
  }

  // 部門明細檢核
  const dept = (inheritedDept || ' ').trim().toUpperCase();
  if (dept && !meta.pubdept.includes(dept)) {
    return {
      isValid: false,
      message: `科目明細 [${dept}] 不在允許的設定值內 (${meta.pubdept.trim()})`,
      normalizedRow: row,
    };
  }

  // 稅額檢核
  const taxcode = (row.taxcode || '').trim();
  if (taxcode && taxcode !== '*') {
    return {
      isValid: false,
      message: '稅額欄位僅接受 "*" (自動產生5%稅額) 或空白！',
      normalizedRow: row,
    };
  }

  const normalized: AccountItem = {
    ...row,
    accno,
    accname: truncateBig5(inheritedName, 20),
    dept: dept || ' ',
    taxcode: taxcode ? '*' : ' ',
    accnamel: truncateBig5(row.accnamel || '', 60),
    engaccname: (row.engaccname || '').trim().substring(0, 254),
  };

  return {
    isValid: true,
    message: '',
    normalizedRow: normalized,
  };
};
