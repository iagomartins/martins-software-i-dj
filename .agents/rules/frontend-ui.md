# Frontend, UI & Audio Synchronization Rules

The iDJ frontend is built with **React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui**. Because this is a high-precision live audio performance application, the UI must stay buttery smooth (60-120 FPS) while processing continuous audio metrics, BPM tracking, and waveform positioning.

---

## 1. High-Performance UI & 60 FPS Rendering

1. **Decouple Audio State from React Render Cycles**:
   - The audio playback position changes every ~2.9ms (at 128 samples / 44.1kHz).
   - **NEVER** push sub-millisecond audio playback position directly into React `useState` at the top level of the app, as this causes the entire DOM tree to re-render constantly.
   - **Pattern**:
     - Keep continuous position updates inside `AudioService` or ref-backed animation loops.
     - Canvas-based waveforms (`AudioWaveform.tsx`) and scratch wheels (`ScratchWheel.tsx`) should drive their playhead rendering using `requestAnimationFrame`.
     - React state should only store discrete state: track loaded, play/pause, active cue points, effect on/off toggles, and quantized BPM values.

2. **Canvas Waveform Rendering**:
   - Use pre-computed peak caches for loaded audio buffers (Min/Max amplitude per pixel).
   - Never iterate through entire multi-megabyte `AudioBuffer.getChannelData` arrays inside the render loop.
   - Use OffscreenCanvas or double buffering where supported for zero-jank scrubbing.

---

## 2. Audio Control Interaction (Knobs, Faders, Jog Wheels)

1. **Interactive Control Sensitivity**:
   - Knobs and faders (`DJKnob.tsx`, `DJFader.tsx`, `CrossFader.tsx`, `PitchFader.tsx`) must provide:
     - Shift-key modifier for fine-tuning precision (e.g. 0.1x step resolution).
     - Double-click to reset to default/detent value (e.g. 0dB EQ, center crossfader, 0% pitch).
     - Non-linear logarithmic or audio-taper curves for volume and frequency sweeps.

2. **Parameter Smoothing**:
   - When users rapidly drag a fader or knob, transmit continuous float updates to `AudioService` / Wasm without debounce delays, but ensure the DSP applies smoothing to avoid click/zipper artifacts.

---

## 3. Web MIDI Integration

1. **Hardware Controller Priority**:
   - Web MIDI messages (`onmidimessage`) must be mapped to actions with minimal latency (<5ms).
   - Map 7-bit standard CCs (0-127) and 14-bit high-resolution CC pairs cleanly.
   - Provide visual feedback in the UI when MIDI hardware packets are received.
