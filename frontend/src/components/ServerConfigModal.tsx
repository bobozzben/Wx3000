import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  HardDrive,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  X,
  Globe,
  Laptop,
  AlertTriangle,
  FolderCheck,
} from 'lucide-react';
import {
  getApiServerUrl,
  setApiServerUrl,
  checkServerConnection,
  DEFAULT_API_SERVER,
  isElectronApp,
  getDataDrive,
  setDataDrive,
  normalizeDrive,
  checkDriveDirectory,
  applyServerSystemConfig,
  type ServerCheckResult,
  type DriveCheckResult,
} from '../services/apiConfig';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerChanged?: (newUrl: string) => void;
  onConfigApplied?: (drive: string, schema: string) => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  onServerChanged,
  onConfigApplied,
}) => {
  const [serverUrl, setServerUrl] = useState('');
  const [dataDrive, setDriveInput] = useState('C');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ServerCheckResult | null>(null);

  const [isCheckingDrive, setIsCheckingDrive] = useState(false);
  const [driveResult, setDriveResult] = useState<DriveCheckResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const driveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const currentUrl = getApiServerUrl();
      const currentDrive = getDataDrive();
      setServerUrl(currentUrl);
      setDriveInput(currentDrive);
      setTestResult(null);
      setSaveError(null);

      // 開窗時自動測試連線與檢查磁碟目錄
      handleTest(currentUrl);
      handleCheckDrive(currentDrive, currentUrl);
    }
  }, [isOpen]);

  const handleTest = async (targetUrl?: string) => {
    const urlToTest = targetUrl || serverUrl;
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

  const handleCheckDrive = async (driveLetter?: string, targetUrl?: string) => {
    const raw = driveLetter !== undefined ? driveLetter : dataDrive;
    const norm = normalizeDrive(raw);
    setIsCheckingDrive(true);
    setDriveResult(null);
    setSaveError(null);

    try {
      const res = await checkDriveDirectory(norm, targetUrl || serverUrl);
      setDriveResult(res);
      return res;
    } catch (err: any) {
      const fallbackRes: DriveCheckResult = {
        success: false,
        exists: false,
        drive: norm,
        path: `${norm}:\\W3000`,
        message: err.message || `檢查磁碟機 ${norm}: 失敗`,
      };
      setDriveResult(fallbackRes);
      return fallbackRes;
    } finally {
      setIsCheckingDrive(false);
    }
  };

  const handleDriveChange = (val: string) => {
    const norm = normalizeDrive(val);
    setDriveInput(norm);
    setDriveResult(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!serverUrl.trim()) {
      setSaveError('請輸入有效的伺服器位址');
      return;
    }

    const normDrive = normalizeDrive(dataDrive);
    setIsSaving(true);
    setSaveError(null);

    try {
      // 1. 嚴格檢查該磁碟機代號下是否有 W3000 目錄
      const checkRes = await handleCheckDrive(normDrive, serverUrl);
      if (!checkRes || !checkRes.exists) {
        setSaveError(
          checkRes?.message ||
            `❌ 磁碟機 ${normDrive}: 下找不到 W3000 目錄 (路徑: ${normDrive}:\\W3000 不存在)，無法儲存！`
        );
        setIsSaving(false);
        return;
      }

      // 2. 儲存前端伺服器位址與磁碟機代號
      const appliedUrl = setApiServerUrl(serverUrl);
      setServerUrl(appliedUrl);
      setDataDrive(normDrive, true);

      // 3. 呼叫後端 API 更新 PostgreSQL Schema 與 DBF 路徑
      const serverConfigRes = await applyServerSystemConfig(normDrive, appliedUrl);
      if (!serverConfigRes.success) {
        setSaveError(`儲存伺服器 Schema 失敗: ${serverConfigRes.message}`);
        setIsSaving(false);
        return;
      }

      if (onServerChanged) {
        onServerChanged(appliedUrl);
      }
      if (onConfigApplied) {
        onConfigApplied(normDrive, `${normDrive.toLowerCase()}:/w3000/comm`);
      }

      onClose();
    } catch (err: any) {
      setSaveError(err.message || '儲存設定時發生未預期錯誤');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    setServerUrl(DEFAULT_API_SERVER);
    setDriveInput('C');
    handleTest(DEFAULT_API_SERVER);
    handleCheckDrive('C', DEFAULT_API_SERVER);
  };

  if (!isOpen) return null;

  const currentPreviewSchema = `${dataDrive.toLowerCase()}:/w3000/comm`;
  const currentPreviewDbfPath = `${dataDrive.toUpperCase()}:\\w3000\\comm`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs font-mono p-4">
      <div className="bg-slate-900 border-2 border-yellow-400 text-white w-full max-w-xl rounded shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1e3a8a] text-white px-4 py-2.5 flex items-center justify-between border-b border-blue-900 shrink-0">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-base tracking-wide text-yellow-300">
              ERP 伺服器與資料來源磁碟設定 (典型 C/S 架構)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded hover:bg-blue-800 transition"
            title="關閉 [Esc]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 bg-slate-900 overflow-y-auto flex-1">
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

          {/* 1. 資料來源磁碟機代號輸入區 */}
          <div className="space-y-1.5 p-3 rounded bg-slate-800/50 border border-slate-700">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-yellow-300 flex items-center space-x-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>資料來源磁碟機代號 (Data Source Drive Letter)</span>
              </label>
              <span className="text-xs text-gray-400">系統預設：C 碟</span>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <div className="flex items-center bg-slate-950 border-2 border-slate-600 rounded px-2 focus-within:border-yellow-400 focus-within:ring-1 focus-within:ring-yellow-400">
                <input
                  ref={driveInputRef}
                  type="text"
                  maxLength={2}
                  value={dataDrive}
                  onChange={(e) => handleDriveChange(e.target.value)}
                  onBlur={() => handleCheckDrive(dataDrive)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') onClose();
                  }}
                  placeholder="C"
                  className="w-12 bg-transparent text-white text-lg font-black text-center focus:outline-none py-1.5 uppercase font-mono tracking-widest text-yellow-400"
                />
                <span className="text-gray-400 font-bold text-base select-none">碟 (:\W3000)</span>
              </div>

              <button
                type="button"
                onClick={() => handleCheckDrive(dataDrive)}
                disabled={isCheckingDrive}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold rounded flex items-center space-x-1 border border-emerald-500 transition disabled:opacity-50 text-sm shrink-0"
              >
                <FolderCheck className={`w-4 h-4 ${isCheckingDrive ? 'animate-spin' : ''}`} />
                <span>{isCheckingDrive ? '檢查中...' : '檢查磁碟目錄'}</span>
              </button>
            </div>

            {/* 即時路徑與 Schema 預覽 */}
            <div className="mt-2 text-xs grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-950/80 p-2 rounded border border-slate-800">
              <div>
                <span className="text-gray-400">PostgreSQL Schema：</span>
                <code className="text-amber-300 font-bold ml-1">{currentPreviewSchema}</code>
              </div>
              <div>
                <span className="text-gray-400">PostgreSQL Database：</span>
                <code className="text-emerald-400 font-bold ml-1">w3000 (固定)</code>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-400">地端 DBF 同步路徑：</span>
                <code className="text-cyan-300 font-bold ml-1">{currentPreviewDbfPath}</code>
              </div>
            </div>

            {/* 磁碟目錄檢查結果反饋 */}
            {driveResult && (
              <div
                className={`p-2.5 rounded border text-xs flex items-start space-x-2 mt-2 ${
                  driveResult.exists
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-500 text-rose-300'
                }`}
              >
                {driveResult.exists ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold text-sm">
                    {driveResult.exists ? '磁碟目錄驗證通過' : '磁碟機目錄不存在錯誤'}
                  </div>
                  <div>{driveResult.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* 2. 伺服器網址輸入 */}
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

          {/* 錯誤警告提示 */}
          {saveError && (
            <div className="p-3 rounded border border-rose-500 bg-rose-950/80 text-rose-200 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="font-bold">{saveError}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-xs text-gray-400 hover:text-yellow-300 underline underline-offset-2 transition"
          >
            還原本機預設 (C 碟 / localhost:5007)
          </button>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm font-bold border border-slate-600 transition disabled:opacity-50"
            >
              取消 [ESC]
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-1.5 rounded bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-extrabold shadow-md flex items-center space-x-1 transition active:translate-y-0.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>套用中...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>儲存並套用 [Enter]</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
