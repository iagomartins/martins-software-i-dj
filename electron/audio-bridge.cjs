const koffi = require("koffi");
const path = require("path");
const fs = require("fs");

class AudioBridge {
  constructor() {
    this.audioEngine = null;
    this.isInitialized = false;
    this.dllPath = path.join(
      __dirname,
      "..",
      "cpp",
      "dist",
      "Release",
      "audio_engine.dll"
    );
  }

  async initialize() {
    try {
      // Check if DLL exists
      if (!fs.existsSync(this.dllPath)) {
        console.log("⚠ Audio Engine DLL not found, using mock mode");
        this.isInitialized = true;
        return true;
      }

      // Load the DLL using Koffi
      const lib = koffi.load(this.dllPath);
      const AudioEnginePtr = koffi.pointer("AudioEngine", koffi.opaque());

      // Define the function signatures from your C++ header
      const AudioEngine_New = lib.func("AudioEngine_New", AudioEnginePtr, []);
      const AudioEngine_Initialize = lib.func(
        "AudioEngine_Initialize",
        "bool",
        [AudioEnginePtr]
      );
      const AudioEngine_SetDeckPlaying = lib.func(
        "AudioEngine_SetDeckPlaying",
        "void",
        [AudioEnginePtr, "int", "bool"]
      );
      const AudioEngine_SetDeckVolume = lib.func(
        "AudioEngine_SetDeckVolume",
        "void",
        [AudioEnginePtr, "int", "float"]
      );
      const AudioEngine_SetDeckPitch = lib.func(
        "AudioEngine_SetDeckPitch",
        "void",
        [AudioEnginePtr, "int", "float"]
      );
      const AudioEngine_SetDeckPosition = lib.func(
        "AudioEngine_SetDeckPosition",
        "void",
        [AudioEnginePtr, "int", "float"]
      );
      const AudioEngine_SetDeckFile = lib.func(
        "AudioEngine_SetDeckFile",
        "void",
        [AudioEnginePtr, "int", "string"]
      );
      const AudioEngine_SetEffect = lib.func("AudioEngine_SetEffect", "void", [
        AudioEnginePtr,
        "int",
        "int",
        "bool",
      ]);
      const AudioEngine_SetEQ = lib.func("AudioEngine_SetEQ", "void", [
        AudioEnginePtr,
        "int",
        "int",
        "float",
      ]);
      const AudioEngine_SetCrossfader = lib.func(
        "AudioEngine_SetCrossfader",
        "void",
        [AudioEnginePtr, "float"]
      );
      const AudioEngine_SetMasterVolume = lib.func(
        "AudioEngine_SetMasterVolume",
        "void",
        [AudioEnginePtr, "float"]
      );
      const AudioEngine_SetHeadphoneVolume = lib.func(
        "AudioEngine_SetHeadphoneVolume",
        "void",
        [AudioEnginePtr, "float"]
      );
      const AudioEngine_Shutdown = lib.func("AudioEngine_Shutdown", "void", [
        AudioEnginePtr,
      ]);

      // Create audio engine instance
      this.audioEngine = AudioEngine_New();

      // Initialize the engine
      const success = AudioEngine_Initialize(this.audioEngine);

      if (success) {
        this.isInitialized = true;
        console.log("✓ Audio Engine initialized with Koffi");

        // Store the functions for later use
        this.functions = {
          setDeckPlaying: AudioEngine_SetDeckPlaying,
          setDeckVolume: AudioEngine_SetDeckVolume,
          setDeckPitch: AudioEngine_SetDeckPitch,
          setDeckPosition: AudioEngine_SetDeckPosition,
          setDeckFile: AudioEngine_SetDeckFile,
          setEffect: AudioEngine_SetEffect,
          setEQ: AudioEngine_SetEQ,
          setCrossfader: AudioEngine_SetCrossfader,
          setMasterVolume: AudioEngine_SetMasterVolume,
          setHeadphoneVolume: AudioEngine_SetHeadphoneVolume,
          shutdown: AudioEngine_Shutdown,
        };

        return true;
      } else {
        console.error("Failed to initialize Audio Engine");
        return false;
      }
    } catch (error) {
      console.error("Failed to load Audio Engine DLL:", error);
      this.isInitialized = true; // Fall back to mock mode
      return true;
    }
  }

  // Audio control methods
  setDeckPlaying(deck, playing) {
    if (this.isInitialized && this.functions) {
      this.functions.setDeckPlaying(this.audioEngine, deck, playing);
    }
  }

  setDeckVolume(deck, volume) {
    if (this.isInitialized && this.functions) {
      this.functions.setDeckVolume(this.audioEngine, deck, volume);
    }
  }

  setDeckPitch(deck, pitch) {
    if (this.isInitialized && this.functions) {
      this.functions.setDeckPitch(this.audioEngine, deck, pitch);
    }
  }

  setDeckPosition(deck, position) {
    if (this.isInitialized && this.functions) {
      this.functions.setDeckPosition(this.audioEngine, deck, position);
    }
  }

  setDeckFile(deck, filepath) {
    if (this.isInitialized && this.functions) {
      this.functions.setDeckFile(this.audioEngine, deck, filepath);
    }
  }

  setEffect(deck, effect, enabled) {
    if (this.isInitialized && this.functions) {
      this.functions.setEffect(this.audioEngine, deck, effect, enabled);
    }
  }

  setEQ(deck, band, value) {
    if (this.isInitialized && this.functions) {
      this.functions.setEQ(this.audioEngine, deck, band, value);
    }
  }

  setCrossfader(value) {
    if (this.isInitialized && this.functions) {
      this.functions.setCrossfader(this.audioEngine, value);
    }
  }

  setMasterVolume(volume) {
    if (this.isInitialized && this.functions) {
      this.functions.setMasterVolume(this.audioEngine, volume);
    }
  }

  setHeadphoneVolume(volume) {
    if (this.isInitialized && this.functions) {
      this.functions.setHeadphoneVolume(this.audioEngine, volume);
    }
  }

  shutdown() {
    if (this.isInitialized && this.functions && this.audioEngine) {
      this.functions.shutdown(this.audioEngine);
      this.audioEngine = null;
    }
  }
}

module.exports = AudioBridge;
