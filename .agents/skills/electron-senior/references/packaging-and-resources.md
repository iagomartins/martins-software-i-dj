# Packaging, ASAR & Native Dependencies Reference

This document covers configuring `electron-builder` to package iDJ for distribution, ensuring native dynamic libraries (`.dll`) and WebAssembly modules (`.wasm`) are properly extracted and executable.

---

## 1. The ASAR Archive Challenge

Electron bundles application source code into an ASAR (Atom Shell Archive) format. However:
- Operating system loaders (`LoadLibraryW` on Windows, `dlopen` on POSIX) **cannot load `.dll` or `.so` files from inside an ASAR archive**.
- If Koffi or the OS attempts to load a library inside an unextracted ASAR file, the application crashes immediately with `ERR_DLOPEN_FAILED`.

### Solution: `asarUnpack`
Explicitly tell `electron-builder` which binaries and native node modules to unpack to the filesystem (`app.asar.unpacked/`):

```json
{
  "build": {
    "appId": "com.idj.software",
    "productName": "iDJ",
    "asar": true,
    "asarUnpack": [
      "**/*.dll",
      "**/*.wasm",
      "**/node_modules/koffi/**"
    ],
    "files": [
      "dist/**/*",
      "electron/**/*",
      "public/**/*",
      "audio_engine.dll",
      "portaudio.dll",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "audio_engine.dll",
        "to": "audio_engine.dll"
      },
      {
        "from": "portaudio.dll",
        "to": "portaudio.dll"
      }
    ]
  }
}
```

---

## 2. Resolving Resources at Runtime

In `electron/main.cjs`, use `process.resourcesPath` when packaged:

```javascript
const path = require('path');
const { app } = require('electron');

function getAssetPath(filename) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.join(__dirname, '..', filename);
}
```

---

## 3. Platform-Specific Targets

### Windows (NSIS & Portable)
```json
{
  "win": {
    "target": ["nsis", "portable"],
    "icon": "public/favicon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true
  }
}
```

### macOS (DMG & Zip)
Ensure `entitlements.mac.plist` includes microphone / audio-input permissions if recording is supported:
```xml
<key>com.apple.security.device.audio-input</key>
<true/>
```

### Linux (AppImage)
Check that `libasound2` (ALSA) and `libpulse0` are available or bundled for audio playback.
