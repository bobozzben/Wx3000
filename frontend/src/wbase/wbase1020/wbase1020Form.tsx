import React, { useEffect, useRef } from 'react';
import { useWbase1020 } from './useWbase1020';
import { Save, X, KeyRound, Building, Phone, MapPin, FileText, UserCheck } from 'lucide-react';

export const Wbase1020Form: React.FC = () => {
  const {
    isFormOpen,
    formMode,
    formData,
    setFormData,
    saveForm,
    closeForm,
    loading,
    list,
  } = useWbase1020();

  const [pkError, setPkError] = useState<string | null>(null);

  // Field Focus Refs array in tab sequence order
  const inputRefs = [
    useRef<HTMLInputElement>(null), // 0: cpaCode (PRIMARY KEY)
    useRef<HTMLInputElement>(null), // 1: cpaName
    useRef<HTMLInputElement>(null), // 2: licenseNo
    useRef<HTMLInputElement>(null), // 3: officeName
    useRef<HTMLInputElement>(null), // 4: tel
    useRef<HTMLInputElement>(null), // 5: fax
    useRef<HTMLInputElement>(null), // 6: address
  ];
  const memoRef = useRef<HTMLTextAreaElement>(null); // 7: memo

  // Auto focus first input on open & clear errors
  useEffect(() => {
    if (isFormOpen) {
      setPkError(null);
      setTimeout(() => {
        if (formMode === 'add') {
          inputRefs[0].current?.focus();
        } else {
          inputRefs[1].current?.focus();
        }
      }, 100);
    }
  }, [isFormOpen, formMode]);

  // Primary Key existence check helper
  const checkPrimaryKeyExists = (codeVal: string): boolean => {
    if (formMode !== 'add') return false;
    const code = codeVal.trim().toUpperCase();
    if (!code) return false;

    const exists = list.some((item) => item.cpaCode.trim().toUpperCase() === code);
    if (exists) {
      const msg = `⚠️ 主鍵「會計師代號」[${code}] 已存在，請重新輸入！`;
      setPkError(msg);
      setTimeout(() => {
        inputRefs[0].current?.focus();
        inputRefs[0].current?.select();
      }, 50);
      return true;
    }
    setPkError(null);
    return false;
  };

  // Keyboard shortcut listener for F9, Ctrl+S, Esc
  useEffect(() => {
    if (!isFormOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeForm();
      } else if (e.key === 'F9' || (e.ctrlKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        saveForm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, closeForm, saveForm]);

  if (!isFormOpen) return null;

  // Handle Enter key navigation to next field
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If Primary Key field (index 0), perform existence check
      if (index === 0) {
        const code = formData.cpaCode.trim().toUpperCase();
        setFormData({ cpaCode: code });
        if (checkPrimaryKeyExists(code)) {
          return; // Stay on primary key field if duplicate!
        }
      }

      // Non-primary key fields (index > 0): No existence check needed
      setPkError(null);
      if (index < inputRefs.length - 1) {
        inputRefs[index + 1].current?.focus();
      } else if (index === inputRefs.length - 1) {
        memoRef.current?.focus();
      } else {
        // Last field: trigger save
        saveForm();
      }
    }
  };

  const handleCodeBlur = () => {
    if (formData.cpaCode) {
      const code = formData.cpaCode.trim().toUpperCase();
      setFormData({ cpaCode: code });
      checkPrimaryKeyExists(code);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-mono">
      <div className="bg-slate-900 border-4 border-blue-600 rounded-lg shadow-2xl w-full max-w-2xl text-white overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-950 px-6 py-3 border-b-2 border-yellow-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-bold tracking-wide text-yellow-300">
              {formMode === 'add' ? '【新增】會計師主檔資料 [F3]' : `【修改】會計師 [${formData.cpaCode}] 資料`}
            </h3>
          </div>
          <button
            onClick={closeForm}
            className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-blue-900"
            title="關閉 (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 會計師代號 */}
            <div>
              <label className="block text-xs font-bold text-yellow-300 mb-1 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" />
                <span>會計師代號 * (英數10碼, 自動大寫)</span>
              </label>
              <input
                ref={inputRefs[0]}
                type="text"
                maxLength={10}
                disabled={formMode === 'edit'}
                value={formData.cpaCode}
                onChange={(e) => {
                  setFormData({ cpaCode: e.target.value });
                  if (pkError) setPkError(null);
                }}
                onBlur={handleCodeBlur}
                onKeyDown={(e) => handleInputKeyDown(e, 0)}
                placeholder="例如: C001"
                className={`w-full px-3 py-2 bg-slate-800 border-2 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition ${pkError
                    ? 'border-red-500 bg-red-950/50 text-red-200 animate-pulse'
                    : formMode === 'edit'
                      ? 'opacity-60 cursor-not-allowed border-gray-700'
                      : 'border-blue-500'
                  }`}
              />
              {pkError && (
                <p className="mt-1 text-xs font-bold text-red-400 flex items-center gap-1 animate-bounce">
                  <span>{pkError}</span>
                </p>
              )}
            </div>

            {/* 會計師姓名 */}
            <div>
              <label className="block text-xs font-bold text-yellow-300 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                <span>會計師姓名 *</span>
              </label>
              <input
                ref={inputRefs[1]}
                type="text"
                maxLength={30}
                value={formData.cpaName}
                onChange={(e) => setFormData({ cpaName: e.target.value })}
                onKeyDown={(e) => handleInputKeyDown(e, 1)}
                placeholder="例如: 張志明"
                className="w-full px-3 py-2 bg-slate-800 border-2 border-blue-500 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition"
              />
            </div>

            {/* 證照字號 */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>證照字號</span>
              </label>
              <input
                ref={inputRefs[2]}
                type="text"
                maxLength={50}
                value={formData.licenseNo}
                onChange={(e) => setFormData({ licenseNo: e.target.value })}
                onKeyDown={(e) => handleInputKeyDown(e, 2)}
                placeholder="例如: 台財證(一)字第12345號"
                className="w-full px-3 py-2 bg-slate-800 border border-gray-600 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition"
              />
            </div>

            {/* 事務所名稱 */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                <span>事務所名稱</span>
              </label>
              <input
                ref={inputRefs[3]}
                type="text"
                maxLength={60}
                value={formData.officeName}
                onChange={(e) => setFormData({ officeName: e.target.value })}
                onKeyDown={(e) => handleInputKeyDown(e, 3)}
                placeholder="例如: XXX聯合會計師事務所"
                className="w-full px-3 py-2 bg-slate-800 border border-gray-600 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition"
              />
            </div>

            {/* 電話 */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>電話</span>
              </label>
              <input
                ref={inputRefs[4]}
                type="text"
                maxLength={20}
                value={formData.tel}
                onChange={(e) => setFormData({ tel: e.target.value })}
                onKeyDown={(e) => handleInputKeyDown(e, 4)}
                placeholder="例如: 02-23910088"
                className="w-full px-3 py-2 bg-slate-800 border border-gray-600 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition"
              />
            </div>

            {/* 傳真 */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>傳真</span>
              </label>
              <input
                ref={inputRefs[5]}
                type="text"
                maxLength={20}
                value={formData.fax}
                onChange={(e) => setFormData({ fax: e.target.value })}
                onKeyDown={(e) => handleInputKeyDown(e, 5)}
                placeholder="例如: 02-12345678"
                className="w-full px-3 py-2 bg-slate-800 border border-gray-600 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition"
              />
            </div>
          </div>

          {/* 通訊地址 */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>通訊地址</span>
            </label>
            <input
              ref={inputRefs[6]}
              type="text"
              maxLength={100}
              value={formData.address}
              onChange={(e) => setFormData({ address: e.target.value })}
              onKeyDown={(e) => handleInputKeyDown(e, 6)}
              placeholder="例如: 臺北市中正區羅斯福路幾段幾號幾樓"
              className="w-full px-3 py-2 bg-slate-800 border border-gray-600 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition"
            />
          </div>

          {/* 備註 */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              <span>備註事項</span>
            </label>
            <textarea
              ref={memoRef}
              rows={3}
              value={formData.memo}
              onChange={(e) => setFormData({ memo: e.target.value })}
              onKeyDown={(e) => handleInputKeyDown(e, 7)}
              placeholder="輸入額外說明事項..."
              className="w-full px-3 py-2 bg-slate-800 border border-gray-600 rounded text-white font-mono focus:outline-none focus:border-yellow-400 transition"
            />
          </div>
        </div>

        {/* Footer & Shortcut Hint Bar */}
        <div className="bg-slate-950 px-6 py-3 border-t border-gray-800 flex items-center justify-between">
          <div className="flex space-x-3 text-xs">
            <span className="bg-blue-900 text-yellow-300 px-2 py-1 rounded border border-blue-700 font-bold">
              [Enter] 下一欄
            </span>
            <span className="bg-blue-900 text-green-300 px-2 py-1 rounded border border-blue-700 font-bold">
              [F9 / Ctrl+S] 儲存
            </span>
            <span className="bg-blue-900 text-gray-300 px-2 py-1 rounded border border-blue-700">
              [Esc] 放棄
            </span>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold transition text-sm border border-gray-500"
            >
              放棄 (Esc)
            </button>
            <button
              type="button"
              onClick={saveForm}
              disabled={loading}
              className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-bold shadow-lg transition text-sm flex items-center space-x-1 border border-yellow-300"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? '處理中...' : '儲存存檔 [F9]'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
