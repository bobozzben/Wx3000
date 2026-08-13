import React from 'react';
import type { CompanyItem } from './companyFieldDefs';
import { Printer, X, Building2, User, Phone, MapPin, FileText } from 'lucide-react';

interface Wbase2010PrintProps {
  company: CompanyItem | null;
  onClose: () => void;
}

export const Wbase2010Print: React.FC<Wbase2010PrintProps> = ({ company, onClose }) => {
  if (!company) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header toolbar */}
        <div className="h-12 px-5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center space-x-2 text-sm font-semibold">
            <Printer className="w-4 h-4 text-blue-400" />
            <span>客戶明細表單列印預覽</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center space-x-1 transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>列印</span>
            </button>
            <button
              onClick={onClose}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>關閉 Esc</span>
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 overflow-y-auto font-sans bg-white print:p-0">
          <div className="border border-slate-300 rounded-lg p-6 bg-slate-50/50 print:border-black print:bg-white">
            <div className="text-center pb-4 border-b border-slate-200 mb-6 print:border-black">
              <h1 className="text-2xl font-bold text-slate-900 tracking-wide print:text-black">
                客戶基本資料基本表
              </h1>
              <p className="text-xs text-slate-500 mt-1 print:text-gray-700">
                Wx3000 雲端會計進銷存系統 · 列印日期: {new Date().toLocaleDateString('zh-TW')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0 print:hidden" />
                <span className="font-medium text-slate-500 w-24">客戶編號：</span>
                <span className="font-bold text-slate-900">{company.code}</span>
              </div>

              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-400 shrink-0 print:hidden" />
                <span className="font-medium text-slate-500 w-24">統一編號：</span>
                <span className="font-bold text-slate-900">{company.uni || '未輸入'}</span>
              </div>

              <div className="col-span-2 flex items-center space-x-2 border-t border-slate-200/60 pt-3">
                <span className="font-medium text-slate-500 w-24">客戶全稱：</span>
                <span className="font-bold text-slate-900 text-base">{company.name}</span>
              </div>

              {company.eng && (
                <div className="col-span-2 flex items-center space-x-2">
                  <span className="font-medium text-slate-500 w-24">英文名稱：</span>
                  <span>{company.eng}</span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-500 w-24">客戶簡稱：</span>
                <span>{company.short || company.name.slice(0, 2)}</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-500 w-24">上市櫃狀態：</span>
                <span>{company.type || '一般'}</span>
              </div>

              <div className="flex items-center space-x-2 border-t border-slate-200/60 pt-3">
                <User className="w-4 h-4 text-slate-400 shrink-0 print:hidden" />
                <span className="font-medium text-slate-500 w-24">負責人：</span>
                <span>{company.owner || '未輸入'}</span>
              </div>

              <div className="flex items-center space-x-2 border-t border-slate-200/60 pt-3">
                <Phone className="w-4 h-4 text-slate-400 shrink-0 print:hidden" />
                <span className="font-medium text-slate-500 w-24">聯絡電話：</span>
                <span>{company.tel || '未輸入'}</span>
              </div>

              <div className="col-span-2 flex items-center space-x-2 border-t border-slate-200/60 pt-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 print:hidden" />
                <span className="font-medium text-slate-500 w-24">公司地址：</span>
                <span>{company.addr || '未輸入'}</span>
              </div>

              {company.email && (
                <div className="col-span-2 flex items-center space-x-2">
                  <span className="font-medium text-slate-500 w-24">電子郵件：</span>
                  <span>{company.email}</span>
                </div>
              )}

              {company.memo && (
                <div className="col-span-2 flex items-start space-x-2 border-t border-slate-200/60 pt-3">
                  <span className="font-medium text-slate-500 w-24 shrink-0">備註事項：</span>
                  <p className="whitespace-pre-wrap">{company.memo}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
