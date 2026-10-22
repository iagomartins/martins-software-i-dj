/**
 * Verification script for Electron configuration and native engine assets.
 * Location: .agents/skills/electron-senior/scripts/verify-electron-setup.cjs
 */

const fs = require("fs");
const path = require("path");

console.log("=========================================");
console.log("   iDJ Electron Environment Verification ");
console.log("=========================================\n");

let passed = true;

function check(label, condition, details = "") {
  if (condition) {
    console.log(`✅ [PASS] ${label}`);
    if (details) console.log(`         ${details}`);
  } else {
    console.log(`❌ [FAIL] ${label}`);
    if (details) console.log(`         ${details}`);
    passed = false;
  }
}

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");

// 1. Check Electron files
const mainPath = path.join(rootDir, "electron", "main.cjs");
const preloadPath = path.join(rootDir, "electron", "preload.js");

check("Electron main entrypoint exists", fs.existsSync(mainPath), mainPath);
check("Electron preload script exists", fs.existsSync(preloadPath), preloadPath);

// 2. Check native audio binaries
const audioEngineDll = path.join(rootDir, "audio_engine.dll");
const portaudioDll = path.join(rootDir, "portaudio.dll");

check("Native audio_engine.dll present in root", fs.existsSync(audioEngineDll), audioEngineDll);
check("PortAudio DLL present in root", fs.existsSync(portaudioDll), portaudioDll);

// 3. Check Wasm assets in public
const wasmBinary = path.join(rootDir, "public", "audio_processor.wasm");
const wasmGlue = path.join(rootDir, "public", "audio_processor.js");
const audioWorklet = path.join(rootDir, "public", "audio-processor.js");

check("WebAssembly binary exists", fs.existsSync(wasmBinary), wasmBinary);
check("WebAssembly glue script exists", fs.existsSync(wasmGlue), wasmGlue);
check("AudioWorklet processor script exists", fs.existsSync(audioWorklet), audioWorklet);

// 4. Verify main.cjs configuration
if (fs.existsSync(mainPath)) {
  const mainContent = fs.readFileSync(mainPath, "utf-8");
  check(
    "Preload path resolved dynamically",
    mainContent.includes("preload.js"),
    "preload.js reference verified in main.cjs"
  );
  check(
    "Context Isolation enabled",
    mainContent.includes("contextIsolation: true"),
    "contextIsolation: true found"
  );
  check(
    "Node Integration disabled in webPreferences",
    mainContent.includes("nodeIntegration: false"),
    "nodeIntegration: false found"
  );
}

// 5. Test Koffi availability
try {
  const koffi = require("koffi");
  check("Koffi module loaded successfully", !!koffi, `Version: ${koffi.version || "ok"}`);
} catch (err) {
  check("Koffi module loading", false, err.message);
}

console.log("\n-----------------------------------------");
if (passed) {
  console.log("🎉 All Electron desktop checks passed successfully!");
  process.exit(0);
} else {
  console.log("⚠️ One or more checks failed. Please review the output above.");
  process.exit(1);
}
