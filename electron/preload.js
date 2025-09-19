const { contextBridge, ipcRenderer } = require("electron");

// Add error handling
try {
  console.log("🔧 Preload script starting...");

  contextBridge.exposeInMainWorld("electronAPI", {
    audio: {
      setDeckPlaying: (deck, playing) => {
        console.log("📡 IPC: setDeckPlaying", deck, playing);
        return ipcRenderer.invoke("audio:setDeckPlaying", deck, playing);
      },
      setDeckVolume: (deck, volume) => {
        console.log("📡 IPC: setDeckVolume", deck, volume);
        return ipcRenderer.invoke("audio:setDeckVolume", deck, volume);
      },
      setDeckPitch: (deck, pitch) => {
        console.log("📡 IPC: setDeckPitch", deck, pitch);
        return ipcRenderer.invoke("audio:setDeckPitch", deck, pitch);
      },
      setDeckPosition: (deck, position) => {
        console.log("📡 IPC: setDeckPosition", deck, position);
        return ipcRenderer.invoke("audio:setDeckPosition", deck, position);
      },
      setDeckFile: (deck, filepath) => {
        console.log("📡 IPC: setDeckFile", deck, filepath);
        return ipcRenderer.invoke("audio:setDeckFile", deck, filepath);
      },
      setEffect: (deck, effect, enabled) => {
        console.log("📡 IPC: setEffect", deck, effect, enabled);
        return ipcRenderer.invoke("audio:setEffect", deck, effect, enabled);
      },
      setEQ: (deck, band, value) => {
        console.log("📡 IPC: setEQ", deck, band, value);
        return ipcRenderer.invoke("audio:setEQ", deck, band, value);
      },
      setCrossfader: (value) => {
        console.log("📡 IPC: setCrossfader", value);
        return ipcRenderer.invoke("audio:setCrossfader", value);
      },
      setMasterVolume: (volume) => {
        console.log("📡 IPC: setMasterVolume", volume);
        return ipcRenderer.invoke("audio:setMasterVolume", volume);
      },
      setHeadphoneVolume: (volume) => {
        console.log("📡 IPC: setHeadphoneVolume", volume);
        return ipcRenderer.invoke("audio:setHeadphoneVolume", volume);
      },
    },
  });

  console.log("✅ Preload script completed successfully");
} catch (error) {
  console.error("❌ Preload script error:", error);
}
