const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createConnectWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 480,
    resizable: false,
    title: 'ExamShield LAN 🛡️ - Connect to Host',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'connect.html'));
}

ipcMain.on('connect_to_server', (event, serverUrl) => {
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    serverUrl = 'http://' + serverUrl;
  }

  // Transform into locked kiosk window
  mainWindow.setResizable(true);
  mainWindow.setKiosk(true); // Locks to full screen and prevents minimizing
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadURL(serverUrl);
});

app.whenReady().then(createConnectWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
