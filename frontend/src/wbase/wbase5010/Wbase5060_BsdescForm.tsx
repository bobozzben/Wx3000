import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText,
  Printer,
  Plus,
  Trash2,
  Copy,
  Edit3,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  fetchBsdescList,
  createBsdesc,
  updateBsdesc,
  deleteBsdesc,
  exportReportToXlsx,
  buildBsdescWordRequest,
  selectBsdescForPrint,
  BSDESC_WORD_TEMPLATE,
  type BsdescItem,
} from './services/wbase5010';
import { FoxProGridV2, type ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { printElement } from '../../utils/printUtil';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { getDataDrive } from '../../services/apiConfig';
import { getOfficeStatus, mergeWordTemplate, openWordTemplate } from '../../services/localagent';
import { fetchOffice } from '../../services/wbase1010';

interface Wbase5060BsdescFormProps {
  onClose?: () => void;
}

const DEFAULT_BSDESC_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'seq', label: '順序', customTitle: '順序', selected: true },
  { key: 'no', label: '條文代號', customTitle: '條文代號', selected: true },
  { key: 'desc', label: '條文內容說明', customTitle: '內容說明', selected: true },
  { key: 'sel', label: '選取記號', customTitle: '記號', selected: true },
];

export const Wbase5060_BsdescForm: React.FC<Wbase5060BsdescFormProps> = ({ onClose }) => {
  const { isDark } = useTheme();

  // 頂部表頭參數
  const [rpdate, setRpdate] = useState('115/01/01');
  const [comphidno, setComphidno] = useState('');
  const [endyear, setEndyear] = useState('115');
  const rpdateRef = useRef<HTMLInputElement>(null);
  const comphidnoRef = useRef<HTMLInputElement>(null);
  const endyearRef = useRef<HTMLInputElement>(null);

  // 資料列表
  const [rows, setRows] = useState<BsdescItem[]>([]);
  // F7 要印的條文：網頁預覽與轉出 Word 用同一個篩選 (指標有勾、依 seq)
  const printRows = useMemo(() => selectBsdescForPrint(rows), [rows]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // F7 委任書列印預覽 Modal (本機沒有 Word 時使用)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const printDocRef = useRef<HTMLDivElement>(null);

  // F6 開啟範本 / F7 轉出 Word 進行中 (ref 防止連按重複執行)
  const [wordBusy, setWordBusy] = useState(false);
  const wordBusyRef = useRef(false);

  // 載入條文資料
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setStatusMsg('載入委任書條文資料中...');
      const list = await fetchBsdescList();
      setRows(list);
      setStatusMsg(`已載入 ${list.length} 筆委任書條文`);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`載入失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 新增條文 (Ins)
  const handleInsertRow = useCallback(async () => {
    const nextSeq = rows.length > 0 ? Math.max(...rows.map(r => r.seq)) + 1 : 1;
    const newRow: BsdescItem = {
      seq: nextSeq,
      no: '',
      desc: '',
      sel: '→',
      serial: nextSeq,
    };

    try {
      setStatusMsg('新增條文中...');
      const res = await createBsdesc(newRow);
      if (res.success) {
        newRow.seq = res.seq;
        newRow.serial = res.seq;
        setRows(prev => [...prev, newRow]);
        setSelectedRowIndex(rows.length);
        setStatusMsg(`已新增第 ${res.seq} 條文`);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`新增失敗: ${err.message}`);
    }
  }, [rows]);

  // 刪除條文 (Del)
  const handleDeleteRow = useCallback(async () => {
    if (rows.length === 0 || selectedRowIndex < 0 || selectedRowIndex >= rows.length) return;
    const target = rows[selectedRowIndex];
    if (!window.confirm(`確定要刪除第 ${target.seq} 條文嗎？`)) return;

    try {
      setStatusMsg('刪除條文中...');
      const res = await deleteBsdesc(target.seq);
      if (res.success) {
        const next = rows.filter((_, idx) => idx !== selectedRowIndex);
        setRows(next);
        setSelectedRowIndex(Math.max(0, selectedRowIndex - 1));
        setStatusMsg(`已刪除條文`);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`刪除失敗: ${err.message}`);
    }
  }, [rows, selectedRowIndex]);

  // 複製目前條文 (F4)
  const handleCopyRow = useCallback(async () => {
    if (rows.length === 0 || selectedRowIndex < 0 || selectedRowIndex >= rows.length) return;
    const current = rows[selectedRowIndex];
    const nextSeq = Math.max(...rows.map(r => r.seq)) + 1;
    const copiedRow: BsdescItem = {
      seq: nextSeq,
      no: current.no,
      desc: current.desc,
      sel: current.sel,
      serial: nextSeq,
    };

    try {
      setStatusMsg('複製條文中...');
      const res = await createBsdesc(copiedRow);
      if (res.success) {
        copiedRow.seq = res.seq;
        copiedRow.serial = res.seq;
        setRows(prev => [...prev, copiedRow]);
        setSelectedRowIndex(rows.length);
        setStatusMsg(`已複製條文至第 ${res.seq} 項`);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`複製失敗: ${err.message}`);
    }
  }, [rows, selectedRowIndex]);

  const runWordTask = useCallback(async (task: () => Promise<void>) => {
    if (wordBusyRef.current) return;
    wordBusyRef.current = true;
    setWordBusy(true);
    try {
      await task();
    } finally {
      wordBusyRef.current = false;
      setWordBusy(false);
    }
  }, []);

  // F6 委任書編修 (VFP wbs_rep2 F6.Click)：在本機開啟範本 <資料磁碟機>:\W3000\comm\wbase001.DOC 讓使用者直接修改
  const handleOpenTemplate = useCallback(() => runWordTask(async () => {
    setStatusMsg('開啟委任書範本中...');
    const res = await openWordTemplate(BSDESC_WORD_TEMPLATE, getDataDrive());
    if (res.success) {
      setStatusMsg(`已開啟委任書範本 ${res.path ?? ''}，修改後在 Word 存檔即可`);
    } else {
      setStatusMsg(`開啟委任書範本失敗: ${res.error ?? ''}`);
      window.alert(`無法開啟委任書範本：\n${res.error ?? ''}`);
    }
  }), [runWordTask]);

  // F7 列印 (VFP wbs_rep2 F7.Click + Pap1)：本機有 Word 時以 wbase001.DOC 為底轉出 docx，沒有 Word 時開網頁預覽
  const handlePrint = useCallback(() => {
    if (wordBusyRef.current || isPrintModalOpen) return;
    const missing = !endyear.trim()
      ? { msg: '請輸入結算年度', ref: endyearRef }
      : !rpdate.trim()
        ? { msg: '請輸入委任日期', ref: rpdateRef }
        : !comphidno.trim()
          ? { msg: '請輸入負責人證號', ref: comphidnoRef }
          : null;
    if (missing) {
      window.alert(missing.msg);
      missing.ref.current?.focus();
      return;
    }
    // Word 與網頁預覽都只列指標有勾的條文；都沒勾時兩條路徑給同一個提示 (VFP 不提示，直接印出空白的委任內容)
    if (printRows.length === 0
      && !window.confirm('沒有勾選任何條文 (指標欄)，委任內容會是空白。\n仍要列印嗎？')) {
      setStatusMsg('沒有勾選條文，已取消列印');
      return;
    }

    void runWordTask(async () => {
      setStatusMsg('檢查本機 Word...');
      const status = await getOfficeStatus();
      if (!status.word) {
        setStatusMsg(
          !status.reachable
            ? '無法連線 LocalAgent，改用網頁預覽'
            : status.outdated
              ? 'LocalAgent 版本未支援 Word，改用網頁預覽'
              : '本機未偵測到 Word，改用網頁預覽'
        );
        setIsPrintModalOpen(true);
        return;
      }

      setStatusMsg('讀取事務所資料...');
      const office = await fetchOffice().catch(() => null);
      const request = buildBsdescWordRequest({ rows, rpdate, comphidno, office, drive: getDataDrive() });
      setStatusMsg(`轉出 Word 委任書中 (${request.paragraphs.length} 條條文)...`);
      const res = await mergeWordTemplate(request);
      if (res.success) {
        setStatusMsg(`已轉出 Word 委任書 ${res.path ?? ''}${office ? '' : ' (讀不到事務所資料，以假字串代替)'}`);
      } else {
        setStatusMsg(`轉出 Word 失敗: ${res.error ?? ''}`);
        window.alert(`轉出 Word 委任書失敗：\n${res.error ?? ''}\n\n改用網頁預覽。`);
        setIsPrintModalOpen(true);
      }
    });
  }, [isPrintModalOpen, endyear, rpdate, comphidno, rows, printRows, runWordTask]);

  // 儲存列行內編輯
  const handleSaveRow = async (row: BsdescItem, _rIdx?: number) => {
    try {
      await updateBsdesc(row.seq, row);
      setStatusMsg(`第 ${row.seq} 條文已自動存檔`);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`存檔失敗: ${err.message}`);
    }
  };

  // F6 / F7 在 capture 階段攔截：FoxProGridV2 也在 window 監聽 F7 (onOpenPrint)，不攔下會轉出兩份
  useEffect(() => {
    const handleFunctionKey = (e: KeyboardEvent) => {
      if (e.key !== 'F6' && e.key !== 'F7') return;
      e.preventDefault();
      e.stopPropagation();
      if (isPrintModalOpen) return;
      if (e.key === 'F6') void handleOpenTemplate();
      else handlePrint();
    };
    window.addEventListener('keydown', handleFunctionKey, true);
    return () => window.removeEventListener('keydown', handleFunctionKey, true);
  }, [isPrintModalOpen, handleOpenTemplate, handlePrint]);

  // 全域快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPrintModalOpen) return;

      if (e.key === 'Insert') {
        e.preventDefault();
        handleInsertRow();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleDeleteRow();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleCopyRow();
      } else if (e.key === ' '&& (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        // 切換目前列 sel
        if (selectedRowIndex >= 0 && selectedRowIndex < rows.length) {
          const next = [...rows];
          const curr = next[selectedRowIndex];
          curr.sel = curr.sel === '→' ? '' : '→';
          setRows(next);
          handleSaveRow(curr, selectedRowIndex);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (onClose) onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintModalOpen, selectedRowIndex, rows, handleInsertRow, handleDeleteRow, handleCopyRow, onClose]);

  // FoxProGridV2 欄位定義
  const columns: ColumnDefV2<BsdescItem>[] = [
    {
      key: 'sel',
      label: '指標',
      width: '60px',
      align: 'center',
      renderCell: (val, row, rIdx) => (
        <span
          className="font-bold text-lg text-yellow-500 cursor-pointer"
          onClick={() => {
            const next = [...rows];
            next[rIdx] = { ...row, sel: row.sel === '→' ? '' : '→' };
            setRows(next);
            handleSaveRow(next[rIdx], rIdx);
          }}
        >
          {val || ' '}
        </span>
      ),
    },
    {
      key: 'seq',
      label: '順序',
      width: '70px',
      editable: false,
      align: 'center',
    },
    {
      key: 'no',
      label: '條文代號',
      width: '100px',
      editable: true,
      align: 'center',
      uppercase: true,
      maxLength: 10,
    },
    {
      key: 'desc',
      label: '委任書條文 / 查核程序說明 (Enter修改)',
      width: '600px',
      editable: true,
      renderCell: val => <span className="block truncate pr-2">{val || '（無說明）'}</span>,
    },
  ];

  // 列印委任書文件
  const handlePrintDocument = () => {
    if (printDocRef.current) {
      printElement(printDocRef.current, '委任書列印');
    }
  };

  // 匯出條文清冊
  const handleExportXlsx = async () => {
    return await exportReportToXlsx(rows, DEFAULT_BSDESC_XLSX_FIELDS, '委任書條文清單');
  };

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-slate-100 text-gray-900'}`}>
      {/* 頂部委任書表頭參數 */}
      <div className={`p-4 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-300'} shadow-sm`}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-500">委任日期:</span>
            <input
              ref={rpdateRef}
              type="text"
              value={rpdate}
              onChange={e => setRpdate(e.target.value)}
              placeholder="115/01/01"
              className={`w-28 px-2 py-1 text-sm border rounded text-center ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">負責人證號:</span>
            <input
              ref={comphidnoRef}
              type="text"
              value={comphidno}
              onChange={e => setComphidno(e.target.value.toUpperCase())}
              placeholder="身分證號"
              className={`w-32 px-2 py-1 text-sm border rounded uppercase ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">結算年度:</span>
            <input
              ref={endyearRef}
              type="text"
              value={endyear}
              onChange={e => setEndyear(e.target.value)}
              className={`w-20 px-2 py-1 text-sm border rounded text-center ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>

          {/* 按鈕群 */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleInsertRow}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow"
              title="Ins 新增條文"
            >
              <Plus className="w-3.5 h-3.5" />
              Ins 新增
            </button>
            <button
              type="button"
              onClick={handleDeleteRow}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded shadow"
              title="Del 刪除條文"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Del 刪除
            </button>
            <button
              type="button"
              onClick={handleCopyRow}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-800 dark:text-gray-200"
              title="F4 複製條文"
            >
              <Copy className="w-3.5 h-3.5" />
              F4 複製
            </button>
            <button
              type="button"
              onClick={() => void handleOpenTemplate()}
              disabled={wordBusy}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded shadow disabled:opacity-50"
              title="F6 以 Word 開啟委任書範本 wbase001.DOC 編修"
            >
              <Edit3 className="w-3.5 h-3.5" />
              F6 委任書編修
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={wordBusy}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
              title="F7 委任書列印 (本機有 Word 時轉出 docx，否則開網頁預覽)"
            >
              <Printer className="w-4 h-4" />
              F7 委任書列印
            </button>
          </div>
        </div>
      </div>

      {/* 主體條文維護表格 (FoxProGridV2) */}
      <div className="flex-1 overflow-hidden p-2">
        <FoxProGridV2
          rows={rows}
          columns={columns}
          createEmptyRow={() => ({
            seq: rows.length + 1,
            no: '',
            desc: '',
            sel: '→',
            serial: rows.length + 1,
          })}
          onRowsChange={newRows => setRows(newRows)}
          onSaveRow={handleSaveRow}
          onOpenPrint={handlePrint}
          gridId="wbase5060_bsdesc_grid"
        />
      </div>

      {/* 底部狀態列 */}
      <div className={`px-4 py-1.5 text-xs flex justify-between items-center border-t ${
        isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-200 border-slate-300 text-gray-600'
      }`}>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            [Ins] 新增 | [Del] 刪除 | [F4] 複製 | [F6] 委任書編修 | [Space] 選/不選 | [Enter] 換欄 | [F7] 列印 | [Esc] 離開
          </span>
          <span>{statusMsg}</span>
        </div>
        <div>
          共 <strong className="text-yellow-600">{rows.length}</strong> 條條文
        </div>
      </div>

      {/* F7 委任書整份預覽與直印彈窗 (本機沒有 Word、或轉出 Word 失敗時使用) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <div className={`flex flex-col w-full max-w-4xl h-[92vh] rounded-lg border shadow-2xl overflow-hidden ${
            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-3 border-b ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-gray-300'
            }`}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold">委任書列印預覽</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportXlsx}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  匯出 Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrintDocument}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow focus:ring-2 focus:ring-yellow-400"
                >
                  <Printer className="w-4 h-4" />
                  紙張直接列印
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 委任書 A4 預覽紙張區 */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-200 dark:bg-gray-950">
              <div
                ref={printDocRef}
                className="max-w-2xl mx-auto p-12 bg-white text-black shadow-xl rounded min-h-[900px] leading-relaxed"
                style={{ fontFamily: '"Microsoft JhengHei", "SimSun", sans-serif' }}
              >
                {/* 標題 */}
                <h1 className="text-2xl font-bold text-center tracking-widest mb-2">委　任　書</h1>
                <div className="text-right text-xs text-gray-500 mb-6">
                  委任日期：{rpdate}　　結算年度：{endyear} 年度
                </div>

                {/* 條文內容 */}
                <div className="space-y-4 text-sm leading-loose">
                  {printRows.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="font-bold shrink-0">{item.seq}、</span>
                      <p className="text-justify">{item.desc || '（無說明）'}</p>
                    </div>
                  ))}
                </div>

                {/* 簽章立約區 */}
                <div className="mt-16 pt-8 border-t border-gray-400 grid grid-cols-2 gap-8 text-sm">
                  <div className="space-y-4">
                    <p className="font-bold">委任人（甲方）：</p>
                    <p>營利事業名稱：</p>
                    <p>統一編號：</p>
                    <p>負責人：</p>
                    <p>負責人身分證號：{comphidno}</p>
                    <p>營業地址：</p>
                  </div>
                  <div className="space-y-4">
                    <p className="font-bold">受任人（乙方）：</p>
                    <p>事務所名稱：</p>
                    <p>會計師／記帳士：</p>
                    <p>登錄證字號：</p>
                    <p>事務所地址：</p>
                    <p>聯絡電話：</p>
                  </div>
                </div>

                <div className="text-center text-xs text-gray-400 mt-12">
                  中華民國　　　年　　　月　　　日
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
