const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  audio: {
    setPitchBend: (deckNumber, semitones) => 
      ipcRenderer.invoke('audio:setPitchBend', deckNumber, semitones),
    setFlanger: (deckNumber, enabled, rate, depth) => 
      ipcRenderer.invoke('audio:setFlanger', deckNumber, enabled, rate, depth),
    setFilter: (deckNumber, cutoff, resonance) => 
      ipcRenderer.invoke('audio:setFilter', deckNumber, cutoff, resonance),
    setJogWheel: (deckNumber, position) => 
      ipcRenderer.invoke('audio:setJogWheel', deckNumber, position)
  }
});
