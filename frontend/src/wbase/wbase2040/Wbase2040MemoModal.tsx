import React, { useEffect, useRef, useState } from 'react';
import { SearchModal } from '../../components/FoxProGrid/SearchModal';
import { checkBig5Compatible } from '../../services/validation';
import { useTheme } from '../menu/ThemeContext';
import { searchSummaries } from './lookups';
import { KeyHintBar } from './KeyHintBar';

interface Wbase2040MemoModalProps {
  title: string;
  subtitle?: string;
  value: string;
  onChange: (text: string) => void;
  /** 存檔後關閉；回傳 false 時保留視窗 */
  onSaveAndClose: () => Promise<boolean>;
  onClose: () => void;
}

/**
 * 摘要內容編輯 (VFP recmemo.scx / recsmemo.scx)：直接編輯 memo，
 * F3 選取摘要 (recmemo 開窗後整段取代)，F6 / Esc 存檔離開
 */
export const Wbase2040MemoModal: React.FC<Wbase2040MemoModalProps> = ({ title, subtitle, value, onChange, onSaveAndClose, onClose }) => {
  const { isDark } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const contents = useRef(new Map<string, string>());

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 50);
  }, []);

  const saveAndClose = async () => {
    const check = checkBig5Compatible(value);
    if (!check.valid) {
      setError(check.message);
      return;
    }
    if (await onSaveAndClose()) onClose();
  };

  useEffect(() => {
    if (pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        setPickerOpen(true);
      } else if (e.key === 'F6' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        saveAndClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div
        className={`flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border-2 shadow-2xl ${
          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        <div className={`flex items-center justify-between px-4 py-2 text-white ${isDark ? 'bg-slate-900' : 'bg-blue-900'}`}>
          <h3 className="text-lg font-bold">{title}</h3>
          {subtitle && <span className="font-mono text-sm text-yellow-300">{subtitle}</span>}
        </div>
        <div className="p-3 sm:p-4">
          <textarea
            ref={textRef}
            value={value}
            onChange={(e) => {
              setError('');
              onChange(e.target.value);
            }}
            rows={14}
            className={`w-full resize-y rounded border-2 p-3 font-mono text-base focus:outline-none ${
              isDark ? 'bg-slate-900 border-blue-500 text-yellow-200 focus:border-yellow-400' : 'bg-yellow-50 border-blue-600 focus:border-yellow-500'
            }`}
          />
          {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
          <p className="mt-1 text-xs opacity-70">Ctrl + C 複製　Ctrl + V 貼上</p>
        </div>
        <KeyHintBar
          keys={[
            { key: 'F3', label: '選取摘要', onClick: () => setPickerOpen(true) },
            { key: 'F6', label: '存檔離開', onClick: saveAndClose, danger: true },
          ]}
        />
      </div>
      <SearchModal
        isOpen={pickerOpen}
        title="選取摘要"
        onSearch={(q) => searchSummaries(q, contents.current)}
        onSelect={(item) => {
          onChange(contents.current.get(item.code) ?? '');
          setPickerOpen(false);
          setTimeout(() => textRef.current?.focus(), 50);
        }}
        onClose={() => {
          setPickerOpen(false);
          setTimeout(() => textRef.current?.focus(), 50);
        }}
      />
    </div>
  );
};
