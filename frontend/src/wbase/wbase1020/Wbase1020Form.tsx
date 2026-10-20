import React from 'react';
import type { CpaItem } from '../../services/wbase1020';
import { useTheme } from '../menu/ThemeContext';
import {
  User,
  Award,
  Phone,
  Building,
  AlertCircle,
} from 'lucide-react';

import { isValidEmail, EMAIL_WARNING_TEXT } from '../../services/validation';

export const CPA_FIELDS_ORDERED: (keyof CpaItem)[] = [
  'cpaCode',
  'cpaName',
  'certType',
  'taxId',
  'unifiedNo',
  'licenseNo',
  'docTrack',
  'certNo',
  'tel',
  'mobile',
  'fax',
  'email',
  'address',
  'guildNo1',
  'guildNo2',
  'officeName',
  'memo',
];

interface Wbase1020FormProps {
  formData: CpaItem;
  setFormData: React.Dispatch<React.SetStateAction<CpaItem>>;
  inputRefsMap: React.MutableRefObject<Map<string, HTMLInputElement | HTMLTextAreaElement>>;
  mode: 'grid' | 'edit' | 'add';
  onFieldKeyDown?: (e: React.KeyboardEvent, fid: keyof CpaItem) => void;
}

function SectionCard({
  title,
  icon: Icon,
  isDark,
  children,
}: {
  title: string;
  icon: any;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[12px] border transition-colors ${
        isDark
          ? 'bg-slate-800/90 border-slate-700/80 shadow-md'
          : 'bg-white border-2 border-slate-300 shadow-sm'
      }`}
    >
      <div
        className={`h-9 px-4 flex items-center gap-2 border-b rounded-t-[10px] ${
          isDark
            ? 'bg-slate-800/90 border-slate-700/80 text-slate-200'
            : 'bg-slate-100/90 border-slate-200 text-slate-900 font-bold'
        }`}
      >
        <Icon size={14} className={isDark ? 'text-yellow-400' : 'text-blue-700'} />
        <span className="text-[12px] font-bold tracking-wide">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export const Wbase1020Form: React.FC<Wbase1020FormProps> = ({
  formData,
  setFormData,
  inputRefsMap,
  mode,
  onFieldKeyDown,
}) => {
  const { isDark } = useTheme();

  const handleInputChange = (field: keyof CpaItem, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const renderField = (
    fieldKey: keyof CpaItem,
    label: string,
    placeholder: string = '',
    colSpan: string = 'col-span-1',
    isTextArea: boolean = false
  ) => {
    const val = (formData[fieldKey] as string) || '';
    const isCodeField = fieldKey === 'cpaCode';
    const isDisabled = mode === 'grid' || (isCodeField && mode === 'edit');

    const inputProps = {
      'data-field': fieldKey,
      id: fieldKey,
      ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
        if (el) {
          inputRefsMap.current.set(fieldKey, el);
        } else {
          inputRefsMap.current.delete(fieldKey);
        }
      },
      value: val,
      disabled: isDisabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleInputChange(fieldKey, e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => onFieldKeyDown && onFieldKeyDown(e, fieldKey),
      placeholder,
    };

    const isEmailField = fieldKey === 'email';
    const isEmailInvalid = isEmailField && !isValidEmail(val);

    return (
      <div key={fieldKey} className={colSpan}>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor={fieldKey}
            className={`block text-[11px] font-bold tracking-wide ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {label}
          </label>
          {isEmailField && isEmailInvalid && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-1 font-mono">
              <AlertCircle size={11} />
              格式非標準 (提示仍可存檔)
            </span>
          )}
        </div>
        {isTextArea ? (
          <textarea
            {...inputProps}
            rows={2}
            className={`w-full min-h-[56px] rounded-[6px] border px-2.5 py-1.5 text-[13px] font-mono transition ${
              isDark
                ? isDisabled
                  ? 'bg-slate-900/60 border-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-950 border-blue-500 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400'
                : isDisabled
                ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed font-medium'
                : 'bg-white border-blue-600 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-bold'
            }`}
          />
        ) : (
          <input
            {...inputProps}
            type={isEmailField ? 'email' : 'text'}
            className={`w-full h-8 rounded-[6px] border px-2.5 text-[13px] font-mono transition shadow-2xs ${
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
        )}
        {isEmailField && isEmailInvalid && (
          <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ {EMAIL_WARNING_TEXT}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 4 Grouped Section Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section 1: 基本與身分資料 */}
        <SectionCard title="基本與身分資料" icon={User} isDark={isDark}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {renderField('cpaCode', '代號 (cpaCode)', '請輸入代號 (如 01)')}
            {renderField('cpaName', '姓名 (cpaName)', '請輸入姓名', 'col-span-1 sm:col-span-2')}
            {renderField('certType', '證書別 (1:會計 2:記帳 3:報稅)', '1/2/3')}
            {renderField('taxId', '申報ID (身分證號)', 'F333333333')}
            {renderField('unifiedNo', '統一編號 (8碼)', '12223334')}
          </div>
        </SectionCard>

        {/* Section 2: 證照核准字號 */}
        <SectionCard title="證照核准字號" icon={Award} isDark={isDark}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {renderField('licenseNo', '證書年度或國稅別', '如 097')}
            {renderField('docTrack', '發文字軌', '如 登 / 證')}
            {renderField('certNo', '證書編號', '如 1234567')}
          </div>
        </SectionCard>

        {/* Section 3: 聯絡通訊 */}
        <SectionCard title="聯絡通訊" icon={Phone} isDark={isDark}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {renderField('tel', '電話', '如 02-12345678')}
            {renderField('mobile', '手機', '行動電話')}
            {renderField('fax', '傳真', '如 02-12345678')}
            {renderField('email', 'E-MAIL', '電子信箱', 'col-span-1 sm:col-span-3')}
            {renderField('address', '通訊地址', '通訊地址', 'col-span-1 sm:col-span-3')}
          </div>
        </SectionCard>

        {/* Section 4: 公會與事務所 */}
        <SectionCard title="公會與事務所" icon={Building} isDark={isDark}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderField('guildNo1', '公會名稱', '如 台北市會計師聯合公會')}
            {renderField('guildNo2', '會員證號', '如 987654321')}
            {renderField('officeName', '事務所名稱', '事務所名稱')}
            {renderField('memo', '備註', '備註說明', 'col-span-1 sm:col-span-2', true)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
