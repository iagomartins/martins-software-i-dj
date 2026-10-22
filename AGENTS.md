# iDJ - Workspace Agent Rules & Guidelines

Welcome to the **iDJ (Professional DJ Software)** repository. This file defines the core directives, architectural patterns, and engineering rules for all AI agents and developers working on this codebase.

---

## 🧭 System Architecture At A Glance

- **Application Type**: Hybrid Desktop DJ Mixing Software.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Audio Core (Primary)**: Web Audio API + AudioWorklet + WebAssembly DSP (compiled from C++ with Emscripten).
- **Audio Core (Native)**: PortAudio C++ Engine with ASIO/WASAPI support, callable via Koffi FFI.
- **Desktop Runtime**: Electron 37+ with strict Context Isolation.

---

## 📜 Active Workspace Rules

All agents working on this project must consult and comply with the dedicated rules in [.agents/rules/](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/rules):

1. **[Core Architecture Rules](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/rules/project-core.md)**:
   - Module boundaries, separation between audio processing, orchestration, and UI rendering.
   - Dual-engine compatibility standards.
2. **[Real-Time C++ Audio DSP Rules](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/rules/audio-dsp-realtime.md)**:
   - Hard real-time audio thread commandments: zero allocations (`malloc`/`new`), zero mutexes, zero I/O or logging in the render loop.
   - Anti-denormal float protections, filter stability (Transposed Direct Form II), and equal-power crossfader mathematics.
3. **[Electron Desktop & Security Rules](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/rules/electron-desktop.md)**:
   - Context isolation, typed IPC bridges, input sanitization, Koffi native pointer lifecycles, and low-latency audio window flags.
4. **[Frontend & Audio Synchronization Rules](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/rules/frontend-ui.md)**:
   - Decoupling continuous playback position updates from React state tree; 60-120 FPS canvas waveform rendering; Web MIDI mapping.
5. **[Mandatory Test-Driven Development (TDD) Rules](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/rules/tdd-mandatory.md)**:
   - Red-Green-Refactor sequence, strict mock boundaries (AudioContext, Web MIDI, Electron IPC, Canvas), and zero-regression commit gates.

---

## 🛠️ Specialized Agent Skills

When executing complex tasks in this workspace, refer to the senior skill runbooks:
- **Audio Processing C++ Senior Skill**: [.agents/skills/audio-processing-cpp/SKILL.md](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/skills/audio-processing-cpp/SKILL.md)
- **Electron Desktop Senior Skill**: [.agents/skills/electron-senior/SKILL.md](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/skills/electron-senior/SKILL.md)
- **Test-Driven Development (TDD) Senior Skill**: [.agents/skills/test-driven-development/SKILL.md](file:///c:/Users/Avell/Documents/martins-software-i-dj/.agents/skills/test-driven-development/SKILL.md)

---

## 🚀 Key Build & Test Commands

- **Run Automated Tests**: `npm test`
- **Run Tests in Watch Mode (TDD)**: `npm run test:watch`
- **Start Web Dev Server**: `npm run dev`
- **Start Electron in Dev**: `npm run electron:dev`
- **Compile WebAssembly Audio Engine**: `cd cpp && .\build_wasm.bat` (or `.\build_wasm.ps1`)
- **Compile Native C++ Engine (CMake)**: `.\scripts\build-auto.bat`
- **Test Native C++ Engine via Koffi**: `node test-audio-engine.cjs`
- **Typecheck & Lint**: `npx tsc --noEmit && npm run lint`
