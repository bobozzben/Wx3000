import React from 'react';
import {
  FIELD_METADATA,
  TAB_FIELDS_MAP,
} from './companyFieldDefs';
import { useTheme } from '../menu/ThemeContext';
import {
  Building2,
  Phone,
  User,
  FileText,
  Home,
  Calculator,
  Calendar,
  FileCheck,
  History,
} from 'lucide-react';

interface Wbase2010FormProps {
  activeTab: number;
  formData: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inputRefsMap: React.MutableRefObject<Map<string, HTMLInputElement | HTMLTextAreaElement>>;
}

function SectionCard({
  title,
  icon: Icon,
  isDark,
  children,
}: {
  title: string;
  icon: any;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[12px] border transition-colors ${
        isDark
          ? 'bg-slate-800 border-slate-700/80 shadow-md'
          : 'bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
      }`}
    >
      <div
        className={`h-9 px-4 flex items-center gap-2 border-b rounded-t-[12px] ${
          isDark
            ? 'bg-slate-800/90 border-slate-700/80 text-slate-200'
            : 'bg-[#FBFCFE] border-slate-100 text-slate-700'
        }`}
      >
        <Icon size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
        <span className="text-[12px] font-semibold">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export const Wbase2010Form: React.FC<Wbase2010FormProps> = ({
  activeTab,
  formData,
  setFormData,
  inputRefsMap,
}) => {
  const { isDark } = useTheme();

  const handleInputChange = (fid: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fid]: value }));
  };

  const renderField = (fid: string) => {
    const meta = FIELD_METADATA[fid] || { label: fid };
    const val = formData[fid] || '';
    const isTextArea = meta.type === 'textarea';

    const inputProps = {
      'data-field': fid,
      id: fid,
      ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
        if (el) {
          inputRefsMap.current.set(fid, el);
        } else {
          inputRefsMap.current.delete(fid);
        }
      },
      value: val,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleInputChange(fid, e.target.value),
      placeholder: meta.placeholder || '',
    };

    return (
      <div key={fid} className={isTextArea ? 'col-span-full' : ''}>
        <label
          htmlFor={fid}
          className={`block text-[11px] font-medium mb-1.5 tracking-wide ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          {meta.label}{' '}
          <span className={`text-[10px] font-normal ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {fid}
          </span>
        </label>
        {isTextArea ? (
          <textarea
            {...inputProps}
            rows={2}
            className={`w-full min-h-[64px] rounded-[8px] border px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600'
                : 'bg-white border-[#D1D5DB] text-slate-800'
            }`}
          />
        ) : (
          <input
            {...inputProps}
            type="text"
            className={`w-full h-8 rounded-[8px] border px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600'
                : 'bg-white border-[#D1D5DB] text-slate-800'
            }`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tab 0: F3 基本資料 */}
      {activeTab === 0 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="基本資料" icon={Building2} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f3_code',
                'f3_name',
                'f3_eng',
                'f3_short',
                'f3_uni',
                'f3_taxNo',
                'f3_taxOffice',
                'f3_capital',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="通訊與帳務" icon={Phone} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['f3_tel', 'f3_fax', 'f3_email', 'f3_addr', 'f3_addr2', 'f3_acctType'].map((fid) =>
                renderField(fid)
              )}
            </div>
          </SectionCard>

          <SectionCard title="負責人與聯絡" icon={User} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f3_owner',
                'f3_idNo',
                'f3_ownerTel',
                'f3_ownerMobile',
                'f3_ownerAddr',
                'f3_contactName',
                'f3_contactTel',
              ].map((fid) => renderField(fid))}
            </div>
            <div className="mt-4">{renderField('f3_memo')}</div>
          </SectionCard>
        </div>
      )}

      {/* Tab 1: F4 聯絡申報 */}
      {activeTab === 1 && (
        <SectionCard title="聯絡申報設定" icon={FileText} isDark={isDark}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TAB_FIELDS_MAP[1].map((fid) => renderField(fid))}
          </div>
        </SectionCard>
      )}

      {/* Tab 2: F5 房屋稅籍 */}
      {activeTab === 2 && (
        <SectionCard title="房屋稅籍資料" icon={Home} isDark={isDark}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TAB_FIELDS_MAP[2].map((fid) => renderField(fid))}
          </div>
        </SectionCard>
      )}

      {/* Tab 3: F6 營所稅務 */}
      {activeTab === 3 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="營所稅 - 基礎與代理人" icon={Calculator} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TAB_FIELDS_MAP[3].slice(0, 18).map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="期間與委任結算" icon={Calendar} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TAB_FIELDS_MAP[3].slice(18).map((fid) => renderField(fid))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 4: F7 委任資料 */}
      {activeTab === 4 && (
        <SectionCard title="委任詳細資料" icon={FileCheck} isDark={isDark}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TAB_FIELDS_MAP[4].slice(0, 8).map((fid) => renderField(fid))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {TAB_FIELDS_MAP[4].slice(8, 13).map((fid) => renderField(fid))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {TAB_FIELDS_MAP[4].slice(13).map((fid) => renderField(fid))}
          </div>
        </SectionCard>
      )}

      {/* Tab 5: F8 異動記錄 */}
      {activeTab === 5 && (
        <SectionCard title="異動記錄" icon={History} isDark={isDark}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TAB_FIELDS_MAP[5].map((fid) => renderField(fid))}
          </div>
          <div
            className={`mt-6 p-4 rounded-xl text-[12px] border ${
              isDark
                ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            此頁為異動備註，Enter 會循環回 F3 第一格，符合 FoxPro 傳統 Tab 循環邏輯。
          </div>
        </SectionCard>
      )}
    </div>
  );
};
