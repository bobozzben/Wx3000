export type SystemCategory = 'tax_accounting' | 'audit' | 'institutional' | 'corporate';

export interface SubsystemItem {
  id: string; // e.g. "1", "2", "Z", "A", etc.
  code: string; // e.g. "wtaxop", "wbase", "wacct"
  title: string; // e.g. "1-營業稅申報系統"
  category: SystemCategory;
  description: string;
  features: string[];
  routeTarget?: 'wbase' | 'purchase' | string;
  isAvailable: boolean; // true if implemented and clickable to open
  colorTheme: 'blue' | 'magenta' | 'orange' | 'green';
  isEmptySlot?: boolean; // For placeholder/blank button
}

export interface QuickServiceItem {
  id: string;
  title: string;
  iconType: 'bullhorn' | 'cloud' | 'headset' | 'mic' | 'zap';
  badge?: string;
  bgColor: string; // Tailwind class
  hoverColor: string;
  actionType: 'notice' | 'license' | 'support' | 'voice' | 'learning';
  description: string;
}

export interface BranchOffice {
  city: string;
  address: string;
  tel: string;
  fax: string;
}

export interface BottomToolAction {
  id: string;
  title: string;
  iconText?: string;
  iconType?: 'report' | 'backup' | 'update' | 'web' | 'exit';
  badge?: string;
}
