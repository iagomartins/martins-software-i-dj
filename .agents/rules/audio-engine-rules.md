---
trigger: always_on
---

# 🛑 STRICT AUDIO ENGINE RULES (IMMUTABLE ARCHITECTURE)

This document defines the absolute, unchangeable rules for `AudioService.ts`, `audio-processor.js`, and the Web Audio API graph. **Any modification to the audio engine MUST strictly comply with these rules. DO NOT alter the core routing or math formulas defined here.**

## 1. The Sacred Audio Graph (Routing Chain)
The audio graph for each deck MUST follow this exact, unbreakable sequence. Never bypass a node or blindly call `.disconnect()` without rebuilding this exact chain:
`AudioBufferSourceNode` -> `AudioWorkletNode (C++ FX)` -> `BiquadFilterNode (Low)` -> `BiquadFilterNode (Mid)` -> `BiquadFilterNode (High)` -> `GainNode (Deck Volume)` -> `GainNode (Crossfader)` -> `AudioContext.destination`

## 2. Crossfader Immutability (Constant Power Curve)
The crossfader logic is LOCKED. Do not revert to linear fading. It must always use the Constant Power Curve applied to the dedicated Crossfader `GainNode`s:
- **Deck A Gain:** `Math.cos(crossfaderValue * 0.5 * Math.PI)`
- **Deck B Gain:** `Math.sin(crossfaderValue * 0.5 * Math.PI)`
- `crossfaderValue` is exactly `0.0` (A only), `0.5` (Center), to `1.0` (B only).

## 3. `audio-processor.js` (The AudioWorklet)
- **Isolation:** This file runs in a separate real-time audio thread. It has NO access to `window`, `document`, or React.
- **Communication:** The ONLY way to alter effects is via `port.postMessage`.
- **Wasm Handling:** The `process` method must guarantee it does not crash if `this.wasm` is not yet loaded. It must silently pass the audio through (`output.set(input)`) until the C++ module is ready.

## 4. UI vs. Audio Engine Decoupling
- `AudioService.ts` is a SINGLETON. It must never be re-instantiated by React's lifecycle.
- React components MUST NOT contain Web Audio API logic (no `gain.value = x` inside `.tsx` files). Components only dispatch values to the global store, which then calls `AudioService` methods.

## 5. Modification Protocol
If you are asked to fix or add an effect (FX), you may ONLY modify the `postMessage` payloads and the Wasm execution inside `audio-processor.js`. YOU ARE FORBIDDEN from altering the `GainNode` connections or the crossfader math.