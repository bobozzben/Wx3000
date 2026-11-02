import React, { useState, useEffect } from 'react';
import {
  Printer,
  Tag,
  BarChart2,
  TrendingUp,
  DollarSign,
  FileText,
} from 'lucide-react';
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

export const Wbase5010Index: React.FC<Wbase5010IndexProps> = ({
  initialTab = '5010',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<Wbase50TabType>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // 全域 Alt+1 ~ Alt+6 快速切換頁籤
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('5010');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('5020');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('5030');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('5040');
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('5050');
        } else if (e.key === '6') {
          e.preventDefault();
          setActiveTab('5060');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tabItems = [
    { key: '5010', label: '5-1 客戶資料列印', icon: Printer },
    { key: '5020', label: '5-2 郵寄標籤列印', icon: Tag },
    { key: '5030', label: '5-3 客戶登打統計表', icon: BarChart2 },
    { key: '5040', label: '5-4 客戶營業狀況表', icon: TrendingUp },
    { key: '5050', label: '5-5 客戶財務狀況參考表', icon: DollarSign },
    { key: '5060', label: '5-6 委任書輸入維護', icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gray-950 overflow-hidden font-mono">
      {/* 頂部共用 WbasePageHeader */}
      <WbasePageHeader
        title="5. 客戶資料列印與委任書管理"
        category="基本資料"
        mode="grid"
        onBackToMenu={onClose}
      />

      {/* 模組分頁選單列 */}
      <div className="flex items-center gap-1 px-4 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm shrink-0 overflow-x-auto">
        {tabItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key as Wbase50TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 主工作區切換 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === '5010' && <Wbase5010_CustomerPrint onClose={onClose} />}
        {activeTab === '5020' && <Wbase5020_LabelPrint onClose={onClose} />}
        {activeTab === '5030' && <Wbase5030_KeyinStats onClose={onClose} />}
        {activeTab === '5040' && <Wbase5040_BusinessStatus onClose={onClose} />}
        {activeTab === '5050' && <Wbase5050_FinanceStatus onClose={onClose} />}
        {activeTab === '5060' && <Wbase5060_BsdescForm onClose={onClose} />}
      </div>
    </div>
  );
};

export default Wbase5010Index;
