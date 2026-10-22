---
name: electron-senior
description: >-
  Senior-level Electron desktop engineering, secure IPC architecture, native C++
  FFI integration with Koffi, low-latency Chromium audio tuning, and production
  packaging with electron-builder for iDJ. Use this skill when modifying Electron
  main/preload scripts, handling native audio DLL loading, auditing desktop security,
  optimizing window performance, or preparing production releases.
---

# Electron Senior Skill

This skill provides comprehensive instructions, architectural guidelines, and standard procedures for designing, securing, and optimizing the Electron desktop shell for **iDJ**.

---

## 🖥️ Electron Architecture Overview

In iDJ, Electron provides desktop OS capabilities while running a high-precision audio application:

1. **Main Process ([`electron/main.cjs`](file:///c:/Users/Avell/Documents/martins-software-i-dj/electron/main.cjs))**:
   - Manages application lifecycle (`app.whenReady()`, window creation, power management).
   - Handles OS file system operations, file dialogs, and native library loading.
   - Configures Chromium low-latency audio flags before app launch.

2. **Preload Script ([`electron/preload.js`](file:///c:/Users/Avell/Documents/martins-software-i-dj/electron/preload.js))**:
   - Executes with `contextIsolation: true`.
   - Bridges strictly defined, typed APIs to the renderer via `contextBridge.exposeInMainWorld('electronAPI', ...)`.

3. **Renderer Process (`src/`)**:
   - Runs React 18, TypeScript, and the Web Audio API graph.
   - Communicates with OS services exclusively via `window.electronAPI`.

---

## 🛠️ Core Workflows

### Workflow 1: Adding or Modifying IPC Channels

When exposing a new desktop capability (e.g. reading audio metadata, scanning track libraries, saving playlist files):

1. **Implement Handler in Main Process ([`electron/main.cjs`](file:///c:/Users/Avell/Documents/martins-software-i-dj/electron/main.cjs))**:
   - Always use `ipcMain.handle` (asynchronous, Promise-based). Never use synchronous `ipcMain.on` / `event.returnValue = ...` as it freezes the renderer.
   - Sanitize all parameters and paths:
     ```javascript
     ipcMain.handle('audio:scanDirectory', async (event, folderPath) => {
       if (typeof folderPath !== 'string' || !folderPath) {
         return { success: false, error: 'Invalid folder path' };
       }
       // Process with fs.promises...
     });
     ```
2. **Expose Typed Wrapper in Preload ([`electron/preload.js`](file:///c:/Users/Avell/Documents/martins-software-i-dj/electron/preload.js))**:
   - Expose the method on `window.electronAPI`:
     ```javascript
     contextBridge.exposeInMainWorld('electronAPI', {
       // ... existing APIs
       audio: {
         scanDirectory: (folderPath) => ipcRenderer.invoke('audio:scanDirectory', folderPath)
       }
     });
     ```
3. **Declare TypeScript Types ([`src/vite-env.d.ts`](file:///c:/Users/Avell/Documents/martins-software-i-dj/src/vite-env.d.ts))**:
   - Keep TypeScript types strictly in sync with the exposed object so frontend components have full autocomplete and type-safety.

---

### Workflow 2: Managing Native C++ DLLs via Koffi

When integrating or testing native audio engine binaries (`audio_engine.dll`, `portaudio.dll`):

1. **Dynamic Path Resolution**:
   - Locate the DLL dynamically based on whether the app is packaged:
     ```javascript
     const dllPath = app.isPackaged
       ? path.join(process.resourcesPath, 'audio_engine.dll')
       : path.join(__dirname, '..', 'cpp', 'dist', 'Release', 'audio_engine.dll');
     ```
2. **Handle Dependent DLLs**:
   - On Windows, `audio_engine.dll` depends on `portaudio.dll`. Ensure `portaudio.dll` is in the same directory or registered via `process.env.PATH` before loading with `koffi.load()`.
3. **Lifecycle Cleanup**:
   - Register application quit hooks to terminate the native audio engine cleanly:
     ```javascript
     app.on('before-quit', () => {
       if (nativeEngineInstance) {
         AudioEngine_Shutdown(nativeEngineInstance);
         AudioEngine_Delete(nativeEngineInstance);
         nativeEngineInstance = null;
       }
     });
     ```

---

### Workflow 3: Chromium Audio Optimization for DJ Performance

Ensure the following flags are registered in `electron/main.cjs` **before** `app.whenReady()`:

```javascript
// Disable CPU throttling when window is obscured or minimized
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Eliminate user-gesture requirement for Web Audio API context
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Prevent audio glitching under high CPU load
app.commandLine.appendSwitch('enable-exclusive-audio');
```

---

### Workflow 4: Packaging and Distribution with electron-builder

1. **Verify ASAR Unpack Rules**:
   - Native binaries (`*.dll`, `*.wasm`, `*.node`) cannot be executed directly from inside a compressed ASAR archive.
   - In `package.json`, specify:
     ```json
     "build": {
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
         "portaudio.dll"
       ]
     }
     ```
2. **Execute Build**:
   ```powershell
   npm run build
   npx electron-builder --win
   ```

---

## 🚨 Electron Engineering Checklist

| Check | Requirement |
|---|---|
| **Context Isolation** | `contextIsolation: true` in `webPreferences`. |
| **No Node in Renderer** | `nodeIntegration: false`. No `require()` in React. |
| **No Synchronous IPC** | Use `ipcRenderer.invoke()` and `ipcMain.handle()`. |
| **Power Management** | Use `powerSaveBlocker` during active mixing sessions. |
| **Native Pointer Safety** | Explicitly release C++ engine instances before quit. |
| **Path Sanitization** | Verify paths passed to `fs:*` to avoid directory traversal. |

---

## 📚 Technical References

- [IPC Security & Architecture Reference](./references/ipc-security-architecture.md)
- [Native C++ FFI with Koffi](./references/koffi-native-ffi.md)
- [Low-Latency Audio Tuning in Electron](./references/low-latency-audio-electron.md)
- [Packaging, ASAR & Native Dependencies](./references/packaging-and-resources.md)
