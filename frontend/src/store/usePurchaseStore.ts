import { create } from 'zustand';
import type { PurchaseLineItem } from '../services/api';

const generateDefaultBillNo = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `PI-${dateStr}${randomNum}`;
};

const createInitialLines = (count = 15): PurchaseLineItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    lineNo: i + 1,
    productCode: '',
    productName: '',
    qty: 0,
    price: 0,
    amount: 0,
    remark: '',
  }));
};

interface PurchaseState {
  billNo: string;
  vendorCode: string;
  vendorName: string;
  purchaseDate: string;
  lines: PurchaseLineItem[];
  setBillNo: (no: string) => void;
  setVendor: (code: string, name: string) => void;
  setPurchaseDate: (date: string) => void;
  setLines: (lines: PurchaseLineItem[]) => void;
  resetForm: () => void;
}

export const usePurchaseStore = create<PurchaseState>((set) => ({
  billNo: generateDefaultBillNo(),
  vendorCode: 'F001',
  vendorName: '宏達五金工業股份有限公司',
  purchaseDate: new Date().toISOString().slice(0, 10),
  lines: createInitialLines(15),
  setBillNo: (billNo) => set({ billNo }),
  setVendor: (vendorCode, vendorName) => set({ vendorCode, vendorName }),
  setPurchaseDate: (purchaseDate) => set({ purchaseDate }),
  setLines: (lines) => set({ lines }),
  resetForm: () =>
    set({
      billNo: generateDefaultBillNo(),
      vendorCode: '',
      vendorName: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      lines: createInitialLines(15),
    }),
}));
