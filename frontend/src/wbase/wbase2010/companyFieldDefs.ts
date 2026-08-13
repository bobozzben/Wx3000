export interface CompanyItem {
  code: string;
  name: string;
  eng?: string;
  short?: string;
  uni: string;
  taxNo?: string;
  taxOffice?: string;
  capital?: string | number;
  tel?: string;
  fax?: string;
  addr?: string;
  addr2?: string;
  email?: string;
  acctType?: string;
  owner?: string;
  idNo?: string;
  ownerTel?: string;
  ownerMobile?: string;
  ownerAddr?: string;
  contactName?: string;
  contactTel?: string;
  memo?: string;
  type?: string;
  bizCode?: string;
  taxMethod?: string;
  officeId?: string;
  accountantCode?: string;

  // Additional fields across F4~F8
  [key: string]: any;
}

export interface FieldMeta {
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'number';
}

export const TABS_CONFIG = [
  { idx: 0, kbd: 'F3', title: '基本資料', color: 'bg-blue-500' },
  { idx: 1, kbd: 'F4', title: '聯絡申報', color: 'bg-emerald-500' },
  { idx: 2, kbd: 'F5', title: '房屋稅籍', color: 'bg-amber-500' },
  { idx: 3, kbd: 'F6', title: '營所稅務', color: 'bg-violet-500' },
  { idx: 4, kbd: 'F7', title: '委任資料', color: 'bg-rose-500' },
  { idx: 5, kbd: 'F8', title: '異動記錄', color: 'bg-slate-500' },
];

export const FIELD_METADATA: Record<string, FieldMeta> = {
  // F3 基本資料
  f3_code: { label: '客戶編號', placeholder: 'C0001' },
  f3_name: { label: '客戶名稱', placeholder: '鴻海精密工業股份有限公司' },
  f3_eng: { label: '英文名稱', placeholder: 'Hon Hai Precision' },
  f3_short: { label: '簡稱', placeholder: '鴻海' },
  f3_uni: { label: '統一編號', placeholder: '03545423' },
  f3_taxNo: { label: '稅籍編號', placeholder: '' },
  f3_taxOffice: { label: '稅捐處', placeholder: '台北市' },
  f3_capital: { label: '資本額', placeholder: '100,000,000' },
  f3_tel: { label: '電話', placeholder: '02-22683466' },
  f3_fax: { label: '傳真', placeholder: '02-22683467' },
  f3_addr: { label: '公司地址', placeholder: '新北市土城區...' },
  f3_addr2: { label: '通訊地址', placeholder: '' },
  f3_email: { label: '電子郵件', placeholder: 'contact@foxconn.com' },
  f3_acctType: { label: '帳務類別', placeholder: '一般' },
  f3_owner: { label: '負責人姓名', placeholder: '劉揚偉' },
  f3_idNo: { label: '負責人身分證', placeholder: 'A123456789' },
  f3_ownerTel: { label: '負責人電話', placeholder: '' },
  f3_ownerMobile: { label: '負責人手機', placeholder: '0912345678' },
  f3_ownerAddr: { label: '負責人地址', placeholder: '' },
  f3_contactName: { label: '聯絡人', placeholder: '王小姐' },
  f3_contactTel: { label: '聯絡電話', placeholder: '' },
  f3_memo: { label: '備註', type: 'textarea' },

  // F4 聯絡申報
  f4_contact: { label: '聯絡人', placeholder: '王經理' },
  f4_phone: { label: '聯絡電話', placeholder: '' },
  f4_period: { label: '申報期別', placeholder: '每月' },
  f4_kind: { label: '所得類別', placeholder: '薪資' },
  f4_mediaTxt: { label: '媒體申報-文字', placeholder: '' },
  f4_mediaTet: { label: '媒體申報-TET', placeholder: '' },
  f4_mediaT02: { label: '媒體申報-T02', placeholder: '' },
  f4_mediaT08: { label: '媒體申報-T08', placeholder: '' },
  f4_note: { label: '備註說明', placeholder: '' },
  f4_headOffice: { label: '總機構', placeholder: '' },
  f4_taxOffice: { label: '稽徵機關', placeholder: '' },
  f4_officeId: { label: '事務所代號', placeholder: '' },
  f4_method: { label: '申報方式', placeholder: '網路' },
  f4_code: { label: '代號', placeholder: '' },
  f4_idNo: { label: '統一編號', placeholder: '' },
  f4_name: { label: '姓名', placeholder: '' },
  f4_phone2: { label: '電話', placeholder: '' },
  f4_cert: { label: '憑證', placeholder: '' },
  f4_print: { label: '列印格式', placeholder: 'A4' },

  // F5 房屋稅籍
  f5_house: { label: '房屋稅籍編號', placeholder: '' },
  f5_listed: { label: '上市櫃', placeholder: '上市' },
  f5_method: { label: '申報方式', placeholder: '電子申報' },
  f5_taxOffice: { label: '稅務機關', placeholder: '' },
  f5_officeId: { label: '事務所', placeholder: '' },
  f5_contact: { label: '聯絡人', placeholder: '' },
  f5_phone: { label: '電話', placeholder: '' },
  f5_withholder: { label: '扣繳義務人', placeholder: '' },

  // F6 營所稅務
  f6_org: { label: '所屬機關', placeholder: '' },
  f6_bizCode: { label: '行業代號', placeholder: '1234' },
  f6_89: { label: '89年盈餘', placeholder: '' },
  f6_91: { label: '91年盈餘', placeholder: '' },
  f6_94: { label: '94年盈餘', placeholder: '' },
  f6_officeId: { label: '事務所代號', placeholder: '' },
  f6_accountant: { label: '會計師', placeholder: '' },
  f6_open: { label: '開業日期', placeholder: '2020/01/01' },
  f6_close: { label: '歇業日期', placeholder: '' },
  f6_certNo: { label: '憑證序號', placeholder: '' },
  f6_procType: { label: '代理人種類', placeholder: '' },
  f6_procCode: { label: '代理人代號', placeholder: '' },
  f6_procName: { label: '代理人姓名', placeholder: '' },
  f6_procId: { label: '代理人身分證', placeholder: '' },
  f6_procPhone: { label: '代理人電話', placeholder: '' },
  f6_procAddr: { label: '代理人地址', placeholder: '' },
  f6_taxId: { label: '稅籍編號', placeholder: '' },
  f6_start: { label: '會計期間起', placeholder: '01/01' },
  f6_end: { label: '會計期間訖', placeholder: '12/31' },
  f6_withhold: { label: '扣繳憑單', placeholder: '' },
  f6_cert2: { label: '憑證2', placeholder: '' },
  f6_entrustDate: { label: '委任日期', placeholder: '' },
  f6_content: { label: '委任內容', placeholder: '' },
  f6_settleType: { label: '決算種類', placeholder: '' },
  f6_settleCode: { label: '決算代號', placeholder: '' },
  f6_settleName: { label: '決算姓名', placeholder: '' },
  f6_settleId: { label: '決算ID', placeholder: '' },
  f6_settlePhone: { label: '決算電話', placeholder: '' },
  f6_settleAddr: { label: '決算地址', placeholder: '' },
  f6_settleWith: { label: '決算扣繳', placeholder: '' },
  f6_cert3: { label: '憑證3', placeholder: '' },
  f6_entrustDate2: { label: '委任日期2', placeholder: '' },
  f6_content2: { label: '委任內容2', placeholder: '' },

  // F7 委任資料
  f7_content: { label: '委任內容', placeholder: '營所稅申報' },
  f7_code: { label: '代號', placeholder: '' },
  f7_name: { label: '姓名', placeholder: '' },
  f7_id: { label: '身分證', placeholder: '' },
  f7_phone: { label: '電話', placeholder: '' },
  f7_mobile: { label: '手機', placeholder: '' },
  f7_addr: { label: '地址', placeholder: '' },
  f7_date: { label: '委任日期', placeholder: '' },
  f7_cert: { label: '憑證', placeholder: '' },
  f7_assoc: { label: '公會', placeholder: '' },
  f7_officer: { label: '經辦', placeholder: '' },
  f7_ticket: { label: '單號', placeholder: '' },
  f7_keyer: { label: '建檔者', placeholder: '' },
  f7_memo1: { label: '備註一', type: 'textarea' },
  f7_memo2: { label: '備註二', type: 'textarea' },

  // F8 異動記錄
  f8_note: { label: '系統備註', placeholder: '' },
  f8_param1: { label: '參數一', placeholder: '' },
  f8_param2: { label: '參數二', placeholder: '' },
  f8_param3: { label: '參數三', placeholder: '' },
  f8_param4: { label: '參數四', placeholder: '' },
  f8_param5: { label: '參數五', placeholder: '' },
  f8_memo: { label: '特記事項', type: 'textarea' },
};

export const TAB_FIELDS_MAP: Record<number, string[]> = {
  0: [
    'f3_code', 'f3_name', 'f3_eng', 'f3_short', 'f3_uni', 'f3_taxNo',
    'f3_taxOffice', 'f3_capital', 'f3_tel', 'f3_fax', 'f3_addr', 'f3_addr2',
    'f3_email', 'f3_acctType', 'f3_owner', 'f3_idNo', 'f3_ownerTel',
    'f3_ownerMobile', 'f3_ownerAddr', 'f3_contactName', 'f3_contactTel', 'f3_memo'
  ],
  1: [
    'f4_contact', 'f4_phone', 'f4_period', 'f4_kind', 'f4_mediaTxt',
    'f4_mediaTet', 'f4_mediaT02', 'f4_mediaT08', 'f4_note', 'f4_headOffice',
    'f4_taxOffice', 'f4_officeId', 'f4_method', 'f4_code', 'f4_idNo',
    'f4_name', 'f4_phone2', 'f4_cert', 'f4_print'
  ],
  2: [
    'f5_house', 'f5_listed', 'f5_method', 'f5_taxOffice', 'f5_officeId',
    'f5_contact', 'f5_phone', 'f5_withholder'
  ],
  3: [
    'f6_org', 'f6_bizCode', 'f6_89', 'f6_91', 'f6_94', 'f6_officeId',
    'f6_accountant', 'f6_open', 'f6_close', 'f6_certNo', 'f6_procType',
    'f6_procCode', 'f6_procName', 'f6_procId', 'f6_procPhone', 'f6_procAddr',
    'f6_taxId', 'f6_start', 'f6_end', 'f6_withhold', 'f6_cert2',
    'f6_entrustDate', 'f6_content', 'f6_settleType', 'f6_settleCode',
    'f6_settleName', 'f6_settleId', 'f6_settlePhone', 'f6_settleAddr',
    'f6_settleWith', 'f6_cert3', 'f6_entrustDate2', 'f6_content2'
  ],
  4: [
    'f7_content', 'f7_code', 'f7_name', 'f7_id', 'f7_phone', 'f7_mobile',
    'f7_addr', 'f7_date', 'f7_cert', 'f7_assoc', 'f7_officer', 'f7_ticket',
    'f7_keyer', 'f7_memo1', 'f7_memo2'
  ],
  5: [
    'f8_note', 'f8_param1', 'f8_param2', 'f8_param3', 'f8_param4',
    'f8_param5', 'f8_memo'
  ]
};

export const INITIAL_COMPANIES: CompanyItem[] = [
  { code: "C0001", name: "鴻海精密工業股份有限公司", uni: "03545423", owner: "劉揚偉", tel: "02-2268-3466", type: "上市", short: "鴻海" },
  { code: "C0002", name: "台灣積體電路製造股份有限公司", uni: "22099118", owner: "魏哲家", tel: "03-5636688", type: "上市", short: "台積電" },
  { code: "C0003", name: "聯發科技股份有限公司", uni: "16670998", owner: "蔡明介", tel: "03-5670766", type: "上市", short: "聯發科" },
  { code: "C0004", name: "中華電信股份有限公司", uni: "96972798", owner: "郭水義", tel: "02-23445566", type: "上市", short: "中華電" },
  { code: "C0005", name: "富邦金融控股股份有限公司", uni: "70790807", owner: "蔡明興", tel: "02-66387888", type: "上市", short: "富邦金" },
  { code: "C0006", name: "國泰金融控股股份有限公司", uni: "70790808", owner: "蔡宏圖", tel: "02-27087698", type: "上市", short: "國泰金" },
  { code: "C0007", name: "長榮海運股份有限公司", uni: "03534567", owner: "張衍義", tel: "02-25001122", type: "上市", short: "長榮" },
  { code: "C0008", name: "台塑石化股份有限公司", uni: "16082491", owner: "陳寶郎", tel: "02-27122211", type: "上市", short: "台塑化" },
  { code: "C0009", name: "大立光電股份有限公司", uni: "22345678", owner: "林恩平", tel: "04-23594121", type: "上市", short: "大立光" },
  { code: "C0010", name: "研華股份有限公司", uni: "23545678", owner: "劉克振", tel: "02-2792-4788", type: "上市", short: "研華" },
  { code: "C0011", name: "廣達電腦股份有限公司", uni: "22102493", owner: "林百里", tel: "02-2888-4567", type: "上市", short: "廣達" },
  { code: "C0012", name: "緯創資通股份有限公司", uni: "70708552", owner: "林憲銘", tel: "02-6615-2525", type: "上市", short: "緯創" }
];
