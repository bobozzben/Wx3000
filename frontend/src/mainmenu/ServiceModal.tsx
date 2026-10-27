import React, { useEffect } from 'react';
import type { QuickServiceItem } from './types';
import {
  X,
  Bell,
  CloudDownload,
  Headphones,
  Mic,
  Zap,
  HardDrive,
  Globe,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useTheme } from '../wbase/menu/ThemeContext';

interface ServiceModalProps {
  service: QuickServiceItem | null;
  toolActionId: string | null;
  onClose: () => void;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({ service, toolActionId, onClose }) => {
  const { isDark } = useTheme();

  useEffect(() => {
    if (!service && !toolActionId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [service, toolActionId, onClose]);

  if (!service && !toolActionId) return null;

  const renderIcon = () => {
    if (service) {
      switch (service.iconType) {
        case 'bullhorn':
          return <Bell className="w-5 h-5 text-rose-400" />;
        case 'cloud':
          return <CloudDownload className="w-5 h-5 text-sky-400" />;
        case 'headset':
          return <Headphones className="w-5 h-5 text-orange-400" />;
        case 'mic':
          return <Mic className="w-5 h-5 text-amber-400" />;
        case 'zap':
          return <Zap className="w-5 h-5 text-yellow-400" />;
      }
    }

    if (toolActionId) {
      switch (toolActionId) {
        case 'batch_reports':
          return <FileText className="w-5 h-5 text-blue-400" />;
        case 'backup':
          return <HardDrive className="w-5 h-5 text-emerald-400" />;
        case 'update_standalone':
          return <RefreshCw className="w-5 h-5 text-indigo-400" />;
        case 'web_update':
          return <Globe className="w-5 h-5 text-cyan-400" />;
      }
    }

    return null;
  };

  const getTitle = () => {
    if (service) return service.title;
    switch (toolActionId) {
      case 'batch_reports':
        return '批次帳表列印作業';
      case 'backup':
        return '資料庫整體備份作業';
      case 'update_standalone':
        return '單機版程式與資料庫檢查更新';
      case 'web_update':
        return '奇勝雲端自動網路更版';
      default:
        return '系統工具';
    }
  };

  const getContent = () => {
    const cardCls = isDark
      ? 'bg-slate-800/70 border-slate-700/80 text-slate-200'
      : 'bg-white border-slate-200 text-slate-700';

    if (service) {
      switch (service.actionType) {
        case 'notice':
          return (
            <div className="space-y-3">
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  isDark
                    ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="font-bold text-sm">【重要公告】最新稅務法令修訂與軟體更版提醒</div>
                <div className="opacity-80">發佈日期：2026 年最新申報期</div>
                <p className="leading-relaxed">
                  配合財政部最新營所稅及營業稅申報格式更動，請各事務所及企業客戶確認網路更版至 V2.4-A
                  最新版本，以確保媒體申報檔案格式無誤。
                </p>
              </div>
              <ul className={`list-disc list-inside text-xs space-y-1.5 p-3.5 rounded-xl border ${cardCls}`}>
                <li>營業稅電子申報媒體檔案格式升級檢核完成。</li>
                <li>基本資料系統 (wbase) 全面支援 Web / 跨平台架構。</li>
                <li>二代健保補充保費新制試算邏輯同步更新。</li>
              </ul>
            </div>
          );
        case 'license':
          return (
            <div className={`space-y-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p>本系統之軟體使用版權已連結奇勝雲端授權管理中心：</p>
              <div className={`p-3.5 rounded-xl border font-mono text-[11px] space-y-1.5 ${cardCls}`}>
                <div>客戶代碼：DEMO-3000-UNIV</div>
                <div>授權期間：2026/01/01 ~ 2026/12/31</div>
                <div>授權模組：全功能旗艦版 (稅務+審計+機關+公司版)</div>
                <div>連線狀態：雲地雙向同步就緒</div>
              </div>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                如需增購授權人次或延長合約，請洽各區分公司客服專線。
              </p>
            </div>
          );
        case 'support':
          return (
            <div className={`space-y-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p>歡迎使用奇勝資訊即時線上客服系統，服務時間：週一至週五 08:30 ~ 17:30</p>
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  isDark
                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                    : 'bg-orange-50 border-orange-200 text-orange-900'
                }`}
              >
                <div className="font-bold">遠端連線工程師諮詢：</div>
                <div>免付費技術支援專線：0800-000-300</div>
                <div>線上 AnyDesk / TeamViewer 支援請備妥連線代碼。</div>
              </div>
            </div>
          );
        case 'voice':
          return (
            <div className={`space-y-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <div
                className={`p-3.5 rounded-xl border ${
                  isDark
                    ? 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                <div className="font-bold mb-1">AI 語音助理啟動中</div>
                <p>
                  您可直接透過麥克風說出指令，例如：「開啟基本資料」、「營業稅申報」、「台北公司電話」。
                </p>
              </div>
              <div className="flex items-center justify-center p-4">
                <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                  <Mic className="w-6 h-6 text-rose-500" />
                </div>
              </div>
            </div>
          );
        case 'learning':
          return (
            <div className={`space-y-2.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                奇勝客戶充電站 - 知識庫與實務指引：
              </p>
              <div className="space-y-2">
                <a
                  href="#video1"
                  onClick={(e) => e.preventDefault()}
                  className={`block p-2.5 rounded-xl border transition ${
                    isDark
                      ? 'bg-slate-800/70 hover:bg-slate-800 border-slate-700 text-sky-400'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-blue-700'
                  }`}
                >
                  ▶ [影音教學] 營業稅 401 申報與進銷項憑證扣抵實務
                </a>
                <a
                  href="#video2"
                  onClick={(e) => e.preventDefault()}
                  className={`block p-2.5 rounded-xl border transition ${
                    isDark
                      ? 'bg-slate-800/70 hover:bg-slate-800 border-slate-700 text-sky-400'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-blue-700'
                  }`}
                >
                  ▶ [影音教學] wbase 基本資料系統客戶/廠商批次匯入技巧
                </a>
                <a
                  href="#doc1"
                  onClick={(e) => e.preventDefault()}
                  className={`block p-2.5 rounded-xl border transition ${
                    isDark
                      ? 'bg-slate-800/70 hover:bg-slate-800 border-slate-700 text-sky-400'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-blue-700'
                  }`}
                >
                  📄 [手冊下載] 會計總帳年度結帳與期末調整分錄指引
                </a>
              </div>
            </div>
          );
      }
    }

    if (toolActionId) {
      switch (toolActionId) {
        case 'batch_reports':
          return (
            <div className={`text-xs space-y-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p className="leading-relaxed">
                批次帳表精靈可一次產製多個帳冊與傳票報表，支援總分類帳、明細分類帳、日記帳與損益表打包轉檔匯出
                PDF / Excel。
              </p>
              <div className={`p-3 rounded-xl border ${cardCls}`}>
                已準備就緒，可指定產製年度、月份區間與公司代碼。
              </div>
            </div>
          );
        case 'backup':
          return (
            <div className={`text-xs space-y-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p className="leading-relaxed">
                資料備份作業將備份目前執行資料庫（包含全部客戶資料主檔及傳票明細）。
              </p>
              <div
                className={`p-3 rounded-xl border font-mono ${
                  isDark
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                目標備份目錄：C:\Users\ben\Dropbox\W3000\Backup\auto_backup.zip
              </div>
            </div>
          );
        case 'update_standalone':
          return (
            <div className={`text-xs space-y-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p className="leading-relaxed">
                單機版檢查程式將確認本機與主機執行檔版本是否一致，並自動修復過期索引與資料結構。
              </p>
            </div>
          );
        case 'web_update':
          return (
            <div className={`text-xs space-y-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <div
                className={`p-3 rounded-xl border font-semibold ${
                  isDark
                    ? 'bg-blue-950/40 border-blue-800/60 text-blue-300'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                目前版本：V2.4-A (最新版)
              </div>
              <p className="leading-relaxed">
                已連線至奇勝自動更版伺服器，所有核心模組與稅法參數均已是最新狀態，無需下載補丁。
              </p>
            </div>
          );
      }
    }

    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden flex flex-col font-sans transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b ${
            isDark
              ? 'bg-slate-950/80 border-slate-800 text-white'
              : 'bg-slate-800 border-slate-700 text-white'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {renderIcon()}
            <h3 className="font-bold text-sm sm:text-base text-amber-300">{getTitle()}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`p-5 flex-1 ${isDark ? 'bg-slate-900/90' : 'bg-slate-50/70'}`}>
          {getContent()}
        </div>

        <div
          className={`px-5 py-3 border-t flex justify-end ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/80 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
};
