# Electron Desktop Architecture & Security Rules

iDJ runs as a desktop application using Electron. To maintain system stability, security, and low audio latency, all Electron code must adhere to these rules.

---

## 1. Process Isolation & Security Standards

1. **Context Isolation**:
   - `contextIsolation: true` MUST remain enabled in `BrowserWindow` webPreferences at all times.
   - `nodeIntegration: false` MUST remain disabled. The renderer must never have direct access to Node.js built-ins.

2. **Secure Preload Exposure**:
   - Use `contextBridge.exposeInMainWorld('electronAPI', { ... })`.
   - Never expose raw `ipcRenderer.send`, `ipcRenderer.on`, or `ipcRenderer.invoke` directly to `window`. Expose only strongly-typed wrapper functions.
   - Example:
     ```javascript
     // Safe:
     contextBridge.exposeInMainWorld('electronAPI', {
       dialog: {
         showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options)
       }
     });
     ```

3. **IPC Channel Validation**:
   - Every `ipcMain.handle` callback must validate input parameters before executing file system or OS operations.
   - Sanitize file paths to prevent directory traversal (`path.normalize`, verifying against allowed audio formats: `.wav`, `.mp3`, `.flac`, `.aiff`, `.ogg`).

4. **Web Security in Production**:
   - Flags like `webSecurity: false` and `allowRunningInsecureContent: true` are strictly developmental flags.
   - In production builds (`npm run build`), `webSecurity` must be `true`. Local resources (audio files, Wasm modules) should be loaded using standard custom protocols (`app://` or standard file streaming IPC).

---

## 2. Native C++ Libraries & Koffi FFI Rules

1. **DLL / Shared Library Resolution**:
   - Never hardcode absolute paths to `.dll`, `.so`, or `.dylib`.
   - Use dynamic resolution taking into account dev mode (`__dirname`) vs packaged app (`process.resourcesPath` / `app.getAppPath()`):
     ```javascript
     const isPackaged = app.isPackaged;
     const libPath = isPackaged
       ? path.join(process.resourcesPath, 'audio_engine.dll')
       : path.join(__dirname, '..', 'cpp', 'dist', 'Release', 'audio_engine.dll');
     ```

2. **Koffi FFI Memory & Pointer Lifecycle**:
   - Any memory allocated by native code (e.g. `AudioEngine_New`) must have an explicit destructor call (`AudioEngine_Delete` or `AudioEngine_Shutdown`) when the window closes or on `app.on('before-quit')`.
   - Never allow garbage collection to lose track of native pointers without cleanup.

3. **Multi-threading with Native Audio Engines**:
   - Native audio threads run outside V8.
   - NEVER call JavaScript callbacks directly from high-frequency PortAudio/ASIO callbacks without a thread-safe message queue or Koffi asynchronous trampoline.

---

## 3. Low-Latency Audio Window Configuration

1. **Chromium Audio Flags**:
   - In `electron/main.cjs`, configure Chromium audio switch flags before `app.whenReady()` to enable low-latency audio processing:
     ```javascript
     app.commandLine.appendSwitch('disable-renderer-backgrounding');
     app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
     app.commandLine.appendSwitch('enable-exclusive-audio');
     ```
   - This ensures background tabs or minimized windows do not throttle the audio clock or AudioWorklet execution.

2. **Power & Sleep Management**:
   - During live playback, prevent the host operating system from sleeping or suspending CPU cores via Electron's `powerSaveBlocker`:
     ```javascript
     const { powerSaveBlocker } = require('electron');
     const id = powerSaveBlocker.start('prevent-app-suspension');
     ```
