# iDJ Core Project Rules & Architecture

This repository contains **iDJ**, a professional DJ software with a hybrid architecture combining a high-performance C++ audio engine (compiled both as WebAssembly for browser/AudioWorklet and as native dynamic libraries via PortAudio/Koffi) with an Electron desktop application running a React + TypeScript + Tailwind CSS user interface.

---

## 1. Architectural Integrity & Boundaries

1. **Separation of Concerns**:
   - **Audio Thread (Real-Time DSP)**: C++ (WebAssembly in `public/audio-processor.js` or Native PortAudio in `cpp/audio_engine.cpp`). Must NEVER be blocked by UI, IPC, or file I/O.
   - **Audio Service Orchestrator (`src/services/AudioService.ts`)**: Single source of truth for the Web Audio graph, playback positions, deck synchronization, and Wasm message passing.
   - **Electron Main Process (`electron/main.cjs`)**: Responsible for OS-level capabilities (file system access, native file dialogs, hardware window management). Must NEVER run heavy computational tasks.
   - **Preload Script (`electron/preload.js`)**: Secure, minimal bridge exposing explicit APIs via `contextBridge`.
   - **UI Layer (`src/`)**: Pure reactive presentation and user control. Uses `DJContext` and `AudioService` singleton. Must throttle high-frequency events (e.g. waveform rendering, scratch wheel updates) to match requestAnimationFrame (60-120Hz).

2. **Dual-Engine Audio Pipeline**:
   - **Primary Engine**: Web Audio API + AudioWorklet + WebAssembly (`cpp/audio_processor.cpp` + `cpp/wasm_bindings.cpp`). Delivers cross-platform, zero-driver-install real-time audio.
   - **Native Engine**: PortAudio C++ Engine (`cpp/audio_engine.cpp`) with low-latency ASIO support, loaded via `koffi` or shared memory for professional studio environments.
   - Do NOT break compatibility with either pipeline when modifying C++ DSP code.

---

## 2. Code Quality & Language Standards

### C++ (Modern C++17)
- Use C++17 standards (`set(CMAKE_CXX_STANDARD 17)`).
- Code must compile cleanly with both **Emscripten (`emcc`)** and **MSVC/Clang/GCC**.
- No unbounded memory allocations or non-deterministic execution in the audio processing hot path.
- Always guard platform-specific APIs with appropriate preprocessor flags (`#ifdef _WIN32`).

### TypeScript & React
- Strict typing is mandatory: avoid `any`; define concrete types or interfaces in `src/types/` or adjacent to modules.
- Adhere to React 18 hooks best practices: cleanup all audio listeners, requestAnimationFrames, and intervals in `useEffect` return functions.
- Avoid unnecessary re-renders: memoize heavy DJ deck and waveform components with `React.memo`, `useMemo`, and `useCallback`.

### Electron & Node.js
- Use `contextIsolation: true` and `nodeIntegration: false`.
- Never expose raw `ipcRenderer` or Node built-in modules (`fs`, `child_process`) to the renderer process.
- All IPC channels must follow `domain:action` convention (e.g., `fs:readFile`, `dialog:showOpenDialog`).

---

## 3. Directory Layout Conventions

```
martins-software-i-dj/
├── .agents/                    # Agent customizations: rules and skills
│   ├── rules/                 # Mandatory project guidelines
│   └── skills/                # Specialized domain runbooks (audio C++, electron)
├── cpp/                       # C++ audio engine and DSP algorithms
│   ├── audio_processor.cpp    # Core DSP (Biquad, delay, flanger, reverb)
│   ├── wasm_bindings.cpp      # Emscripten C-API exports for Wasm
│   ├── audio_engine.cpp       # Native PortAudio / ASIO engine
│   └── CMakeLists.txt         # Native CMake build definition
├── electron/                  # Electron desktop application entrypoints
│   ├── main.cjs               # Main process entry
│   └── preload.js             # Context-isolated secure preload bridge
├── public/                    # Static assets & compiled Wasm
│   ├── audio-processor.js     # AudioWorkletProcessor script
│   └── audio_processor.wasm   # Compiled Wasm binary
├── src/                       # React 18 + TypeScript frontend
│   ├── components/dj/         # DJ-specific UI controls (Decks, Knobs, Faders, Waveforms)
│   ├── contexts/              # DJ application state & Web MIDI
│   └── services/              # AudioService audio graph singleton
```
