import React, { useEffect, useRef, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';

interface AssignCustomerModalProps {
  customers: { no: string; name: string }[];
  /** 勾選該客戶並把游標移過去；回傳 false 表示找不到 */
  onAssign: (no: string) => boolean;
  onClose: () => void;
}

/**
 * F6 指定客戶 (VFP wbase2020f6 / wbaseonecust)：連續輸入客戶編號，找到就勾選，空白 Enter 或 Esc 離開。
 * 與 VFP 的差異：完全比對代號 (VFP 在 SET EXACT OFF 下可能比對到前綴相同的客戶)、找不到時提示；
 * F2 開客戶清單 (VFP 只有 2-2 有，2-3 也提供)
 */
export const AssignCustomerModal: React.FC<AssignCustomerModalProps> = ({ customers, onAssign, onClose }) => {
  const { isDark } = useTheme();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listOpen) inputRef.current?.focus();
  }, [listOpen]);

  const submit = () => {
    // 讀輸入框本身的值：快速盲打時 Enter 可能比最後一個字的 state 更新先到
    const no = (inputRef.current?.value ?? value).trim().toUpperCase();
    if (!no) {
      onClose();
      return;
    }
    const customer = customers.find((c) => c.no.toUpperCase() === no);
    if (customer && onAssign(customer.no)) {
      setStatus({ ok: true, text: `已勾選 ${customer.no} ${customer.name}` });
      setValue('');
    } else {
      setStatus({ ok: false, text: `找不到客戶編號 ${no}` });
      inputRef.current?.select();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'F2') {
      e.preventDefault();
      setListOpen(true);
    }
  };

  const searchCustomers = async (query: string): Promise<SearchItem[]> => {
    const kw = query.trim().toLowerCase();
    return customers
      .filter((c) => !kw || c.no.toLowerCase().includes(kw) || c.name.toLowerCase().includes(kw))
      .map((c) => ({ code: c.no, name: c.name }));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div
          className={`w-full max-w-md overflow-hidden rounded-lg border-2 shadow-2xl ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-blue-900 text-slate-900'
          }`}
        >
          <div className={`flex items-center gap-2 px-4 py-3 text-white ${isDark ? 'bg-slate-950' : 'bg-blue-900'}`}>
            <UserCheck className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-bold">指定客戶</h3>
          </div>
          <div className="space-y-3 p-5 font-mono">
            <div className="flex items-center gap-3">
              <label htmlFor="wbase2030-assign" className="shrink-0 font-bold">
                客戶編號:
              </label>
              <input
                id="wbase2030-assign"
                ref={inputRef}
                type="text"
                maxLength={8}
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                onKeyDown={onKeyDown}
                className={`w-40 rounded border-2 px-3 py-2 text-base uppercase focus:outline-none ${
                  isDark
                    ? 'bg-slate-950 border-blue-500 text-yellow-300 focus:border-yellow-400'
                    : 'bg-yellow-50 border-blue-600 text-slate-900 focus:border-yellow-500'
                }`}
              />
            </div>
            <p className={`min-h-5 text-sm font-bold ${status ? (status.ok ? 'text-emerald-600' : 'text-red-600') : ''}`}>{status?.text}</p>
          </div>
          <div
            className={`flex justify-between border-t px-4 py-2 text-xs font-mono ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-gray-100 border-gray-200 text-gray-600'
            }`}
          >
            <span>[Enter] 勾選</span>
            <span>[F2] 客戶清單</span>
            <span>[空白 Enter / Esc] 離開</span>
          </div>
        </div>
      </div>
      <SearchModal
        isOpen={listOpen}
        title="客戶"
        onSearch={searchCustomers}
        onSelect={(item) => {
          setValue(item.code);
          setListOpen(false);
        }}
        onClose={() => setListOpen(false)}
      />
    </>
  );
};
