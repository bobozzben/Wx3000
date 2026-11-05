import { useState, useEffect, useCallback } from 'react';
import type {
  CustomerTaxItem,
  CustomerVoucherItem,
  AccStItem,
} from './services/wbase4020';
import {
  fetchCustomerTaxList,
  updateCustomerTax,
  applyDefaultTaxAccounts,
  fetchCustomerVoucherList,
  updateCustomerVoucher,
  applyDefaultVoucherParams,
  fetchStockModeList,
  updateStockMode,
} from './services/wbase4020';

export type Wbase4020Tab = '4020' | '4030' | '4040' | '4050' | '4060';

export interface UseWbase4020Return {
  activeTab: Wbase4020Tab;
  setActiveTab: (tab: Wbase4020Tab) => void;
  loading: boolean;
  error: string | null;

  // 4-2 營業稅設定
  taxRows: CustomerTaxItem[];
  setTaxRows: React.Dispatch<React.SetStateAction<CustomerTaxItem[]>>;
  saveTaxRow: (row: CustomerTaxItem, rowIndex: number) => Promise<void>;
  applyDefaultTax: (row: CustomerTaxItem, rowIndex: number) => Promise<void>;

  // 4-3 傳票轉檔設定
  voucherRows: CustomerVoucherItem[];
  setVoucherRows: React.Dispatch<React.SetStateAction<CustomerVoucherItem[]>>;
  saveVoucherRow: (row: CustomerVoucherItem, rowIndex: number) => Promise<void>;
  applyDefaultVoucher: (row: CustomerVoucherItem, rowIndex: number) => Promise<void>;

  // 4-4 期末存貨計算方式
  stockRows: AccStItem[];
  setStockRows: React.Dispatch<React.SetStateAction<AccStItem[]>>;
  saveStockRow: (row: AccStItem, rowIndex: number) => Promise<void>;

  // 鍵盤移動方向 (F12)
  enterDirection: 'right' | 'down';
  toggleEnterDirection: () => void;

  // 全域重新整理
  refreshCurrentTab: () => Promise<void>;

  // 搜尋
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  handleSearchCustomer: (keyword: string) => Promise<void>;
}

export const useWbase4020 = (initialTab: Wbase4020Tab = '4020'): UseWbase4020Return => {
  const [activeTab, setActiveTab] = useState<Wbase4020Tab>(initialTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [taxRows, setTaxRows] = useState<CustomerTaxItem[]>([]);
  const [voucherRows, setVoucherRows] = useState<CustomerVoucherItem[]>([]);
  const [stockRows, setStockRows] = useState<AccStItem[]>([]);

  const [enterDirection, setEnterDirection] = useState<'right' | 'down'>('right');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  // 切換方向
  const toggleEnterDirection = useCallback(() => {
    setEnterDirection((prev) => (prev === 'right' ? 'down' : 'right'));
  }, []);

  // 載入當前 Tab 資料
  const loadTabData = useCallback(
    async (tab: Wbase4020Tab, keyword?: string) => {
      setLoading(true);
      setError(null);
      try {
        if (tab === '4020') {
          const list = await fetchCustomerTaxList(keyword);
          setTaxRows(list);
        } else if (tab === '4030') {
          const list = await fetchCustomerVoucherList(keyword);
          setVoucherRows(list);
        } else if (tab === '4040') {
          const list = await fetchStockModeList(keyword);
          setStockRows(list);
        }
      } catch (err: any) {
        console.error('loadTabData error:', err);
        setError(err?.response?.data?.message || err.message || '資料載入失敗');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const refreshCurrentTab = useCallback(async () => {
    await loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const handleSearchCustomer = useCallback(
    async (keyword: string) => {
      await loadTabData(activeTab, keyword);
    },
    [activeTab, loadTabData]
  );

  // 4-2 儲存列
  const saveTaxRow = useCallback(
    async (row: CustomerTaxItem, rowIndex: number) => {
      try {
        await updateCustomerTax(row.no, row);
        const updated = [...taxRows];
        updated[rowIndex] = row;
        setTaxRows(updated);
      } catch (err: any) {
        alert('儲存營業稅設定失敗: ' + (err?.response?.data?.error || err?.response?.data?.message || err.message));
      }
    },
    [taxRows]
  );

  // 4-2 套用標準參數
  const applyDefaultTax = useCallback(
    async (row: CustomerTaxItem, rowIndex: number) => {
      try {
        const applied = await applyDefaultTaxAccounts(row.no);
        setTaxRows((prev) => {
          const idx = prev[rowIndex]?.no === row.no ? rowIndex : prev.findIndex((r) => r.no === row.no);
          if (idx < 0) return prev;
          const updated = [...prev];
          updated[idx] = { ...prev[idx], ...applied };
          return updated;
        });
      } catch (err: any) {
        alert('套用標準參數失敗: ' + (err?.response?.data?.error || err?.response?.data?.message || err.message));
      }
    },
    []
  );

  // 4-3 儲存列
  const saveVoucherRow = useCallback(
    async (row: CustomerVoucherItem, rowIndex: number) => {
      try {
        await updateCustomerVoucher(row.no, row);
        const updated = [...voucherRows];
        updated[rowIndex] = row;
        setVoucherRows(updated);
      } catch (err: any) {
        alert('儲存傳票轉檔設定失敗: ' + (err?.response?.data?.error || err?.response?.data?.message || err.message));
      }
    },
    [voucherRows]
  );

  // 4-3 套用標準參數
  const applyDefaultVoucher = useCallback(
    async (row: CustomerVoucherItem, rowIndex: number) => {
      try {
        const applied = await applyDefaultVoucherParams(row.no);
        setVoucherRows((prev) => {
          const idx = prev[rowIndex]?.no === row.no ? rowIndex : prev.findIndex((r) => r.no === row.no);
          if (idx < 0) return prev;
          const updated = [...prev];
          updated[idx] = { ...prev[idx], ...applied };
          return updated;
        });
      } catch (err: any) {
        alert('套用標準轉檔參數失敗: ' + (err?.response?.data?.error || err?.response?.data?.message || err.message));
      }
    },
    []
  );

  // 4-4 儲存列
  const saveStockRow = useCallback(
    async (row: AccStItem, rowIndex: number) => {
      try {
        await updateStockMode(row.no, row);
        const updated = [...stockRows];
        updated[rowIndex] = row;
        setStockRows(updated);
      } catch (err: any) {
        alert('儲存期末存貨計算方式失敗: ' + (err?.response?.data?.error || err?.response?.data?.message || err.message));
      }
    },
    [stockRows]
  );

  return {
    activeTab,
    setActiveTab,
    loading,
    error,
    taxRows,
    setTaxRows,
    saveTaxRow,
    applyDefaultTax,
    voucherRows,
    setVoucherRows,
    saveVoucherRow,
    applyDefaultVoucher,
    stockRows,
    setStockRows,
    saveStockRow,
    enterDirection,
    toggleEnterDirection,
    refreshCurrentTab,
    searchOpen,
    setSearchOpen,
    handleSearchCustomer,
  };
};
