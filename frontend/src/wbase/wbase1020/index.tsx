import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWbase1020 } from './useWbase1020';
import { Wbase1020Form, CPA_FIELDS_ORDERED } from './Wbase1020Form';
import { Wbase1020Print } from './wbase1020Print';
import type { CpaItem } from '../../services/wbase1020';
import { FoxProGridCard } from '../../components/FoxProGridCard';
import type { FoxProGridCardColumn } from '../../components/FoxProGridCard';
import { useTheme } from '../menu/ThemeContext';
import { isValidEmail } from '../../services/validation';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit3,
  Printer,
  LogOut,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Save,
  Undo2,
} from 'lucide-react';

interface Wbase1020PageProps {
  onBackToMenu?: () => void;
}

const CPA_GRID_COLUMNS: FoxProGridCardColumn<CpaItem>[] = [
  { key: 'cpaCode', label: '代號', width: '70px', className: 'font-bold font-mono' },
  { key: 'certType', label: '證書別', width: '75px', align: 'center', className: 'font-mono' },
  { key: 'cpaName', label: '姓名', width: '180px', className: 'font-bold' },
  { key: 'taxId', label: '申報ID', width: '120px', className: 'font-mono' },
  { key: 'licenseNo', label: '證書年度或國稅別', width: '150px', className: 'font-mono' },
  { key: 'docTrack', label: '發文字軌', width: '80px', align: 'center' },
  { key: 'certNo', label: '證書編號', width: '100px', className: 'font-mono' },
  { key: 'tel', label: '電話', width: '140px', className: 'font-mono' },
  { key: 'mobile', label: '手機', width: '120px', className: 'font-mono' },
  { key: 'fax', label: '傳真', width: '130px', className: 'font-mono' },
  { key: 'unifiedNo', label: '統一編號', width: '100px', className: 'font-mono' },
  { key: 'address', label: '地址', width: '240px' },
  { key: 'guildNo1', label: '公會名稱', width: '220px' },
  { key: 'guildNo2', label: '會員證號', width: '110px', className: 'font-mono' },
  {
    key: 'email',
    label: 'E-MAIL',
    width: '180px',
    className: 'font-mono',
    render: (item) => {
      const emailStr = String(item.email || '');
      const isInvalid = !isValidEmail(emailStr);
      return (
        <span className="flex items-center gap-1.5 truncate">
          {isInvalid && (
            <span
              className="px-1.5 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded shrink-0 shadow-sm"
              title="電子郵件格式非標準，此為提示，仍可正常儲存"
            >
              ⚠️ 格式
            </span>
          )}
          <span className={isInvalid ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
            {emailStr}
          </span>
        </span>
      );
    },
  },
];

export const Wbase1020Page: React.FC<Wbase1020PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();

  const {
    rows,
    selectedIndex,
    setSelectedIndex,
    mode,
    formData,
    setFormData,
    loading,
    errorToast,
    setErrorToast,
    showAutoCloseToast,
    toastMessage,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    isPrintOpen,
    refreshData,
    startEdit,
    startAdd,
    cancelEdit,
    saveForm,
    openDeleteConfirm,
    confirmDelete,
    openSearchModal,
    closeSearchModal,
    selectRowFromSearch,
    openPrint,
  } = useWbase1020();

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const inputRefsMap = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const [searchModalIndex, setSearchModalIndex] = useState<number>(0);
  const searchModalListRef = useRef<HTMLDivElement>(null);

  // Initial data loading
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Focus specific input field with yellow highlight
  const focusField = useCallback((fid: string) => {
    const el = inputRefsMap.current.get(fid);
    if (el) {
      el.focus();
      el.classList.add('fox-flash');
      setTimeout(() => el.classList.remove('fox-flash'), 250);
    }
  }, []);

  // When switching to edit / add mode, focus appropriate first field
  useEffect(() => {
    if (mode === 'edit') {
      setTimeout(() => focusField('cpaName'), 100);
    } else if (mode === 'add') {
      setTimeout(() => focusField('cpaCode'), 100);
    } else if (mode === 'grid') {
      setTimeout(() => gridContainerRef.current?.focus(), 80);
    }
  }, [mode, focusField]);

  // Filtered rows for Search Modal
  const filteredSearchRows = React.useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.cpaCode.toLowerCase().includes(q) ||
        r.cpaName.toLowerCase().includes(q) ||
        (r.unifiedNo && r.unifiedNo.toLowerCase().includes(q)) ||
        (r.taxId && r.taxId.toLowerCase().includes(q)) ||
        (r.guildNo1 && r.guildNo1.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  // Reset modal index on query change
  useEffect(() => {
    if (isSearchOpen) {
      setSearchModalIndex(0);
    }
  }, [isSearchOpen, searchQuery]);

  // Keyboard navigation on FoxProGridCard
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mode !== 'grid') return;

    const pageSize = 8;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(rows.length - 1, selectedIndex + 1));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(0, selectedIndex - pageSize));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(rows.length - 1, selectedIndex + pageSize));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedIndex(Math.max(0, rows.length - 1));
    } else if (e.key === 'Enter' || e.key === 'F6') {
      e.preventDefault();
      startEdit();
    } else if (e.key === 'Insert' || e.key === 'F3') {
      e.preventDefault();
      startAdd();
    } else if (e.key === 'F2') {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === 'F7') {
      e.preventDefault();
      openPrint();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      openDeleteConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (onBackToMenu) onBackToMenu();
    }
  };

  // Keyboard navigation inside Form (Enter moves to next field, Esc saves)
  const handleFormFieldKeyDown = (e: React.KeyboardEvent, fid: keyof CpaItem) => {
    if (mode === 'grid') return;

    if (e.key === 'Enter') {
      if (e.currentTarget.tagName === 'TEXTAREA' && e.shiftKey) return;
      e.preventDefault();
      const currentIdx = CPA_FIELDS_ORDERED.indexOf(fid);
      if (currentIdx !== -1 && currentIdx < CPA_FIELDS_ORDERED.length - 1) {
        const nextFid = CPA_FIELDS_ORDERED[currentIdx + 1];
        focusField(nextFid as string);
      } else {
        // Last field, trigger save
        saveForm();
      }
    } else if (e.key === 'Escape' || e.key === 'F9') {
      e.preventDefault();
      saveForm();
    } else if (e.key === 'F12') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const selectedRow = rows[selectedIndex];

  return (
    <div
      className={`min-h-full flex-1 flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      <style>{`
        .fox-flash { background: #FEF08A !important; color: #0F172A !important; box-shadow: 0 0 0 2px #FACC15 !important; transition: background 0.15s; }
      `}</style>

      {/* Top Banner Header */}
      <div
        className={`shrink-0 px-4 md:px-6 py-3 border-b flex items-center justify-between shadow-xs transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-b-2 border-slate-200 text-slate-900 font-bold'
        }`}
      >
        <div className="flex items-center space-x-3">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className={`p-1.5 rounded-lg transition ${
                isDark ? 'hover:bg-slate-800 text-gray-300' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="返回主選單 (Esc)"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2 bg-yellow-400 text-black rounded font-bold shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider flex items-center gap-2">
              1-2 會計師/記帳士資料維護
              <span className="text-xs px-2 py-0.5 rounded bg-blue-800 text-white font-normal font-mono">
                wbase1020
              </span>
            </h1>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              FoxProGridCard 輸入模式 · 支援上下鍵瀏覽、Enter/F6編修、Ins新增、F2查詢
            </p>
          </div>

          {/* Mode Pill Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 ml-4">
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full border font-bold ${
                mode === 'grid'
                  ? isDark
                    ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                  : isDark
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}
            >
              {mode === 'grid' ? 'GRID 瀏覽模式' : mode === 'edit' ? 'EDIT 編修中' : 'ADD 新增中'}
            </span>
          </div>
        </div>

        {/* Top Right Action & Search Trigger */}
        <div className="flex items-center space-x-2">
          {selectedRow && (
            <div
              className={`hidden md:flex text-xs rounded-full px-3 py-1 border font-mono ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-yellow-300'
                  : 'bg-slate-50 border-slate-200 text-blue-900 font-bold'
              }`}
            >
              選取：[{selectedRow.cpaCode}] {selectedRow.cpaName}
            </div>
          )}

          <button
            onClick={openSearchModal}
            className={`px-3 py-1.5 rounded text-xs font-bold border flex items-center space-x-1.5 transition ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'
                : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800 shadow-2xs'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-blue-500" />
            <span>查詢 F2</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 p-4 md:p-6 flex flex-col gap-5 overflow-y-auto max-w-[1600px] w-full mx-auto">
        {/* Upper Part: FoxProGridCard */}
        <div className="w-full shrink-0">
          <FoxProGridCard<CpaItem>
            title="會計師/記帳士清單 (FoxProGridCard)"
            totalCount={rows.length}
            shortcutHint="↑↓ 換筆 · Enter / F6 編修 · Ins 新增 · F2 查詢 · Del 刪除"
            data={rows}
            columns={CPA_GRID_COLUMNS}
            selectedIndex={selectedIndex}
            onSelectRow={(_r, idx) => {
              setSelectedIndex(idx);
              gridContainerRef.current?.focus();
            }}
            onDoubleClickRow={startEdit}
            onKeyDown={handleGridKeyDown}
            gridContainerRef={gridContainerRef as unknown as React.RefObject<HTMLDivElement>}
            maxHeight="max-h-[220px]"
            loading={loading}
            emptyText="查無會計師/記帳士資料"
            getItemKey={(r) => r.cpaCode}
          />
        </div>

        {/* Lower Part: Form Card Input Area */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              明細卡片輸入區 (Card Details)
              {mode !== 'grid' && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">
                  - 編輯中，按 Enter 跳至下一欄位，按 Esc/F9 儲存
                </span>
              )}
            </h2>

            {mode === 'grid' && (
              <button
                onClick={startEdit}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                點此進入編修模式 [F6]
              </button>
            )}
          </div>

          <Wbase1020Form
            formData={formData}
            setFormData={setFormData}
            inputRefsMap={inputRefsMap}
            mode={mode}
            onFieldKeyDown={handleFormFieldKeyDown}
          />
        </div>
      </div>

      {/* Bottom Status & Action Bar */}
      <div className="mt-auto sticky bottom-0 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] font-mono">
        {/* Status Line */}
        <div
          className={`h-7 border-t flex items-center justify-between px-4 text-[11px] ${
            isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-700 font-medium'
          }`}
        >
          <div className="flex items-center gap-4 truncate">
            <span>
              {mode === 'grid'
                ? '瀏覽模式：↑↓換筆 · Enter/F6編修 · Ins新增 · F2查詢 · Del刪除 · Esc離開'
                : '編輯模式：Enter依序跳格 · Esc/F9儲存並回清單 · F12放棄'}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span>
              筆數：{selectedIndex + 1} / {rows.length} 筆
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                mode === 'grid' ? 'bg-blue-500' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="font-bold">{mode.toUpperCase()}</span>
          </div>
        </div>

        {/* Action Button Bar */}
        {mode === 'grid' ? (
          <div className="h-[46px] bg-[#1e293b] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={startAdd}
                className="h-8 px-3 rounded text-xs font-bold flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 shadow transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Ins 新增</span>
              </button>

              <button
                onClick={startEdit}
                className="h-8 px-3 rounded text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow transition cursor-pointer"
              >
                <Edit3 size={14} />
                <span>F6 編修</span>
              </button>

              <button
                onClick={() => openDeleteConfirm()}
                className="h-8 px-3 rounded text-xs font-bold flex items-center gap-1.5 bg-red-700 hover:bg-red-600 text-white shadow transition cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Del 刪除</span>
              </button>

              <div className="w-px h-5 bg-slate-700 mx-1 hidden sm:block" />

              <button
                onClick={openSearchModal}
                className="h-8 px-3 rounded text-xs font-bold flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <Search size={14} />
                <span>F2 查詢</span>
              </button>

              <button
                onClick={openPrint}
                className="h-8 px-3 rounded text-xs font-bold flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <Printer size={14} />
                <span>F7 列印</span>
              </button>
            </div>

            <div>
              <button
                onClick={() => {
                  if (onBackToMenu) onBackToMenu();
                  else gridContainerRef.current?.focus();
                }}
                className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogOut size={14} />
                <span>Esc 離開</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="h-[46px] bg-[#0f172a] flex items-center justify-between px-4">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>卡片編輯中 · 請依序填寫欄位，完成後按「儲存」或按 Esc</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Undo2 size={14} />
                <span>放棄取消 (F12)</span>
              </button>

              <button
                onClick={saveForm}
                className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <Save size={14} />
                <span>儲存並回清單 (Esc/F9)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* F2 Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
          <div
            className={`border-2 rounded-lg p-5 max-w-xl w-full shadow-2xl flex flex-col max-h-[80vh] transition-colors ${
              isDark ? 'bg-slate-900 border-blue-500 text-white' : 'bg-white border-blue-900 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-yellow-400">
                <Search size={18} />
                會計師/記帳士開窗搜尋 [F2]
              </h3>
              <span className="text-xs text-gray-400">↑↓ 選擇 · Enter 確認 · Esc 關閉</span>
            </div>

            <input
              type="text"
              autoFocus
              placeholder="輸入代號 / 姓名 / 統編 / 申報ID 快速搜尋..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSearchModalIndex((prev) => Math.min(filteredSearchRows.length - 1, prev + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSearchModalIndex((prev) => Math.max(0, prev - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const target = filteredSearchRows[searchModalIndex];
                  if (target) selectRowFromSearch(target.cpaCode);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeSearchModal();
                }
              }}
              className={`w-full px-3 py-2 rounded text-sm mb-3 border focus:outline-none ${
                isDark
                  ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
              }`}
            />

            <div ref={searchModalListRef} className="flex-1 overflow-y-auto divide-y max-h-[350px] border rounded">
              {filteredSearchRows.map((r, idx) => {
                const isHighlight = idx === searchModalIndex;
                return (
                  <div
                    key={r.cpaCode}
                    onClick={() => selectRowFromSearch(r.cpaCode)}
                    className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition ${
                      isHighlight
                        ? isDark
                          ? 'bg-yellow-950/80 text-yellow-300 font-bold'
                          : 'bg-blue-100 text-blue-900 font-bold'
                        : isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold w-12">[{r.cpaCode}]</span>
                      <span className="font-bold">{r.cpaName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                      <span>統編: {r.unifiedNo || '-'}</span>
                      <span>ID: {r.taxId || '-'}</span>
                    </div>
                  </div>
                );
              })}
              {filteredSearchRows.length === 0 && (
                <div className="py-8 text-center text-xs text-gray-400">查無符合條件的會計師/記帳士</div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-4 pt-2 border-t">
              <button
                onClick={closeSearchModal}
                className="px-4 py-1.5 rounded text-xs font-bold bg-gray-600 hover:bg-gray-500 text-white"
              >
                取消 (Esc)
              </button>
              <button
                onClick={() => {
                  const target = filteredSearchRows[searchModalIndex];
                  if (target) selectRowFromSearch(target.cpaCode);
                }}
                className="px-4 py-1.5 rounded text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white"
              >
                選取 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
          <div
            className={`border-2 rounded-lg p-6 max-w-md w-full shadow-2xl transition-colors ${
              isDark ? 'bg-slate-900 border-red-500 text-white' : 'bg-white border-red-600 text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3 text-red-500 mb-4">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold">確認刪除該筆會計師資料？</h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed">
              您即將刪除資料：
              <span className="font-bold text-yellow-400 ml-1">
                [{selectedRow.cpaCode}] {selectedRow.cpaName}
              </span>
              <br />
              此操作將從 DBF 與 PostgreSQL 資料庫中移除，無法復原。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className={`px-4 py-1.5 rounded font-bold text-sm transition ${
                  isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-slate-800'
                }`}
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded text-sm shadow transition"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {isPrintOpen && <Wbase1020Print />}

      {/* Auto-Close Toast */}
      {showAutoCloseToast && (
        <div
          className={`fixed bottom-14 right-6 z-50 flex items-center space-x-2 text-white px-4 py-2.5 rounded-lg shadow-xl border font-bold text-sm font-mono animate-bounce ${
            toastMessage && toastMessage.includes('提示')
              ? 'bg-amber-600 border-amber-400'
              : 'bg-emerald-600 border-emerald-400'
          }`}
        >
          {toastMessage && toastMessage.includes('提示') ? (
            <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-200" />
          ) : (
            <CheckCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage || '資料已成功儲存至 DBF 與 PostgreSQL！'}</span>
        </div>
      )}

      {/* Error Toast */}
      {errorToast && (
        <div className="fixed bottom-14 right-6 z-50 flex items-center justify-between space-x-3 bg-red-600 text-white px-4 py-2.5 rounded-lg shadow-xl border border-red-400 font-bold text-sm max-w-md font-mono">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>{errorToast}</span>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="text-white hover:text-gray-200 underline text-xs ml-2"
          >
            關閉
          </button>
        </div>
      )}
    </div>
  );
};
