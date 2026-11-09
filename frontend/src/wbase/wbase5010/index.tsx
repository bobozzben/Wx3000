import React from 'react';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { Wbase5010_CustomerPrint } from './Wbase5010_CustomerPrint';
import { Wbase5020_LabelPrint } from './Wbase5020_LabelPrint';
import { Wbase5030_KeyinStats } from './Wbase5030_KeyinStats';
import { Wbase5040_BusinessStatus } from './Wbase5040_BusinessStatus';
import { Wbase5050_FinanceStatus } from './Wbase5050_FinanceStatus';
import { Wbase5060_BsdescForm } from './Wbase5060_BsdescForm';

export type Wbase50TabType = '5010' | '5020' | '5030' | '5040' | '5050' | '5060';

interface Wbase5010IndexProps {
  initialTab?: Wbase50TabType;
  onClose?: () => void;
}

const SCREEN_TITLES: Record<Wbase50TabType, string> = {
  '5010': '5-1 客戶資料列印',
  '5020': '5-2 郵寄標籤列印',
  '5030': '5-3 客戶登打統計表',
  '5040': '5-4 客戶營業狀況表',
  '5050': '5-5 客戶財務狀況參考表',
  '5060': '5-6 委任書輸入維護',
};

export const Wbase5010Index: React.FC<Wbase5010IndexProps> = ({
  initialTab = '5010',
  onClose,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gray-950 overflow-hidden font-mono">
      {/* 頂部共用 WbasePageHeader */}
      <WbasePageHeader
        title={SCREEN_TITLES[initialTab]}
        code={`wbase${initialTab}`}
        category="管理報表"
        mode="grid"
        onBackToMenu={onClose}
      />

      {/* 主工作區 (依選單傳入的 initialTab 顯示對應畫面，不顯示頁籤) */}
      <div className="flex-1 overflow-hidden">
        {initialTab === '5010' && <Wbase5010_CustomerPrint onClose={onClose} />}
        {initialTab === '5020' && <Wbase5020_LabelPrint onClose={onClose} />}
        {initialTab === '5030' && <Wbase5030_KeyinStats onClose={onClose} />}
        {initialTab === '5040' && <Wbase5040_BusinessStatus onClose={onClose} />}
        {initialTab === '5050' && <Wbase5050_FinanceStatus onClose={onClose} />}
        {initialTab === '5060' && <Wbase5060_BsdescForm onClose={onClose} />}
      </div>
    </div>
  );
};

export default Wbase5010Index;
