const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Require server to start it in background
const { server } = require('./src/server');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'ExamShield LAN 🛡️ - Teacher Control Center',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);

  // Allow server 1 second to bind to port 3000, then load dashboard
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000/admin');
  }, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

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
