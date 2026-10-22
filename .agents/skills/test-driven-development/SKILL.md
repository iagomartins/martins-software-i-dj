---
name: test-driven-development
description: >-
  Senior-level Test-Driven Development (TDD) engineering, zero-regression testing
  architecture, Web Audio API/AudioWorklet mocking, Web MIDI hardware simulation,
  Electron IPC testing, and React UI testing for iDJ. Use this skill whenever
  implementing new features, refactoring code, fixing bugs, or writing unit and
  integration tests with Vitest and Testing Library.
---

# Test-Driven Development (TDD) Mandatory Architecture

This skill defines the formal architectural standards, mocking boundaries, and execution runbooks for **Test-Driven Development (TDD)** in the **iDJ** project.

---

## 🏛️ Core TDD Principles & The Non-Negotiable Contract

1. **Mandatory Red-Green-Refactor Cycle**:
   - **RED**: Write an automated test covering the specification before any implementation code is written. Execute `npm test` and assert that the test fails for the expected reason.
   - **GREEN**: Write the minimal production code necessary to make the test pass. Verify with `npm test`.
   - **REFACTOR**: Clean up, optimize performance, and eliminate code duplication while ensuring all tests continue to pass.
2. **Zero-Regression Guarantee**:
   - No bug fix is complete without a reproduction test case that caught the bug and now permanently prevents its recurrence.
   - No pull request or commit is permitted if any test in the test suite is failing.
3. **Commit Quality Gate**:
   - Running `npx tsc --noEmit && npm test` is mandatory before requesting or creating any Git commit.

---

## 🛡️ Mocking Boundaries & Hardware Sandboxes

iDJ integrates low-level browser and desktop APIs that cannot run natively in Node.js / jsdom without dedicated sandboxes. The global mocks are centralized in [`src/test/setupTests.ts`](file:///c:/Users/Avell/Documents/martins-software-i-dj/src/test/setupTests.ts).

### 1. Web Audio API & AudioWorklet Sandbox
- **Never instantiate unmocked `AudioContext` in tests**: It crashes Node.js environments immediately.
- Use the standard mocks provided in `setupTests.ts`:
  - `MockAudioContext`: Mocks `createGain`, `createBufferSource`, `createMediaStreamDestination`, `decodeAudioData`, and `resume`.
  - `MockAudioParam`: Records and verifies audio parameter updates, specifically `setTargetAtTime` (used for anti-zipper de-zippering), `setValueAtTime`, and linear/exponential ramps.
  - `MockAudioWorkletNode`: Emulates message passing (`port.postMessage` and `port.onmessage`).
  - `MockAudioBuffer`: Provides fake multichannel PCM data without requiring real audio files.

### 2. Web MIDI API Hardware Simulator
- Tests must simulate physical DJ controller hardware via `MockMIDIAccess` and `MockMIDIInput`.
- Emulate raw 3-byte packets: `[Status, ControlID, Value]`:
  - **Status 176 (`0xb0`)**: Control Change (faders, knobs, jog wheels).
  - **Status 144 (`0x90`)**: Buttons (Note On).
- Simulate hardware message delivery:
  ```typescript
  mockInput.simulateMessage([144, 0x16, 127]); // Deck A Play press
  mockInput.simulateMessage([176, 0x3a, 64]);  // Crossfader center
  ```

### 3. Electron Desktop IPC Mocking
- Emulate the context isolation bridge on `window.electron.ipcRenderer`:
  ```typescript
  vi.spyOn(window.electron.ipcRenderer, 'invoke').mockImplementation(async (channel) => {
    if (channel === 'show-open-dialog') return { canceled: false, filePaths: ['track.mp3'] };
    if (channel === 'read-file') return new Uint8Array([0, 1, 2, 3]);
  });
  ```

### 4. HTML5 Canvas 2D Waveform Mock
- Waveform components render 60–120 FPS audio visualizers. `setupTests.ts` mocks `HTMLCanvasElement.prototype.getContext('2d')` with spy stubs for `beginPath`, `stroke`, `fillRect`, etc., to allow testing UI components without canvas crashes.

### 5. Wasm Module & Asset Fetch Interceptor
- In testing, `fetch` requests for `.wasm` and `.js` audio worklet binaries are intercepted and return lightweight stubs to keep unit test execution sub-second.

---

## 📂 Domain Testing Runbooks

### Domain 1: Audio Engine & DSP Services (`src/services/AudioService.ts`)
- **Location**: [`src/services/__tests__/AudioService.test.ts`](file:///c:/Users/Avell/Documents/martins-software-i-dj/src/services/__tests__/AudioService.test.ts)
- **Key Assertions**:
  1. **Singleton & Idempotency**: Assert `AudioService.getInstance() === AudioService.getInstance()` and that concurrent calls to `initialize()` resolve the same promise without duplicating `AudioContext`.
  2. **Memory Safety**: Assert that `loadTrack` uses asynchronous `Blob.arrayBuffer()` without blocking synchronous execution or creating redundant copies.
  3. **Equal-Power Mathematics**: Assert that `setCrossfader(0.5)` produces $\cos(\frac{\pi}{4}) = \sin(\frac{\pi}{4}) = \frac{\sqrt{2}}{2} \approx 0.7071$ gain on each deck, preserving constant acoustic power ($A^2 + B^2 = 1.0$).
  4. **Lifecycle & Race Conditions**: Assert that `pause()` explicitly disconnects and nullifies `sourceNode.onended` before stopping to prevent the false track-end bug.

### Domain 2: MIDI Controller Translation (`src/services/MidiParser.ts` & `MidiRouter.ts`)
- **Location**: [`src/services/__tests__/MidiIntegration.test.ts`](file:///c:/Users/Avell/Documents/martins-software-i-dj/src/services/__tests__/MidiIntegration.test.ts)
- **Key Assertions**:
  1. **Hardware Dictionaries**: Validate exact Mixxx ControlIDs against target actions.
  2. **Button Release Filtering**: Assert that `Value !== 127` (such as button release `Value === 0`) returns `null` and is ignored to prevent double toggling.
  3. **Jog Wheel Relative Delta**: Assert forward rotation ($\le 64 \rightarrow \text{delta} = \text{val}$) vs. backward rotation ($> 64 \rightarrow \text{delta} = \text{val} - 128$).
  4. **Status Disambiguation**: Assert that identical control numbers (e.g. Note 51 = Deck B Load, CC 51 = Deck B Jog) are routed correctly based on the status byte.
  5. **State Dispatch**: Verify `scheduleDispatch` batches updates without blocking the zero-latency audio thread.

### Domain 3: Isolated React Components (`src/components/dj/`)
- **Location**: [`src/components/dj/__tests__/UIComponents.test.tsx`](file:///c:/Users/Avell/Documents/martins-software-i-dj/src/components/dj/__tests__/UIComponents.test.tsx)
- **Key Assertions**:
  1. **Pure Presentation**: Test components using `@testing-library/react` in isolation. Never invoke real audio hardware.
  2. **User Interactions**: Simulate mouse events (`fireEvent.mouseDown`, `mouseMove`, `mouseUp`, `doubleClick`) and verify that `onChange` callbacks fire with properly bounded values.
  3. **Visual Feedback States**: Verify overlays (e.g., [`DeckLoadingOverlay`](file:///c:/Users/Avell/Documents/martins-software-i-dj/src/components/dj/DeckLoadingOverlay.tsx)) correctly display spinners, track titles, progress bars, or error messages based on state props.

---

## ⚡ Execution Commands

| Task | Command |
| :--- | :--- |
| **Run All Tests** | `npm test` |
| **Run Tests in Watch Mode (Active TDD)** | `npm run test:watch` |
| **Run Specific Test File** | `npx vitest run src/services/__tests__/AudioService.test.ts` |
| **Run Specific Test by Name** | `npx vitest run -t "Equal Power"` |
| **Generate Coverage Report** | `npx vitest run --coverage` |
| **Pre-Commit Verification Gate** | `npx tsc --noEmit && npm test && npm run build` |

---

## 📋 Standard TDD Checklist for Developers & Agents

Before submitting or committing any change:
- [ ] Has a failing test been written first (`RED`)?
- [ ] Does the implementation strictly fulfill the test requirement (`GREEN`)?
- [ ] Are all mock boundaries (`AudioContext`, `MIDI`, `IPC`, `Canvas`) respected?
- [ ] Does `npm test` pass with 100% success?
- [ ] Does `npx tsc --noEmit` pass with 0 errors?
- [ ] Has user permission been requested before committing?
