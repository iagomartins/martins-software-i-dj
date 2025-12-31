const { contextBridge, ipcRenderer } = require("electron");

// Add error handling
try {
  console.log("🔧 Preload script starting...");

  contextBridge.exposeInMainWorld("electronAPI", {
    dialog: {
      showOpenDialog: (options) => {
        console.log("📡 IPC: showOpenDialog", options);
        return ipcRenderer.invoke("dialog:showOpenDialog", options);
      },
    },
    fs: {
      writeFile: (filePath, data) => {
        console.log("📡 IPC: writeFile", filePath);
        return ipcRenderer.invoke("fs:writeFile", filePath, data);
      },
      readFile: (filePath) => {
        console.log("📡 IPC: readFile", filePath);
        return ipcRenderer.invoke("fs:readFile", filePath);
      },
      exists: (filePath) => {
        console.log("📡 IPC: exists", filePath);
        return ipcRenderer.invoke("fs:exists", filePath);
      },
      unlink: (filePath) => {
        console.log("📡 IPC: unlink", filePath);
        return ipcRenderer.invoke("fs:unlink", filePath);
      },
      mkdir: (dirPath) => {
        console.log("📡 IPC: mkdir", dirPath);
        return ipcRenderer.invoke("fs:mkdir", dirPath);
      },
    },
    path: {
      getDocumentsPath: () => {
        console.log("📡 IPC: getDocumentsPath");
        return ipcRenderer.invoke("path:getDocumentsPath");
      },
    },
  });

  console.log("✅ Preload script completed successfully");
} catch (error) {
  console.error("❌ Preload script error:", error);
}
