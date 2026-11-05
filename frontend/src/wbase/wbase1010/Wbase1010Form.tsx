import React, { useEffect, useRef } from 'react';
import { Building2, Check, MapPin } from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';
import { OFFICE_BYTES, type OfficeInfo } from '../../services/wbase1010';
import { truncateBig5 } from '../../services/validation';

type EditableField = keyof typeof OFFICE_BYTES;

interface FieldDef {
  key: EditableField;
  label: string;
  widthClass: string;
  hint?: string;
}

/** 可輸入欄位，順序同 VFP TabIndex (電話 1 → 傳真 2 → 地址 3 → 負責人 4 → 聯絡人 5 → 電子郵件 6 → 數位憑證公用目錄 7) */
const FIELDS: FieldDef[] = [
  { key: 'tel', label: '事務所電話', widthClass: 'w-52' },
  { key: 'fax', label: '事務所傳真', widthClass: 'w-52' },
  { key: 'addr', label: '事務所地址', widthClass: 'flex-1 min-w-0', hint: 'F2 地址選單' },
  { key: 'boss', label: '負責人', widthClass: 'w-52' },
  { key: 'contact', label: '聯絡人', widthClass: 'w-52' },
  { key: 'email', label: '電子郵件', widthClass: 'flex-1 min-w-0 max-w-lg' },
  { key: 'pubImgPath', label: '數位憑證公用目錄', widthClass: 'flex-1 min-w-0' },
];

/** 唯讀欄位 (VFP Enabled=.F.，黃底)：只能在 F4 事務所資料按 F5 轉入預設 */
const READONLY: { key: keyof OfficeInfo; label: string; widthClass: string }[] = [
  { key: 'name', label: '事務所名稱', widthClass: 'flex-1 min-w-0' },
  { key: 'engName', label: '英文名稱', widthClass: 'flex-1 min-w-0' },
  { key: 'taxNo', label: '事務所統編', widthClass: 'w-52' },
];

export interface FocusRequest {
  field: EditableField | 'save';
  seq: number;
}

interface Wbase1010FormProps {
  form: OfficeInfo;
  dirty: boolean;
  onChange: (field: keyof OfficeInfo, value: string) => void;
  onOpenAddr: () => void;
  onSave: () => void;
  focusRequest: FocusRequest;
}

/**
 * 預設事務所資料 (VFP wbase1010 的 pf1.Page1「預設事務所資料」)
 * Enter / ↓ 下一欄、↑ 上一欄，最後一欄 Enter 移到「F8 確定」；事務所地址按 F2 開地址選單
 */
export const Wbase1010Form: React.FC<Wbase1010FormProps> = ({
  form,
  dirty,
  onChange,
  onOpenAddr,
  onSave,
  focusRequest,
}) => {
  const { isDark } = useTheme();
  const refs = useRef<Partial<Record<EditableField, HTMLInputElement | null>>>({});
  const saveRef = useRef<HTMLButtonElement>(null);

  const focusField = (field: EditableField | 'save') => {
    setTimeout(() => {
      if (field === 'save') {
        saveRef.current?.focus();
        return;
      }
      const el = refs.current[field];
      if (!el) return;
      el.focus();
      el.select();
    }, 30);
  };

  useEffect(() => {
    focusField(focusRequest.field);
  }, [focusRequest]);

  const move = (idx: number, delta: number) => {
    const next = idx + delta;
    if (next < 0) return;
    focusField(next >= FIELDS.length ? 'save' : FIELDS[next].key);
  };

  const labelClass = `w-40 shrink-0 text-right font-bold ${isDark ? 'text-sky-300' : 'text-blue-800'}`;

  const inputClass = `h-[38px] px-3 rounded border-2 font-mono text-base outline-none transition-colors ${
    isDark
      ? 'bg-slate-950 border-slate-600 text-white focus:border-yellow-400 focus:bg-yellow-950/40 focus:ring-2 focus:ring-yellow-400'
      : 'bg-white border-slate-300 text-slate-900 focus:border-yellow-500 focus:bg-yellow-50 focus:ring-2 focus:ring-yellow-400'
  }`;

  const readonlyClass = `h-[38px] px-3 flex items-center rounded border font-mono text-base truncate ${
    isDark ? 'bg-yellow-900/40 border-yellow-700 text-yellow-100' : 'bg-[#ffff80] border-yellow-400 text-black'
  }`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4" style={{ fontFamily: 'Consolas, Monaco, monospace' }}>
      <div
        className={`mx-auto max-w-4xl rounded-lg border-2 shadow-md ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-blue-900'
        }`}
      >
        <div
          className={`flex items-center justify-between px-4 py-2 rounded-t font-bold ${
            isDark ? 'bg-slate-950 text-yellow-300' : 'bg-[#1e3a8a] text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            預設事務所資料
          </span>
          {dirty && <span className="text-xs text-amber-300">● 尚未存檔 (按 F8 確定)</span>}
        </div>

        <div className="p-4 sm:p-5 space-y-2.5 text-base">
          {READONLY.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className={labelClass}>{f.label}：</span>
              <div className={`${readonlyClass} ${f.widthClass}`} title="請至 F4 事務所資料按 F5 轉入預設">
                {form[f.key] || ' '}
              </div>
            </div>
          ))}

          <div className={`my-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />

          {FIELDS.map((f, idx) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className={labelClass}>{f.label}：</span>
              <div className={`flex items-center gap-1.5 ${f.widthClass}`}>
                <input
                  ref={(el) => {
                    refs.current[f.key] = el;
                  }}
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => onChange(f.key, truncateBig5(e.target.value, OFFICE_BYTES[f.key]))}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      move(idx, 1);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      move(idx, -1);
                    } else if (e.key === 'F2' && f.key === 'addr') {
                      e.preventDefault();
                      onOpenAddr();
                    }
                  }}
                  className={`${inputClass} w-full`}
                />
                {f.key === 'addr' && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={onOpenAddr}
                    className="h-[38px] px-2 shrink-0 flex items-center gap-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-black"
                    title="F2 地址選單"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    F2
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-3">
            <span className={`text-sm font-bold ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
              新增事務所，請至 F4 事務所資料
            </span>
            <button
              ref={saveRef}
              type="button"
              onClick={onSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSave();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  focusField(FIELDS[FIELDS.length - 1].key);
                }
              }}
              className="flex items-center gap-1.5 px-5 h-[38px] rounded bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow focus:outline-none focus:ring-4 focus:ring-yellow-400"
            >
              <Check className="w-4 h-4" />
              F8 確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
