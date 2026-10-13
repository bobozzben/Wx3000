const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Wx3000 雲端會計進銷存系統 (FoxPro 桌面端)',
    backgroundColor: '#0f172a',
    show: false, // 載入完成後優雅顯示，避免白屏
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // 允許連線至內網不同 IP 之 ERP Web API
      spellcheck: false,
    },
  });

  // ERP 專用選單配置（確保 F12、F2、F9 完整保留給 FoxPro 鍵盤盲打）
  const template = [
    {
      label: '系統 (&S)',
      submenu: [
        {
          label: '伺服器連線設定 (&C)',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('open-server-config');
          },
        },
        { type: 'separator' },
        {
          label: '重新載入畫面 (&R)',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.reload();
          },
        },
        {
          label: '列印 (&P)',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow.webContents.print();
          },
        },
        { type: 'separator' },
        {
          label: '離開 Wx3000 (&X)',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '檢視 (&V)',
      submenu: [
        { label: '實際大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '縮小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切換全螢幕', accelerator: 'F11', role: 'togglefullscreen' },
        {
          label: '開發人員診斷工具 (DevTools)',
          accelerator: 'CmdOrCtrl+Shift+I', // 嚴禁綁定 F12，F12 保留給 FoxPro 存檔
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: '說明 (&H)',
      submenu: [
        {
          label: '關於 Wx3000 桌面端',
          click: () => {
            mainWindow.webContents.send('open-about-dialog');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // 視窗最大化並顯示
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // 攔截並防止使用者誤按 F5 重整導致輸入中表單遺失
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F5' && !input.control && !input.meta) {
      // 阻止單按 F5（若需強制重載請使用 Ctrl+R）
      event.preventDefault();
    }
  });

  // 載入頁面
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error('Failed to load dev server:', err);
      loadStaticHtml();
    });
  } else {
    loadStaticHtml();
  }

  function loadStaticHtml() {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load dist index.html:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 註冊 IPC 監聽
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url);
});

ipcMain.handle('window-print', async (_, options = {}) => {
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent || false,
        printBackground: true,
        deviceName: options.deviceName || '',
        ...options,
      },
      (success, failureReason) => {
        if (!success) {
          console.warn('Print failed or cancelled:', failureReason);
        }
        resolve(success);
      }
    );
  });
});

// 生命週期
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
