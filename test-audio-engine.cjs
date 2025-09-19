const koffi = require("koffi");
const fs = require("fs");
const path = require("path");

console.log("🧪 Starting C++ Audio Engine Test...");

// Find the DLL
const dllPath = path.join(
  __dirname,
  "cpp",
  "dist",
  "Release",
  "audio_engine.dll"
);
console.log("🔍 Looking for DLL at:", dllPath);
console.log("�� DLL exists:", fs.existsSync(dllPath));

if (!fs.existsSync(dllPath)) {
  console.error("❌ DLL not found! Please build the C++ engine first.");
  process.exit(1);
}

try {
  // Load the DLL
  console.log("📚 Loading DLL...");
  const lib = koffi.load(dllPath);
  console.log("✅ DLL loaded successfully");

  // Define function signatures
  const AudioEnginePtr = koffi.pointer("AudioEngine", koffi.opaque());
  const AudioEngine_New = lib.func("AudioEngine_New", AudioEnginePtr, []);
  const AudioEngine_Initialize = lib.func("AudioEngine_Initialize", "bool", [
    AudioEnginePtr,
  ]);
  const AudioEngine_SetDeckPlaying = lib.func(
    "AudioEngine_SetDeckPlaying",
    "void",
    [AudioEnginePtr, "int", "bool"]
  );
  const AudioEngine_SetDeckFile = lib.func("AudioEngine_SetDeckFile", "void", [
    AudioEnginePtr,
    "int",
    "string",
  ]);
  const AudioEngine_Shutdown = lib.func("AudioEngine_Shutdown", "void", [
    AudioEnginePtr,
  ]);

  console.log("✅ Function signatures loaded");

  // Create engine instance
  console.log("��️ Creating audio engine instance...");
  const engine = AudioEngine_New();
  console.log("✅ Audio engine instance created");

  // Initialize engine
  console.log("🚀 Initializing audio engine...");
  const success = AudioEngine_Initialize(engine);
  console.log("🔧 Initialization result:", success);

  if (success) {
    console.log("✅ Audio engine initialized successfully!");

    // Test setting a file (use a dummy path for now)
    console.log("�� Testing setDeckFile...");
    AudioEngine_SetDeckFile(
      engine,
      1,
      "C:/temp/1758311354274_06 Embraced Feelings.wav"
    );
    console.log("✅ setDeckFile called");

    // Update the test to actually play audio
    console.log("🎵 Testing actual audio playback...");
    AudioEngine_SetDeckPlaying(engine, 1, true);
    console.log("▶️ Audio should be playing now...");

    // Wait longer to hear the audio
    setTimeout(() => {
      console.log("⏹️ Stopping audio...");
      AudioEngine_SetDeckPlaying(engine, 1, false);
    }, 10000); // Wait 10 seconds to hear the audio

    // Wait a bit
    // console.log("⏳ Waiting 2 seconds...");
    // setTimeout(() => {
    //   console.log("⏹️ Stopping playback...");
    //   AudioEngine_SetDeckPlaying(engine, 1, false);
    //   console.log("✅ setDeckPlaying(false) called");

    // Shutdown
    // console.log(" Shutting down audio engine...");
    // AudioEngine_Shutdown(engine);
    // console.log("✅ Audio engine shutdown complete");
    // console.log("🎉 Test completed successfully!");
    // }, 2000);
  } else {
    console.error("❌ Failed to initialize audio engine");
  }
} catch (error) {
  console.error("❌ Test failed with error:", error);
  console.error("Error details:", {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
}
