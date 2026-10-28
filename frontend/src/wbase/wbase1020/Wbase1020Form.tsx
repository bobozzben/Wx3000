import React from 'react';
import type { CpaItem } from '../../services/wbase1020';
import { useTheme } from '../menu/ThemeContext';
import { User, Edit3, AlertCircle } from 'lucide-react';
import { isValidEmail, EMAIL_WARNING_TEXT } from '../../services/validation';

/**
 * 依據 cpa.dbf 結構之欄位順序:
 * no, kind, name, id, cno1, cword, cno2, tel, mobile, fax, unino, addr, hno1, hno2, email
 */
export const CPA_FIELDS_ORDERED: (keyof CpaItem)[] = [
  'cpaCode',
  'certType',
  'cpaName',
  'taxId',
  'licenseNo',
  'docTrack',
  'certNo',
  'tel',
  'mobile',
  'fax',
  'unifiedNo',
  'address',
  'guildNo1',
  'guildNo2',
  'email',
];

interface Wbase1020FormProps {
  formData: CpaItem;
  setFormData: React.Dispatch<React.SetStateAction<CpaItem>>;
  inputRefsMap: React.MutableRefObject<Map<string, HTMLInputElement | HTMLTextAreaElement>>;
  mode: 'grid' | 'edit' | 'add';
  onFieldKeyDown?: (e: React.KeyboardEvent, fid: keyof CpaItem) => void;
  onStartEdit?: () => void;
}

export const Wbase1020Form: React.FC<Wbase1020FormProps> = ({
  formData,
  setFormData,
  inputRefsMap,
  mode,
  onFieldKeyDown,
  onStartEdit,
}) => {
  const { isDark } = useTheme();

  const handleInputChange = (field: keyof CpaItem, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const renderField = (
    fieldKey: keyof CpaItem,
    label: string,
    placeholder: string = '',
    colSpan: string = 'col-span-12 sm:col-span-4'
  ) => {
    const val = (formData[fieldKey] as string) || '';
    const isCodeField = fieldKey === 'cpaCode';
    const isDisabled = mode === 'grid' || (isCodeField && mode === 'edit');

    const inputProps = {
      'data-field': fieldKey,
      id: fieldKey,
      ref: (el: HTMLInputElement | null) => {
        if (el) {
          inputRefsMap.current.set(fieldKey, el);
        } else {
          inputRefsMap.current.delete(fieldKey);
        }
      },
      value: val,
      disabled: isDisabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        handleInputChange(fieldKey, e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => onFieldKeyDown && onFieldKeyDown(e, fieldKey),
      placeholder,
    };

    const isEmailField = fieldKey === 'email';
    const isEmailInvalid = isEmailField && !isValidEmail(val);

    return (
      <div key={fieldKey} className={colSpan}>
        <div className="flex items-center justify-between mb-0.5">
          <label
            htmlFor={fieldKey}
            className={`block text-[11px] font-bold tracking-wide ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {label}
          </label>
          {isEmailField && isEmailInvalid && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-1 font-mono">
              <AlertCircle size={10} />
              格式非標準 (提示仍可存檔)
            </span>
          )}
        </div>
        <input
          {...inputProps}
          type={isEmailField ? 'email' : 'text'}
          className={`w-full h-7.5 rounded-[5px] border px-2 text-xs font-mono transition shadow-2xs ${
            isEmailInvalid
              ? isDark
                ? 'bg-slate-950 border-amber-500 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold'
                : 'bg-amber-50/50 border-amber-500 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs font-bold'
              : isDark
              ? isDisabled
                ? 'bg-slate-900/60 border-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-slate-950 border-blue-500 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 font-bold'
              : isDisabled
              ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed font-medium'
              : 'bg-white border-blue-600 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-bold'
          }`}
        />
        {isEmailField && isEmailInvalid && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ {EMAIL_WARNING_TEXT}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className={`rounded-[10px] border transition-colors ${
        isDark
          ? 'bg-slate-800/90 border-slate-700/80 shadow-md'
          : 'bg-white border-2 border-slate-300 shadow-xs'
      }`}
    >
      {/* Unified Single Card Header */}
      <div
        className={`h-8 px-3 sm:px-4 flex items-center justify-between border-b rounded-t-[8px] ${
          isDark
            ? 'bg-slate-800/90 border-slate-700/80 text-slate-200'
            : 'bg-slate-100/90 border-slate-200 text-slate-900 font-bold'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <User size={13} className={isDark ? 'text-yellow-400' : 'text-blue-700'} />
          <span className="text-xs font-bold tracking-wide truncate">明細資料卡片 (cpa.dbf)</span>
          {mode !== 'grid' ? (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal truncate">
              - 編輯中，按 Enter 跳至下一欄位，按 Esc/F9 儲存
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-normal hidden sm:inline truncate">
              - 瀏覽模式，Enter / F6 編修
            </span>
          )}
        </div>
        {mode === 'grid' && onStartEdit && (
          <button
            type="button"
            onClick={onStartEdit}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <Edit3 className="w-3 h-3" />
            <span>進入編修 [F6]</span>
          </button>
        )}
      </div>

      {/* Card Body - 15 Fields in 5 Clean Rows */}
      <div className="p-2 sm:p-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-3 gap-y-1 sm:gap-y-1.5">
          {/* Row 1: 基本身分 (no, kind, name, id) */}
          {renderField('cpaCode', '代號', '如 01', 'col-span-12 sm:col-span-2')}
          {renderField('certType', '證書別', '1:會計 2:記帳 3:報稅', 'col-span-12 sm:col-span-2')}
          {renderField('cpaName', '姓名', '請輸入姓名', 'col-span-12 sm:col-span-4')}
          {renderField('taxId', '申報ID', '申報ID (身分證號)', 'col-span-12 sm:col-span-4')}

          {/* Divider */}
          <div className="col-span-12 border-t border-slate-200 dark:border-slate-700/60 my-0.5" />

          {/* Row 2: 證照字號 (cno1, cword, cno2) */}
          {renderField('licenseNo', '證書年度或國稅別', '如 097', 'col-span-12 sm:col-span-4')}
          {renderField('docTrack', '發文字軌', '如 登 / 證', 'col-span-12 sm:col-span-4')}
          {renderField('certNo', '證書編號', '如 1234567', 'col-span-12 sm:col-span-4')}

          {/* Divider */}
          <div className="col-span-12 border-t border-slate-200 dark:border-slate-700/60 my-0.5" />

          {/* Row 3: 聯絡通訊 (tel, mobile, fax) */}
          {renderField('tel', '電話', '如 02-12345678', 'col-span-12 sm:col-span-4')}
          {renderField('mobile', '手機', '行動電話', 'col-span-12 sm:col-span-4')}
          {renderField('fax', '傳真', '如 02-12345678', 'col-span-12 sm:col-span-4')}

          {/* Row 4: 統一編號與地址 (unino, addr) */}
          {renderField('unifiedNo', '統一編號', '統一編號 (8碼)', 'col-span-12 sm:col-span-3')}
          {renderField('address', '地址', '營業或通訊地址', 'col-span-12 sm:col-span-9')}

          {/* Divider */}
          <div className="col-span-12 border-t border-slate-200 dark:border-slate-700/60 my-0.5" />

          {/* Row 5: 公會與信箱 (hno1, hno2, email) */}
          {renderField('guildNo1', '公會名稱', '如 台北市會計師聯合公會', 'col-span-12 sm:col-span-4')}
          {renderField('guildNo2', '會員證號', '如 987654321', 'col-span-12 sm:col-span-3')}
          {renderField('email', 'E-MAIL', '電子郵件信箱', 'col-span-12 sm:col-span-5')}
        </div>
      </div>
    </div>
  );
};
