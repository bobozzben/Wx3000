import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, FileDown, Filter, Hash, ListOrdered, MapPin, Settings2, Stamp } from 'lucide-react';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import {
  FoxProPrintModalv2,
  type PrintConditionSection,
  type PrintConditionStatus,
  type PrintConditionValues,
} from '../../components/FoxProGrid/FoxProPrintModalv2';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { exportFieldsToXlsx } from '../../components/FoxProGrid/useFoxProPrintXlsxExport';
import { oddStartMonth, validEndMonth, validRocYear } from '../../components/FoxProGrid/foxProPrintValidators';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { MessageDialog, type MessageState } from '../wbase2030/Wbase2030Dialogs';
import { useTheme } from '../menu/ThemeContext';
import { fetchTicketPlaceByCode, fetchTicketPlaces } from '../../services/wbase3010';
import { getSystemParam, setSystemParam } from '../../services/systemParamService';
import { getPgSchema } from '../../services/apiConfig';
import {
  describeMediaTransferError,
  fetchMediaTransferDefaults,
  runMediaTransfer,
  saveMediaTransferFile,
  type MediaTransferDefaults,
  type MediaTransferMode,
  type MediaTransferRequest,
  type MediaTransferResult,
  type MediaTransferRow,
} from '../../services/wbase3025';

export interface Wbase3025TransferProps {
  mode: MediaTransferMode;
  onClose: () => void;
}

const SCREEN: Record<MediaTransferMode, { title: string; code: string; formCode: string; menu: string }> = {
  media: { title: '統一發票購買媒體轉檔作業', code: 'wbase3025', formCode: 'VFP wbase3025 ‧ wbasemenu0304cmd01', menu: '3-4-1 原媒體轉檔' },
  net: { title: '統一發票購買網路申購轉檔', code: 'wbase3025n', formCode: 'VFP wbase3025n ‧ wbasemenu0304cmd02', menu: '3-4-2 網路申購轉檔' },
};

/** 記住上次條件的 參數設定 名稱 (兩個畫面共用縣市 / 購買地點 / 業者ID，與 VFP pub_para.buycity 的用途相同) */
const PARAM_TABLE = '參數設定';
const PARAM_CITY = '統購轉檔縣市';
const PARAM_PLACE = '統購轉檔購買地點';
const PARAM_AGENT = '統購轉檔記帳業者ID';
const PARAM_FILTER = '統購轉檔依據';
const PARAM_MEDIA_SORT = '原媒體轉檔排序';
const PARAM_MEDIA_FORMAT = '原媒體轉檔格式';
const PARAM_MEDIA_OFFICE = '原媒體轉檔事務所資料';
const PARAM_NET_FORMAT = '網路申購轉檔格式';

const XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '代號', selected: true },
  { key: 'name', label: '公司名稱', customTitle: '公司名稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'times', label: '購買次數', customTitle: '次數', selected: true },
  { key: 'a02', label: '二聯', customTitle: '二聯', selected: true },
  { key: 'a02b', label: '二聯副', customTitle: '二聯副', selected: true },
  { key: 'a03', label: '三聯', customTitle: '三聯', selected: true },
  { key: 'a03b', label: '三聯副', customTitle: '三聯副', selected: true },
  { key: 'spec', label: '特種', customTitle: '特種', selected: true },
  { key: 'c02', label: '二收銀', customTitle: '二收銀', selected: true },
  { key: 'c03', label: '三收銀', customTitle: '三收銀', selected: true },
  { key: 'c03b', label: '三收副', customTitle: '三收副', selected: true },
  { key: 'addr', label: '地址', customTitle: '地址', selected: false },
  { key: 'error', label: '錯誤', customTitle: '錯誤', selected: true },
];

const qtyCol = (key: keyof MediaTransferRow, label: string): FoxProPrintColumn<MediaTransferRow> => ({
  key,
  label,
  width: '58px',
  align: 'right',
  render: (val) => (Number(val) ? String(val) : ''),
});

const PREVIEW_COLUMNS: FoxProPrintColumn<MediaTransferRow>[] = [
  { key: 'no', label: '代號', width: '80px', align: 'center' },
  { key: 'name', label: '公司名稱', width: '170px' },
  { key: 'unino', label: '統一編號', width: '90px', align: 'center' },
  { key: 'taxno', label: '稅籍編號', width: '95px', align: 'center' },
  { key: 'times', label: '次', width: '36px', align: 'center' },
  qtyCol('a02', '二聯'),
  qtyCol('a02b', '二副'),
  qtyCol('a03', '三聯'),
  qtyCol('a03b', '三副'),
  qtyCol('spec', '特種'),
  qtyCol('c02', '二收'),
  qtyCol('c03', '三收'),
  qtyCol('c03b', '三收副'),
  { key: 'error', label: '錯誤', width: '200px' },
];

const isTaipei = (city: string) => city.startsWith('台北市') || city.startsWith('臺北市');

/** 事務所電話 '-' 後 8 碼 (VFP pptel，台北市原媒體檔的代理人代號與檔名) */
const telAgent = (tel: string): string => {
  const ll = tel.indexOf('-');
  return tel.substring(ll + 1).substring(0, 8).trim();
};

/**
 * 3-4-1 原媒體轉檔 (VFP wbase3025) / 3-4-2 網路申購轉檔 (VFP wbase3025n)。
 * 條件畫面用 FoxProPrintModalv2：F7 預覽轉出清單、F8 產生檔案並下載 (對應 VFP F8.確定)、Esc 離開。
 * 檔案內容由後端 /api/wbase3025/transfer 依縣市格式產生 (Big5)，瀏覽器下載取代 VFP 的磁碟機 / 路徑 / 磁片份數。
 */
export const Wbase3025Transfer: React.FC<Wbase3025TransferProps> = ({ mode, onClose }) => {
  const { isDark } = useTheme();
  const isNet = mode === 'net';
  const screen = SCREEN[mode];

  const [values, setValues] = useState<PrintConditionValues>(() => ({
    year: '',
    startMonth: '',
    endMonth: '',
    filterBy: 1,
    city: '',
    placeNo: '',
    agentId: '',
    sortBy: 1,
    withOffice: 1,
    format: 1,
  }));
  const [defaults, setDefaults] = useState<MediaTransferDefaults | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeSearch, setPlaceSearch] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<PrintConditionStatus | null>(null);
  const [preview, setPreview] = useState<MediaTransferResult | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);
  const loadedRef = useRef(false);

  const year = String(values.year ?? '').trim();
  const bm = String(values.startMonth ?? '').trim().padStart(2, '0');
  const em = String(values.endMonth ?? '').trim().padStart(2, '0');
  const period = `${year}${bm}-${em}`;
  const filterBy = Number(values.filterBy) === 2 ? '2' : '1';
  const city = String(values.city ?? '').trim();
  const placeNo = String(values.placeNo ?? '').trim();
  const agentId = String(values.agentId ?? '').trim().toUpperCase();
  const format = String(values.format ?? '1') as '1' | '2' | '3';

  // 區域與預計檔名 (與後端相同規則，只給摘要卡片顯示)
  const regionCity = filterBy === '1' ? city : placeName;
  const region: MediaTransferResult['region'] = isNet
    ? format === '2'
      ? 'kaohsiung'
      : format === '3'
      ? 'province'
      : 'taipei'
    : isTaipei(regionCity)
    ? 'taipei'
    : regionCity.startsWith('高雄市')
    ? 'kaohsiung'
    : 'province';
  const regionName = region === 'taipei' ? '台北市' : region === 'kaohsiung' ? '高雄市' : '台灣省';
  const expectedFile = isNet
    ? `${agentId || '<業者ID>'}${region === 'taipei' ? '.VAX' : '.DAT'}`
    : region === 'taipei'
    ? `${telAgent(defaults?.officeTel ?? '') || '<事務所電話>'}.VAX`
    : region === 'kaohsiung'
    ? agentId || '<業者ID>'
    : format === '2'
    ? 'PODER.TXT'
    : 'PODER.DAT';

  // 進入畫面：上次條件 (參數設定) → 沒有就用 VFP Init 的預設 (最近一期、pub_para.buycity)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const schema = getPgSchema();
    (async () => {
      let def: MediaTransferDefaults | null = null;
      try {
        def = await fetchMediaTransferDefaults();
        setDefaults(def);
      } catch (err) {
        setStatus({ type: 'error', text: describeMediaTransferError(err, '讀取轉檔預設值失敗') });
      }
      try {
        const [savedCity, savedPlace, savedAgent, savedFilter, savedSort, savedMediaFormat, savedOffice, savedNetFormat] = await Promise.all([
          getSystemParam(schema, PARAM_TABLE, PARAM_CITY, ''),
          getSystemParam(schema, PARAM_TABLE, PARAM_PLACE, ''),
          getSystemParam(schema, PARAM_TABLE, PARAM_AGENT, ''),
          getSystemParam(schema, PARAM_TABLE, PARAM_FILTER, '1'),
          getSystemParam(schema, PARAM_TABLE, PARAM_MEDIA_SORT, '1'),
          getSystemParam(schema, PARAM_TABLE, PARAM_MEDIA_FORMAT, '1'),
          getSystemParam(schema, PARAM_TABLE, PARAM_MEDIA_OFFICE, '1'),
          getSystemParam(schema, PARAM_TABLE, PARAM_NET_FORMAT, '1'),
        ]);
        setValues((prev) => ({
          ...prev,
          year: def?.year ?? prev.year,
          startMonth: def?.startMonth ?? prev.startMonth,
          endMonth: def?.endMonth ?? prev.endMonth,
          city: savedCity || def?.city || '',
          placeNo: savedPlace || '',
          agentId: savedAgent || '',
          filterBy: savedFilter === '2' ? 2 : 1,
          sortBy: savedSort === '2' ? 2 : 1,
          withOffice: savedOffice === '2' ? 2 : 1,
          format: isNet ? (['1', '2', '3'].includes(savedNetFormat) ? Number(savedNetFormat) : 1) : savedMediaFormat === '2' ? 2 : 1,
        }));
      } catch (err) {
        console.error('載入統購轉檔參數失敗', err);
        if (def) setValues((prev) => ({ ...prev, year: def.year, startMonth: def.startMonth, endMonth: def.endMonth, city: prev.city || def.city }));
      }
    })();
  }, [isNet]);

  // 購買地點代號 → 名稱 (VFP pno.Valid)
  useEffect(() => {
    if (!placeNo) {
      setPlaceName('');
      return;
    }
    let cancelled = false;
    fetchTicketPlaceByCode(placeNo)
      .then((item) => {
        if (!cancelled) setPlaceName(item?.placeName?.trim() ?? '');
      })
      .catch(() => {
        if (!cancelled) setPlaceName('');
      });
    return () => {
      cancelled = true;
    };
  }, [placeNo]);

  const buildRequest = (): MediaTransferRequest => ({
    mode,
    year,
    startMonth: bm,
    endMonth: em,
    filterBy,
    city,
    placeNo,
    agentId,
    sortBy: Number(values.sortBy) === 2 ? '2' : '1',
    format,
    withOffice: Number(values.withOffice) !== 2,
  });

  const rememberParams = async () => {
    const schema = getPgSchema();
    try {
      await Promise.all([
        setSystemParam(schema, PARAM_TABLE, PARAM_CITY, city),
        setSystemParam(schema, PARAM_TABLE, PARAM_PLACE, placeNo),
        setSystemParam(schema, PARAM_TABLE, PARAM_AGENT, agentId),
        setSystemParam(schema, PARAM_TABLE, PARAM_FILTER, filterBy),
        isNet
          ? setSystemParam(schema, PARAM_TABLE, PARAM_NET_FORMAT, format)
          : Promise.all([
              setSystemParam(schema, PARAM_TABLE, PARAM_MEDIA_SORT, Number(values.sortBy) === 2 ? '2' : '1'),
              setSystemParam(schema, PARAM_TABLE, PARAM_MEDIA_FORMAT, format),
              setSystemParam(schema, PARAM_TABLE, PARAM_MEDIA_OFFICE, Number(values.withOffice) === 2 ? '2' : '1'),
            ]),
      ]);
    } catch (err) {
      console.error('儲存統購轉檔參數失敗', err);
    }
  };

  /** 共同的前置檢查 (FoxProPrintModalv2 已檢核欄位格式；這裡是 VFP f8.Click 的其餘檢查) */
  const precheck = (): string | null => {
    if (!agentId) return '記帳業者ID 未輸入!!';
    if (filterBy === '1' && !city) return '轉檔縣市未輸入!!';
    if (filterBy === '2' && !placeNo) return '轉檔縣市未輸入!!';
    if (isTaipei(city) && !(defaults?.officeTel ?? '').trim()) return '公司電話空白無法轉檔!!';
    return null;
  };

  const transfer = async (): Promise<MediaTransferResult | null> => {
    const err = precheck();
    if (err) {
      setStatus({ type: 'error', text: err });
      return null;
    }
    setBusy(true);
    setStatus({ type: 'info', text: '轉檔資料整理中…' });
    try {
      const result = await runMediaTransfer(buildRequest());
      setStatus({ type: result.errors.length > 0 ? 'warning' : result.rows.length > 0 ? 'success' : 'warning', text: result.message });
      return result;
    } catch (e) {
      setStatus({ type: 'error', text: describeMediaTransferError(e) });
      return null;
    } finally {
      setBusy(false);
    }
  };

  // F7：預覽轉出清單
  const handlePreview = async () => {
    const result = await transfer();
    if (result) setPreview(result);
  };

  // F8：產生檔案並下載 (VFP F8.確定 → 轉檔完成!!)
  const handleExport = async () => {
    const result = await transfer();
    if (!result) return;
    if (result.rows.length === 0) {
      setMessage({ type: 'warning', title: '訊息', lines: [result.message, '沒有產生檔案。'] });
      return;
    }
    saveMediaTransferFile(result);
    void rememberParams();
    const lines = [`檔名：${result.fileName}`, `${result.regionName}格式，共 ${result.rows.length} 家公司、${result.lineCount} 列、${result.byteLength} 位元組`];
    if (result.errors.length > 0) {
      lines.push('', `錯誤清單 (${result.errors.length} 筆，這些列仍已轉出)：`);
      result.errors.slice(0, 12).forEach((e) => lines.push(e));
      if (result.errors.length > 12) lines.push(`… 共 ${result.errors.length} 筆，可用 F7 預覽查看`);
    }
    setMessage({ type: result.errors.length > 0 ? 'warning' : 'success', title: '轉檔完成!!', lines });
  };

  const closePlaceSearch = useCallback(() => {
    setPlaceSearch(false);
    setFocusRequest({ key: 'placeNo' });
  }, []);

  // ------------------------------------------------------------------ 條件卡片
  const sections: PrintConditionSection[] = [
    {
      title: '發票購買期別',
      icon: Calendar,
      badge: period,
      fields: [
        { kind: 'text', key: 'year', label: '年度', suffix: '年', maxLength: 3, digits: true, validate: validRocYear },
        { kind: 'text', key: 'startMonth', label: '起月', maxLength: 2, digits: true, widthClass: 'w-14', validate: oddStartMonth },
        { kind: 'text', key: 'endMonth', label: '迄月', prefix: '－', suffix: '月', maxLength: 2, digits: true, widthClass: 'w-14', validate: validEndMonth('startMonth') },
      ],
    },
    {
      title: '轉檔依據',
      icon: Filter,
      fields: [
        {
          kind: 'options',
          key: 'filterBy',
          label: '轉檔依據',
          options: [
            { value: 1, label: '依地址縣市' },
            { value: 2, label: '依購買地點' },
          ],
        },
      ],
    },
    filterBy === '1'
      ? {
          title: '轉檔縣市',
          icon: MapPin,
          badge: isNet && city === '*' ? '不分區全部轉出' : regionName,
          fields: [
            {
              kind: 'text',
              key: 'city',
              label: '轉檔縣市',
              maxLength: 6,
              widthClass: 'w-40',
              placeholder: isNet ? '例如 台北市，* 不分區' : '例如 台北市',
              suffix: isNet ? '(* : 代表不分區全部轉出)' : undefined,
            },
          ],
        }
      : {
          title: '購買地點',
          icon: MapPin,
          badge: placeName ? `${regionName}格式` : undefined,
          fields: [
            {
              kind: 'text',
              key: 'placeNo',
              label: '購買地點代號',
              maxLength: 6,
              uppercase: true,
              widthClass: 'w-28',
              placeholder: 'F2 選單',
              suffix: placeName || '(F2 開購買地點選單)',
              onF2: () => setPlaceSearch(true),
              validate: (v) => (v.trim() === '' ? '轉檔縣市未輸入!' : null),
            },
          ],
        },
    {
      title: '記帳業者ＩＤ',
      icon: Hash,
      fields: [
        {
          kind: 'text',
          key: 'agentId',
          label: '記帳業者ＩＤ',
          maxLength: 10,
          uppercase: true,
          widthClass: 'w-40',
          placeholder: 'A123456789',
          validate: (v) => (v.trim() === '' ? '記帳業者ID 未輸入!' : null),
        },
      ],
    },
  ];

  if (isNet) {
    sections.push({
      title: '轉檔格式',
      icon: Settings2,
      fields: [
        {
          kind: 'options',
          key: 'format',
          label: '轉檔格式',
          options: [
            { value: 1, label: '台北市' },
            { value: 2, label: '高雄市' },
            { value: 3, label: '台灣省' },
          ],
        },
      ],
    });
  } else {
    sections.push(
      {
        title: '排序方式',
        icon: ListOrdered,
        fields: [
          {
            kind: 'options',
            key: 'sortBy',
            label: '排序方式',
            options: [
              { value: 1, label: '依統一編號' },
              { value: 2, label: '依稅籍編號' },
            ],
          },
        ],
      },
      {
        title: '轉出事務所資料',
        icon: Stamp,
        fields: [
          {
            kind: 'options',
            key: 'withOffice',
            label: '轉出事務所資料',
            options: [
              { value: 1, label: '是 (台灣省檔尾加事務所簽章欄)' },
              { value: 2, label: '否' },
            ],
          },
        ],
      }
    );
    if (region === 'province') {
      sections.push({
        title: '轉檔格式 (附檔檔名)',
        icon: Settings2,
        fields: [
          {
            kind: 'options',
            key: 'format',
            label: '轉檔格式',
            options: [
              { value: 1, label: 'DAT (PODER.DAT)' },
              { value: 2, label: 'TXT (PODER.TXT)' },
            ],
          },
        ],
      });
    }
  }

  const active = !busy && !preview && !placeSearch && !message;

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
      <WbasePageHeader title={screen.menu} code={screen.code} category="發票統購" mode="grid" onBackToMenu={onClose} />

      <FoxProPrintModalv2
        title={screen.title}
        formCode={screen.formCode}
        badge="F7 預覽 / F8 轉檔"
        icon={FileDown}
        sections={sections}
        values={values}
        onChange={setValues}
        summary={{
          title: '轉出檔案',
          icon: FileDown,
          value: `${regionName}格式 ‧ ${expectedFile}`,
          note: `期別 ${period}` + (defaults?.officeName ? ` ‧ ${defaults.officeName}` : ''),
        }}
        active={active}
        printLabel="F7. 預覽轉檔資料"
        onPrint={() => void handlePreview()}
        onExport={() => void handleExport()}
        exportLabel="F8. 轉檔下載"
        status={status}
        onCancel={onClose}
        focusRequest={focusRequest}
      />

      <SearchModal
        isOpen={placeSearch}
        title="購買地點選單"
        onSearch={async (q: string): Promise<SearchItem[]> => {
          const list = await fetchTicketPlaces(q.trim() || undefined);
          return list.map((p) => ({ code: p.placeCode.trim(), name: p.placeName.trim() }));
        }}
        onSelect={(item) => {
          setValues((prev) => ({ ...prev, placeNo: item.code.toUpperCase() }));
          setPlaceName(item.name);
          closePlaceSearch();
        }}
        onClose={closePlaceSearch}
      />

      {preview && (
        <FoxProPrintModal
          isOpen={true}
          onClose={() => setPreview(null)}
          title={`${screen.menu} 預覽`}
          subtitle={`${preview.regionName}格式 ‧ ${preview.fileName} ‧ ${preview.lineCount} 列`}
          reportTitle={`${screen.title} (期別 ${period})`}
          reportSubtitle={`${preview.message}${preview.errors.length > 0 ? `　⚠ 錯誤清單 ${preview.errors.length} 筆 (見「錯誤」欄，這些列仍會轉出)` : ''}`}
          showFilter={false}
          startCodeValue=""
          onStartCodeChange={() => {}}
          endCodeValue=""
          onEndCodeChange={() => {}}
          onSearch={async () => {}}
          data={preview.rows}
          columns={PREVIEW_COLUMNS}
          loading={false}
          hasSearched={true}
          emptyText={`⚠️ ${preview.message}`}
          enableXlsxExport={true}
          xlsxFields={XLSX_FIELDS}
          xlsxStorageKey={`${screen.code}_xlsx_export_config`}
          xlsxFileName={`${screen.menu}_${period}`}
          onExportXlsx={async (data, selectedFields) => exportFieldsToXlsx(data, selectedFields, `${screen.menu}_${period}`)}
        />
      )}

      {message && (
        <MessageDialog
          message={message}
          onDismiss={() => {
            const current = message;
            setMessage(null);
            current.onClose?.();
          }}
        />
      )}
    </div>
  );
};
