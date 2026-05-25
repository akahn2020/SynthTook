const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const isDev = !app.isPackaged;
// Window/taskbar icon is taken from the .exe's embedded icon on Windows and
// the .app bundle's Resources/icon.icns on Mac — both set at build time via
// electron-builder's win.icon / mac.icon. No runtime icon path needed.

const NUM_SLOTS = 8;
const userDataDir = () => app.getPath('userData');
const sessionPath = () => path.join(userDataDir(), 'session.json');
const slotsDir    = () => path.join(userDataDir(), 'slots');
const slotPath    = (i) => path.join(slotsDir(), `${i + 1}.json`);

async function ensureDirs() {
  await fs.mkdir(slotsDir(), { recursive: true });
}

async function readJson(p) {
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function writeJson(p, data) {
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf-8');
}

async function unlinkIfExists(p) {
  try { await fs.unlink(p); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}

function registerIpc() {
  ipcMain.handle('session:read',  async () => { await ensureDirs(); return readJson(sessionPath()); });
  ipcMain.handle('session:write', async (_e, data) => { await ensureDirs(); await writeJson(sessionPath(), data); });
  ipcMain.handle('session:clear', async () => { await unlinkIfExists(sessionPath()); });

  ipcMain.handle('slots:list', async () => {
    await ensureDirs();
    const out = new Array(NUM_SLOTS).fill(null);
    for (let i = 0; i < NUM_SLOTS; i++) out[i] = await readJson(slotPath(i));
    return out;
  });
  ipcMain.handle('slots:write', async (_e, index, slot) => {
    await ensureDirs();
    await writeJson(slotPath(index), slot);
  });
  ipcMain.handle('slots:clear', async (_e, index) => { await unlinkIfExists(slotPath(index)); });

  ipcMain.handle('shell:openUserData', async () => {
    await ensureDirs();
    await shell.openPath(userDataDir());
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const fileMenu = {
    label: 'File',
    submenu: [
      {
        label: 'Show Patterns Folder',
        accelerator: isMac ? 'Cmd+Shift+O' : 'Ctrl+Shift+O',
        click: async () => { await ensureDirs(); await shell.openPath(userDataDir()); },
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  };
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    fileMenu,
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'About SynthTook Local',
          click: async () => { await shell.openExternal('https://github.com/akahn2020/SynthTook'); },
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a14',
    title: 'SynthTook Local',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'midi' || permission === 'midiSysex');
  });
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'midi' || permission === 'midiSysex';
  });

  win.loadFile('index.html');
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

// Single-instance lock: if a second `npm start` happens while one is already
// running, focus the existing window instead of fighting for the same userData
// dir (which produces cache-lock errors).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
