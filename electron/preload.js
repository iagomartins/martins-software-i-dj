const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  audio: {
    setDeckPlaying: (deck, playing) =>
      ipcRenderer.invoke("audio:setDeckPlaying", deck, playing),
    setDeckVolume: (deck, volume) =>
      ipcRenderer.invoke("audio:setDeckVolume", deck, volume),
    setDeckPitch: (deck, pitch) =>
      ipcRenderer.invoke("audio:setDeckPitch", deck, pitch),
    setDeckPosition: (deck, position) =>
      ipcRenderer.invoke("audio:setDeckPosition", deck, position),
    setDeckFile: (deck, filepath) =>
      ipcRenderer.invoke("audio:setDeckFile", deck, filepath),
    setEffect: (deck, effect, enabled) =>
      ipcRenderer.invoke("audio:setEffect", deck, effect, enabled),
    setEQ: (deck, band, value) =>
      ipcRenderer.invoke("audio:setEQ", deck, band, value),
    setCrossfader: (value) => ipcRenderer.invoke("audio:setCrossfader", value),
    setMasterVolume: (volume) =>
      ipcRenderer.invoke("audio:setMasterVolume", volume),
    setHeadphoneVolume: (volume) =>
      ipcRenderer.invoke("audio:setHeadphoneVolume", volume),
  },
});
