const { app, BrowserWindow, ipcMain, crashReporter } = require("electron");
const path = require("path");

app.on("ready", () => {
  crashReporter.start({
    submitURL: "", // Leave empty to disable
    uploadToServer: false,
  });
});

// Load the native JUCE module
const JUCEAudioProcessor = require("juce-audio-processor");
let juceProcessor = null;
let ipcHandlersSetup = false;

console.log("🔧 Initializing JUCE Audio Processor...");

try {
  juceProcessor = new JUCEAudioProcessor();
  console.log("✓ JUCE module loaded in main process");
} catch (error) {
  console.log("✗ JUCE module failed to load:", error);
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

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Set up IPC handlers after window is created
  setupIPCHandlers();
}

// IPC handlers for JUCE audio processing
function setupIPCHandlers() {
  if (ipcHandlersSetup) {
    console.log("⚠️ IPC handlers already set up, skipping...");
    return;
  }

  console.log("🔧 Setting up IPC handlers for JUCE audio processing...");

  ipcMain.handle("audio:setPitchBend", async (event, deckNumber, semitones) => {
    console.log(
      `🎵 [IPC] setPitchBend called - Deck: ${deckNumber}, Semitones: ${semitones}`
    );
    try {
      if (juceProcessor) {
        await juceProcessor.setPitchBend(semitones);
        console.log(`✓ [IPC] setPitchBend successful`);
      } else {
        console.log("⚠️ [IPC] JUCE processor not available, using fallback");
      }
      return { success: true };
    } catch (error) {
      console.error(`✗ [IPC] setPitchBend failed:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "audio:setFlanger",
    async (event, deckNumber, enabled, rate, depth) => {
      console.log(
        ` [IPC] setFlanger called - Deck: ${deckNumber}, Enabled: ${enabled}, Rate: ${rate}, Depth: ${depth}`
      );
      try {
        if (juceProcessor) {
          await juceProcessor.setFlangerEnabled(enabled);
          await juceProcessor.setFlangerRate(rate);
          await juceProcessor.setFlangerDepth(depth);
          console.log(`✓ [IPC] setFlanger successful`);
        } else {
          console.log("⚠️ [IPC] JUCE processor not available, using fallback");
        }
        return { success: true };
      } catch (error) {
        console.error(`✗ [IPC] setFlanger failed:`, error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    "audio:setFilter",
    async (event, deckNumber, cutoff, resonance) => {
      console.log(
        `🎵 [IPC] setFilter called - Deck: ${deckNumber}, Cutoff: ${cutoff}, Resonance: ${resonance}`
      );
      try {
        if (juceProcessor) {
          await juceProcessor.setFilterCutoff(cutoff);
          await juceProcessor.setFilterResonance(resonance);
          console.log(`✓ [IPC] setFilter successful`);
        } else {
          console.log("⚠️ [IPC] JUCE processor not available, using fallback");
        }
        return { success: true };
      } catch (error) {
        console.error(`✗ [IPC] setFilter failed:`, error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle("audio:setJogWheel", async (event, deckNumber, position) => {
    console.log(
      ` [IPC] setJogWheel called - Deck: ${deckNumber}, Position: ${position}`
    );
    try {
      if (juceProcessor) {
        await juceProcessor.setJogWheelPosition(position);
        console.log(`✓ [IPC] setJogWheel successful`);
      } else {
        console.log("⚠️ [IPC] JUCE processor not available, using fallback");
      }
      return { success: true };
    } catch (error) {
      console.error(`✗ [IPC] setJogWheel failed:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcHandlersSetup = true;
  console.log("✓ IPC handlers set up successfully");

  // Add cleanup when app is closing
  app.on("before-quit", () => {
    if (juceProcessor) {
      console.log("🧹 Cleaning up JUCE processor...");
      juceProcessor.destroy();
    }
  });
}

app.whenReady().then(createWindow);
