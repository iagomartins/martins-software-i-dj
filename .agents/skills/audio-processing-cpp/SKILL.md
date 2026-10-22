---
name: audio-processing-cpp
description: >-
  Senior-level C++ audio DSP engineering, real-time safety patterns, WebAssembly
  compilation with Emscripten, AudioWorklet integration, and native PortAudio/ASIO
  engine development for iDJ. Use this skill whenever implementing or debugging audio
  effects (EQ, filters, delay, reverb, pitch shifting), optimizing DSP performance,
  preventing audio dropouts/denormals, or compiling and binding C++ modules.
---

# Audio Processing C++ Senior Skill

This skill provides comprehensive instructions, architectural guidelines, and standard procedures for developing, testing, and optimizing high-performance C++ audio processing in **iDJ**.

---

## 🎧 Architecture Overview

iDJ employs a dual-track audio engine architecture:

1. **WebAssembly / AudioWorklet Engine (Primary)**:
   - Source: [`cpp/audio_processor.cpp`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/audio_processor.cpp), [`cpp/audio_processor.h`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/audio_processor.h), [`cpp/wasm_bindings.cpp`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/wasm_bindings.cpp).
   - Compiled with: Emscripten (`emcc`).
   - Runs in: AudioWorklet dedicated thread inside [`public/audio-processor.js`](file:///c:/Users/Avell/Documents/martins-software-i-dj/public/audio-processor.js).
   - Zero-copy audio processing on 128-sample blocks at 44.1kHz / 48kHz.

2. **Native PortAudio Engine (Pro Desktop)**:
   - Source: [`cpp/audio_engine.cpp`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/audio_engine.cpp), [`cpp/audio_engine.h`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/audio_engine.h).
   - Compiled with: CMake & MSVC/Clang into [`audio_engine.dll`](file:///c:/Users/Avell/Documents/martins-software-i-dj/audio_engine.dll).
   - Supports: Low-latency ASIO, WASAPI, shared memory state synchronization, and direct Node.js FFI via `koffi`.

---

## 🛠️ Core Workflows

### Workflow 1: Developing & Modifying DSP Algorithms

When adding or modifying an audio effect (e.g., new EQ curve, filter, distortion, compressor, or reverb):

1. **Declare in Header ([`cpp/audio_processor.h`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/audio_processor.h))**:
   - Keep internal state variables (filter history, delay line pointers, LFO phase) as member variables.
   - Do NOT use dynamic structures (`std::vector`, `std::map`) inside the DSP struct or class.
   - Ensure delay lines are initialized to max size in constructor.
2. **Implement Algorithm ([`cpp/audio_processor.cpp`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/audio_processor.cpp))**:
   - Follow **Transposed Direct Form II** for biquad filters to avoid numerical degradation.
   - Protect against denormal numbers on all feedback loops:
     ```cpp
     inline float killDenormal(float val) {
         static const float anti_denormal = 1e-18f;
         return val + anti_denormal - anti_denormal;
     }
     ```
   - For detailed filter formulas and circular buffer patterns, see [DSP Algorithms Reference](./references/dsp-algorithms.md).
3. **Expose C ABI in Wasm Bindings ([`cpp/wasm_bindings.cpp`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/wasm_bindings.cpp))**:
   - Wrap parameters with `EMSCRIPTEN_KEEPALIVE` and `extern "C"`.
   - Update `process_deck_audio` if new channel or buffer parameters are added.
4. **Export in Build Scripts**:
   - Add the new function name to `EXPORTED_FUNCS` in [`cpp/build_wasm.bat`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/build_wasm.bat) and [`cpp/build_wasm.ps1`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/build_wasm.ps1).

---

### Workflow 2: Compiling WebAssembly & Updating AudioWorklet

1. **Activate Emscripten SDK**:
   ```powershell
   # In terminal with emsdk installed:
   emsdk activate latest
   .\emsdk_env.ps1
   ```
2. **Run Wasm Compilation**:
   ```powershell
   cd cpp
   .\build_wasm.ps1
   ```
   *Expected output*: `public/audio_processor.wasm` and `public/audio_processor.js`.
3. **Update Worklet Message Handler ([`public/audio-processor.js`](file:///c:/Users/Avell/Documents/martins-software-i-dj/public/audio-processor.js))**:
   - Add IPC handler in `handleMessage(data)` to pass parameter values to `this.wasmInstance._your_new_function(data.value)`.
4. **Update Frontend Service ([`src/services/AudioService.ts`](file:///c:/Users/Avell/Documents/martins-software-i-dj/src/services/AudioService.ts))**:
   - Expose the method on `AudioService` (e.g. `setDeckFilterCutoff(deck, cutoff)`).
   - Post message through `this.workletNode.port.postMessage(...)`.

---

### Workflow 3: Compiling & Testing the Native Engine

1. **Build with CMake**:
   ```powershell
   .\scripts\build-auto.bat
   ```
   Or via PowerShell:
   ```powershell
   cd cpp
   if (!(Test-Path build)) { mkdir build }
   cd build
   cmake ..
   cmake --build . --config Release
   ```
2. **Verify Native DLL via Koffi**:
   ```powershell
   node test-audio-engine.cjs
   ```
3. **Inspect Device Enumeration**:
   - Check console logs for ASIO vs WASAPI device detection and ensure sample rate matches hardware clock (typically 44100 or 48000 Hz).

---

## 🚨 Real-Time Safety Audit Checklist

Before committing any C++ DSP change, execute this mental or automated audit:

| Check | Requirement | Violation Consequence |
|---|---|---|
| **No Dynamic Allocations** | Zero calls to `malloc`, `free`, `new`, `delete`, `push_back`. | Priority inversion, GC pause, audio glitch. |
| **No Mutex Locks** | Use atomics with `std::memory_order_relaxed` / `acquire_release` or lock-free queues. | Audio thread descheduled waiting on worker thread. |
| **No File / Console I/O** | Zero `printf`, `std::cout`, file reading. | Microsecond syscall latency causes buffer underflow. |
| **Denormal Protection** | All recursive IIR and delay paths flush denormals. | 100x CPU spike when audio pauses or tails decay. |
| **Equal-Power Crossfading** | Crossfader applies cosine/sine or equal-power square root curve. | 3dB perceived volume drop at center position. |

---

## 📚 Technical References

- [DSP Algorithms & Math Deep-Dive](./references/dsp-algorithms.md)
- [Real-Time Multithreading & Lock-Free Design](./references/realtime-multithreading.md)
- [WebAssembly & AudioWorklet Zero-Copy Pipeline](./references/wasm-audioworklet.md)
- [PortAudio Native Engine & Low-Latency Drivers](./references/portaudio-native.md)
