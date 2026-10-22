# IPC Security & Architecture Reference

This reference outlines the security principles, IPC performance patterns, and channel structure for the **iDJ** Electron desktop application.

---

## 1. Electron Security Model & Threat Vectors

Desktop applications running Chromium face unique threat vectors because renderers execute web code while having access to native OS capabilities through IPC bridges.

### Core Defense Mechanisms
1. **Context Isolation**:
   - Isolates the preload script's execution context from the website's execution context (`window`).
   - Even if external web code or a compromised dependency runs in the renderer, it cannot tamper with prototype objects or access preload variables directly.
2. **Disabling Node Integration**:
   - `nodeIntegration: false` ensures the renderer cannot invoke `require('fs')` or `require('child_process')`.
3. **Strict Context Bridge API Surface**:
   - Only expose explicit functions, not whole modules.
   - **Never do this**:
     ```javascript
     // DANGEROUS - Gives renderer total control over IPC
     contextBridge.exposeInMainWorld('electron', {
       ipcRenderer: ipcRenderer
     });
     ```
   - **Always do this**:
     ```javascript
     // SECURE - Whitelisted, parameter-controlled invocations
     contextBridge.exposeInMainWorld('electronAPI', {
       dialog: {
         showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options)
       }
     });
     ```

---

## 2. IPC Performance: Asynchronous vs Synchronous

### Why Synchronous IPC is Prohibited
Using `ipcRenderer.sendSync()` blocks the renderer's JavaScript thread until the main process responds. In a DJ app:
- Blocking the JS thread for 10-50ms freezes audio waveform painting and UI animations.
- If the main process is busy performing disk I/O, the entire UI drops frames.

### Recommended Pattern: `ipcMain.handle` / `ipcRenderer.invoke`
- Always asynchronous (returns a Promise).
- Handled via internal message ports without freezing the renderer.
- Return structured status objects:
  ```typescript
  type IPCResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };
  ```

---

## 3. Safe File System Operations & Path Sanitization

When opening or reading audio files (`.wav`, `.mp3`, `.flac`):

1. **Path Normalization**:
   Always normalize paths to prevent directory traversal exploits (`../../`):
   ```javascript
   const normalizedPath = path.normalize(filePath);
   ```

2. **File Size and Streaming**:
   - Reading massive 500MB WAV files into memory via a single IPC array transfer causes garbage collection spikes.
   - For audio loading, use buffer streams or direct file paths passed to Web Audio API / native engine rather than transferring multi-megabyte arrays across the IPC bridge.
