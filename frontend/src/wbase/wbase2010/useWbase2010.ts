import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  type CompanyItem,
  TAB_FIELDS_MAP,
} from './companyFieldDefs';
import {
  isValidEmail,
  WBASE210_CHOICE_RULES,
  truncateBig5,
} from '../../services/validation';

const parseCapital = (val: any): number => {
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/元/g, '').trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

export function useWbase2010(onBackToMenu?: () => void) {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [mode, setMode] = useState<'grid' | 'edit' | 'add'>('grid');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const inputRefsMap = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());

  // Filtered companies based on search modal query
  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.uni.includes(q) ||
        (c.owner && c.owner.toLowerCase().includes(q))
    );
  }, [companies, searchQuery]);

  // Sync form data with selected record
  useEffect(() => {
    if (mode === 'add') return;
    const current = filteredCompanies[selectedIndex];
    if (!current) {
      setFormData({});
      return;
    }

    const values: Record<string, string> = {
      f3_code: current.code || '',
      f3_name: current.name || '',
      f3_eng: current.eng || '',
      f3_short: current.short || (current.name ? current.name.slice(0, 2) : ''),
      f3_uni: current.uni || '',
      f3_taxNo: current.taxNo || '',
      f3_offno: current.offno || current.taxOffice || '',
      f3_offno4: current.offno4 || '',
      f3_capital: current.capital ? String(current.capital) : '',
      f3_tel: current.tel || '',
      f3_fax: current.fax || '',
      f3_addr: current.addr || '',
      f3_invaddr: current.invaddr || current.addr2 || '',
      f3_postno: current.postno || '',
      f3_email: current.email || '',
      f3_acctType: current.acctType || '一般',
      f3_owner: current.owner || '',
      f3_idNo: current.idNo || '',
      f3_mobile: current.mobile || current.ownerMobile || '',
      f3_ownerAddr: current.ownerAddr || '',
      f3_contactName: current.contactName || '',
      f3_contactTel: current.contactTel || '',
      f3_contactMobile: current.contactMobile || '',
      f3_memo: current.memo || '',
    };

    // Populate all fields across tabs 1..5 (F4~F8)
    for (let t = 1; t <= 5; t++) {
      for (const fid of TAB_FIELDS_MAP[t] || []) {
        values[fid] = current[fid] !== undefined && current[fid] !== null ? String(current[fid]) : '';
      }
    }

    setFormData(values);
  }, [filteredCompanies, selectedIndex, mode]);

  // Load from backend PostgreSQL API
  const fetchCompanies = useCallback(async (targetCode?: string) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/wbase2010');
      const data = res.data;
      if (Array.isArray(data)) {
        const mapped: CompanyItem[] = data.map((d: any) => {
          const item: CompanyItem = {
            code: (d.companyCode || d.code || '').trim(),
            name: (d.companyName || d.name || '').trim(),
            eng: (d.englishName || d.eng || '').trim(),
            short: (d.shortName || d.short || '').trim(),
            uni: (d.unifiedNo || d.uni || '').trim(),
            taxNo: (d.taxNo || '').trim(),
            taxOffice: (d.taxOffice || '').trim(),
            capital: d.capital || '',
            tel: (d.tel || '').trim(),
            fax: (d.fax || '').trim(),
            addr: (d.address || d.addr || '').trim(),
            addr2: (d.address2 || d.addr2 || '').trim(),
            email: (d.email || '').trim(),
            acctType: (d.acctType || '一般').trim(),
            owner: (d.owner || '').trim(),
            idNo: (d.ownerIdNo || d.idNo || '').trim(),
            ownerMobile: (d.ownerMobile || '').trim(),
            ownerAddr: (d.ownerAddr || '').trim(),
            contactName: (d.contactName || '').trim(),
            contactTel: (d.contactTel || '').trim(),
            memo: (d.memo || '').trim(),
          };

          for (let t = 0; t <= 5; t++) {
            for (const fid of TAB_FIELDS_MAP[t] || []) {
              if (d[fid] !== undefined && d[fid] !== null) {
                item[fid] = String(d[fid]).trim();
              }
            }
          }
          return item;
        });
        setCompanies(mapped);

        if (targetCode) {
          const idx = mapped.findIndex((c) => c.code.toLowerCase() === targetCode.toLowerCase());
          if (idx !== -1) {
            setSelectedIndex(idx);
          }
        } else {
          setSelectedIndex((prev) => (prev < mapped.length ? prev : 0));
        }
      } else {
        setCompanies([]);
      }
    } catch (e: any) {
      console.error('Backend PostgreSQL API error loading companies:', e);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Focus specific input field with yellow highlight animation and FoxPro text selection
  const focusField = useCallback((fid: string, flash = true) => {
    const el = inputRefsMap.current.get(fid);
    if (el) {
      el.focus({ preventScroll: true });
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      } catch {
        // Fallback
      }
      if ('select' in el && typeof (el as any).select === 'function') {
        try {
          (el as HTMLInputElement).select();
        } catch {}
      }
      if (flash) {
        el.classList.add('fox-flash');
        setTimeout(() => el.classList.remove('fox-flash'), 250);
      }
    }
  }, []);

  // Switch tab and auto focus its first field
  const switchTab = useCallback(
    (tabIdx: number) => {
      setActiveTab(tabIdx);
      const firstFid = TAB_FIELDS_MAP[tabIdx]?.[0];
      if (firstFid) {
        setTimeout(() => focusField(firstFid, true), 80);
      }
    },
    [focusField]
  );

  // Enter Edit mode for selected company
  const startEdit = useCallback(() => {
    setMode('edit');
    setActiveTab(0);
    setTimeout(() => {
      focusField('f3_name');
    }, 100);
  }, [focusField]);

  // Start Add mode
  const startAdd = useCallback(() => {
    setMode('add');
    setActiveTab(0);

    const newCode = `C${String(companies.length + 1).padStart(4, '0')}`;
    const emptyValues: Record<string, string> = {
      f3_code: newCode,
      f3_name: '',
      f3_eng: '',
      f3_short: '',
      f3_uni: '',
      f3_taxNo: '',
      f3_offno: '台北市',
      f3_offno4: '',
      f3_capital: '',
      f3_tel: '',
      f3_fax: '',
      f3_addr: '',
      f3_invaddr: '',
      f3_postno: '',
      f3_email: '',
      f3_acctType: '一般',
      f3_owner: '',
      f3_idNo: '',
      f3_mobile: '',
      f3_ownerAddr: '',
      f3_contactName: '',
      f3_contactTel: '',
      f3_contactMobile: '',
      f3_memo: '',
    };
    for (let t = 1; t <= 5; t++) {
      for (const fid of TAB_FIELDS_MAP[t] || []) {
        emptyValues[fid] = '';
      }
    }
    // 對齊 wbase210.pas 新增預設值
    emptyValues['f4_t401'] = 'Y';
    emptyValues['f4_tzero'] = 'Y';
    emptyValues['f4_tflog'] = 'Y';
    emptyValues['f4_tnot'] = 'N';
    emptyValues['f4_datayn'] = 'Y';
    emptyValues['f4_monthv'] = '0';
    emptyValues['f4_kind'] = '0';
    emptyValues['f4_mediatype'] = '2';
    emptyValues['f4_tpay'] = '0';
    emptyValues['f4_pbktype'] = '1';
    emptyValues['f5_upcode'] = 'N';
    emptyValues['f5_bktype5'] = '1';
    emptyValues['f6_bktype'] = '1';
    emptyValues['f6_bktax'] = 'Y';
    emptyValues['f6_bkprior'] = '1';
    emptyValues['f6_sbktype'] = '1';
    emptyValues['f6_sbktax'] = 'Y';
    emptyValues['f6_sbkprior'] = '1';
    emptyValues['f6_bkbd'] = '0101';
    emptyValues['f6_bked'] = '1231';
    emptyValues['f7_tbktype'] = '1';

    setFormData(emptyValues);

    setTimeout(() => {
      focusField('f3_code');
    }, 100);
  }, [companies.length, focusField]);

  // Cancel edit / return to grid
  const cancelEdit = useCallback(() => {
    setMode('grid');
    setTimeout(() => {
      gridContainerRef.current?.focus();
    }, 50);
  }, []);

  // Save form data (POST or PUT) to PostgreSQL backend
  const saveForm = useCallback(async () => {
    const code = formData.f3_code?.trim();
    const name = formData.f3_name?.trim();
    if (!code) {
      alert('請輸入客戶編號!!');
      focusField('f3_code', true);
      return;
    }
    if (!name) {
      alert('請輸入客戶名稱!!');
      focusField('f3_name', true);
      return;
    }

    // 新增時檢查客戶代號是否重複 (對齊 wbase210.pas KeyExists)
    if (mode === 'add') {
      const exists = companies.some((c) => c.code.trim().toUpperCase() === code.toUpperCase());
      if (exists) {
        alert('客戶代號已存在!!');
        focusField('f3_code', true);
        return;
      }
    }

    // 記帳起始日與結束日起訖檢查 (對齊 wbase210.pas line 2873)
    const bkbd = (formData.f6_bkbd || '').trim();
    const bked = (formData.f6_bked || '').trim();
    if (bkbd && bked && bkbd > bked) {
      if (!window.confirm(`記帳起始日 ${bkbd} 大於結束日 ${bked}，是否為非歷年制？`)) {
        setActiveTab(3); // 切到 F6 結算簽證
        setTimeout(() => focusField('f6_bkbd', true), 100);
        return;
      }
    }

    // 限定值欄位未填寫提醒 (對齊 wbase210.pas line 2897 BlankChoices)
    const blankChoices: string[] = [];
    for (const [fid, rule] of Object.entries(WBASE210_CHOICE_RULES)) {
      const val = (formData[fid] || '').trim();
      if (!val) {
        blankChoices.push(rule.label);
      }
    }
    if (blankChoices.length > 0) {
      const confirmSave = window.confirm(
        `未填寫欄位：\n${blankChoices.join('、')}\n\n是否仍要存檔？`
      );
      if (!confirmSave) {
        return;
      }
    }

    // 存檔預設值自動補齊 (對齊 wbase210.pas lines 2762-2799)
    const shortVal = formData.f3_short?.trim() || truncateBig5(name, 8);
    const addrVal = formData.f3_addr?.trim() || '';
    const invaddrVal = formData.f3_invaddr?.trim() || addrVal;

    const payload: CompanyItem = {
      code,
      name,
      eng: formData.f3_eng || '',
      short: shortVal,
      uni: formData.f3_uni || '',
      taxNo: formData.f3_taxNo || '',
      taxOffice: formData.f3_offno || formData.f3_taxOffice || '',
      capital: formData.f3_capital || '',
      tel: formData.f3_tel || '',
      fax: formData.f3_fax || '',
      addr: addrVal,
      addr2: invaddrVal,
      email: formData.f3_email || '',
      acctType: formData.f3_acctType || '一般',
      owner: formData.f3_owner || '',
      idNo: formData.f3_idNo || '',
      ownerMobile: formData.f3_mobile || formData.f3_ownerMobile || '',
      ownerAddr: formData.f3_ownerAddr || '',
      contactName: formData.f3_contactName || '',
      contactTel: formData.f3_contactTel || '',
      contactMobile: formData.f3_contactMobile || '',
      memo: formData.f3_memo || '',
    };
    for (let t = 1; t <= 5; t++) {
      for (const fid of TAB_FIELDS_MAP[t] || []) {
        payload[fid] = formData[fid] || '';
      }
    }

    // 營業稅與各類扣繳之預設標記補齊
    if (!payload.f4_t401) payload.f4_t401 = 'Y';
    if (!payload.f4_tzero) payload.f4_tzero = 'Y';
    if (!payload.f4_tflog) payload.f4_tflog = 'Y';
    if (!payload.f5_upcode) payload.f5_upcode = 'N';
    if (!payload.f6_bkbd) payload.f6_bkbd = '0101';
    if (!payload.f6_bked) payload.f6_bked = '1231';
    if (!payload.f4_outrate) payload.f4_outrate = '5';

    // Pre-submit validation for field length limits against DB schema
    const FIELD_LENGTH_LIMITS: Record<string, { label: string; maxLen: number }> = {
      f3_code: { label: '客戶編號 (f3_code)', maxLen: 30 },
      f3_name: { label: '客戶名稱 (f3_name)', maxLen: 255 },
      f3_eng: { label: '英文名稱 (f3_eng)', maxLen: 255 },
      f3_short: { label: '簡稱 (f3_short)', maxLen: 255 },
      f3_uni: { label: '統一編號 (f3_uni)', maxLen: 20 },
      f3_taxNo: { label: '稅籍編號 (f3_taxNo)', maxLen: 30 },
      f3_offno: { label: '國稅局代號 (f3_offno)', maxLen: 100 },
      f3_offno4: { label: '國稅局代碼 (f3_offno4)', maxLen: 100 },
      f3_tel: { label: '電話 (f3_tel)', maxLen: 255 },
      f3_fax: { label: '傳真 (f3_fax)', maxLen: 255 },
      f3_addr: { label: '公司地址 (f3_addr)', maxLen: 255 },
      f3_invaddr: { label: '聯絡地址 (f3_invaddr)', maxLen: 255 },
      f3_email: { label: '電子郵件 (f3_email)', maxLen: 255 },
      f3_acctType: { label: '帳務類別 (f3_acctType)', maxLen: 50 },
      f3_owner: { label: '負責人姓名 (f3_owner)', maxLen: 255 },
      f3_idNo: { label: '負責人身分證 (f3_idNo)', maxLen: 30 },
      f3_mobile: { label: '負責人手機 (f3_mobile)', maxLen: 255 },
      f3_ownerAddr: { label: '負責人地址 (f3_ownerAddr)', maxLen: 255 },
      f3_contactName: { label: '聯絡人 (f3_contactName)', maxLen: 255 },
      f3_contactTel: { label: '聯絡電話 (f3_contactTel)', maxLen: 255 },
      f3_memo: { label: '備註 (f3_memo)', maxLen: 255 },
    };

    for (const [fid, meta] of Object.entries(FIELD_LENGTH_LIMITS)) {
      const val = formData[fid] || '';
      if (val.length > meta.maxLen) {
        alert(`儲存失敗：欄位「${meta.label}」內容長度為 ${val.length} 字元，超過資料庫限制長度 (${meta.maxLen} 字元)！\n內容為: "${val}"\n請修正後再儲存。`);
        focusField(fid, true);
        return;
      }
    }

    const str = (v: any) => (v === null || v === undefined ? '' : String(v).trim());

    const bodyData: Record<string, any> = {
      companyCode: str(payload.code),
      companyName: str(payload.name),
      englishName: str(payload.eng),
      shortName: str(payload.short),
      unifiedNo: str(payload.uni),
      taxNo: str(payload.taxNo),
      taxOffice: str(payload.taxOffice),
      capital: parseCapital(payload.capital),
      tel: str(payload.tel),
      fax: str(payload.fax),
      address: str(payload.addr),
      address2: str(payload.addr2),
      email: str(payload.email),
      acctType: str(payload.acctType || '一般'),
      owner: str(payload.owner),
      ownerIdNo: str(payload.idNo),
      ownerMobile: str(payload.ownerMobile),
      ownerAddr: str(payload.ownerAddr),
      contactName: str(payload.contactName),
      contactMobile: str(payload.contactMobile || payload.contactTel),
      memo: str(payload.memo),
    };
    for (let t = 1; t <= 5; t++) {
      for (const fid of TAB_FIELDS_MAP[t] || []) {
        bodyData[fid] = str(payload[fid]);
      }
    }

    try {
      if (mode === 'add') {
        await axios.post('/api/wbase2010', bodyData);
      } else if (mode === 'edit') {
        await axios.put(`/api/wbase2010/${encodeURIComponent(payload.code)}`, bodyData);
      }

      // Refresh companies list from PostgreSQL upon success and maintain focus on saved record
      await fetchCompanies(payload.code);
      const isEmailInvalid = !isValidEmail(payload.email);
      const emailHint = isEmailInvalid ? '\n\n⚠️ 提示：電子郵件格式非標準，已照常存檔。' : '';
      alert((mode === 'add' ? '新增成功！' : '修改成功！') + emailHint);
      cancelEdit();
    } catch (err: any) {
      console.error('PostgreSQL API error during save:', err);
      const detailStr = err.response?.data?.detail ? ` (${err.response.data.detail})` : '';
      const errMsg = err.response?.data?.message || err.message || '儲存失敗';
      alert(`儲存至 PostgreSQL 資料庫失敗：${errMsg}${detailStr}`);
    }
  }, [formData, mode, cancelEdit, fetchCompanies]);

  // Delete company record from PostgreSQL
  const deleteSelected = useCallback(async () => {
    const current = filteredCompanies[selectedIndex];
    if (!current) return;

    if (window.confirm(`確定要刪除客戶 [${current.code} · ${current.name}] 嗎？`)) {
      try {
        await axios.delete(`/api/wbase2010/${encodeURIComponent(current.code)}`);
        await fetchCompanies();
        alert('已成功刪除客戶資料！');
      } catch (e: any) {
        console.error('PostgreSQL API delete error:', e);
        const errMsg = e.response?.data?.message || e.message || '刪除失敗';
        alert(`刪除客戶資料失敗：${errMsg}`);
      }
    }
  }, [filteredCompanies, selectedIndex, fetchCompanies]);

  // Open F2 Search Modal
  const openSearchModal = useCallback(() => {
    setSearchQuery('');
    setIsSearchOpen(true);
  }, []);

  // Close F2 Search Modal and refocus grid
  const closeSearchModal = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setTimeout(() => {
      gridContainerRef.current?.focus();
    }, 80);
  }, []);

  // Select company from F2 Search Modal
  const selectCompanyFromSearch = useCallback((code: string) => {
    const idx = companies.findIndex((c) => c.code.toLowerCase() === code.toLowerCase());
    setSearchQuery('');
    if (idx !== -1) {
      setSelectedIndex(idx);
    }
    setIsSearchOpen(false);
    setTimeout(() => {
      gridContainerRef.current?.focus();
    }, 80);
  }, [companies]);

  // Grid navigation via Arrow keys, PageUp/Down, Home/End & shortcuts
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== 'grid') return;

    // Calculate dynamic visible page size based on grid container height (default 8 rows)
    const container = gridContainerRef.current;
    const pageSize = container ? Math.max(1, Math.floor(container.clientHeight / 32)) : 8;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(filteredCompanies.length - 1, prev + 1));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - pageSize));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(filteredCompanies.length - 1, prev + pageSize));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedIndex(Math.max(0, filteredCompanies.length - 1));
    } else if (e.key === 'Enter' || e.key === 'F6') {
      e.preventDefault();
      startEdit();
    } else if (e.key === 'F2') {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (onBackToMenu) onBackToMenu();
    }
  };

  // Keyboard navigation inside Edit / Add mode (F3-F8, Esc)
  // 欄位內之 Enter / ArrowDown / ArrowUp 由 Wbase2010Form 之 useFoxProCardNavigation 處理，避免雙重事件衝突
  useEffect(() => {
    if (mode === 'grid') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // F3 ~ F8 tab switching
      const matchF = e.key.match(/^F([3-8])$/);
      if (matchF) {
        e.preventDefault();
        const tabIdx = parseInt(matchF[1], 10) - 3;
        if (tabIdx >= 0 && tabIdx <= 5) {
          switchTab(tabIdx);
        }
        return;
      }

      // Esc saves form & returns to grid list in edit mode
      if (e.key === 'Escape') {
        e.preventDefault();
        saveForm();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, switchTab, saveForm]);

  return {
    companies,
    filteredCompanies,
    loading,
    selectedIndex,
    setSelectedIndex,
    mode,
    activeTab,
    setActiveTab,
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    isPrintOpen,
    setIsPrintOpen,
    formData,
    setFormData,
    gridContainerRef,
    inputRefsMap,
    switchTab,
    startEdit,
    startAdd,
    cancelEdit,
    saveForm,
    deleteSelected,
    handleGridKeyDown,
    focusField,
    fetchCompanies,
    openSearchModal,
    closeSearchModal,
    selectCompanyFromSearch,
  };
}
