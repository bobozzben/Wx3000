import axios, { type InternalAxiosRequestConfig } from 'axios';

// 預設後端 ERP API 伺服器位置（本機開發或單機運行）
export const DEFAULT_API_SERVER = 'http://localhost:5007';
export const STORAGE_KEY_API_SERVER = 'wx3000_api_server_url';

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

  // 2. 探測 /swagger
  try {
    const res = await axios.get(`${url}/swagger/v1/swagger.json`, {
      timeout: 2500,
      headers: { Accept: 'application/json' },
    });
    const latency = Date.now() - startTime;
    return {
      success: res.status >= 200 && res.status < 400,
      latencyMs: latency,
      message: `連線成功 (${latency}ms)`,
      statusCode: res.status,
    };
  } catch {
    // 忽略 swagger 錯誤
  }

  // 3. 探測業務 API /api/wbase3010
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
 * 初始化 Axios 全域攔截器
 * 確保在 Electron（file://）或純前端桌面端架構下，
 * 所有的相對路徑 `/api/...` 都自動指向配置的 ERP 伺服器
 */
export const initApiConfig = () => {
  const activeUrl = getApiServerUrl();
  applyApiServerUrl(activeUrl);

  // 1. Axios 攔截器：統一將 /api/... 請求導向當前配置之 ERP 後端伺服器
  axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const currentServer = getApiServerUrl();
    if (config.url && config.url.startsWith('/api')) {
      config.baseURL = currentServer;
    }
    return config;
  });

  // 2. 原生 window.fetch 補丁：確保任何使用 fetch 的組件也能在 Electron (file://) 下正確發送請求
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const currentServer = getApiServerUrl();
      if (typeof input === 'string') {
        if (input.startsWith('/api')) {
          input = `${currentServer}${input}`;
        }
      } else if (input instanceof URL) {
        if (input.pathname.startsWith('/api')) {
          input = new URL(`${currentServer}${input.pathname}${input.search}`);
        }
      }
      return originalFetch(input, init);
    };
  }
};
