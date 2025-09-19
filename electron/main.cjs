const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const AudioBridge = require("./audio-bridge.cjs");

let mainWindow;
let audioBridge;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("dist/index.html");
  mainWindow.webContents.openDevTools();
}

// Initialize audio bridge
async function initializeAudio() {
  audioBridge = new AudioBridge();
  await audioBridge.initialize();
}

// IPC handlers
ipcMain.handle("audio:setDeckPlaying", async (event, deck, playing) => {
  audioBridge.setDeckPlaying(deck, playing);
  return { success: true };
});

ipcMain.handle("audio:setDeckVolume", async (event, deck, volume) => {
  audioBridge.setDeckVolume(deck, volume);
  return { success: true };
});

ipcMain.handle("audio:setDeckPitch", async (event, deck, pitch) => {
  audioBridge.setDeckPitch(deck, pitch);
  return { success: true };
});

ipcMain.handle("audio:setDeckPosition", async (event, deck, position) => {
  audioBridge.setDeckPosition(deck, position);
  return { success: true };
});

ipcMain.handle("audio:setDeckFile", async (event, deck, filepath) => {
  audioBridge.setDeckFile(deck, filepath);
  return { success: true };
});

ipcMain.handle("audio:setEffect", async (event, deck, effect, enabled) => {
  audioBridge.setEffect(deck, effect, enabled);
  return { success: true };
});

ipcMain.handle("audio:setEQ", async (event, deck, band, value) => {
  audioBridge.setEQ(deck, band, value);
  return { success: true };
});

ipcMain.handle("audio:setCrossfader", async (event, value) => {
  audioBridge.setCrossfader(value);
  return { success: true };
});

ipcMain.handle("audio:setMasterVolume", async (event, volume) => {
  audioBridge.setMasterVolume(volume);
  return { success: true };
});

ipcMain.handle("audio:setHeadphoneVolume", async (event, volume) => {
  audioBridge.setHeadphoneVolume(volume);
  return { success: true };
});

app.whenReady().then(async () => {
  await initializeAudio();
  createWindow();
});

app.on("before-quit", () => {
  if (audioBridge) {
    audioBridge.shutdown();
  }
});
