import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, XCircle, RefreshCw, Save, X, Globe, Laptop } from 'lucide-react';
import {
  getApiServerUrl,
  setApiServerUrl,
  checkServerConnection,
  DEFAULT_API_SERVER,
  isElectronApp,
  type ServerCheckResult,
} from '../services/apiConfig';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerChanged?: (newUrl: string) => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  onServerChanged,
}) => {
  const [serverUrl, setServerUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ServerCheckResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getApiServerUrl();
      setServerUrl(current);
      setTestResult(null);
      // 開窗時自動測試一次
      handleTest(current);
    }
  }, [isOpen]);

  const handleTest = async (target?: string) => {
    const urlToTest = target || serverUrl;
    if (!urlToTest.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await checkServerConnection(urlToTest);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || '連線逾時',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!serverUrl.trim()) return;
    const appliedUrl = setApiServerUrl(serverUrl);
    setServerUrl(appliedUrl);
    if (onServerChanged) {
      onServerChanged(appliedUrl);
    }
    onClose();
  };

  const handleResetDefault = () => {
    setServerUrl(DEFAULT_API_SERVER);
    handleTest(DEFAULT_API_SERVER);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs font-mono">
      <div className="bg-slate-900 border-2 border-yellow-400 text-white w-full max-w-lg rounded shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#1e3a8a] text-white px-4 py-2.5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-base tracking-wide text-yellow-300">
              ERP 伺服器連線設定 (典型 C/S 架構)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded hover:bg-blue-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 bg-slate-900">
          {/* 模式說明提示 */}
          <div className="bg-slate-800/90 border border-slate-700 p-3 rounded text-xs text-gray-300 space-y-1">
            <div className="flex items-center space-x-2 text-yellow-400 font-bold">
              {isElectronApp() ? (
                <>
                  <Laptop className="w-4 h-4" />
                  <span>模式：純前端桌面端 (Electron Client)</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  <span>模式：瀏覽器開發端 (Web Browser Client)</span>
                </>
              )}
            </div>
            <p className="text-gray-400 leading-relaxed">
              典型 ERP 架構：本桌面客戶端專注於 FoxPro 高速輸入與視覺呈現，業務邏輯與資料庫存取由後端 ASP.NET Core API (C#) 集中處理。
            </p>
          </div>

          {/* 伺服器網址輸入 */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-yellow-300">
              後端 API 伺服器位址 (ERP Server URL)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="例如: http://localhost:5007 或 http://192.168.1.100:5007"
                className="flex-1 bg-slate-950 text-white text-base px-3 py-2 border-2 border-slate-600 rounded focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTest()}
                disabled={isTesting}
                className="px-3 py-2 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white font-bold rounded flex items-center space-x-1 border border-blue-500 transition disabled:opacity-50 text-sm shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? '測試中' : '連線測試'}</span>
              </button>
            </div>
            <p className="text-xs text-gray-400">
              預設本機: <code className="text-yellow-400">http://localhost:5007</code>。若為區域網路集中主機，請填入主機 IP 與連接埠。
            </p>
          </div>

          {/* 連線測試結果反饋 */}
          {testResult && (
            <div
              className={`p-3 rounded border text-sm flex items-start space-x-2 ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-sm">
                  {testResult.success ? '伺服器連線成功' : '伺服器連線失敗'}
                </div>
                <div>{testResult.message}</div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-xs text-gray-400 hover:text-yellow-300 underline underline-offset-2 transition"
          >
            還原本機預設 (localhost:5007)
          </button>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm font-bold border border-slate-600 transition"
            >
              取消 [ESC]
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-extrabold shadow-md flex items-center space-x-1 transition active:translate-y-0.5"
            >
              <Save className="w-4 h-4" />
              <span>儲存並套用 [Enter]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
