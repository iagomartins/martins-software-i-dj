# Low-Latency Audio Tuning in Electron

Standard Electron / Chromium browser defaults optimize for battery life and energy efficiency by aggressively throttling hidden tabs, pausing inactive timers, and lowering audio buffer frequencies. For a professional live DJ application, these power-saving behaviors must be overridden.

---

## 1. Chromium Command-Line Switches

Place these switches at the very top of `electron/main.cjs` **before** `app.whenReady()`:

```javascript
const { app } = require('electron');

// 1. Prevent Chromium from throttling timers, requestAnimationFrame, and audio rendering
// when the DJ minimizes the window or brings another window (e.g. browser) to the foreground
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// 2. Disable user-gesture requirement so AudioContext and AudioWorklet can resume automatically
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 3. Audio hardware buffer configuration (request lowest possible latency)
app.commandLine.appendSwitch('enable-exclusive-audio');
app.commandLine.appendSwitch('audio-buffer-size', '128');

// 4. Smooth 60-120Hz GPU-accelerated rendering for waveforms
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
```

---

## 2. Preventing OS Sleep & Suspension

A live DJ set must never be interrupted by the operating system going to sleep or entering standby mode:

```javascript
const { powerSaveBlocker } = require('electron');

let blockerId = null;

function enableDJPerformanceMode() {
  if (blockerId === null || !powerSaveBlocker.isStarted(blockerId)) {
    // 'prevent-app-suspension' prevents the OS from suspending the process or sleeping
    blockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log(`⚡ PowerSaveBlocker started (ID: ${blockerId})`);
  }
}

function disableDJPerformanceMode() {
  if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId);
    console.log(`💤 PowerSaveBlocker stopped`);
    blockerId = null;
  }
}
```

---

## 3. Multi-Device Audio Output Routing

DJ software requires at least two distinct stereo outputs:
1. **Master Output**: Connected to club speakers/PA.
2. **Headphone Output (Cue / Monitor)**: Connected to the DJ headphones.

In Electron, use the Web Audio API's `setSinkId` feature:

```javascript
// Route an HTMLAudioElement or MediaStream destination to a specific audio output device
async function routeAudioToDevice(audioElement, deviceId) {
  if (typeof audioElement.setSinkId === 'function') {
    try {
      await audioElement.setSinkId(deviceId);
      console.log(`Audio routed successfully to device: ${deviceId}`);
    } catch (err) {
      console.error(`Failed to route audio to device ${deviceId}:`, err);
    }
  } else {
    console.warn('setSinkId is not supported in this runtime');
  }
}
```
Enumerate output devices using `navigator.mediaDevices.enumerateDevices()` filtered by `kind === 'audiooutput'`.
