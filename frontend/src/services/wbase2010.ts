import axios from 'axios';
import type { CompanyItem } from '../wbase/wbase2010/companyFieldDefs';

export type { CompanyItem };

export interface CompanyPrintFilter {
  codeStart?: string;
  codeEnd?: string;
}

const API_BASE = '/api/wbase2010';

export const fetchCompanies = async (keyword?: string): Promise<CompanyItem[]> => {
  const response = await axios.get<CompanyItem[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const getCompanyList = fetchCompanies;

export const fetchCompanyByCode = async (code: string): Promise<CompanyItem> => {
  const response = await axios.get<CompanyItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return response.data;
};

export const createCompany = async (item: CompanyItem): Promise<CompanyItem> => {
  const response = await axios.post<CompanyItem>(API_BASE, item);
  return response.data;
};

export const updateCompany = async (code: string, item: CompanyItem): Promise<CompanyItem> => {
  const response = await axios.put<CompanyItem>(
    `${API_BASE}/${encodeURIComponent(code)}`,
    item
  );
  return response.data;
};

export const deleteCompany = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export const printCompanyList = async (query: CompanyPrintFilter): Promise<CompanyItem[]> => {
  const response = await axios.post<CompanyItem[]>(`${API_BASE}/print`, query);
  return Array.isArray(response.data) ? response.data : [];
};
