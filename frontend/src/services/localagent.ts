import axios from 'axios';

/**
 * 專用於呼叫地端 LocalAgent (http://localhost:18889) 之獨立 Axios 實例
 * 絕不繼承 ERP 後端全域 baseURL 或 X-Data-Drive Header，杜絕跨域 CORS Preflight 攔截
 */
export const localagentApi = axios.create({
  baseURL: 'http://localhost:18889',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

