import React, { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { useTheme } from '../menu/ThemeContext';
import { apiErrorMessage, verifyTransferPassword } from '../../services/wbase2030';
import { TransferPasswordModal } from './TransferPasswordModal';
import { MessageDialog, type MessageState } from './Wbase2030Dialogs';
import { Wbase2020Export } from './Wbase2020Export';
import { Wbase2030Import } from './Wbase2030Import';

interface Wbase2030PageProps {
  mode: 'export' | 'import';
  onBackToMenu?: () => void;
}

/**
 * 2-2 客戶資料匯出 (wbase2020) / 2-3 客戶資料匯入 (wbase2030)，VFP base20.prg wbasemenu02cmd02 / cmd03。
 * 進入前先檢查轉檔列印密碼：放棄就回選單，錯誤顯示「密碼錯誤!」後回選單 (與 VFP 相同，不重試)
 */
export const Wbase2030Page: React.FC<Wbase2030PageProps> = ({ mode, onBackToMenu }) => {
  const { isDark } = useTheme();
  const [password, setPassword] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const isExport = mode === 'export';

  const checkPassword = async (value: string) => {
    setChecking(true);
    try {
      if (await verifyTransferPassword(value)) {
        setPassword(value);
      } else {
        setMessage({ type: 'error', title: '錯誤', lines: ['密碼錯誤!'], onClose: onBackToMenu });
      }
    } catch (err) {
      setMessage({ type: 'error', title: '錯誤', lines: [apiErrorMessage(err, '密碼檢查失敗')], onClose: onBackToMenu });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      <WbasePageHeader
        onBackToMenu={onBackToMenu}
        category="客戶資料"
        icon={isExport ? <Download className="w-4 h-4 text-black" /> : <Upload className="w-4 h-4 text-black" />}
        title={isExport ? '客戶資料匯出' : '客戶資料匯入'}
        code={isExport ? 'wbase2020' : 'wbase2030'}
      />

      {password === null ? (
        <div className="flex-1" />
      ) : isExport ? (
        <Wbase2020Export password={password} onBackToMenu={onBackToMenu} />
      ) : (
        <Wbase2030Import password={password} onBackToMenu={onBackToMenu} />
      )}

      {password === null && !message && <TransferPasswordModal checking={checking} onConfirm={checkPassword} onCancel={() => onBackToMenu?.()} />}

      {message && (
        <MessageDialog
          message={message}
          onDismiss={() => {
            setMessage(null);
            message.onClose?.();
          }}
        />
      )}
    </div>
  );
};
