# PortAudio Native C++ Engine & Low-Latency Drivers

This document covers compiling, configuring, and binding the native PortAudio C++ audio engine (`audio_engine.dll`) for Windows and desktop environments.

---

## 1. Native Build Configuration (CMake)

The native engine is declared in [`cpp/CMakeLists.txt`](file:///c:/Users/Avell/Documents/martins-software-i-dj/cpp/CMakeLists.txt):

```cmake
cmake_minimum_required(VERSION 3.16)
project(DJAudioEngine)

set(CMAKE_CXX_STANDARD 17)

# PortAudio lookup (vcpkg or manual paths)
find_library(PORTAUDIO_LIB NAMES portaudio PATHS "C:/vcpkg/installed/x64-windows/lib")
find_path(PORTAUDIO_INCLUDE NAMES portaudio.h PATHS "C:/vcpkg/installed/x64-windows/include")

add_library(audio_engine SHARED audio_engine.cpp audio_engine.h)
target_link_libraries(audio_engine PRIVATE ${PORTAUDIO_LIB})
```

### Compiling on Windows
Run `scripts/build-auto.bat` or use MSVC directly:
```powershell
cd cpp
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

The resulting `audio_engine.dll` is placed in `cpp/dist/Release/audio_engine.dll` and copied to the workspace root and `dist/`.

---

## 2. Windows ASIO vs WASAPI Driver Selection

In `AudioEngine::initialize()`:
1. PortAudio queries all available host APIs:
   - **ASIO (Steinberg Audio Stream Input/Output)**: Priority 1. Direct hardware driver access, bypassing Windows audio mixing, delivering sub-5ms round-trip latency.
   - **WASAPI (Windows Audio Session API) Exclusive**: Priority 2. Low latency, direct hardware control.
   - **DirectSound / MME**: Fallback only. Higher latency (>30ms), prone to software mixing jitter.

```cpp
// Search for ASIO driver device
for (int i = 0; i < numDevices; i++) {
    const PaDeviceInfo* deviceInfo = Pa_GetDeviceInfo(i);
    const PaHostApiInfo* hostApi = Pa_GetHostApiInfo(deviceInfo->hostApi);
    if (strstr(hostApi->name, "ASIO") != nullptr && deviceInfo->maxOutputChannels >= 2) {
        asioDevice = i;
        break;
    }
}
```

---

## 3. Koffi FFI Bridge in Node.js / Electron

To consume the native DLL from Node.js or Electron main process:

```javascript
const koffi = require("koffi");
const path = require("path");

const lib = koffi.load(path.join(__dirname, "audio_engine.dll"));

// Declare Opaque Pointer & Signatures
const AudioEnginePtr = koffi.pointer("AudioEngine", koffi.opaque());
const AudioEngine_New = lib.func("AudioEngine_New", AudioEnginePtr, []);
const AudioEngine_Initialize = lib.func("AudioEngine_Initialize", "bool", [AudioEnginePtr]);
const AudioEngine_SetDeckPlaying = lib.func("AudioEngine_SetDeckPlaying", "void", [AudioEnginePtr, "int", "bool"]);
const AudioEngine_Shutdown = lib.func("AudioEngine_Shutdown", "void", [AudioEnginePtr]);
const AudioEngine_Delete = lib.func("AudioEngine_Delete", "void", [AudioEnginePtr]);

// Instantiate & Run
const engine = AudioEngine_New();
if (AudioEngine_Initialize(engine)) {
    console.log("Audio Engine Running via Koffi!");
}
```
Always pair `AudioEngine_New()` with `AudioEngine_Delete()` during application shutdown to avoid leaking native memory and holding driver handles open.
