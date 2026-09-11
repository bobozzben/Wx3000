import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  type CompanyItem,
  TAB_FIELDS_MAP,
  INITIAL_COMPANIES,
} from './companyFieldDefs';

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

  // Flattened field order across all tabs (0..5) for Enter key navigation
  const allFieldsOrdered = useMemo(() => {
    const fieldsList: { tabIdx: number; fid: string }[] = [];
    for (let t = 0; t <= 5; t++) {
      const fids = TAB_FIELDS_MAP[t] || [];
      for (const fid of fids) {
        fieldsList.push({ tabIdx: t, fid });
      }
    }
    return fieldsList;
  }, []);

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
      f3_taxOffice: current.taxOffice || '',
      f3_capital: current.capital ? String(current.capital) : '',
      f3_tel: current.tel || '',
      f3_fax: current.fax || '',
      f3_addr: current.addr || '',
      f3_addr2: current.addr2 || '',
      f3_email: current.email || '',
      f3_acctType: current.acctType || '一般',
      f3_owner: current.owner || '',
      f3_idNo: current.idNo || '',
      f3_ownerTel: current.ownerTel || '',
      f3_ownerMobile: current.ownerMobile || '',
      f3_ownerAddr: current.ownerAddr || '',
      f3_contactName: current.contactName || '',
      f3_contactTel: current.contactTel || '',
      f3_memo: current.memo || '',

      f4_contact: current.f4_contact || current.contactName || '',
      f4_phone: current.f4_phone || current.contactTel || '',
      f4_period: current.f4_period || '每月',
      f4_kind: current.f4_kind || '薪資',
      f4_mediaTxt: current.f4_mediaTxt || '',
      f4_mediaTet: current.f4_mediaTet || '',
      f4_mediaT02: current.f4_mediaT02 || '',
      f4_mediaT08: current.f4_mediaT08 || '',
      f4_note: current.f4_note || '',
      f4_headOffice: current.f4_headOffice || '',
      f4_taxOffice: current.f4_taxOffice || '',
      f4_officeId: current.f4_officeId || '',
      f4_method: current.f4_method || '網路',
      f4_code: current.f4_code || '',
      f4_idNo: current.f4_idNo || '',
      f4_name: current.f4_name || '',
      f4_phone2: current.f4_phone2 || '',
      f4_cert: current.f4_cert || '',
      f4_print: current.f4_print || 'A4',

      f5_house: current.f5_house || '',
      f5_listed: current.type || '上市',
      f5_method: current.taxMethod || '電子申報',
      f5_taxOffice: current.f5_taxOffice || '',
      f5_officeId: current.officeId || '',
      f5_contact: current.f5_contact || '',
      f5_phone: current.f5_phone || '',
      f5_withholder: current.f5_withholder || '',

      f6_org: current.f6_org || '',
      f6_bizCode: current.bizCode || '1234',
      f6_89: current.f6_89 || '',
      f6_91: current.f6_91 || '',
      f6_94: current.f6_94 || '',
      f6_officeId: current.officeId || '',
      f6_accountant: current.accountantCode || '',
      f6_open: current.f6_open || '2020/01/01',
      f6_close: current.f6_close || '',

      f7_content: current.f7_content || '營所稅申報',
      f7_code: current.f7_code || '',
      f7_name: current.f7_name || '',
      f7_id: current.f7_id || '',
      f7_phone: current.f7_phone || '',

      f8_note: current.f8_note || '',
      f8_memo: current.f8_memo || '',
    };
    setFormData(values);
  }, [filteredCompanies, selectedIndex, mode]);

  // Load from backend PostgreSQL API with fallback
  const fetchCompanies = useCallback(async (targetCode?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wbase2010');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: CompanyItem[] = data.map((d: any) => ({
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
            ownerTel: (d.ownerTel || '').trim(),
            ownerMobile: (d.ownerMobile || '').trim(),
            ownerAddr: (d.ownerAddr || '').trim(),
            contactName: (d.contactName || '').trim(),
            contactTel: (d.contactTel || '').trim(),
            memo: (d.memo || '').trim(),
            type: (d.listedType || d.type || '一般').trim(),
            officeId: (d.officeId || '').trim(),
          }));
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
          setCompanies(INITIAL_COMPANIES);
        }
      } else {
        setCompanies(INITIAL_COMPANIES);
      }
    } catch (e) {
      console.warn('Backend PostgreSQL API error, using initial list:', e);
      setCompanies(INITIAL_COMPANIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Focus specific input field with yellow highlight animation
  const focusField = useCallback((fid: string, flash = true) => {
    const el = inputRefsMap.current.get(fid);
    if (el) {
      el.focus();
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
      f3_taxOffice: '台北市',
      f3_capital: '',
      f3_tel: '',
      f3_fax: '',
      f3_addr: '',
      f3_addr2: '',
      f3_email: '',
      f3_acctType: '一般',
      f3_owner: '',
      f3_idNo: '',
      f3_ownerTel: '',
      f3_ownerMobile: '',
      f3_ownerAddr: '',
      f3_contactName: '',
      f3_contactTel: '',
      f3_memo: '',
      f5_listed: '上市',
    };
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
    if (!code || !name) {
      alert('請輸入客戶編號與客戶名稱！');
      return;
    }

    const payload: CompanyItem = {
      code,
      name,
      eng: formData.f3_eng || '',
      short: formData.f3_short || name.slice(0, 2),
      uni: formData.f3_uni || '',
      taxNo: formData.f3_taxNo || '',
      taxOffice: formData.f3_taxOffice || '',
      capital: formData.f3_capital || '',
      tel: formData.f3_tel || '',
      fax: formData.f3_fax || '',
      addr: formData.f3_addr || '',
      addr2: formData.f3_addr2 || '',
      email: formData.f3_email || '',
      acctType: formData.f3_acctType || '一般',
      owner: formData.f3_owner || '',
      idNo: formData.f3_idNo || '',
      ownerTel: formData.f3_ownerTel || '',
      ownerMobile: formData.f3_ownerMobile || '',
      ownerAddr: formData.f3_ownerAddr || '',
      contactName: formData.f3_contactName || '',
      contactTel: formData.f3_contactTel || '',
      memo: formData.f3_memo || '',
      type: formData.f5_listed || '上市',
      officeId: formData.f6_officeId || '',
      ...formData,
    };

    // Pre-submit validation for field length limits against DB schema
    const FIELD_LENGTH_LIMITS: Record<string, { label: string; maxLen: number }> = {
      f3_code: { label: '客戶編號 (f3_code)', maxLen: 30 },
      f3_name: { label: '客戶名稱 (f3_name)', maxLen: 255 },
      f3_eng: { label: '英文名稱 (f3_eng)', maxLen: 255 },
      f3_short: { label: '簡稱 (f3_short)', maxLen: 255 },
      f3_uni: { label: '統一編號 (f3_uni)', maxLen: 20 },
      f3_taxNo: { label: '稅籍編號 (f3_taxNo)', maxLen: 30 },
      f3_taxOffice: { label: '稅捐處 (f3_taxOffice)', maxLen: 100 },
      f3_tel: { label: '電話 (f3_tel)', maxLen: 255 },
      f3_fax: { label: '傳真 (f3_fax)', maxLen: 255 },
      f3_addr: { label: '公司地址 (f3_addr)', maxLen: 255 },
      f3_addr2: { label: '通訊地址 (f3_addr2)', maxLen: 255 },
      f3_email: { label: '電子郵件 (f3_email)', maxLen: 255 },
      f3_acctType: { label: '帳務類別 (f3_acctType)', maxLen: 50 },
      f3_owner: { label: '負責人姓名 (f3_owner)', maxLen: 255 },
      f3_idNo: { label: '負責人身分證 (f3_idNo)', maxLen: 30 },
      f3_ownerMobile: { label: '負責人手機 (f3_ownerMobile)', maxLen: 255 },
      f3_ownerAddr: { label: '負責人地址 (f3_ownerAddr)', maxLen: 255 },
      f3_contactName: { label: '聯絡人 (f3_contactName)', maxLen: 255 },
      f3_contactTel: { label: '聯絡電話 (f3_contactTel)', maxLen: 255 },
      f3_memo: { label: '備註 (f3_memo)', maxLen: 255 },
      f5_listed: { label: '上市櫃 (f5_listed)', maxLen: 20 },
      f6_officeId: { label: '事務所代號 (f6_officeId)', maxLen: 30 },
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

    const bodyData = {
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
      ownerTel: str(payload.ownerTel),
      ownerMobile: str(payload.ownerMobile),
      ownerAddr: str(payload.ownerAddr),
      contactName: str(payload.contactName),
      contactMobile: str(payload.contactTel || payload.contactMobile || payload.f4_phone),
      memo: str(payload.memo),
      listedType: str(payload.type || payload.f5_listed || '上市'),
      officeId: str(payload.officeId || payload.f6_officeId),
    };

    try {
      if (mode === 'add') {
        const res = await fetch('/api/wbase2010', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const detailStr = errData.detail ? ` (${errData.detail})` : '';
          throw new Error((errData.message || '新增失敗') + detailStr);
        }
      } else if (mode === 'edit') {
        const res = await fetch(`/api/wbase2010/${encodeURIComponent(payload.code)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const detailStr = errData.detail ? ` (${errData.detail})` : '';
          throw new Error((errData.message || '更新失敗') + detailStr);
        }
      }

      // Refresh companies list from PostgreSQL upon success and maintain focus on saved record
      await fetchCompanies(payload.code);
      alert(mode === 'add' ? '新增成功！' : '修改成功！');
      cancelEdit();
    } catch (err: any) {
      console.error('PostgreSQL API error during save:', err);
      alert(`儲存至 PostgreSQL 資料庫失敗：${err.message || err}`);
    }
  }, [formData, mode, cancelEdit, fetchCompanies]);

  // Delete company record from PostgreSQL
  const deleteSelected = useCallback(async () => {
    const current = filteredCompanies[selectedIndex];
    if (!current) return;

    if (window.confirm(`確定要刪除客戶 [${current.code} · ${current.name}] 嗎？`)) {
      try {
        const res = await fetch(`/api/wbase2010/${encodeURIComponent(current.code)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || '刪除失敗');
        }
      } catch (e) {
        console.warn('PostgreSQL API delete error:', e);
      }

      await fetchCompanies();
      alert('已成功刪除客戶資料！');
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

  // Keyboard navigation inside Edit / Add mode (F3-F8, Enter, Esc)
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

      // Enter jumps to next field across tabs
      if (e.key === 'Enter') {
        const activeEl = document.activeElement as HTMLElement;
        if (!activeEl) return;

        if (activeEl.tagName === 'TEXTAREA' && !e.ctrlKey) {
          if (e.shiftKey) return;
        }
        if (activeEl.tagName === 'BUTTON') return;

        const fid = activeEl.getAttribute('data-field');
        if (!fid) return;

        e.preventDefault();
        const currentIdx = allFieldsOrdered.findIndex((item) => item.fid === fid);
        if (currentIdx === -1) return;

        let nextIdx = (currentIdx + 1) % allFieldsOrdered.length;
        let iterations = 0;
        while (iterations < allFieldsOrdered.length) {
          const candidate = allFieldsOrdered[nextIdx];
          const el = inputRefsMap.current.get(candidate.fid);
          if (el && !el.disabled) {
            if (candidate.tabIdx !== activeTab) {
              setActiveTab(candidate.tabIdx);
              setTimeout(() => focusField(candidate.fid), 80);
            } else {
              focusField(candidate.fid);
            }
            break;
          }
          nextIdx = (nextIdx + 1) % allFieldsOrdered.length;
          iterations++;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, activeTab, allFieldsOrdered, switchTab, saveForm, focusField]);

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
