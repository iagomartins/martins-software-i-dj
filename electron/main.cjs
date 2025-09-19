const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises; // Use promises version
const AudioBridge = require("./audio-bridge.cjs");

let mainWindow;
let audioBridge;

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");
  console.log("🔧 Preload path:", preloadPath);
  console.log("🔧 Preload exists:", require("fs").existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
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

// Add file dialog handler
ipcMain.handle("dialog:showOpenDialog", async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Add file system handlers
ipcMain.handle("fs:writeFile", async (event, filePath, data) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, Buffer.from(data));
    console.log(`✅ File written to: ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    console.error(`❌ Failed to write file: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:readFile", async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    return { success: true, data: Array.from(data) }; // Convert to array for transfer
  } catch (error) {
    console.error(`❌ Failed to read file: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:exists", async (event, filePath) => {
  try {
    await fs.access(filePath);
    return { success: true, exists: true };
  } catch (error) {
    return { success: true, exists: false };
  }
});

ipcMain.handle("fs:unlink", async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`✅ File deleted: ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to delete file: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:mkdir", async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to create directory: ${error.message}`);
    return { success: false, error: error.message };
  }
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
