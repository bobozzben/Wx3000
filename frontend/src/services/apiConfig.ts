import axios, { type InternalAxiosRequestConfig } from 'axios';

// 預設後端 ERP API 伺服器位置（本機開發或單機運行）
export const DEFAULT_API_SERVER = 'http://localhost:5007';
export const STORAGE_KEY_API_SERVER = 'wx3000_api_server_url';

// 資料來源磁碟機代號設定
export const DEFAULT_DATA_DRIVE = 'C';
export const STORAGE_KEY_DATA_DRIVE = 'wx3000_data_drive';
export const STORAGE_KEY_DATA_DRIVE_CONFIGURED = 'wx3000_data_drive_configured';

/**
 * 標準化磁碟機代號 (提取第一個英文字母並轉大寫，預設 'C')
 */
export const normalizeDrive = (drive?: string): string => {
  if (!drive || typeof drive !== 'string') return DEFAULT_DATA_DRIVE;
  const match = drive.trim().toUpperCase().match(/^([A-Z])(?::.*)?$/);
  return match ? match[1] : DEFAULT_DATA_DRIVE;
};

/**
 * 取得當前設定的資料來源磁碟機代號 (例如: "C" 或 "F")
 */
export const getDataDrive = (): string => {
  if (typeof window === 'undefined') return DEFAULT_DATA_DRIVE;
  const saved = localStorage.getItem(STORAGE_KEY_DATA_DRIVE);
  if (saved && saved.trim()) {
    return normalizeDrive(saved);
  }
  return DEFAULT_DATA_DRIVE;
};

/**
 * 檢查資料來源磁碟機參數是否曾經被使用者確認/設定過
 */
export const isDataDriveConfigured = (): boolean => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY_DATA_DRIVE_CONFIGURED) === 'true';
};

/**
 * 取得當前磁碟機對應的 PostgreSQL Schema (例如: "c:/w3000/comm" 或 "f:/w3000/comm")
 */
export const getPgSchema = (): string => {
  return `${getDataDrive().toLowerCase()}:/w3000/comm`;
};

/**
 * 取得當前磁碟機對應的 DBF 路徑 (例如: "C:\w3000\comm" 或 "F:\w3000\comm")
 */
export const getDbfPath = (): string => {
  return `${getDataDrive().toUpperCase()}:\\w3000\\comm`;
};

/**
 * 儲存資料來源磁碟機代號
 */
export const setDataDrive = (drive: string, isConfigured: boolean = true): string => {
  const normalized = normalizeDrive(drive);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_DATA_DRIVE, normalized);
    if (isConfigured) {
      localStorage.setItem(STORAGE_KEY_DATA_DRIVE_CONFIGURED, 'true');
    }
  }
  return normalized;
};

/**
 * 判斷當前環境是否為 Electron 桌面客戶端
 */
export const isElectronApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).electronAPI ||
    window.location.protocol === 'file:' ||
    navigator.userAgent.includes('Electron')
  );
};

/**
 * 取得當前設定的 ERP 後端伺服器 Base URL
 */
export const getApiServerUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_API_SERVER;

  const saved = localStorage.getItem(STORAGE_KEY_API_SERVER);
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  // 讀取環境變數 VITE_API_URL
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 若在 Web 瀏覽器環境下開啟 (非 file:// 且非 Electron)，自動以當前伺服器 origin 為 API 位址
  if (!isElectronApp() && typeof window.location !== 'undefined' && window.location.protocol.startsWith('http')) {
    return window.location.origin;
  }

  return DEFAULT_API_SERVER;
};

/**
 * 儲存並更新 ERP 後端伺服器位址
 */
export const setApiServerUrl = (url: string): string => {
  let cleanUrl = url.trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    cleanUrl = DEFAULT_API_SERVER;
  }
  // 自動補齊協議
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }

  localStorage.setItem(STORAGE_KEY_API_SERVER, cleanUrl);
  applyApiServerUrl(cleanUrl);
  return cleanUrl;
};

/**
 * 將 Base URL 套用到 Axios 全域實例
 */
export const applyApiServerUrl = (serverUrl: string) => {
  axios.defaults.baseURL = serverUrl;
};

/**
 * 測試與 ERP 後端伺服器的連線狀態（Ping / Health Check）
 */
export interface ServerCheckResult {
  success: boolean;
  latencyMs: number;
  message: string;
  statusCode?: number;
}

export const checkServerConnection = async (targetUrl?: string): Promise<ServerCheckResult> => {
  const url = (targetUrl || getApiServerUrl()).replace(/\/+$/, '');
  const startTime = Date.now();

  // 1. 優先探測 /health 端點
  try {
    const healthRes = await axios.get(`${url}/health`, {
      timeout: 2500,
      headers: { Accept: 'application/json' },
    });
    const latency = Date.now() - startTime;
    return {
      success: healthRes.status >= 200 && healthRes.status < 400,
      latencyMs: latency,
      message: `連線成功 (${latency}ms)`,
      statusCode: healthRes.status,
    };
  } catch {
    // 忽略 /health 錯誤，進入後續備用探測
  }

  // 2. 備用探測業務 API /api/wbase3010
  try {
    const fallbackRes = await axios.get(`${url}/api/wbase3010`, {
      timeout: 3000,
      params: { keyword: '__ping__' },
    });
    const latency = Date.now() - startTime;
    return {
      success: fallbackRes.status >= 200 && fallbackRes.status < 400,
      latencyMs: latency,
      message: `連線成功 (${latency}ms)`,
      statusCode: fallbackRes.status,
    };
  } catch (fallbackErr: any) {
    const latency = Date.now() - startTime;
    const errorMsg = fallbackErr.response?.status
      ? `伺服器回應 HTTP ${fallbackErr.response.status}`
      : fallbackErr.message || '無法連線至指定的 ERP 伺服器';
    return {
      success: false,
      latencyMs: latency,
      message: errorMsg,
      statusCode: fallbackErr.response?.status,
    };
  }
};

/**
 * 檢查磁碟機代號下是否存在 W3000 目錄
 */
export interface DriveCheckResult {
  success: boolean;
  exists: boolean;
  drive: string;
  path: string;
  message: string;
}

export const checkDriveDirectory = async (
  drive: string,
  targetServerUrl?: string
): Promise<DriveCheckResult> => {
  const normDrive = normalizeDrive(drive);
  const targetDir = `${normDrive}:\\W3000`;
  const url = (targetServerUrl || getApiServerUrl()).replace(/\/+$/, '');

  // 1. 優先呼叫後端 API /api/systemconfig/check-drive
  try {
    const res = await axios.get<DriveCheckResult>(`${url}/api/systemconfig/check-drive`, {
      params: { drive: normDrive },
      timeout: 3000,
    });
    if (res.data) {
      return res.data;
    }
  } catch (err) {
    // 後端尚未啟動或端點不可用，進入備用 LocalAgent 檢測
  }

  // 2. 備用呼叫地端 LocalAgent (http://localhost:18889/api/check-drive)
  try {
    const agentRes = await axios.get<DriveCheckResult>('http://localhost:18889/api/check-drive', {
      params: { drive: normDrive },
      timeout: 2000,
    });
    if (agentRes.data) {
      return agentRes.data;
    }
  } catch {
    // 忽略 LocalAgent 錯誤
  }

  // 3. 若皆無法連線，回傳提示
  return {
    success: false,
    exists: false,
    drive: normDrive,
    path: targetDir,
    message: `無法連線至伺服器或 LocalAgent 檢查目錄，請確認伺服器或代理服務已啟動`,
  };
};

/**
 * 套用並儲存磁碟機設定至後端 API
 */
export const applyServerSystemConfig = async (
  drive: string,
  targetServerUrl?: string
): Promise<{ success: boolean; message: string; currentPgSchema?: string; currentDbfPath?: string }> => {
  const normDrive = normalizeDrive(drive);
  const url = (targetServerUrl || getApiServerUrl()).replace(/\/+$/, '');

  try {
    const res = await axios.post(`${url}/api/systemconfig`, { dataDrive: normDrive }, { timeout: 5000 });
    return {
      success: res.data?.success ?? true,
      message: res.data?.message || '設定儲存成功',
      currentPgSchema: res.data?.currentPgSchema,
      currentDbfPath: res.data?.currentDbfPath,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.response?.data?.message || err.message || '儲存伺服器設定失敗',
    };
  }
};

/**
 * 初始化 Axios 全域攔截器
 */
export const initApiConfig = () => {
  const activeUrl = getApiServerUrl();
  applyApiServerUrl(activeUrl);

  // 1. Axios 攔截器：統一將 /api/... 請求導向當前配置之 ERP 後端伺服器，並附帶 X-Data-Drive
  axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const currentServer = getApiServerUrl();
    const isRelativeApi = Boolean(config.url && config.url.startsWith('/api'));
    const isBackendApi = isRelativeApi ||
      Boolean(config.url && config.url.startsWith(currentServer)) ||
      Boolean(!config.url?.startsWith('http://') && !config.url?.startsWith('https://'));

    if (isRelativeApi) {
      config.baseURL = currentServer;
    }

    if (isBackendApi) {
      if (!config.headers) {
        config.headers = {} as any;
      }
      if (typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('X-Data-Drive', getDataDrive());
      } else {
        config.headers['X-Data-Drive'] = getDataDrive();
      }
    } else {
      // 外部服務 (例如 LocalAgent http://localhost:18889)，徹底清除 X-Data-Drive 防止觸發跨域 CORS Preflight 攔截
      if (config.headers) {
        if (typeof (config.headers as any).delete === 'function') {
          (config.headers as any).delete('X-Data-Drive');
          (config.headers as any).delete('x-data-drive');
        }
        delete (config.headers as any)['X-Data-Drive'];
        delete (config.headers as any)['x-data-drive'];
      }
    }
    return config;
  });

  // 2. 原生 window.fetch 補丁
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const currentServer = getApiServerUrl();
      const currentDrive = getDataDrive();

      const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const isBackendApi = !inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')
        ? true
        : inputUrl.startsWith(currentServer);

      const newInit: RequestInit = { ...init };
      if (isBackendApi) {
        const headers = new Headers(newInit.headers || {});
        if (!headers.has('X-Data-Drive')) {
          headers.set('X-Data-Drive', currentDrive);
        }
        newInit.headers = headers;
      }

      if (typeof input === 'string') {
        if (input.startsWith('/api')) {
          input = `${currentServer}${input}`;
        }
      } else if (input instanceof URL) {
        if (input.pathname.startsWith('/api')) {
          input = new URL(`${currentServer}${input.pathname}${input.search}`);
        }
      }
      return originalFetch(input, newInit);
    };
  }
};
