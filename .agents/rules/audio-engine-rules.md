---
trigger: always_on
---

# 🛑 STRICT AUDIO ENGINE RULES (IMMUTABLE ARCHITECTURE)

Authoritative and immutable engineering rules for `AudioService.ts`, `audio-processor.js`, `useAudioEngine.tsx`, and the Web Audio + WebAssembly graph in **iDJ**.

**Every modification to the audio engine, signal routing, or React hooks MUST strictly comply with these rules. Do NOT alter the core routing, mathematics, or memory safety guarantees.**

---

## 1. The Sacred Audio Graph (Zero-Duplication Guaranteed)

The routing for each deck MUST follow this exact, unbreakable topology. Never bypass nodes or call `.disconnect()` without preserving this architecture.

```
DECK 1 & 2 SIGNAL PATH:
[AudioBufferSourceNode] (Dynamic, one-shot per play)
       │
       ├──► [AudioWorkletNode: dj-audio-processor] (Wasm FX / Clean Pass-Through)
       │         │
       │         ▼
       │    [BiquadFilterNode: Low Shelf (250 Hz)]
       │         │
       │         ▼
       │    [BiquadFilterNode: Mid Peaking (1000 Hz, Q=1.0)]
       │         │
       │         ▼
       │    [BiquadFilterNode: High Shelf (4000 Hz)]
       │         │
       │         ▼
       │    [GainNode: Deck Volume]
       │         │
       │         ▼
       │    [GainNode: Deck Crossfader] ──► [AudioContext.destination] (MASTER OUT)
       │                                ──► [MediaStreamDestination: masterDestination]
       └──► [GainNode: Deck Headphone] ──► [GainNode: Headphone Vol] ──► [headphoneDestination]
            (Pre-fader Cue Monitoring)
```

### 🛑 Zero Audio Duplication Commandments
1. **Single Master Output Rule:** `AudioContext.destination` is the **only** node delivering the master mix to hardware speakers.
2. **FORBIDDEN: HTMLAudioElement Master Duplication:** NEVER create an `HTMLAudioElement` (`new Audio()`) playing `masterStream` to default output while `AudioContext.destination` is connected. This sends the signal through two pipelines, causing audible chorus/phasing (~30–50ms delay).
3. **Static Graph Idempotency:** EQ filters, volume gain, and crossfader gain are persistent per deck. They MUST be wired exactly once (guarded by `deck.graphConnected`). Never reconnect them inside `loadTrack` or `play`.
4. **Dynamic Source Lifecycles:** Web Audio `AudioBufferSourceNode`s are strictly one-shot. Create a new `sourceNode` on `play()`, connect exclusively to `deck.workletNode` (and `headphoneGain`), and immediately `.stop()`, `.disconnect()`, and clear references on `pause()` / `stop()`.

---

## 2. 3-Band DJ Isolator EQ Specifications

Chain connected in series before channel fader: `Source -> Worklet -> Low -> Mid -> High -> Channel Gain`.

### Filter Parameters
| Band | Filter Type | Frequency | Q Factor | Default Gain |
| :--- | :--- | :--- | :--- | :--- |
| **Low** | `lowshelf` | **250 Hz** | — | `0.0 dB` (flat) |
| **Mid** | `peaking` | **1000 Hz** | **1.0** | `0.0 dB` (flat) |
| **High** | `highshelf` | **4000 Hz** | — | `0.0 dB` (flat) |

### Parameter Mapping & Smoothing
- **Normalized UI Input:** $x \in [0.0, 1.0]$ ($0.5$ = center/flat). Defensive conversion for bipolar $[-1.0, 1.0]$: $x = (v + 1) \cdot 0.5$.
- **Decibel Transfer Function:**
  $$\text{Gain}_{\text{dB}} = \begin{cases} -40 + \left(\frac{x}{0.5}\right) \cdot 40 & \text{if } x \le 0.5 \quad (0.0 = -40\text{ dB kill}) \\ \left(\frac{x - 0.5}{0.5}\right) \cdot 6 & \text{if } x > 0.5 \quad (1.0 = +6\text{ dB boost}) \end{cases}$$
- **Anti-Zipper Smoothing:** Gain updates MUST use `filter.gain.setTargetAtTime(targetDb, audioContext.currentTime, 0.015)` (15ms time constant). Direct assignment (`gain.value = targetDb`) is only permitted when AudioContext is offline/unstarted.

---

## 3. Equal-Power Crossfader Invariants

Strict **Constant Power (Equal Power) Curve**:
$$\text{Gain}_{\text{Deck1}} = \cos\left(x \cdot \frac{\pi}{2}\right), \quad \text{Gain}_{\text{Deck2}} = \sin\left(x \cdot \frac{\pi}{2}\right), \quad x \in [0.0, 1.0]$$

- **Center (0.5):** $\text{Gain}_1 = \text{Gain}_2 = \frac{1}{\sqrt{2}} \approx 0.7071$. Acoustic power sum: $\cos^2(\pi/4) + \sin^2(\pi/4) = 1.0$ (zero volume drop at center).
- **Full Left (0.0):** Deck 1 = $1.000$, Deck 2 = $0.000$.
- **Full Right (1.0):** Deck 1 = $0.000$, Deck 2 = $1.000$.
- **Transition Smoothing:** Always use `setTargetAtTime(gain, currentTime, 0.015)`.

### 🛑 Single Ownership Rule
In per-deck AudioWorklet mode (`processorOptions: { deckId }`), Web Audio `deckCrossfaderGains` nodes **exclusively own crossfader mixing**. The worklet MUST NOT apply internal C++ crossfader multiplication in per-deck mode. Doing so squares the curve ($0.707 \times 0.707 = 0.5$), creating an acoustic power hole.

---

## 4. AudioWorklet & WebAssembly Core (`audio-processor.js`)

1. **Isolation:** Runs inside real-time audio thread. Zero access to DOM or `window`.
2. **Asynchronous Messaging:** All parameter updates must occur via `port.postMessage` payloads:
   - `UPDATE_FX`: `{ deckId: 1 | 2, effectName: string, isActive: boolean, amount: number }`
   - `SET_CROSSFADER`: `{ value: number }`
   - `SET_DECK_ACTIVE`: `{ deck: 1 | 2, active: boolean }`
3. **Fail-Safe Audio Pass-Through:** If Wasm is uncompiled, allocating, or errored, `process()` MUST gracefully pass audio through (`output[0].set(input[0])`). Never crash the worklet or drop audio.
4. **Dynamic Wasm Memory Growth:** Emscripten builds use `-sALLOW_MEMORY_GROWTH=1`. Large allocations detach `HEAPF32.buffer`. The worklet must detect buffer detachment and refresh views (`updateMemoryViews()`).

---

## 5. TypeScript Translation & React UI Integration (`useAudioEngine.tsx`)

1. **Absolute Singleton Architecture:** `AudioService` is an absolute singleton (`AudioService.getInstance()`). Never instantiate through React component state.
2. **Zero Null Ref Tolerances:**
   - React hooks accessing the audio engine must NEVER guard audio operations with an uninitialized local ref (`if (!audioServiceRef.current) return;`).
   - Hooks must use a guaranteed accessor `getAudioService()` that always resolves `AudioService.getInstance()`.
   - Every consumer (`DJInterface`, `useKeyMapping`, `DJDeck`, `ConfigModal`) must have immediate, active access to `setCrossfader`, `updateVolume`, `updatePitch`, `updateEQ`, and `setDeckPlaying`.
3. **Automatic Mount Initialization:** `useAudioEngine` automatically invokes `initAudioContext()` in a `useEffect` on mount.
4. **Decoupled Playback Telemetry:** Position update callbacks (50ms interval) must NOT trigger root or deck-level React re-renders. Continuous rendering (waveforms, playheads) must use direct `HTMLCanvasElement` animation loops.

---

## 6. Console Logging & Performance Cleanliness

1. **Audio Hot-Path Prohibition:** FORBIDDEN to invoke `console.log` or `console.warn` inside `AudioWorkletProcessor.process()`.
2. **High-Frequency Input Cleanliness:** FORBIDDEN to output console logs on mouse drags or wheel ticks of the crossfader, volume faders, or EQ knobs.
3. **Periodic Loop Cleanliness:** FORBIDDEN to output un-throttled warnings inside the 50ms position timer.
4. Keep the developer console reserved for genuine lifecycle events (module load, track load, hardware errors).

---

## 7. Mandatory Test-Driven Development (TDD) Protocols

All audio modifications must satisfy:
1. **Red-Green-Refactor:** Write Vitest unit/integration tests before altering audio logic.
2. **Graph Regression Suite:** Verify `setupDeckAudioGraph` connects `source -> worklet -> EQ -> gain -> crossfader -> destination` without leaks or multiple destinations.
3. **No Duplicate Streams Check:** Ensure no `HTMLAudioElement` is instantiated for default master playback.
4. **Execution Gate:** Full test suite must pass cleanly with `npm test -- --run`.