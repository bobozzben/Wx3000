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
  ownerMobile?: string;
  ownerAddr?: string;
  contactName?: string;
  contactTel?: string;
  contactMobile?: string;
  memo?: string;

  // DBF fields across F3 ~ F8
  [key: string]: any;
}

export interface FieldMeta {
  label: string;
  dbfCol: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'number';
}

export const TABS_CONFIG = [
  { idx: 0, kbd: 'F3', title: '基本資料', color: 'bg-blue-500' },
  { idx: 1, kbd: 'F4', title: '營業稅', color: 'bg-emerald-500' },
  { idx: 2, kbd: 'F5', title: '各類扣繳', color: 'bg-amber-500' },
  { idx: 3, kbd: 'F6', title: '結算簽證', color: 'bg-violet-500' },
  { idx: 4, kbd: 'F7', title: '暫繳其他', color: 'bg-rose-500' },
  { idx: 5, kbd: 'F8', title: '清算異動', color: 'bg-slate-500' },
];

export const FIELD_METADATA: Record<string, FieldMeta> = {
  // Tab 0: F3 基本資料 (24 個實體 DBF 欄位)
  f3_code: { label: '客戶編號', dbfCol: 'NO', placeholder: 'C0001' },
  f3_name: { label: '公司名稱', dbfCol: 'NAME', placeholder: '鴻海精密工業股份有限公司' },
  f3_eng: { label: '英文名稱', dbfCol: 'ENGNAME', placeholder: 'Hon Hai Precision' },
  f3_short: { label: '公司簡稱', dbfCol: 'ABBR', placeholder: '鴻海' },
  f3_uni: { label: '統一編號', dbfCol: 'UNINO', placeholder: '03545423' },
  f3_taxNo: { label: '稅籍編號', dbfCol: 'TAXNO', placeholder: '' },
  f3_offno: { label: '國稅局代號', dbfCol: 'OFFNO', placeholder: '' },
  f3_offno4: { label: '國稅局代碼', dbfCol: 'OFFNO4', placeholder: '' },
  f3_capital: { label: '資本額', dbfCol: 'CAPITAL', placeholder: '100,000,000' },
  f3_tel: { label: '公司電話', dbfCol: 'TEL', placeholder: '02-22683466' },
  f3_fax: { label: '公司傳真', dbfCol: 'FAX', placeholder: '02-22683467' },
  f3_email: { label: '電子郵件', dbfCol: 'EMAIL', placeholder: 'contact@foxconn.com' },
  f3_addr: { label: '公司地址', dbfCol: 'ADDR', placeholder: '新北市土城區...' },
  f3_invaddr: { label: '聯絡地址', dbfCol: 'INVADDR', placeholder: '' },
  f3_postno: { label: '郵遞區號', dbfCol: 'POSTNO', placeholder: '' },
  f3_acctType: { label: '會計類別', dbfCol: 'ACCTYPE', placeholder: '一般 (A~G)' },
  f3_owner: { label: '負責人姓名', dbfCol: 'HNAME', placeholder: '劉揚偉' },
  f3_idNo: { label: '負責人身分證號', dbfCol: 'HIDNO', placeholder: 'A123456789' },
  f3_mobile: { label: '負責人手機', dbfCol: 'MOBILE', placeholder: '0912345678' },
  f3_ownerAddr: { label: '負責人地址', dbfCol: 'HADDR', placeholder: '' },
  f3_contactName: { label: '聯絡人姓名', dbfCol: 'LINKMAN', placeholder: '王小姐' },
  f3_contactTel: { label: '聯絡人電話', dbfCol: 'LINKTEL', placeholder: '' },
  f3_contactMobile: { label: '聯絡人手機', dbfCol: 'LINKMOBILE', placeholder: '' },
  f3_memo: { label: '備註', dbfCol: 'MEMO', type: 'textarea' },

  // Tab 1: F4 營業稅 (22 個實體 DBF 欄位)
  f4_linkman1: { label: '營業稅聯絡人', dbfCol: 'LINKMAN1' },
  f4_linktel1: { label: '營業稅聯絡電話', dbfCol: 'LINKTEL1' },
  f4_monthv: { label: '申報週期(0每期/1每月)', dbfCol: 'MONTHV' },
  f4_kind: { label: '申報種類(0專營/1兼營/3特種)', dbfCol: 'KIND' },
  f4_mediatype: { label: '媒體申報類別(0銷/1進/2進銷)', dbfCol: 'MEDIATYPE' },
  f4_t401: { label: '申報書媒體(TET)', dbfCol: 'T401' },
  f4_tzero: { label: '零稅率媒體(T02)', dbfCol: 'TZERO' },
  f4_tflog: { label: '固資退稅媒體(T08)', dbfCol: 'TFLOG' },
  f4_tnot: { label: '不得扣抵媒體申報', dbfCol: 'TNOT' },
  f4_tpay: { label: '彙總註記(0單一/1彙總/2分支)', dbfCol: 'TPAY' },
  f4_mainunino: { label: '總機構統編', dbfCol: 'MAINUNINO' },
  f4_datayn: { label: '轉入審核程式(Y/N)', dbfCol: 'DATAYN' },
  f4_outrate: { label: '國外勞務稅率', dbfCol: 'OUTRATE' },
  f4_fileno: { label: '營業稅檔案編號', dbfCol: 'FILENO' },
  f4_tchk: { label: '進銷項合併設定', dbfCol: 'TCHK' },
  f4_compno: { label: '事務所統編', dbfCol: 'COMPNO' },
  f4_pbktype: { label: '營業稅申報方式(1自行/2委託)', dbfCol: 'PBKTYPE' },
  f4_pbkcpano: { label: '申報人代號', dbfCol: 'PBKCPANO' },
  f4_pbkname: { label: '申報人名稱', dbfCol: 'PBKNAME' },
  f4_pbkidno: { label: '申報人證號/身分證', dbfCol: 'PBKIDNO' },
  f4_pbktel: { label: '申報人電話', dbfCol: 'PBKTEL' },
  f4_idno401: { label: '身分證號列印轉檔(Y/N)', dbfCol: 'IDNO401' },

  // Tab 2: F5 各類扣繳 (7 個實體 DBF 欄位)
  f5_house: { label: '房屋稅籍編號', dbfCol: 'HOUSE' },
  f5_upcode: { label: '上市上櫃(Y/N)', dbfCol: 'UPCODE' },
  f5_bktype5: { label: '扣繳申報(1自行/2委託)', dbfCol: 'BKTYPE5' },
  f5_compno5: { label: '扣繳事務所統編', dbfCol: 'COMPNO5' },
  f5_linkman5: { label: '扣繳聯絡人', dbfCol: 'LINKMAN5' },
  f5_linktel5: { label: '扣繳聯絡電話', dbfCol: 'LINKTEL5' },
  f5_mediano: { label: '薪資媒體代號', dbfCol: 'MEDIANO' },

  // Tab 3: F6 結算簽證 (42 個實體 DBF 欄位)
  f6_orga: { label: '公司組織別(1股份/2有限/6獨資等)', dbfCol: 'ORGA' },
  f6_pnostd: { label: '營利事業標準代號', dbfCol: 'PNOSTD' },
  f6_pno: { label: '行業代號89', dbfCol: 'PNO' },
  f6_pno2: { label: '行業代號91', dbfCol: 'PNO2' },
  f6_pno3: { label: '行業代號94', dbfCol: 'PNO3' },
  f6_compno6: { label: '結算事務所統編', dbfCol: 'COMPNO6' },
  f6_cpano: { label: '會計師代號', dbfCol: 'CPANO' },
  f6_cpaname: { label: '會計師姓名', dbfCol: 'CPANAME' },
  f6_cpagno: { label: '會計師公會證號', dbfCol: 'CPAGNO' },
  f6_bdaten: { label: '開業日期(民國9碼)', dbfCol: 'BDATEN' },
  f6_bdate: { label: '開業日期(8碼)', dbfCol: 'BDATE' },
  f6_edate: { label: '結業日期', dbfCol: 'EDATE' },
  f6_etype: { label: '結業/停業(1結業/2停業)', dbfCol: 'ETYPE' },
  f6_rdate: { label: '復業日期', dbfCol: 'RDATE' },
  f6_bktype: { label: '帳務處理型態(1自行/2委託/3委任書)', dbfCol: 'BKTYPE' },
  f6_bkcpano: { label: '帳務委託人代號', dbfCol: 'BKCPANO' },
  f6_bkname: { label: '帳務委託人姓名', dbfCol: 'BKNAME' },
  f6_bkidno: { label: '帳務人身分證/統編', dbfCol: 'BKIDNO' },
  f6_bktel: { label: '帳務委託人電話', dbfCol: 'BKTEL' },
  f6_bkaddr: { label: '帳務委託人地址', dbfCol: 'BKADDR' },
  f6_bkunino: { label: '帳務人統一編號', dbfCol: 'BKUNINO' },
  f6_bkbd: { label: '記帳起始日(MMDD)', dbfCol: 'BKBD' },
  f6_bked: { label: '記帳結束日(MMDD)', dbfCol: 'BKED' },
  f6_bktax: { label: '記帳是否代扣(Y/N)', dbfCol: 'BKTAX' },
  f6_bkcno1: { label: '帳務證號字', dbfCol: 'BKCNO1' },
  f6_bkcword: { label: '帳務登錄台財稅', dbfCol: 'BKCWORD' },
  f6_bkcno2: { label: '帳務證號碼', dbfCol: 'BKCNO2' },
  f6_bkdate: { label: '帳務委任日期', dbfCol: 'BKDATE' },
  f6_bkprior: { label: '委任權限(1會計事務/2會計結算)', dbfCol: 'BKPRIOR' },
  f6_bkother: { label: '帳務委任其他說明', dbfCol: 'BKOTHER' },
  f6_sbktype: { label: '結算申報處理型態', dbfCol: 'SBKTYPE' },
  f6_sbkcpano: { label: '申報委託人代號', dbfCol: 'SBKCPANO' },
  f6_sbkname: { label: '申報委託人姓名', dbfCol: 'SBKNAME' },
  f6_sbkidno: { label: '申報人身分證/統編', dbfCol: 'SBKIDNO' },
  f6_sbktel: { label: '申報委託人電話', dbfCol: 'SBKTEL' },
  f6_sbkaddr: { label: '申報委託人住址', dbfCol: 'SBKADDR' },
  f6_sbktax: { label: '申報是否代扣(Y/N)', dbfCol: 'SBKTAX' },
  f6_sbkcno1: { label: '申報登錄字', dbfCol: 'SBKCNO1' },
  f6_sbkcword: { label: '申報登錄台財稅', dbfCol: 'SBKCWORD' },
  f6_sbkcno2: { label: '申報登錄號', dbfCol: 'SBKCNO2' },
  f6_sbkdate: { label: '申報委任日期', dbfCol: 'SBKDATE' },
  f6_sbkprior: { label: '申報委任內容權限', dbfCol: 'SBKPRIOR' },
  f6_sbkother: { label: '申報委任其他說明', dbfCol: 'SBKOTHER' },

  // Tab 4: F7 暫繳其他 (18 個實體 DBF 欄位)
  f7_tbktype: { label: '暫繳處理型態(1自行/2取具/3填委任)', dbfCol: 'TBKTYPE' },
  f7_tbkcpano: { label: '暫繳委託代辦代號', dbfCol: 'TBKCPANO' },
  f7_tbkname: { label: '暫繳委託代辦姓名', dbfCol: 'TBKNAME' },
  f7_tbkidno: { label: '暫繳委託代辦證號', dbfCol: 'TBKIDNO' },
  f7_tbktel: { label: '暫繳委託代辦電話', dbfCol: 'TBKTEL' },
  f7_tbkaddr: { label: '暫繳委託代辦地址', dbfCol: 'TBKADDR' },
  f7_tbkcno1: { label: '暫繳登錄字號', dbfCol: 'TBKCNO1' },
  f7_tbkcword: { label: '暫繳登錄台財稅', dbfCol: 'TBKCWORD' },
  f7_tbkcno2: { label: '暫繳登錄證號', dbfCol: 'TBKCNO2' },
  f7_tbkdate: { label: '暫繳委託委任日期', dbfCol: 'TBKDATE' },
  f7_taxmenno: { label: '稅務人員編號', dbfCol: 'TAXMENNO' },
  f7_taxmen: { label: '稅務人員姓名', dbfCol: 'TAXMEN' },
  f7_placeno: { label: '購票地點編號', dbfCol: 'PLACENO' },
  f7_place: { label: '購票地點名稱', dbfCol: 'PLACE' },
  f7_keyin: { label: '登打人員編號', dbfCol: 'KEYIN' },
  f7_recamt: { label: '事務所記帳費', dbfCol: 'RECAMT' },
  f7_rectime: { label: '記帳收費週期', dbfCol: 'RECTIME' },
  f7_memo01: { label: '其他備註１', dbfCol: 'MEMO01', type: 'textarea' },

  // Tab 5: F8 清算異動 (20 個實體 DBF 欄位)
  f8_qbktype: { label: '清算申報型態(1自行/2附委任/3同記帳/4非同人)', dbfCol: 'QBKTYPE' },
  f8_qbkcpano: { label: '清算委託人編號', dbfCol: 'QBKCPANO' },
  f8_qbkname: { label: '清算委託人姓名', dbfCol: 'QBKNAME' },
  f8_qbkidno: { label: '清算人身分證號', dbfCol: 'QBKIDNO' },
  f8_qbktel: { label: '清算委託人電話', dbfCol: 'QBKTEL' },
  f8_qbkaddr: { label: '清算委託人地址', dbfCol: 'QBKADDR' },
  f8_qbktax: { label: '清算是否代扣(Y/N)', dbfCol: 'QBKTAX' },
  f8_qbkdate: { label: '清算委託委任日期', dbfCol: 'QBKDATE' },
  f8_qbkprior: { label: '清算委任內容權限', dbfCol: 'QBKPRIOR' },
  f8_qbkother: { label: '清算委任其他說明', dbfCol: 'QBKOTHER' },
  f8_clsname: { label: '清算人姓名', dbfCol: 'CLSNAME' },
  f8_clsidno: { label: '清算人身分證號', dbfCol: 'CLSIDNO' },
  f8_clstel: { label: '清算人電話', dbfCol: 'CLSTEL' },
  f8_clsaddr: { label: '清算人地址', dbfCol: 'CLSADDR' },
  f8_clsdate: { label: '清算就任日期', dbfCol: 'CLSDATE' },
  f8_wendtype: { label: '申報類別(1結算/2決算)', dbfCol: 'WENDTYPE' },
  f8_setdate: { label: '特殊會計年度核准日期', dbfCol: 'SETDATE' },
  f8_setno: { label: '特殊會計年度核准文號', dbfCol: 'SETNO' },
  f8_memo02: { label: '其他備註２', dbfCol: 'MEMO02', type: 'textarea' },
  f8_memo03: { label: '其他備註３', dbfCol: 'MEMO03', type: 'textarea' },
};

export const TAB_FIELDS_MAP: Record<number, string[]> = {
  0: [
    'f3_code', 'f3_name', 'f3_eng', 'f3_short', 'f3_uni', 'f3_taxNo',
    'f3_offno', 'f3_offno4', 'f3_capital', 'f3_tel', 'f3_fax', 'f3_email',
    'f3_addr', 'f3_invaddr', 'f3_postno', 'f3_acctType', 'f3_owner',
    'f3_idNo', 'f3_mobile', 'f3_ownerAddr', 'f3_contactName', 'f3_contactTel',
    'f3_contactMobile', 'f3_memo'
  ],
  1: [
    'f4_linkman1', 'f4_linktel1', 'f4_monthv', 'f4_kind', 'f4_mediatype',
    'f4_t401', 'f4_tzero', 'f4_tflog', 'f4_tnot', 'f4_tpay',
    'f4_mainunino', 'f4_datayn', 'f4_outrate', 'f4_fileno', 'f4_tchk',
    'f4_compno', 'f4_pbktype', 'f4_pbkcpano', 'f4_pbkname', 'f4_pbkidno',
    'f4_pbktel', 'f4_idno401'
  ],
  2: [
    'f5_house', 'f5_upcode', 'f5_bktype5', 'f5_compno5', 'f5_linkman5',
    'f5_linktel5', 'f5_mediano'
  ],
  3: [
    'f6_orga', 'f6_pnostd', 'f6_pno', 'f6_pno2', 'f6_pno3',
    'f6_compno6', 'f6_cpano', 'f6_cpaname', 'f6_cpagno', 'f6_bdaten',
    'f6_bdate', 'f6_edate', 'f6_etype', 'f6_rdate', 'f6_bktype',
    'f6_bkcpano', 'f6_bkname', 'f6_bkidno', 'f6_bktel', 'f6_bkaddr',
    'f6_bkunino', 'f6_bkbd', 'f6_bked', 'f6_bktax', 'f6_bkcno1',
    'f6_bkcword', 'f6_bkcno2', 'f6_bkdate', 'f6_bkprior', 'f6_bkother',
    'f6_sbktype', 'f6_sbkcpano', 'f6_sbkname', 'f6_sbkidno', 'f6_sbktel',
    'f6_sbkaddr', 'f6_sbktax', 'f6_sbkcno1', 'f6_sbkcword', 'f6_sbkcno2',
    'f6_sbkdate', 'f6_sbkprior', 'f6_sbkother'
  ],
  4: [
    'f7_tbktype', 'f7_tbkcpano', 'f7_tbkname', 'f7_tbkidno', 'f7_tbktel',
    'f7_tbkaddr', 'f7_tbkcno1', 'f7_tbkcword', 'f7_tbkcno2', 'f7_tbkdate',
    'f7_taxmenno', 'f7_taxmen', 'f7_placeno', 'f7_place', 'f7_keyin',
    'f7_recamt', 'f7_rectime', 'f7_memo01'
  ],
  5: [
    'f8_qbktype', 'f8_qbkcpano', 'f8_qbkname', 'f8_qbkidno', 'f8_qbktel',
    'f8_qbkaddr', 'f8_qbktax', 'f8_qbkdate', 'f8_qbkprior', 'f8_qbkother',
    'f8_clsname', 'f8_clsidno', 'f8_clstel', 'f8_clsaddr', 'f8_clsdate',
    'f8_wendtype', 'f8_setdate', 'f8_setno', 'f8_memo02', 'f8_memo03'
  ]
};
