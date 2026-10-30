const fs = require('fs');
const path = require('path');
const td = new TextDecoder('big5');

// 1. Extract h_AREA2.dbf
console.log('Extracting districts from C:\\w3000\\dbf\\h_AREA2.dbf...');
const areaBuf = fs.readFileSync('C:\\w3000\\dbf\\h_AREA2.dbf');
const areaCount = areaBuf.readUInt32LE(4);
const areaHeaderLen = areaBuf.readUInt16LE(8);
const areaRecLen = areaBuf.readUInt16LE(10);

const cityList = [];
const cityMap = new Map();

let offset = areaHeaderLen;
for (let i = 0; i < areaCount; i++) {
  const rec = areaBuf.subarray(offset + 1, offset + areaRecLen);
  let city = td.decode(rec.subarray(0, 6)).trim();
  const zip = rec.subarray(6, 9).toString('ascii').trim();
  const area = td.decode(rec.subarray(9, 17)).trim();

  if (city && area && city !== '南海島' && city !== '釣魚臺') {
    // Standardize 臺 to 台 for consistent user searching, but keep alias
    let entry = cityMap.get(city);
    if (!entry) {
      entry = { name: city, districts: [] };
      cityMap.set(city, entry);
      cityList.push(entry);
    }
    if (!entry.districts.some(d => d.zip === zip && d.name === area)) {
      entry.districts.push({ zip, name: area });
    }
  }
  offset += areaRecLen;
}

// 2. Extract h_ROAD1.dbf
console.log('Extracting roads from C:\\w3000\\dbf\\h_ROAD1.dbf...');
const roadBuf = fs.readFileSync('C:\\w3000\\dbf\\h_ROAD1.dbf');
const roadCount = roadBuf.readUInt32LE(4);
const roadHeaderLen = roadBuf.readUInt16LE(8);
const roadRecLen = roadBuf.readUInt16LE(10);
const zipRoads = {};

offset = roadHeaderLen;
let roadTotal = 0;
for (let i = 0; i < roadCount; i++) {
  const rec = roadBuf.subarray(offset + 1, offset + roadRecLen);
  const zip = rec.subarray(0, 3).toString('ascii').trim();
  const road = td.decode(rec.subarray(3, 35)).trim();
  if (zip && road) {
    if (!zipRoads[zip]) zipRoads[zip] = [];
    if (!zipRoads[zip].includes(road)) {
      zipRoads[zip].push(road);
      roadTotal++;
    }
  }
  offset += roadRecLen;
}
console.log(`Extracted ${cityList.length} cities, ${roadTotal} roads.`);

// Write taiwanDistricts.ts
const distTsContent = `/**
 * 台灣各縣市與鄉鎮市區郵遞區號資料庫 (源自 w3000 AREA2.dbf)
 */
export interface TaiwanDistrict {
  zip: string;
  name: string;
}

export interface TaiwanCity {
  name: string;
  districts: TaiwanDistrict[];
}

export const TAIWAN_CITIES: TaiwanCity[] = ${JSON.stringify(cityList, null, 2)};
`;

fs.mkdirSync(path.join(__dirname, '../frontend/src/data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../frontend/src/data/taiwanDistricts.ts'), distTsContent, 'utf8');
console.log('Saved frontend/src/data/taiwanDistricts.ts');

// Write public/data/taiwan_roads.json
fs.mkdirSync(path.join(__dirname, '../frontend/public/data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../frontend/public/data/taiwan_roads.json'), JSON.stringify(zipRoads), 'utf8');
console.log('Saved frontend/public/data/taiwan_roads.json');
