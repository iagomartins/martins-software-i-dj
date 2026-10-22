# iDJ - Modern Cross-Platform DJ Software

[![React 18](https://img.shields.io/badge/React-18-blue.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-37+-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-W3C-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-C%2B%2B17-654FF0.svg?logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Vitest](https://img.shields.io/badge/Vitest-TDD-yellow.svg?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> **Desktop performance in a web-native architecture.**  
> iDJ is a professional hybrid DJ mixing application combining the flexibility of modern web technologies with the sub-millisecond, deterministic real-time audio performance of compiled C++ DSP.

---

## 📖 Table of Contents

- [1. Architectural Overview](#1-architectural-overview)
- [2. The Web-Native Audio Stack](#2-the-web-native-audio-stack)
  - [Web Audio API Graph Routing](#web-audio-api-graph-routing)
  - [C++ DSP via WebAssembly & AudioWorklet](#c-dsp-via-webassembly--audioworklet)
  - [Singleton `AudioService`](#singleton-audioservice)
- [3. High-Performance UI & Design System](#3-high-performance-ui--design-system)
  - [State Decoupling & 60-120 FPS Rendering](#state-decoupling--60-120-fps-rendering)
  - [Strict Neutral Dark Palette (Zero Blue Tints)](#strict-neutral-dark-palette-zero-blue-tints)
- [4. Hardware & MIDI Integration](#4-hardware--midi-integration)
  - [Web MIDI 3-Byte Interception](#web-midi-3-byte-interception)
  - [Hardware Map Translation & Math](#hardware-map-translation--math)
- [5. Testing & Zero-Regression Quality Policy](#5-testing--zero-regression-quality-policy)
  - [Mandatory TDD Design Pattern](#mandatory-tdd-design-pattern)
  - [Hardware & Web API Mocking Boundaries](#hardware--web-api-mocking-boundaries)
- [6. Project Structure](#6-project-structure)
- [7. Getting Started](#7-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Build](#installation--build)
  - [Compiling C++ DSP to WebAssembly](#compiling-c-dsp-to-webassembly)
  - [Running the App](#running-the-app)
- [8. Contributing & Commit Standards](#8-contributing--commit-standards)

---

## 1. Architectural Overview

Traditional desktop DJ applications historically relied on heavyweight native bindings (`node-gyp`, PortAudio DLLs, native threads) that suffered from cross-compilation friction, OS-dependent audio driver crashes, and fragile packaging.

**iDJ** eliminates legacy binary wrappers by operating on a **Web-Native Audio Architecture**:
- Audio graph construction and device routing are handled natively via the standard **Web Audio API**.
- Low-latency real-time DSP (Equalizers, 4-pole filters, Flanger, Echo, Reverb, pitch-shifting) is authored in high-performance **C++17**, compiled to **WebAssembly (Wasm)** via Emscripten, and executed inside an isolated **AudioWorklet** rendering thread.
- The desktop shell is driven by **Electron 37+** with strict Context Isolation, using IPC purely for secure local file I/O and window management.

---

## 2. The Web-Native Audio Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MAIN THREAD                                     │
│                                                                             │
│  React 18 UI  ──(MIDI / User Events)──>  Zustand / Event State Engine       │
│                                                   │                         │
│                                            AudioService                     │
│                                            (Singleton)                      │
│                                                   │                         │
│                                                   ▼                         │
│                                            AudioContext                     │
└───────────────────────────────────────────────────┼─────────────────────────┘
                                                    │ AudioParam / Messages
┌───────────────────────────────────────────────────▼─────────────────────────┐
│                        REAL-TIME AUDIO THREAD (AudioWorklet)                 │
│                                                                             │
│  AudioBufferSourceNode ──> Biquad/Gain ──> AudioWorkletNode [C++ Wasm DSP]  │
│                                                    │ (128 samples / frame)  │
│                                                    ▼                        │
│                                          Equal-Power Crossfader             │
│                                                    │                        │
│                                                    ▼                        │
│                                           Master / Cue Outputs              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Web Audio API Graph Routing
- Every audio stream begins at an `AudioBufferSourceNode`, decodes audio asynchronously via `AudioContext.decodeAudioData()`, and streams into dedicated deck channel gains and filters.
- Master and Cue channels are split cleanly through `MediaStreamAudioDestinationNode` chains, allowing distinct physical outputs for DJ headphones and main PA soundcards.

### C++ DSP via WebAssembly & AudioWorklet
- The audio render loop executes inside an `AudioWorkletGlobalScope` on a dedicated high-priority audio thread.
- **Zero Allocations & Zero Garbage Collection**: The C++ DSP engine (`cpp/audio_processor.cpp`) executes within pre-allocated WebAssembly linear memory (`WebAssembly.Memory`). No dynamic `malloc` or JavaScript garbage collection cycles ever occur during the 128-sample render loop.
- **Transposed Direct Form II**: Audio filters and 3-band EQ stages utilize TDF-II topology with anti-denormal float protections (`1e-15f`) to prevent CPU spikes during silent passages.

### Singleton `AudioService`
- Managed via `src/services/AudioService.ts`.
- **Decoupled from React**: `AudioService` is an absolute Singleton that lives outside the React lifecycle. Component mounts, unmounts, and React 18 `StrictMode` double-invocations never recreate `AudioContext` or tear down audio graphs.
- **Safe AudioSource Lifecycle**: Playhead pause and stop routines explicitly nullify `sourceNode.onended` before disconnecting, eliminating false track-end race conditions.
- **Equal-Power Crossfader**: Gain modulation implements constant acoustic power formulas:
  $$\text{Gain}_A = \cos\left(\text{value} \cdot \frac{\pi}{2}\right), \quad \text{Gain}_B = \sin\left(\text{value} \cdot \frac{\pi}{2}\right)$$
  ensuring no acoustic energy drop ($A^2 + B^2 = 1.0$) at the center position (`0.5`), smoothed by `audioParam.setTargetAtTime()`.

---

## 3. High-Performance UI & Design System

### State Decoupling & 60-120 FPS Rendering
High-frequency audio updates (continuous playhead positions, scrub cursors, and visualizer waveforms) happen at millisecond intervals.

- ❌ **NEVER** push sub-millisecond playhead updates into top-level React `useState` hooks. Doing so re-renders the component tree hundreds of times per second and causes catastrophic audio glitching.
- ✅ **ALWAYS** decouple playhead rendering into HTML5 Canvas and `requestAnimationFrame()` loops. Components maintain lightweight local refs for continuous data while keeping React state reserved strictly for discrete user actions (e.g., track loaded, deck play/pause toggle, cue point placed).

### Strict Neutral Dark Palette (Zero Blue Tints)
To ensure maximum contrast, visual ergonomics in dark DJ booths, and a sleek, industrial aesthetic, iDJ enforces a **Strict Neutral Dark Theme**. **Blue-tinted dark themes (slate/indigo/navy) are strictly prohibited.**

| Element | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Canvas Background** | `#000000` / `#0A0A0A` | Deepest neutral black base |
| **Deck & Mixer Cards** | `#171717` / `#262626` | Pure neutral dark gray surface |
| **Component Borders** | `#333333` / `#404040` | Subtle contrast dividers |
| **Primary Text** | `#FFFFFF` | Maximum legibility |
| **Muted Text / Labels** | `#A3A3A3` | Secondary metadata and units |
| **Active Play / Cue** | `#22C55E` (Neon Green) | Deck active and playing status |
| **Warning / Loop State**| `#F59E0B` (Amber) | Active loops, warning thresholds |
| **Kill / Sync / Clip** | `#EF4444` (Vibrant Red) | Audio peaking, EQ kill buttons |

---

## 4. Hardware & MIDI Integration

iDJ features a native zero-latency hardware translation layer powered by the **Web MIDI API** (`navigator.requestMIDIAccess`).

### Web MIDI 3-Byte Interception
Hardware controllers send raw 3-byte packets:
$$\text{Packet} = [\text{Status}, \text{ControlID}, \text{Value}]$$
- **Status `144` (`0x90`)**: Note On (tactile buttons, cue pads, play/pause keys).
- **Status `176` (`0xb0`)**: Control Change (linear faders, EQ potentiometers, rotary encoders, jog wheels).

### Hardware Map Translation & Math
Implemented across `src/services/MidiParser.ts` and `src/services/MidiRouter.ts`:
1. **Mixxx Hex Map Alignment**: Built-in translation tables for industry controllers (such as the *Hercules DJ Control Instinct*).
2. **Normalized Floating Point Outputs**: All continuous controls (faders, knobs) are normalized to $[0.0, 1.0]$.
3. **Button Release Filtering**: Button release events (`Value === 0`) are filtered out to prevent double-toggling parameters on button release.
4. **Jog Wheel Relative Delta**: Jog wheel rotary encoders report relative motion:
   $$\text{delta} = \begin{cases} \text{val}, & \text{if } \text{val} \le 64 \quad (\text{Clockwise / Forward}) \\ \text{val} - 128, & \text{if } \text{val} > 64 \quad (\text{Counter-Clockwise / Reverse}) \end{cases}$$
5. **Scheduled State Dispatching**: High-frequency MIDI events are throttled and dispatched without blocking the main audio worklet thread.

---

## 5. Testing & Zero-Regression Quality Policy

iDJ enforces a strict **Test-Driven Development (TDD)** quality gate. No pull request or commit will be accepted without passing automated tests and zero TypeScript compiler warnings.

- **Test Runner**: [Vitest](https://vitest.dev/) (`vitest run`)
- **Component Testing**: `@testing-library/react`, `@testing-library/dom`, `jsdom`
- **End-to-End Testing**: [Playwright](https://playwright.dev/)

### Mandatory TDD Design Pattern
For every bug fix, feature, or refactor:
1. **RED**: Write an automated test covering the specification in `src/services/__tests__/` or `src/components/**/__tests__/`. Run `npm test` to verify that it fails.
2. **GREEN**: Implement the minimal production code necessary to satisfy the test.
3. **REFACTOR**: Clean up architecture, eliminate duplication, and verify that all test suites continue to pass.

### Hardware & Web API Mocking Boundaries
Because Node.js and jsdom lack physical audio hardware and MIDI interfaces, tests must NEVER instantiate bare browser hardware APIs.

All mocks are centralized in `src/test/setupTests.ts`:
- **Web Audio API**: `MockAudioContext`, `MockAudioParam`, `MockAudioWorkletNode`, and `MockAudioBuffer` stub the audio graph and verify parameter schedules (`setTargetAtTime`).
- **Web MIDI API**: `MockMIDIAccess` and `MockMIDIInput` simulate hardware message events (`simulateMessage([144, 0x16, 127])`).
- **Electron IPC**: `window.electron.ipcRenderer` mocks file dialogs and disk access.
- **HTML5 Canvas 2D**: Spies on 2D context drawing calls to validate visualizer renders without browser canvas engine overhead.

---

## 6. Project Structure

```
martins-software-i-dj/
├── .agents/                    # Agent & contributor architectural guidelines
│   ├── rules/                  # Core architectural & TDD rules
│   └── skills/                 # Senior engineering skills (DSP, Electron, TDD)
├── cpp/                        # Real-Time C++17 Audio Engine
│   ├── audio_processor.cpp     # DSP algorithms (Filters, EQ, Reverb, Flanger)
│   ├── audio_processor.h       # C++ header and memory buffers
│   ├── wasm_bindings.cpp       # Emscripten bindings & JS interop
│   ├── build_wasm.bat          # Windows Emscripten build script
│   └── build_wasm.sh           # Linux/macOS Emscripten build script
├── electron/                   # Desktop Runtime Shell
│   ├── main.cjs                # Electron main process & IPC handlers
│   └── preload.js              # Context-isolated IPC bridge
├── public/                     # Static Web & Audio Assets
│   ├── audio-processor.js      # AudioWorklet processor script
│   ├── audio_processor.js      # Emscripten Wasm glue code
│   └── audio_processor.wasm    # Compiled WebAssembly binary
├── src/                        # React Frontend Application
│   ├── components/             # React UI components
│   │   ├── dj/                 # Decks, Crossfader, Waveforms, Mixer
│   │   └── ui/                 # Neutral shadcn/ui primitives
│   ├── hooks/                  # Custom React hooks (useMidi, useAudio)
│   ├── services/               # Core services & singletons
│   │   ├── AudioService.ts     # Audio graph singleton manager
│   │   ├── MidiParser.ts       # Hardware mapping dictionary
│   │   ├── MidiRouter.ts       # Web MIDI event orchestrator
│   │   └── __tests__/          # Service unit and integration tests
│   ├── test/                   # Testing infrastructure & setupTests.ts
│   └── App.tsx                 # Root application component
├── vitest.config.ts            # Vitest configuration & jsdom environment
└── package.json                # Project dependencies and run scripts
```

---

## 7. Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Emscripten SDK (emsdk)**: (Only required if modifying C++ DSP code)

### Installation & Build

1. **Clone the repository**:
   ```bash
   git clone https://github.com/iagomartins/martins-software-i-dj.git
   cd martins-software-i-dj
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Verify the environment**:
   ```bash
   npx tsc --noEmit && npm test
   ```

### Compiling C++ DSP to WebAssembly

If you make modifications to the DSP algorithms in `cpp/audio_processor.cpp`:

1. Activate your local Emscripten environment:
   ```bash
   # Windows
   path\to\emsdk\emsdk_env.bat

   # macOS / Linux
   source path/to/emsdk/emsdk_env.sh
   ```

2. Execute the build script:
   ```bash
   # Windows (PowerShell or CMD)
   cd cpp
   .\build_wasm.bat

   # Linux / macOS
   cd cpp
   chmod +x build_wasm.sh
   ./build_wasm.sh
   ```

This generates updated `public/audio_processor.wasm` and `public/audio_processor.js` binaries.

### Running the App

```bash
# Start Vite development server (Web Browser Mode)
npm run dev

# Start Electron Desktop App in Development Mode
npm run electron:dev

# Run full automated test suite (Vitest)
npm test

# Run tests in watch mode (Active TDD workflow)
npm run test:watch

# Build production bundle
npm run build
```

---

## 8. Contributing & Commit Standards

We welcome contributions from audio engineers, UI developers, and DJ enthusiasts!

### Quality Gates
Before creating a pull request or requesting a commit:
1. **Pass all automated tests**: `npm test`
2. **Zero TypeScript errors**: `npx tsc --noEmit`
3. **Pass linter**: `npm run lint`
4. **Follow TDD**: Include a dedicated `.test.ts` or `.test.tsx` file for any new functionality or bug fix.

### Conventional Commits
All commit messages must follow standard Conventional Commit formatting:
- `feat(audio): implement 4-pole resonant lowpass filter`
- `fix(midi): correct relative jog wheel delta for reversed encoder`
- `perf(waveform): migrate cursor tracking to requestAnimationFrame canvas`
- `test(crossfader): add constant power trigonometric gain assertion`

---

## 📄 License & Credits

- Engineered by **Iago Martins** and contributors.
- Released under the **MIT License**.
- Special thanks to the **Web Audio API Working Group**, the **Emscripten team**, and the open-source DJ community.
