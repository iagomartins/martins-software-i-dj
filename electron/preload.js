const { contextBridge, ipcRenderer } = require("electron");

console.log("�� Setting up preload script...");

contextBridge.exposeInMainWorld("electronAPI", {
  audio: {
    setPitchBend: async (deckNumber, semitones) => {
      console.log(
        `🎵 [Preload] setPitchBend called - Deck: ${deckNumber}, Semitones: ${semitones}`
      );
      try {
        const result = await ipcRenderer.invoke(
          "audio:setPitchBend",
          deckNumber,
          semitones
        );
        console.log(`✓ [Preload] setPitchBend result:`, result);
        return result;
      } catch (error) {
        console.error(`✗ [Preload] setPitchBend error:`, error);
        throw error;
      }
    },
    setFlanger: async (deckNumber, enabled, rate, depth) => {
      console.log(
        `🎵 [Preload] setFlanger called - Deck: ${deckNumber}, Enabled: ${enabled}, Rate: ${rate}, Depth: ${depth}`
      );
      try {
        const result = await ipcRenderer.invoke(
          "audio:setFlanger",
          deckNumber,
          enabled,
          rate,
          depth
        );
        console.log(`✓ [Preload] setFlanger result:`, result);
        return result;
      } catch (error) {
        console.error(`✗ [Preload] setFlanger error:`, error);
        throw error;
      }
    },
    setFilter: async (deckNumber, cutoff, resonance) => {
      console.log(
        ` [Preload] setFilter called - Deck: ${deckNumber}, Cutoff: ${cutoff}, Resonance: ${resonance}`
      );
      try {
        const result = await ipcRenderer.invoke(
          "audio:setFilter",
          deckNumber,
          cutoff,
          resonance
        );
        console.log(`✓ [Preload] setFilter result:`, result);
        return result;
      } catch (error) {
        console.error(`✗ [Preload] setFilter error:`, error);
        throw error;
      }
    },
    setJogWheel: async (deckNumber, position) => {
      console.log(
        ` [Preload] setJogWheel called - Deck: ${deckNumber}, Position: ${position}`
      );
      try {
        const result = await ipcRenderer.invoke(
          "audio:setJogWheel",
          deckNumber,
          position
        );
        console.log(`✓ [Preload] setJogWheel result:`, result);
        return result;
      } catch (error) {
        console.error(`✗ [Preload] setJogWheel error:`, error);
        throw error;
      }
    },
  },
});

console.log("✓ Preload script setup complete");
