const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Load the native JUCE module
const JUCEAudioProcessor = require("juce-audio-processor");
const juceProcessor = false;
try {
  const juceProcessor = new JUCEAudioProcessor();
  console.log("✓ JUCE module loaded in main process");
} catch (error) {
  console.log(error);
  console.warn("JUCE module not available, falling back to Web Audio API");
}

let mainWindow;

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
}

// IPC handlers for JUCE audio processing
if (juceProcessor) {
  ipcMain.handle("audio:setPitchBend", async (event, deckNumber, semitones) => {
    try {
      juceProcessor.setPitchBend(semitones);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "audio:setFlanger",
    async (event, deckNumber, enabled, rate, depth) => {
      try {
        juceProcessor.setFlangerEnabled(enabled);
        juceProcessor.setFlangerRate(rate);
        juceProcessor.setFlangerDepth(depth);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    "audio:setFilter",
    async (event, deckNumber, cutoff, resonance) => {
      try {
        juceProcessor.setFilterCutoff(cutoff);
        juceProcessor.setFilterResonance(resonance);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle("audio:setJogWheel", async (event, deckNumber, position) => {
    try {
      juceProcessor.setJogWheelPosition(position);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

app.whenReady().then(createWindow);
