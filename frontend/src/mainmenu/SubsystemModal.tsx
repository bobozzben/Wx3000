import React, { useEffect } from 'react';
import type { SubsystemItem } from './types';
import { X, CheckCircle2, Clock, Play, BookOpen, Layers } from 'lucide-react';
import { useTheme } from '../wbase/menu/ThemeContext';

interface SubsystemModalProps {
  item: SubsystemItem | null;
  onClose: () => void;
  onLaunch: (item: SubsystemItem) => void;
}

export const SubsystemModal: React.FC<SubsystemModalProps> = ({ item, onClose, onLaunch }) => {
  const { isDark } = useTheme();

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden flex flex-col font-sans transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${
            isDark
              ? 'bg-gradient-to-r from-slate-900 via-blue-950/70 to-indigo-950/70 border-slate-800'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-blue-500'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-md text-xs font-mono font-black tracking-wider shadow-xs">
              {item.code.toUpperCase()}
            </span>
            <h3
              className={`font-bold text-base sm:text-lg tracking-wide ${
                isDark ? 'text-white' : 'text-white'
              }`}
            >
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/75 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className={`p-5 space-y-4 flex-1 overflow-y-auto max-h-[70vh] ${
            isDark ? 'bg-slate-900/90' : 'bg-slate-50/70'
          }`}
        >
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              item.isAvailable
                ? isDark
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isDark
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center space-x-2 text-sm font-semibold">
              {item.isAvailable ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>已整合上線（可直接進入主畫面）</span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                  <span>新架構整合規劃中（尚未發佈）</span>
                </>
              )}
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-md font-mono font-bold border ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              SYS-ID: {item.id}
            </span>
          </div>

          {/* Description */}
          <div>
            <h4
              className={`text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span>系統簡介與業務範疇</span>
            </h4>
            <p
              className={`text-sm leading-relaxed p-3.5 rounded-xl border ${
                isDark
                  ? 'bg-slate-800/70 border-slate-700/80 text-slate-200'
                  : 'bg-white border-slate-200/80 text-slate-700'
              }`}
            >
              {item.description}
            </p>
          </div>

          {/* Key Features */}
          {item.features.length > 0 && (
            <div>
              <h4
                className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>核心功能與作業模組</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs font-medium ${
                      isDark
                        ? 'bg-slate-800/60 border-slate-700/70 text-slate-300'
                        : 'bg-white border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3.5 border-t flex justify-end space-x-2.5 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/80 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            關閉
          </button>

          {item.isAvailable ? (
            <button
              type="button"
              onClick={() => {
                onLaunch(item);
                onClose();
              }}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-md transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>開啟子系統主畫面</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium cursor-not-allowed ${
                isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-300 text-slate-600'
              }`}
              title="此子系統目前正在新架構遷移中"
            >
              模組準備中
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
