import React, { useState } from 'react';
import type { CpaItem } from '../../services/wbase1020';
import { useTheme } from '../menu/ThemeContext';
import { User, Edit3, AlertCircle, AlertTriangle, Check, Sparkles } from 'lucide-react';
import {
  isValidEmail,
  EMAIL_WARNING_TEXT,
  checkTaxId,
  checkUnifiedNo,
  checkBig5Compatible,
  getBig5ByteLength,
  DOC_TRACK_SUGGESTIONS,
} from '../../services/validation';
import { CPA_FIELD_RULES } from '../../services/wbase1020';

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
  existingRows?: CpaItem[];
  onFieldKeyDown?: (e: React.KeyboardEvent, fid: keyof CpaItem) => void;
  onStartEdit?: () => void;
}

export const Wbase1020Form: React.FC<Wbase1020FormProps> = ({
  formData,
  setFormData,
  inputRefsMap,
  mode,
  existingRows = [],
  onFieldKeyDown,
  onStartEdit,
}) => {
  const { isDark } = useTheme();
  const [showDocTrackModal, setShowDocTrackModal] = useState(false);

  const handleInputChange = (field: keyof CpaItem, val: string) => {
    // 對齊 wbase120.pas FieldUpper: no, id, unino 自動轉大寫
    const rule = CPA_FIELD_RULES[field as string];
    let processedVal = val;
    if (rule?.uppercase) {
      processedVal = val.toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [field]: processedVal }));
  };

  // 當使用者在發文字軌按 F2 時開啟快選清單
  const handleKeyDownWithF2 = (e: React.KeyboardEvent, fieldKey: keyof CpaItem) => {
    if (fieldKey === 'docTrack' && (e.key === 'F2' || e.key === 'F4')) {
      e.preventDefault();
      setShowDocTrackModal(true);
      return;
    }
    if (onFieldKeyDown) {
      onFieldKeyDown(e, fieldKey);
    }
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
    const rule = CPA_FIELD_RULES[fieldKey as string];
    const maxLen = rule?.maxBytes || 255;

    // --- 各欄位驗證邏輯 (對齊 wbase120.pas 與 util_w3000valid.pas) ---
    // 1. 代號驗證 (必填、唯一性)
    const isCodeEmpty = isCodeField && mode !== 'grid' && !val.trim();
    const isCodeDuplicate =
      isCodeField &&
      mode === 'add' &&
      val.trim() !== '' &&
      existingRows.some((r) => (r.cpaCode || '').trim().toUpperCase() === val.trim().toUpperCase());

    // 2. 姓名驗證 (必填、長度40 bytes)
    const isNameEmpty = fieldKey === 'cpaName' && mode !== 'grid' && !val.trim();
    const nameByteLen = fieldKey === 'cpaName' ? getBig5ByteLength(val) : 0;
    const isNameTooLong = fieldKey === 'cpaName' && nameByteLen > 40;

    // 3. 申報ID (身分證/新舊居留證/8碼統編，提示性非阻斷)
    const isTaxIdField = fieldKey === 'taxId';
    const taxIdResult = isTaxIdField ? checkTaxId(val) : { valid: true, message: '' };
    const isTaxIdInvalid = isTaxIdField && !taxIdResult.valid;

    // 4. 統一編號 (8碼統編加權，提示性非阻斷)
    const isUninoField = fieldKey === 'unifiedNo';
    const uninoResult = isUninoField ? checkUnifiedNo(val) : { valid: true, message: '' };
    const isUninoInvalid = isUninoField && !uninoResult.valid;

    // 5. 電子信箱 (非阻斷)
    const isEmailField = fieldKey === 'email';
    const isEmailInvalid = isEmailField && !isValidEmail(val);

    // 6. Big5 相容性檢查 (全欄位)
    const big5Check = checkBig5Compatible(val);
    const isBig5Invalid = !big5Check.valid;

    // 彙整狀態
    const hasBlockingError = isCodeEmpty || isCodeDuplicate || isNameEmpty;
    const hasWarning =
      isTaxIdInvalid || isUninoInvalid || isEmailInvalid || isNameTooLong || isBig5Invalid;

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
      maxLength: maxLen,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        handleInputChange(fieldKey, e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDownWithF2(e, fieldKey),
      placeholder,
    };

    // 證書別連動之發文字軌選項
    const certKind = (formData.certType || '').trim();
    const trackSuggestions = DOC_TRACK_SUGGESTIONS[certKind] || [];

    return (
      <div key={fieldKey} className={colSpan}>
        {/* Label & Badges Bar */}
        <div className="flex items-center justify-between mb-0.5">
          <label
            htmlFor={fieldKey}
            className={`block text-[11px] font-bold tracking-wide flex items-center gap-1 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {label}
            {rule?.required && (
              <span className="text-red-500 font-bold" title="必填欄位">
                *
              </span>
            )}
            {rule?.uppercase && (
              <span className="text-[9px] text-blue-500 dark:text-blue-400 font-mono font-normal">
                [大寫]
              </span>
            )}
          </label>

          {/* Badges / Hints */}
          <div className="flex items-center gap-1">
            {/* 必填錯誤提示 */}
            {isCodeEmpty && (
              <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/80 px-1 py-0.2 rounded border border-red-300 dark:border-red-700 flex items-center gap-0.5 font-mono">
                <AlertCircle size={10} />
                代號必填
              </span>
            )}
            {isCodeDuplicate && (
              <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/80 px-1 py-0.2 rounded border border-red-300 dark:border-red-700 flex items-center gap-0.5 font-mono">
                <AlertCircle size={10} />
                代號不可重複
              </span>
            )}
            {isNameEmpty && (
              <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/80 px-1 py-0.2 rounded border border-red-300 dark:border-red-700 flex items-center gap-0.5 font-mono">
                <AlertCircle size={10} />
                姓名必填
              </span>
            )}
            {isNameTooLong && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 font-mono">
                ⚠️ {nameByteLen}/40B (超長截斷)
              </span>
            )}

            {/* 非阻斷性提示徽章 */}
            {isTaxIdInvalid && (
              <span
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 font-mono"
                title={`${taxIdResult.message.trim()} (此為非阻斷提示，仍可存檔)`}
              >
                <AlertTriangle size={10} />
                {taxIdResult.message.trim()}
              </span>
            )}
            {isUninoInvalid && (
              <span
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 font-mono"
                title={`${uninoResult.message.trim()} (此為非阻斷提示，仍可存檔)`}
              >
                <AlertTriangle size={10} />
                {uninoResult.message.trim()}
              </span>
            )}
            {isEmailField && isEmailInvalid && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 font-mono">
                <AlertCircle size={10} />
                Email格式非標準
              </span>
            )}
            {isBig5Invalid && (
              <span
                className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/80 px-1 py-0.2 rounded border border-red-300 dark:border-red-700 font-mono"
                title={big5Check.message}
              >
                ⚠️ 非Big5字元
              </span>
            )}
          </div>
        </div>

        {/* Input Field with F2 Button for docTrack */}
        <div className="relative flex items-center">
          <input
            {...inputProps}
            type={isEmailField ? 'email' : 'text'}
            className={`w-full h-7.5 rounded-[5px] border px-2 text-xs font-mono transition shadow-2xs ${
              hasBlockingError
                ? 'bg-red-50/60 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-bold'
                : hasWarning
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

          {/* 發文字軌 F2 快捷選單鈕 (對齊 wbase120.pas F2 挑選字軌) */}
          {fieldKey === 'docTrack' && mode !== 'grid' && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowDocTrackModal(true)}
              className="absolute right-1 px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded shadow-xs cursor-pointer flex items-center gap-0.5"
              title="按 F2 或點此開啟發文字軌清單"
            >
              <span>F2</span>
            </button>
          )}
        </div>

        {/* 發文字軌快速選擇 Chips (依證書別連動: 2:記帳士 -> 證/證換; 3:報稅代理人 -> 財北/財高...) */}
        {fieldKey === 'docTrack' && mode !== 'grid' && trackSuggestions.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 font-mono">建議字軌:</span>
            {trackSuggestions.map((item) => (
              <button
                key={item}
                type="button"
                tabIndex={-1}
                onClick={() => handleInputChange('docTrack', item)}
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold transition border cursor-pointer ${
                  val === item
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-slate-700'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {/* 證書別說明標籤 */}
        {fieldKey === 'certType' && (
          <p className="mt-0.5 text-[10px] text-slate-500 font-mono truncate">
            (空白/1: 會計師 · 2: 記帳士 · 3: 報稅代理人)
          </p>
        )}

        {/* 各欄位詳細非阻斷提示說明 */}
        {isEmailField && isEmailInvalid && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ {EMAIL_WARNING_TEXT}</span>
          </p>
        )}
        {isTaxIdInvalid && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ 提示：{taxIdResult.message.trim()} (此為非阻斷性提示，仍可存檔)</span>
          </p>
        )}
        {isUninoInvalid && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ 提示：{uninoResult.message.trim()} (此為非阻斷性提示，仍可存檔)</span>
          </p>
        )}
      </div>
    );
  };

  const certKind = (formData.certType || '').trim();
  const currentSuggestions = DOC_TRACK_SUGGESTIONS[certKind] || ['證', '證換', '財北', '財高', '北區', '中區', '南區'];

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
              - 編輯中 · Enter 下一欄 · cword/addr F2 開窗 · Esc/F9 儲存
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
          {renderField('cpaCode', '代號', '如 01 (必填/唯一)', 'col-span-12 sm:col-span-2')}
          {renderField('certType', '證書別', '空白/1:會計 2:記帳 3:報稅', 'col-span-12 sm:col-span-2')}
          {renderField('cpaName', '姓名', '請輸入姓名 (必填)', 'col-span-12 sm:col-span-4')}
          {renderField('taxId', '申報ID', '身分證 / 居留證 / 統編', 'col-span-12 sm:col-span-4')}

          {/* Divider */}
          <div className="col-span-12 border-t border-slate-200 dark:border-slate-700/60 my-0.5" />

          {/* Row 2: 證照字號 (cno1, cword, cno2) */}
          {renderField('licenseNo', '證書年度或國稅別', '如 097 / 105', 'col-span-12 sm:col-span-4')}
          {renderField('docTrack', '發文字軌', '如 登 / 證 (按F2開窗)', 'col-span-12 sm:col-span-4')}
          {renderField('certNo', '證書編號', '如 00001234', 'col-span-12 sm:col-span-4')}

          {/* Divider */}
          <div className="col-span-12 border-t border-slate-200 dark:border-slate-700/60 my-0.5" />

          {/* Row 3: 聯絡通訊 (tel, mobile, fax) */}
          {renderField('tel', '電話', '如 02-12345678', 'col-span-12 sm:col-span-4')}
          {renderField('mobile', '手機', '如 0912-345678', 'col-span-12 sm:col-span-4')}
          {renderField('fax', '傳真', '如 02-12345678', 'col-span-12 sm:col-span-4')}

          {/* Row 4: 統一編號與地址 (unino, addr) */}
          {renderField('unifiedNo', '統一編號', '營利事業統編 (8碼)', 'col-span-12 sm:col-span-3')}
          {renderField('address', '地址', '營業或事務所地址 (最多60字元)', 'col-span-12 sm:col-span-9')}

          {/* Divider */}
          <div className="col-span-12 border-t border-slate-200 dark:border-slate-700/60 my-0.5" />

          {/* Row 5: 公會與信箱 (hno1, hno2, email) */}
          {renderField('guildNo1', '公會名稱', '如 台北市會計師公會', 'col-span-12 sm:col-span-4')}
          {renderField('guildNo2', '會員證號', '如 987654321', 'col-span-12 sm:col-span-3')}
          {renderField('email', 'E-MAIL', '電子郵件信箱', 'col-span-12 sm:col-span-5')}
        </div>
      </div>

      {/* F2 發文字軌挑選視窗 (對齊 wbase120.pas SelectCword) */}
      {showDocTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
          <div
            className={`border-2 rounded-lg p-5 max-w-sm w-full shadow-2xl transition-colors ${
              isDark ? 'bg-slate-900 border-blue-500 text-white' : 'bg-white border-blue-800 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-yellow-400">
                <Sparkles size={16} />
                發文字軌挑選 (證書別 {certKind || '無'})
              </h4>
              <span className="text-[11px] text-gray-400">Esc 關閉</span>
            </div>

            <div className="space-y-1.5 my-3">
              {currentSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    handleInputChange('docTrack', item);
                    setShowDocTrackModal(false);
                    // 焦點回到發文字軌
                    inputRefsMap.current.get('docTrack')?.focus();
                  }}
                  className={`w-full px-3 py-2 rounded text-left text-xs font-bold transition flex items-center justify-between cursor-pointer border ${
                    formData.docTrack === item
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-slate-100 hover:bg-blue-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <span>{item}</span>
                  {formData.docTrack === item && <Check size={14} />}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t mt-4">
              <button
                type="button"
                onClick={() => setShowDocTrackModal(false)}
                className="px-3 py-1 rounded text-xs font-bold bg-gray-600 hover:bg-gray-500 text-white"
              >
                關閉 (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
