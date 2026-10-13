const { contextBridge, ipcRenderer } = require('electron');

// 暴露給前端 Renderer (React) 的安全 API
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  
  // 視窗控制
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // 列印支援（ERP 報表/進貨單/發票憑單列印）
  print: (options) => ipcRenderer.invoke('window-print', options),
  
  // 系統資訊
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 開啟系統瀏覽器或外部路徑
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
