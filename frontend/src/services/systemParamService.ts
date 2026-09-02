import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface SystemParamResponse {
  schema: string;
  table: string;
  name: string;
  value: string;
}

/**
 * 讀取總體參數
 * @param schema PostgreSQL Schema 名稱 (例如 'public')
 * @param table PostgreSQL Table 名稱 (例如 'sys_config')
 * @param name 參數名稱 (欄位 "名稱")
 * @param defaultValue 找不到時自動寫入與回傳的預設值 (預設空白字串 '')
 * @returns 參數數值 (欄位 "數值")
 */
export async function getSystemParam(
  schema: string,
  table: string,
  name: string,
  defaultValue: string = ''
): Promise<string> {
  try {
    const response = await axios.get<SystemParamResponse>(`${API_BASE_URL}/systemparam`, {
      params: {
        schema,
        table,
        name,
        defaultValue,
      },
    });
    const val = response.data?.value;
    return val && val.trim() !== '' ? val : defaultValue;
  } catch (e) {
    console.error('getSystemParam error:', e);
    return defaultValue;
  }
}

/**
 * 設定總體參數
 * @param schema PostgreSQL Schema 名稱 (例如 'public')
 * @param table PostgreSQL Table 名稱 (例如 'sys_config')
 * @param name 參數名稱 (欄位 "名稱")
 * @param value 要設定的數值 (欄位 "數值")
 * @returns 設定後的數值 (欄位 "數值")
 */
export async function setSystemParam(
  schema: string,
  table: string,
  name: string,
  value: string
): Promise<string> {
  try {
    const response = await axios.post<SystemParamResponse>(`${API_BASE_URL}/systemparam`, {
      schema,
      table,
      name,
      value,
    });
    return response.data?.value ?? value;
  } catch (e) {
    console.error('setSystemParam error:', e);
    return value;
  }
}
