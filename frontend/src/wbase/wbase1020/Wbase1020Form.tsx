import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CpaItem } from '../../services/wbase1020';
import { useTheme } from '../menu/ThemeContext';
import { User, Edit3, AlertCircle, Sparkles, Check } from 'lucide-react';
import {
  isValidEmail,
  EMAIL_WARNING_TEXT,
  checkTaxId,
  checkUnifiedNo,
  checkCertType,
  checkBig5Compatible,
  getBig5ByteLength,
  DOC_TRACK_SUGGESTIONS,
} from '../../services/validation';
import { CPA_FIELD_RULES } from '../../services/wbase1020';
import { useFoxProCardNavigation } from '../../components/FoxProGridCard';

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

interface WarnDialogInfo {
  title: string;
  message: string;
  type: 'error' | 'warning';
  nextFieldId?: string;
  returnFocusFieldId?: string;
}

interface Wbase1020FormProps {
  formData: CpaItem;
  setFormData: React.Dispatch<React.SetStateAction<CpaItem>>;
  inputRefsMap: React.MutableRefObject<Map<string, HTMLInputElement | HTMLTextAreaElement>>;
  mode: 'grid' | 'edit' | 'add';
  existingRows?: CpaItem[];
  onFieldKeyDown?: (e: React.KeyboardEvent, fid: keyof CpaItem) => void;
  onStartEdit?: () => void;
  onSave?: () => void;
}

export const Wbase1020Form: React.FC<Wbase1020FormProps> = ({
  formData,
  setFormData,
  inputRefsMap,
  mode,
  existingRows = [],
  onFieldKeyDown,
  onStartEdit,
  onSave,
}) => {
  const { isDark } = useTheme();
  const [showDocTrackModal, setShowDocTrackModal] = useState(false);
  const [warnDialog, setWarnDialog] = useState<WarnDialogInfo | null>(null);
  const warnOkBtnRef = useRef<HTMLButtonElement>(null);
  const modifiedFields = useRef<Set<string>>(new Set());

  // FoxPro 鍵盤盲打母版 Hook (支援上下鍵換欄位、Enter 換欄位/存檔、聚焦全選直接覆蓋打字、跳過停用欄位)
  const isFieldDisabled = useCallback(
    (fid: keyof CpaItem) => {
      if (mode === 'grid') return true;
      if (fid === 'cpaCode' && mode === 'edit') return true;
      return false;
    },
    [mode]
  );

  const {
    focusAndSelect,
    moveToField,
    handleFieldFocus,
  } = useFoxProCardNavigation<keyof CpaItem>({
    fieldOrder: CPA_FIELDS_ORDERED,
    inputRefsMap,
    isFieldDisabled,
    onSave,
  });

  // 當彈出系統提示時，自動聚焦於確定按鈕，支援鍵盤盲打 Enter 關閉
  useEffect(() => {
    if (warnDialog) {
      const timer = setTimeout(() => warnOkBtnRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [warnDialog]);

  const dismissWarnDialog = () => {
    const current = warnDialog;
    setWarnDialog(null);
    if (current?.returnFocusFieldId) {
      setTimeout(() => focusAndSelect(current.returnFocusFieldId as keyof CpaItem), 50);
    } else if (current?.nextFieldId) {
      setTimeout(() => focusAndSelect(current.nextFieldId as keyof CpaItem), 50);
    }
  };

  const handleInputChange = (field: keyof CpaItem, val: string) => {
    modifiedFields.current.add(field as string);
    // 對齊 wbase120.pas FieldUpper: no, id, unino 自動轉大寫
    const rule = CPA_FIELD_RULES[field as string];
    let processedVal = val;
    if (rule?.uppercase) {
      processedVal = val.toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [field]: processedVal }));
  };

  /**
   * Enter 鍵欄位檢查 (對齊 wbase120.pas 欄位離欄/SetText 檢驗，格式錯誤阻斷存檔)
   */
  const handleFieldEnter = (fieldKey: keyof CpaItem) => {
    const val = ((formData[fieldKey] as string) || '').trim();
    const currentIdx = CPA_FIELDS_ORDERED.indexOf(fieldKey);
    const nextField =
      currentIdx !== -1 && currentIdx < CPA_FIELDS_ORDERED.length - 1
        ? (CPA_FIELDS_ORDERED[currentIdx + 1] as string)
        : undefined;

    // 1. 代號檢查 (必填、唯一性)
    if (fieldKey === 'cpaCode') {
      if (!val) {
        setWarnDialog({
          title: '代號檢查錯誤',
          message: '代號不可空白！請輸入會計師代號。',
          type: 'error',
          returnFocusFieldId: 'cpaCode',
        });
        return;
      }
      const isDup =
        mode === 'add' &&
        existingRows.some((r) => (r.cpaCode || '').trim().toUpperCase() === val.toUpperCase());
      if (isDup) {
        setWarnDialog({
          title: '代號重複錯誤',
          message: `代號 ${val.toUpperCase()} 已存在，不可重複！`,
          type: 'error',
          returnFocusFieldId: 'cpaCode',
        });
        return;
      }
    }

    // 2. 證書別檢查 (僅限 空白、1、2、3)
    if (fieldKey === 'certType') {
      const check = checkCertType(val);
      if (!check.valid) {
        setWarnDialog({
          title: '證書別錯誤',
          message: check.message,
          type: 'error',
          returnFocusFieldId: 'certType',
        });
        return;
      }
    }

    // 3. 姓名檢查 (必填、長度40 bytes)
    if (fieldKey === 'cpaName') {
      if (!val) {
        setWarnDialog({
          title: '姓名檢查錯誤',
          message: '姓名不可空白！請輸入會計師或事務所姓名。',
          type: 'error',
          returnFocusFieldId: 'cpaName',
        });
        return;
      }
      if (getBig5ByteLength(val) > 40) {
        setWarnDialog({
          title: '長度超限提示',
          message: '姓名長度超過 40 位元組，存入 DBF 時將自動截斷！',
          type: 'warning',
          nextFieldId: nextField,
        });
        return;
      }
    }

    // 4. 申報ID 檢查 - 不彈窗提示畫面，直接換到下一欄位

    // 5. 統一編號檢查 (8碼統編加權) - 提示 (非阻斷，仍可繼續及儲存)
    if (fieldKey === 'unifiedNo' && val) {
      const check = checkUnifiedNo(val);
      if (!check.valid) {
        setWarnDialog({
          title: '統一編號提示',
          message: `統一編號提示：${check.message.trim()}`,
          type: 'warning',
          nextFieldId: nextField,
        });
        return;
      }
    }

    // 6. 電子信箱檢查 - 提示 (非阻斷，仍可繼續及儲存)
    if (fieldKey === 'email' && val) {
      if (!isValidEmail(val)) {
        setWarnDialog({
          title: '電子郵件提示',
          message: `電子信箱提示：${EMAIL_WARNING_TEXT}`,
          type: 'warning',
          nextFieldId: nextField,
        });
        return;
      }
    }

    // 7. Big5 哨兵檢查
    const b5 = checkBig5Compatible(val);
    if (!b5.valid) {
      setWarnDialog({
        title: '字元相容性錯誤',
        message: b5.message,
        type: 'error',
        returnFocusFieldId: fieldKey as string,
      });
      return;
    }

    // 檢核皆通過：跳下一格或觸發存檔 (透過 moveToField 自動跳過停用欄位並在最後欄存檔)
    moveToField(fieldKey, 'next');
  };

  /**
   * 離欄檢查 (對齊 wbase120.pas TCpaDetail.DoWarnExit 離欄即檢查，格式錯誤彈窗提示)
   */
  const handleFieldBlur = (fieldKey: keyof CpaItem) => {
    if (mode === 'grid') return;
    if (!modifiedFields.current.has(fieldKey as string)) return;
    modifiedFields.current.delete(fieldKey as string);

    const val = ((formData[fieldKey] as string) || '').trim();

    if (fieldKey === 'cpaCode') {
      if (!val) {
        setWarnDialog({
          title: '代號檢查錯誤',
          message: '代號不可空白！',
          type: 'error',
          returnFocusFieldId: 'cpaCode',
        });
      } else if (
        mode === 'add' &&
        existingRows.some((r) => (r.cpaCode || '').trim().toUpperCase() === val.toUpperCase())
      ) {
        setWarnDialog({
          title: '代號重複錯誤',
          message: `代號 ${val.toUpperCase()} 已存在，不可重複！`,
          type: 'error',
          returnFocusFieldId: 'cpaCode',
        });
      }
    } else if (fieldKey === 'certType') {
      const check = checkCertType(val);
      if (!check.valid) {
        setWarnDialog({
          title: '證書別錯誤',
          message: check.message,
          type: 'error',
          returnFocusFieldId: 'certType',
        });
      }
    } else if (fieldKey === 'cpaName') {
      if (!val) {
        setWarnDialog({
          title: '姓名檢查錯誤',
          message: '姓名不可空白！',
          type: 'error',
          returnFocusFieldId: 'cpaName',
        });
      }
    } else if (fieldKey === 'unifiedNo' && val) {
      const check = checkUnifiedNo(val);
      if (!check.valid) {
        setWarnDialog({
          title: '統一編號提示',
          message: `統一編號提示：${check.message.trim()}`,
          type: 'warning',
        });
      }
    } else if (fieldKey === 'email' && val) {
      if (!isValidEmail(val)) {
        setWarnDialog({
          title: '電子郵件提示',
          message: `電子信箱提示：${EMAIL_WARNING_TEXT}`,
          type: 'warning',
        });
      }
    }
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    fieldKey: keyof CpaItem
  ) => {
    // docTrack 支援按 F2 / F4 開啟挑選清單
    if (fieldKey === 'docTrack' && (e.key === 'F2' || e.key === 'F4')) {
      e.preventDefault();
      setShowDocTrackModal(true);
      return;
    }

    // Enter: 觸發欄位檢核並換至下一欄 (最後一欄自動存檔)
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFieldEnter(fieldKey);
      return;
    }

    // 向下鍵: 切換至下一欄 (FoxPro 盲打風格)
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveToField(fieldKey, 'next');
      return;
    }

    // 向上鍵: 切換至上一欄 (FoxPro 盲打風格)
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveToField(fieldKey, 'prev');
      return;
    }

    // 傳遞其他全局快捷鍵 (如 Esc/F9 儲存, F12 放棄)
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

    // --- 各欄位即時檢核狀態 ---
    const isCodeEmpty = isCodeField && mode !== 'grid' && !val.trim();
    const isCodeDuplicate =
      isCodeField &&
      mode === 'add' &&
      val.trim() !== '' &&
      existingRows.some((r) => (r.cpaCode || '').trim().toUpperCase() === val.trim().toUpperCase());

    const isCertTypeField = fieldKey === 'certType';
    const certTypeResult = isCertTypeField ? checkCertType(val) : { valid: true, message: '' };
    const isCertTypeInvalid = isCertTypeField && !certTypeResult.valid;

    const isNameEmpty = fieldKey === 'cpaName' && mode !== 'grid' && !val.trim();
    const nameByteLen = fieldKey === 'cpaName' ? getBig5ByteLength(val) : 0;
    const isNameTooLong = fieldKey === 'cpaName' && nameByteLen > 40;

    const isTaxIdField = fieldKey === 'taxId';
    const taxIdResult = isTaxIdField && val.trim() ? checkTaxId(val) : { valid: true, message: '' };
    const isTaxIdInvalid = isTaxIdField && Boolean(val.trim()) && !taxIdResult.valid;

    const isUninoField = fieldKey === 'unifiedNo';
    const uninoResult = isUninoField && val.trim() ? checkUnifiedNo(val) : { valid: true, message: '' };
    const isUninoInvalid = isUninoField && Boolean(val.trim()) && !uninoResult.valid;

    const isEmailField = fieldKey === 'email';
    const isEmailInvalid = isEmailField && Boolean(val.trim()) && !isValidEmail(val);

    const big5Check = checkBig5Compatible(val);
    const isBig5Invalid = !big5Check.valid;

    // 區分「阻斷性錯誤」(紅框/紅字/阻擋存檔) 與「非阻斷性提示」(黃/琥珀框/提示徽章/允許存檔)
    const hasBlockingError =
      isCodeEmpty ||
      isCodeDuplicate ||
      isCertTypeInvalid ||
      isNameEmpty ||
      isBig5Invalid;

    const hasWarning =
      !hasBlockingError &&
      (isTaxIdInvalid || isUninoInvalid || isEmailInvalid || isNameTooLong);

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
      onFocus: handleFieldFocus,
      onClick: (e: React.MouseEvent<HTMLInputElement>) => {
        try {
          e.currentTarget.select();
        } catch {}
      },
      onBlur: () => handleFieldBlur(fieldKey),
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleInputKeyDown(e, fieldKey),
      placeholder,
    };

    const certKind = (formData.certType || '').trim();
    const trackSuggestions = DOC_TRACK_SUGGESTIONS[certKind] || [];

    return (
      <div key={fieldKey} className={colSpan}>
        {/* Label & Error Badges Bar */}
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
            {isCertTypeInvalid && (
              <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/80 px-1 py-0.2 rounded border border-red-300 dark:border-red-700 flex items-center gap-0.5 font-mono">
                <AlertCircle size={10} />
                限空白/2/3
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
            {isTaxIdInvalid && (
              <span
                className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 font-mono"
                title={taxIdResult.message}
              >
                <AlertCircle size={10} />
                ⚠️ 申報ID提示
              </span>
            )}
            {isUninoInvalid && (
              <span
                className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 font-mono"
                title={uninoResult.message}
              >
                <AlertCircle size={10} />
                ⚠️ 統編提示
              </span>
            )}
            {isEmailField && isEmailInvalid && (
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 font-mono">
                <AlertCircle size={10} />
                ⚠️ Email提示
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
                ? 'bg-red-50/70 dark:bg-red-950/50 border-red-500 dark:border-red-500 text-red-900 dark:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-bold'
                : hasWarning
                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 dark:border-amber-500 text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold'
                : isDark
                ? isDisabled
                  ? 'bg-slate-900/60 border-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-950 border-blue-500 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 font-bold'
                : isDisabled
                ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed font-medium'
                : 'bg-white border-blue-600 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-bold'
            }`}
          />

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

        {/* 證書別說明標籤與即時錯誤提示 */}
        {fieldKey === 'certType' && (
          <div>
            <p className="mt-0.5 text-[10px] text-slate-500 font-mono truncate">
              (空白:會計師 2:記帳士 3:報稅代理人)
            </p>
            {isCertTypeInvalid && (
              <p className="mt-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                <span>❌ 證書別錯誤：僅允許輸入 空白(會計師)、2(記帳士)、3(報稅代理人)</span>
              </p>
            )}
          </div>
        )}

        {/* 申報ID 即時提示 (非阻斷) */}
        {isTaxIdField && isTaxIdInvalid && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ 提示：{taxIdResult.message.trim()}</span>
          </p>
        )}

        {/* 統一編號 即時提示 (非阻斷) */}
        {isUninoField && isUninoInvalid && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ 提示：{uninoResult.message.trim()}</span>
          </p>
        )}

        {/* 電子郵件 即時提示 (非阻斷) */}
        {isEmailField && isEmailInvalid && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ 提示：{EMAIL_WARNING_TEXT}</span>
          </p>
        )}

        {/* 發文字軌快速選擇 Chips */}
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
      </div>
    );
  };

  const certKind = (formData.certType || '').trim();
  const currentSuggestions =
    DOC_TRACK_SUGGESTIONS[certKind] || ['證', '證換', '財北', '財高', '北區', '中區', '南區'];

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
              - 編輯中 · ↑↓ / Enter 切換欄位(全選覆蓋) · cword F2 開窗 · Esc/F9 儲存 · F12 放棄
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
          {renderField('certType', '證書別', '空白:會計師 2:記帳士 3:報稅代理人', 'col-span-12 sm:col-span-2')}
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
                發文字軌挑選 (證書別 {certKind ? (certKind === '2' ? '2:記帳士' : certKind === '3' ? '3:報稅代理人' : certKind) : '空白:會計師'})
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
                    focusAndSelect('docTrack');
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

      {/* 系統提示訊息窗 (對齊 wbase120.pas Warn 彈窗) */}
      {warnDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 font-mono"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
              e.preventDefault();
              dismissWarnDialog();
            }
          }}
        >
          <div
            className={`border-2 rounded-lg p-5 max-w-md w-full shadow-2xl transition-colors ${
              warnDialog.type === 'error'
                ? isDark
                  ? 'bg-slate-900 border-red-500 text-white'
                  : 'bg-white border-red-600 text-slate-900'
                : isDark
                ? 'bg-slate-900 border-yellow-400 text-white'
                : 'bg-white border-yellow-500 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 pb-2.5 mb-3 border-b border-slate-700/60">
              <AlertCircle
                className={`w-6 h-6 shrink-0 ${
                  warnDialog.type === 'error' ? 'text-red-500' : 'text-amber-500'
                }`}
              />
              <h4 className="text-base font-bold">{warnDialog.title || '系統檢核提示'}</h4>
              <span className="text-[11px] text-gray-400 ml-auto">
                {warnDialog.type === 'error' ? '[Enter] 關閉並更正' : '[Enter] 關閉繼續'}
              </span>
            </div>

            <div
              className={`my-4 text-sm leading-relaxed font-bold whitespace-pre-line ${
                warnDialog.type === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {warnDialog.message}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-700/60">
              <button
                ref={warnOkBtnRef}
                type="button"
                autoFocus
                onClick={dismissWarnDialog}
                className={`px-5 py-1.5 rounded font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 ${
                  warnDialog.type === 'error'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                <span>
                  {warnDialog.type === 'error' ? '確定更正 [Enter]' : '確定繼續 [Enter]'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
