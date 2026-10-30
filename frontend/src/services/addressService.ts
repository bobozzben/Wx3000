import { TAIWAN_CITIES, type TaiwanCity, type TaiwanDistrict } from '../data/taiwanDistricts';

export { TAIWAN_CITIES, type TaiwanCity, type TaiwanDistrict };

let roadsCache: Record<string, string[]> | null = null;
let roadsFetchPromise: Promise<Record<string, string[]>> | null = null;

/**
 * 依郵遞區號取得對應之所有路名清單 (代碼分割動態載入並記憶體快取)
 */
export async function getRoadsForZip(zip: string): Promise<string[]> {
  if (!zip) return [];
  if (roadsCache) {
    return roadsCache[zip] || [];
  }
  if (!roadsFetchPromise) {
    roadsFetchPromise = import('../data/taiwan_roads.json')
      .then((m) => {
        const data = (m.default || m) as Record<string, string[]>;
        roadsCache = data;
        return data;
      })
      .catch((err) => {
        console.warn('載入道路資料庫失敗:', err);
        roadsCache = {};
        return {};
      });
  }
  const allRoads = await roadsFetchPromise;
  return allRoads[zip] || [];
}

/**
 * 將字串中的半形數字 0~9 轉為全形 ０~９ (對齊 util_hi_addr_form.pas Dig2Big)
 */
export function digToBig(input: string): string {
  const fullWidthDigits = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
  return input.replace(/[0-9]/g, (ch) => fullWidthDigits[parseInt(ch, 10)] || ch);
}

/**
 * 智慧解析現有地址字串，自動推斷 縣市、鄉鎮市區、郵遞區號與路名
 */
export function parseTaiwanAddress(rawAddr: string): {
  city: string;
  district: string;
  zip: string;
  road: string;
  detail: string;
} {
  const s = (rawAddr || '').trim();
  if (!s) {
    return { city: '', district: '', zip: '', road: '', detail: '' };
  }

  // 1. 偵測開頭是否有 3 碼郵遞區號
  let working = s;
  let zip = '';
  const zipMatch = working.match(/^(\d{3,6})/);
  if (zipMatch) {
    zip = zipMatch[1].slice(0, 3);
    working = working.slice(zipMatch[0].length).trim();
  }

  // 2. 比對縣市 (相容「台」與「臺」)
  let foundCity: TaiwanCity | undefined;
  for (const c of TAIWAN_CITIES) {
    const alias1 = c.name;
    const alias2 = c.name.replace(/臺/g, '台');
    const alias3 = c.name.replace(/台/g, '臺');
    if (working.startsWith(alias1) || working.startsWith(alias2) || working.startsWith(alias3)) {
      foundCity = c;
      working = working.slice(alias1.length).trim();
      break;
    }
  }

  // 3. 比對鄉鎮市區
  let foundDist: TaiwanDistrict | undefined;
  if (foundCity) {
    for (const d of foundCity.districts) {
      if (working.startsWith(d.name)) {
        foundDist = d;
        if (!zip) zip = d.zip;
        working = working.slice(d.name.length).trim();
        break;
      }
    }
  }

  // 4. 若有郵遞區號但沒匹配到縣市/行政區，反查
  if (zip && (!foundCity || !foundDist)) {
    for (const c of TAIWAN_CITIES) {
      const d = c.districts.find((item) => item.zip === zip);
      if (d) {
        if (!foundCity) foundCity = c;
        if (!foundDist) foundDist = d;
        break;
      }
    }
  }

  // 5. 街路名稱比對 (路/街/大道/橋等結尾)
  let road = '';
  let detail = working;
  const roadMatch = working.match(/^(.*?(路|街|大道|道|橋|巷))(\d+.*)?$/);
  if (roadMatch) {
    road = roadMatch[1];
    detail = working.slice(road.length).trim();
  }

  return {
    city: foundCity ? foundCity.name : '',
    district: foundDist ? foundDist.name : '',
    zip: foundDist ? foundDist.zip : zip,
    road,
    detail,
  };
}
