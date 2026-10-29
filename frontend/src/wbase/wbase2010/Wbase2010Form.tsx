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
  AlertCircle,
  FileText,
  Calculator,
  Home,
  FileCheck,
  Calendar,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { isValidEmail, EMAIL_WARNING_TEXT } from '../../services/validation';
import { useFoxProCardNavigation } from '../../components/FoxProGridCard';

interface Wbase2010FormProps {
  activeTab?: number;
  formData: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inputRefsMap: React.MutableRefObject<Map<string, HTMLInputElement | HTMLTextAreaElement>>;
  mode?: 'grid' | 'edit' | 'add';
  onSwitchTab?: (tabIdx: number) => void;
  onSave?: () => void;
}

// 彙總全頁所有欄位循序清單 (跨分頁 0~5 循序)
const ALL_FIELDS_ORDERED: { tabIdx: number; fid: string }[] = [];
for (let t = 0; t <= 5; t++) {
  const fids = TAB_FIELDS_MAP[t] || [];
  for (const fid of fids) {
    ALL_FIELDS_ORDERED.push({ tabIdx: t, fid });
  }
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
          : 'bg-white border-slate-300 shadow-sm'
      }`}
    >
      <div
        className={`h-9 px-4 flex items-center gap-2 border-b rounded-t-[12px] ${
          isDark
            ? 'bg-slate-800/90 border-slate-700/80 text-slate-200'
            : 'bg-slate-100/90 border-slate-200 text-slate-900 font-bold'
        }`}
      >
        <Icon size={14} className={isDark ? 'text-slate-400' : 'text-indigo-600'} />
        <span className="text-[12px] font-bold tracking-wide">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export const Wbase2010Form: React.FC<Wbase2010FormProps> = ({
  activeTab = 0,
  formData,
  setFormData,
  inputRefsMap,
  mode = 'edit',
  onSwitchTab,
  onSave,
}) => {
  const { isDark } = useTheme();

  const handleInputChange = (fid: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fid]: value }));
  };

  const {
    handleFieldKeyDown,
    handleFieldFocus,
  } = useFoxProCardNavigation<string>({
    fieldOrder: ALL_FIELDS_ORDERED.map((f) => f.fid),
    inputRefsMap,
    isFieldDisabled: (fid) => fid === 'f3_code' && mode === 'edit',
    onSave,
    onSwitchTab,
    tabFieldsMap: TAB_FIELDS_MAP,
    activeTab,
  });

  const renderField = (fid: string) => {
    const meta = FIELD_METADATA[fid] || { label: fid, dbfCol: fid };
    const val = formData[fid] || '';
    const isTextArea = meta.type === 'textarea';
    const isDisabled = fid === 'f3_code' && mode === 'edit';

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
      disabled: isDisabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleInputChange(fid, e.target.value),
      onFocus: handleFieldFocus,
      onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        try {
          (e.currentTarget as HTMLInputElement).select();
        } catch {}
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleFieldKeyDown(e, fid),
      placeholder: meta.placeholder || '',
    };

    const isEmailField = fid === 'f3_email';
    const isEmailInvalid = isEmailField && !isValidEmail(val);

    return (
      <div key={fid} className={isTextArea ? 'col-span-full' : ''}>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor={fid}
            className={`block text-[11px] font-bold tracking-wide truncate ${
              isDark ? 'text-slate-300' : 'text-slate-800'
            }`}
            title={`${meta.label} (${meta.dbfCol})`}
          >
            {meta.label}{' '}
            <span className={`text-[10px] font-semibold ml-1 font-mono ${isDark ? 'text-blue-400' : 'text-indigo-600'}`}>
              {meta.dbfCol}
            </span>
          </label>
          {isEmailField && isEmailInvalid && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-1 font-mono">
              <AlertCircle size={11} />
              格式非標準
            </span>
          )}
        </div>
        {isTextArea ? (
          <textarea
            {...inputProps}
            rows={2}
            className={`w-full min-h-[64px] rounded-[8px] border px-3 py-2 text-[13px] font-mono font-medium transition ${
              isDark
                ? isDisabled
                  ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                : isDisabled
                ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed opacity-90 font-medium'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-amber-400/60 shadow-2xs'
            }`}
          />
        ) : (
          <input
            {...inputProps}
            type={isEmailField ? 'email' : 'text'}
            className={`w-full h-8 rounded-[8px] border px-3 text-[13px] font-mono font-medium transition shadow-2xs ${
              isEmailInvalid
                ? isDark
                  ? 'bg-slate-900 border-amber-500 text-amber-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold'
                  : 'bg-amber-50/50 border-amber-500 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs font-bold'
                : isDark
                ? isDisabled
                  ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                : isDisabled
                ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed opacity-90 font-medium'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-amber-400/60 shadow-2xs'
            }`}
          />
        )}
        {isEmailField && isEmailInvalid && (
          <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span>⚠️ {EMAIL_WARNING_TEXT}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-8 sm:pb-12">
      {/* Tab 0: F3 基本資料 (24 個實體 DBF 欄位) */}
      {activeTab === 0 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="公司基本資料 (NO, NAME, ENGNAME, ABBR, UNINO, TAXNO, OFFNO, CAPITAL)" icon={Building2} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f3_code',
                'f3_name',
                'f3_eng',
                'f3_short',
                'f3_uni',
                'f3_taxNo',
                'f3_offno',
                'f3_offno4',
                'f3_capital',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="通訊與地址 (TEL, FAX, EMAIL, ADDR, INVADDR, POSTNO, ACCTYPE)" icon={Phone} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['f3_tel', 'f3_fax', 'f3_email', 'f3_addr', 'f3_invaddr', 'f3_postno', 'f3_acctType'].map((fid) =>
                renderField(fid)
              )}
            </div>
          </SectionCard>

          <SectionCard title="負責人與聯絡人 (HNAME, HIDNO, MOBILE, HADDR, LINKMAN, LINKTEL, LINKMOBILE)" icon={User} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f3_owner',
                'f3_idNo',
                'f3_mobile',
                'f3_ownerAddr',
                'f3_contactName',
                'f3_contactTel',
                'f3_contactMobile',
              ].map((fid) => renderField(fid))}
            </div>
            <div className="mt-4">{renderField('f3_memo')}</div>
          </SectionCard>
        </div>
      )}

      {/* Tab 1: F4 營業稅 (22 個實體 DBF 欄位) */}
      {activeTab === 1 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="營業稅申報資料 (LINKMAN1, MONTHV, KIND, MEDIATYPE, T401, TZERO, TFLOG...)" icon={FileText} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f4_linkman1', 'f4_linktel1', 'f4_monthv', 'f4_kind', 'f4_mediatype',
                'f4_t401', 'f4_tzero', 'f4_tflog', 'f4_tnot', 'f4_tpay',
                'f4_mainunino', 'f4_datayn', 'f4_outrate', 'f4_fileno', 'f4_tchk',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="營業稅申報人與事務所 (COMPNO, PBKTYPE, PBKCPANO, PBKNAME, PBKIDNO, PBKTEL, IDNO401)" icon={Calculator} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f4_compno', 'f4_pbktype', 'f4_pbkcpano', 'f4_pbkname', 'f4_pbkidno',
                'f4_pbktel', 'f4_idno401',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 2: F5 各類扣繳 (7 個實體 DBF 欄位) */}
      {activeTab === 2 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="房屋稅籍與上市櫃 (HOUSE, UPCODE)" icon={Home} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['f5_house', 'f5_upcode'].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="各類扣繳申報與事務所 (BKTYPE5, COMPNO5, LINKMAN5, LINKTEL5, MEDIANO)" icon={FileCheck} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['f5_bktype5', 'f5_compno5', 'f5_linkman5', 'f5_linktel5', 'f5_mediano'].map((fid) =>
                renderField(fid)
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 3: F6 結算簽證 (42 個實體 DBF 欄位) */}
      {activeTab === 3 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="公司組織與行業代號 (ORGA, PNOSTD, PNO, PNO2, PNO3, COMPNO6, CPANO, CPANAME...)" icon={Building2} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f6_orga', 'f6_pnostd', 'f6_pno', 'f6_pno2', 'f6_pno3',
                'f6_compno6', 'f6_cpano', 'f6_cpaname', 'f6_cpagno', 'f6_bdaten',
                'f6_bdate', 'f6_edate', 'f6_etype', 'f6_rdate',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="帳務處理（記帳）委託 (BKTYPE, BKCPANO, BKNAME, BKIDNO, BKTEL, BKADDR, BKUNINO...)" icon={Calendar} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f6_bktype', 'f6_bkcpano', 'f6_bkname', 'f6_bkidno', 'f6_bktel',
                'f6_bkaddr', 'f6_bkunino', 'f6_bkbd', 'f6_bked', 'f6_bktax',
                'f6_bkcno1', 'f6_bkcword', 'f6_bkcno2', 'f6_bkdate', 'f6_bkprior', 'f6_bkother',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="結算申報委託 (SBKTYPE, SBKCPANO, SBKNAME, SBKIDNO, SBKTEL, SBKADDR, SBKTAX...)" icon={FileCheck} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f6_sbktype', 'f6_sbkcpano', 'f6_sbkname', 'f6_sbkidno', 'f6_sbktel',
                'f6_sbkaddr', 'f6_sbktax', 'f6_sbkcno1', 'f6_sbkcword', 'f6_sbkcno2',
                'f6_sbkdate', 'f6_sbkprior', 'f6_sbkother',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 4: F7 暫繳其他 (18 個實體 DBF 欄位) */}
      {activeTab === 4 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="暫繳申報委託 (TBKTYPE, TBKCPANO, TBKNAME, TBKIDNO, TBKTEL, TBKADDR, TBKDATE...)" icon={Calculator} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f7_tbktype', 'f7_tbkcpano', 'f7_tbkname', 'f7_tbkidno', 'f7_tbktel',
                'f7_tbkaddr', 'f7_tbkcno1', 'f7_tbkcword', 'f7_tbkcno2', 'f7_tbkdate',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="事務所管理與備註 (TAXMEN, PLACE, KEYIN, RECAMT, RECTIME, MEMO01)" icon={UserCheck} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f7_taxmenno', 'f7_taxmen', 'f7_placeno', 'f7_place',
                'f7_keyin', 'f7_recamt', 'f7_rectime',
              ].map((fid) => renderField(fid))}
            </div>
            <div className="mt-4">{renderField('f7_memo01')}</div>
          </SectionCard>
        </div>
      )}

      {/* Tab 5: F8 清算異動 (20 個實體 DBF 欄位) */}
      {activeTab === 5 && (
        <div className="flex flex-col gap-4">
          <SectionCard title="清算申報委託 (QBKTYPE, QBKCPANO, QBKNAME, QBKIDNO, QBKTEL, QBKADDR, QBKTAX...)" icon={FileSpreadsheet} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                'f8_qbktype', 'f8_qbkcpano', 'f8_qbkname', 'f8_qbkidno', 'f8_qbktel',
                'f8_qbkaddr', 'f8_qbktax', 'f8_qbkdate', 'f8_qbkprior', 'f8_qbkother',
              ].map((fid) => renderField(fid))}
            </div>
          </SectionCard>

          <SectionCard title="清算人資料 (CLSNAME, CLSIDNO, CLSTEL, CLSADDR, CLSDATE)" icon={User} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['f8_clsname', 'f8_clsidno', 'f8_clstel', 'f8_clsaddr', 'f8_clsdate'].map((fid) =>
                renderField(fid)
              )}
            </div>
          </SectionCard>

          <SectionCard title="申報與特殊會計年度備註 (WENDTYPE, SETDATE, SETNO, MEMO02, MEMO03)" icon={Calendar} isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['f8_wendtype', 'f8_setdate', 'f8_setno'].map((fid) => renderField(fid))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {renderField('f8_memo02')}
              {renderField('f8_memo03')}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
};
