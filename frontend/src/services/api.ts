import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5007';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ProductItem {
  code: string;
  name: string;
  spec: string;
  price: number;
  stock: number;
}

export interface VendorItem {
  code: string;
  name: string;
}

export interface PurchaseLineItem {
  lineNo: number;
  productCode: string;
  productName: string;
  qty: number;
  price: number;
  amount: number;
  remark: string;
}

export interface CreatePurchaseOrderPayload {
  billNo: string;
  vendorCode: string;
  vendorName: string;
  total: number;
  lines: PurchaseLineItem[];
}

export const searchProducts = async (q: string): Promise<ProductItem[]> => {
  try {
    const res = await api.get<ProductItem[]>(`/api/products/search?q=${encodeURIComponent(q)}`);
    return res.data;
  } catch (err) {
    console.error('searchProducts error:', err);
    return [];
  }
};

export const searchVendors = async (q: string): Promise<VendorItem[]> => {
  try {
    const res = await api.get<VendorItem[]>(`/api/vendors/search?q=${encodeURIComponent(q)}`);
    return res.data;
  } catch (err) {
    console.error('searchVendors error:', err);
    return [];
  }
};

export const savePurchaseOrder = async (payload: CreatePurchaseOrderPayload) => {
  const res = await api.post('/api/purchase', payload);
  return res.data;
};
