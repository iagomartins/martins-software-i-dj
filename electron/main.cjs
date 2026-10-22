const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises; // Use promises version

let mainWindow;

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");
  console.log("🔧 Preload path:", preloadPath);
  console.log("🔧 Preload exists:", require("fs").existsSync(preloadPath));

  // Make sure your main process allows device access
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      // Add these permissions
      webSecurity: false, // For development only
      allowRunningInsecureContent: true, // For development only
    },
  });

  mainWindow.loadFile("dist/index.html");
  mainWindow.webContents.openDevTools();
}

// File dialog handler
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
    // Return typed Uint8Array directly to allow fast zero-copy IPC and avoid "Invalid array length" on large files
    return { success: true, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
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

// Get documents folder path
ipcMain.handle("path:getDocumentsPath", async (event) => {
  try {
    const documentsPath = app.getPath('documents');
    return { success: true, path: documentsPath };
  } catch (error) {
    console.error(`❌ Failed to get documents path: ${error.message}`);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
});
