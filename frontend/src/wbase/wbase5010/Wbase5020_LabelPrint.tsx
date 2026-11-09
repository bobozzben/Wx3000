import React, { useEffect, useRef, useState } from 'react';
import { Printer, FileSpreadsheet, LayoutGrid, MapPin, Tag, User, X } from 'lucide-react';
import { generateLabels, exportReportToXlsx, type LabelCustomerItem } from './services/wbase5010';
import { printElement } from '../../utils/printUtil';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { MessageDialog, type MessageState } from '../wbase2030/Wbase2030Dialogs';
import { Wbase50CustomerSelect } from './Wbase50CustomerSelect';
import { Wbase50ConditionForm, type ConditionSection, type ConditionValues } from './Wbase50ConditionForm';
import { isCustomerChosen, toCopies, useWbase50Customers, useWbase50XlsxExport } from './wbase50Shared';

interface Wbase5020LabelPrintProps {
  onClose?: () => void;
}

const DEFAULT_LABEL_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '代號', selected: true },
  { key: 'abbr', label: '簡稱', customTitle: '簡稱', selected: true },
  { key: 'name', label: '客戶名稱', customTitle: '客戶名稱', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'linkman', label: '聯絡人', customTitle: '聯絡人', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '地址', selected: true },
  { key: 'prn', label: '列印份數', customTitle: '份數', selected: true },
];

/** 名冊匯出欄位設定 (第二段 F8) */
const XLSX_STORAGE_KEY = 'wbase5020_xlsx_export_config';

const option = (key: string, title: string, icon: ConditionSection['icon'], labels: string[]): ConditionSection => ({
  title,
  icon,
  fields: [{ kind: 'options', key, label: title, options: labels.map((label, i) => ({ value: i + 1, label })) }],
});

/** VFP wbase2012 的四組選項 (依 TabIndex 順序：lab、lty、k_add、pname) */
const SECTIONS: ConditionSection[] = [
  option('labelType', '標籤種類', Tag, ['磁片標籤', '郵遞標籤']),
  option('layoutType', '列印樣式', LayoutGrid, ['橫式 (2 欄)', '直式 (3 欄)']),
  option('addrType', '列印地址', MapPin, ['公司地址', '聯絡地址']),
  option('recipientType', '收信人', User, ['負責人', '聯絡人']),
];

/**
 * 5-2 郵寄標籤列印 (VFP base50.prg wbasemenu05cmd02)。
 * 第一段設定各客戶列印份數 (wbase201201)，Esc 離開後有份數才進入第二段標籤條件 (wbase2012)，
 * F7 產生標籤並開預覽、F8 匯出標籤名冊 Excel。
 */
export const Wbase5020_LabelPrint: React.FC<Wbase5020LabelPrintProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { rows, setRows, loading, error } = useWbase50Customers();
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  // VFP wbase2012.Init：lab=1、lty=1、k_add=1、pname=2
  const [values, setValues] = useState<ConditionValues>({ labelType: 1, layoutType: 1, addrType: 1, recipientType: 2 });
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const [isLabelPreviewOpen, setIsLabelPreviewOpen] = useState(false);
  const [expandedLabels, setExpandedLabels] = useState<LabelCustomerItem[]>([]);
  const labelPrintContainerRef = useRef<HTMLDivElement>(null);

  const chosen = rows.filter((r) => isCustomerChosen(r, 'copies'));
  const totalCopies = chosen.reduce((sum, r) => sum + toCopies(r.prn), 0);
  const layoutType = Number(values.layoutType);
  const addrType = Number(values.addrType);
  const recipientType = Number(values.recipientType);

  /** F8 匯出名冊：份數大於 0 的客戶 (不必查詢) */
  const xlsx = useWbase50XlsxExport({
    storageKey: XLSX_STORAGE_KEY,
    fields: DEFAULT_LABEL_XLSX_FIELDS,
    fileName: () => '郵寄標籤列印名冊',
    load: async () => chosen.map((r) => ({ ...r, prn: toCopies(r.prn) })),
  });

  /** VFP：tmpcust 刪除份數為 0 的客戶後沒有資料就直接回選單，不開 wbase2012 */
  const leaveSelect = () => {
    if (chosen.length === 0) onClose?.();
    else setPhase('condition');
  };

  /** F7：依份數展開標籤並開預覽 */
  const handleGenerateLabels = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const data = await generateLabels({
        labelType: Number(values.labelType),
        layoutType,
        addrType,
        recipientType,
        items: chosen.map((r) => ({ ...r, prn: toCopies(r.prn), selected: true })),
      });
      if (data.length === 0) {
        setMessage({ type: 'warning', title: '訊息', lines: ['無資料可列印!!'] });
        return;
      }
      setExpandedLabels(data);
      setIsLabelPreviewOpen(true);
    } catch (err) {
      setMessage({ type: 'error', title: '錯誤', lines: [`產生標籤失敗：${err instanceof Error ? err.message : String(err)}`] });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintLabelsPaper = () => {
    if (labelPrintContainerRef.current) {
      printElement(labelPrintContainerRef.current, '郵寄標籤列印');
    }
  };

  const handleExportLabelsXlsx = async () => {
    return await exportReportToXlsx(
      chosen.map((r) => ({ ...r, prn: toCopies(r.prn) })),
      DEFAULT_LABEL_XLSX_FIELDS,
      '郵寄標籤列印名冊'
    );
  };

  // 標籤預覽：F7 紙張列印、F8 匯出 Excel、Esc 關閉 (與 FoxProPrintModal 相同)
  const previewActionsRef = useRef({ print: handlePrintLabelsPaper, xlsx: handleExportLabelsXlsx });
  previewActionsRef.current = { print: handlePrintLabelsPaper, xlsx: handleExportLabelsXlsx };
  useEffect(() => {
    if (!isLabelPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsLabelPreviewOpen(false);
      } else if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        previewActionsRef.current.print();
      } else if (e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        void previewActionsRef.current.xlsx();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isLabelPreviewOpen]);

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
      {phase === 'select' ? (
        <Wbase50CustomerSelect
          mode="copies"
          rows={rows}
          onRowsChange={setRows}
          loading={loading}
          error={error}
          gridId="wbase5020_label_grid"
          hint="在列印份數欄輸入每家要印的張數 (Space 切換 0 / 1 份)，設定好後按 Esc 離開，再選擇標籤樣式 (沒有任何份數時直接回主選單)。"
          onExit={leaveSelect}
        />
      ) : (
        <Wbase50ConditionForm
          title="郵寄標籤列印"
          formCode="VFP wbase2012 ‧ wbasemenu05cmd02"
          sections={SECTIONS}
          values={values}
          onChange={setValues}
          chosenCount={chosen.length}
          chosenNote={`共 ${totalCopies} 張標籤`}
          active={!isLabelPreviewOpen && !generating && message === null && !xlsx.busy && !xlsx.selectorOpen}
          printLabel="F7. 標籤列印"
          onPrint={() => {
            xlsx.setStatus(null);
            void handleGenerateLabels();
          }}
          onExport={() => void xlsx.run()}
          exportLabel="F8. 匯出名冊"
          exportConfigure={xlsx.configure}
          onExportConfigureChange={xlsx.setConfigure}
          status={xlsx.status}
          onCancel={() => onClose?.()}
        />
      )}

      {xlsx.selectorElement}

      {message && (
        <MessageDialog
          message={message}
          onDismiss={() => {
            setMessage(null);
            message.onClose?.();
          }}
        />
      )}

      {/* 標籤視覺預覽與列印彈窗 */}
      {isLabelPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <div className={`flex flex-col w-full max-w-5xl h-[90vh] rounded-lg border shadow-2xl overflow-hidden ${
            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-3 border-b ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-gray-300'
            }`}>
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold">
                  郵寄標籤排版預覽 (共 {expandedLabels.length} 張標籤，{layoutType === 1 ? '橫式 2 欄' : '直式 3 欄'})
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportLabelsXlsx}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  F8 匯出 Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrintLabelsPaper}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow focus:ring-2 focus:ring-yellow-400"
                >
                  <Printer className="w-4 h-4" />
                  F7 紙張直接列印
                </button>
                <button
                  type="button"
                  onClick={() => setIsLabelPreviewOpen(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                  title="Esc 關閉"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 標籤排版視覺展示區 */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-gray-950">
              <div
                ref={labelPrintContainerRef}
                className={`max-w-4xl mx-auto p-8 bg-white text-black shadow-lg ${
                  layoutType === 1 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-3 gap-3'
                }`}
                style={{ fontFamily: 'Consolas, "Microsoft JhengHei", monospace' }}
              >
                {expandedLabels.map((lbl, idx) => {
                  const targetAddr = addrType === 2 ? lbl.invaddr || lbl.addr : lbl.addr;
                  const recipient = recipientType === 2 ? lbl.linkman || lbl.hname : lbl.hname;

                  return (
                    <div
                      key={idx}
                      className="border border-dashed border-gray-400 p-4 rounded bg-white flex flex-col justify-between h-44 text-xs leading-relaxed"
                    >
                      <div>
                        {/* 頂部：代號與郵遞標記 */}
                        <div className="flex justify-between items-center text-gray-500 text-[11px] mb-1">
                          <span className="font-mono font-bold text-blue-800">[{lbl.no}]</span>
                          <span>國內郵資已付</span>
                        </div>
                        {/* 地址 */}
                        <div className="text-sm font-bold text-gray-800 line-clamp-2 mt-1">
                          {targetAddr || '（無地址）'}
                        </div>
                      </div>

                      {/* 收件公司與收件人 */}
                      <div className="mt-2 border-t pt-2 border-gray-200">
                        <div className="font-bold text-sm text-gray-900 truncate">
                          {lbl.name}
                        </div>
                        <div className="flex items-center justify-between text-gray-700 mt-1">
                          <span className="text-sm font-semibold">{recipient ? `${recipient} 先生/女士 收` : '負責人 收'}</span>
                          <span className="text-[11px] text-gray-500 font-mono">{lbl.tel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
