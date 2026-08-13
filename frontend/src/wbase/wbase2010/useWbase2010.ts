import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  type CompanyItem,
  FIELD_METADATA,
  TAB_FIELDS_MAP,
  INITIAL_COMPANIES,
} from './companyFieldDefs';

export function useWbase2010() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [mode, setMode] = useState<'grid' | 'edit' | 'add'>('grid');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
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
  const fetchCompanies = useCallback(async () => {
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
          setSelectedIndex(0);
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
      focusField('f3_code');
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

    try {
      if (mode === 'add') {
        const res = await fetch('/api/wbase2010', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyCode: payload.code,
            companyName: payload.name,
            englishName: payload.eng,
            shortName: payload.short,
            unifiedNo: payload.uni,
            taxNo: payload.taxNo,
            taxOffice: payload.taxOffice,
            capital: payload.capital ? Number(payload.capital) : null,
            tel: payload.tel,
            fax: payload.fax,
            address: payload.addr,
            address2: payload.addr2,
            email: payload.email,
            acctType: payload.acctType,
            owner: payload.owner,
            ownerIdNo: payload.idNo,
            ownerTel: payload.ownerTel,
            ownerMobile: payload.ownerMobile,
            ownerAddr: payload.ownerAddr,
            contactName: payload.contactName,
            contactTel: payload.contactTel,
            memo: payload.memo,
            listedType: payload.type,
            officeId: payload.officeId,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || '新增失敗');
        }
      } else if (mode === 'edit') {
        const res = await fetch(`/api/wbase2010/${encodeURIComponent(payload.code)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: payload.name,
            englishName: payload.eng,
            shortName: payload.short,
            unifiedNo: payload.uni,
            taxNo: payload.taxNo,
            taxOffice: payload.taxOffice,
            capital: payload.capital ? Number(payload.capital) : null,
            tel: payload.tel,
            fax: payload.fax,
            address: payload.addr,
            address2: payload.addr2,
            email: payload.email,
            acctType: payload.acctType,
            owner: payload.owner,
            ownerIdNo: payload.idNo,
            ownerTel: payload.ownerTel,
            ownerMobile: payload.ownerMobile,
            ownerAddr: payload.ownerAddr,
            contactName: payload.contactName,
            contactTel: payload.contactTel,
            memo: payload.memo,
            listedType: payload.type,
            officeId: payload.officeId,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || '更新失敗');
        }
      }
    } catch (err: any) {
      console.warn('PostgreSQL API error during save:', err);
    }

    // Refresh companies list from PostgreSQL
    await fetchCompanies();
    alert(mode === 'add' ? '新增成功！' : '修改成功！');
    cancelEdit();
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

  // Grid navigation via Arrow keys & shortcuts
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== 'grid') return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(filteredCompanies.length - 1, prev + 1));
    } else if (e.key === 'Enter' || e.key === 'F6') {
      e.preventDefault();
      startEdit();
    } else if (e.key === 'F2') {
      e.preventDefault();
      setIsSearchOpen(true);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      deleteSelected();
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

      // Esc cancels edit
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
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
  }, [mode, activeTab, allFieldsOrdered, switchTab, cancelEdit, focusField]);

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
  };
}
