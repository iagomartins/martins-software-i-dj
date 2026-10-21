# Native C++ FFI with Koffi Reference

This document covers loading, executing, and managing C++ dynamic link libraries (`audio_engine.dll`) inside Node.js and the Electron Main process using **Koffi**.

---

## 1. Why Koffi Over Traditional FFI / Node-API

- **Performance**: Koffi is significantly faster than `ffi-napi` (up to 5-10x lower call overhead).
- **No Node-Gyp Compilation**: Does not require native compilation at `npm install` time for the FFI bridge itself.
- **Modern Platform Support**: Native support for Windows (x64/ARM64), macOS (Intel/Apple Silicon), and Linux.

---

## 2. Resolving Native Libraries in Electron

Dynamic link libraries must be loaded from paths that work in both development and packaged production builds.

```javascript
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

function getNativeEnginePath() {
  const isPackaged = app && app.isPackaged;

  const candidatePaths = [
    // 1. Packaged resource directory (electron-builder extraResources or unpack)
    isPackaged ? path.join(process.resourcesPath, 'audio_engine.dll') : null,
    // 2. Project root (dev mode)
    path.join(__dirname, '..', 'audio_engine.dll'),
    // 3. C++ build release directory
    path.join(__dirname, '..', 'cpp', 'dist', 'Release', 'audio_engine.dll'),
    path.join(__dirname, '..', 'dist', 'audio_engine.dll')
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(`Could not find audio_engine.dll in: ${candidatePaths.join(', ')}`);
}
```

---

## 3. Koffi Type Definitions & Function Signatures

Declare opaque types and function bindings clearly:

```javascript
const koffi = require('koffi');

const dllPath = getNativeEnginePath();
const lib = koffi.load(dllPath);

// Define opaque pointer to C++ AudioEngine instance
const AudioEnginePtr = koffi.pointer('AudioEngine', koffi.opaque());

// Map exported C API functions
const AudioEngine_New = lib.func('AudioEngine_New', AudioEnginePtr, []);
const AudioEngine_Delete = lib.func('AudioEngine_Delete', 'void', [AudioEnginePtr]);
const AudioEngine_Initialize = lib.func('AudioEngine_Initialize', 'bool', [AudioEnginePtr]);
const AudioEngine_Shutdown = lib.func('AudioEngine_Shutdown', 'void', [AudioEnginePtr]);

const AudioEngine_SetDeckPlaying = lib.func('AudioEngine_SetDeckPlaying', 'void', [AudioEnginePtr, 'int', 'bool']);
const AudioEngine_SetDeckVolume = lib.func('AudioEngine_SetDeckVolume', 'void', [AudioEnginePtr, 'int', 'float']);
const AudioEngine_SetDeckPitch = lib.func('AudioEngine_SetDeckPitch', 'void', [AudioEnginePtr, 'int', 'float']);
const AudioEngine_SetDeckFile = lib.func('AudioEngine_SetDeckFile', 'void', [AudioEnginePtr, 'int', 'string']);
const AudioEngine_SetCrossfader = lib.func('AudioEngine_SetCrossfader', 'void', [AudioEnginePtr, 'float']);
```

---

## 4. Native Instance Lifecycle Management

Always encapsulate the native pointer inside a managed wrapper to guarantee proper destruction:

```javascript
class NativeAudioEngineBridge {
  constructor() {
    this.instance = null;
  }

  start() {
    if (this.instance) return true;
    this.instance = AudioEngine_New();
    const ok = AudioEngine_Initialize(this.instance);
    if (!ok) {
      this.stop();
      return false;
    }
    return true;
  }

  stop() {
    if (this.instance) {
      AudioEngine_Shutdown(this.instance);
      AudioEngine_Delete(this.instance);
      this.instance = null;
    }
  }
}
```
Register `bridge.stop()` with `app.on('will-quit')` or `app.on('before-quit')`.
