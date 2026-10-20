/**
 * 電子郵件與通用欄位格式驗證工具
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
export const EMAIL_WARNING_TEXT = '電子郵件格式可能不正確（範例: user@example.com），此為提示，仍可正常儲存。';
export const EMAIL_SAVE_WARNING_TOAST = '已成功儲存！(⚠️ 提示：電子郵件格式非標準，已照常存檔)';
