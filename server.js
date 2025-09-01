// server.js
// Node bridge: HTTP upload + WebSocket for control. Audio engine renders to system device.
import fs from "fs";
import path from "path";
import os from "os";
import express from "express";
import cors from "cors";
import multer from "multer";
import { Readable } from "stream";
import { WebSocketServer } from "ws";
import Speaker from "speaker";
import WavDecoder from "wav-decoder";
import ffmpeg from "fluent-ffmpeg";

const fs_module = fs;
const path_module = path;
const os_module = os;
const WavDecoder_module = WavDecoder;

// -----------------------------
// Config
// -----------------------------
const config = {
  httpPort: 4000,
  wsPort: 4001,
  // Engine format (demo expects 44.1kHz stereo WAV)
  sampleRate: 44100,
  channels: 2,
  bitDepth: 16,

  // Playback defaults
  baseSpeed: 1.0,
  loop: true,

  // Scratch mapping
  scratchSamplesPerRevolution: 1.2 * 44100,
  wheelVelEmaAlpha: 0.25,
  slipEnabled: true,

  // Pitch bend
  bendSensitivityPerDegree: 0.002,
  bendMax: 0.15,
  bendDecayTimeSeconds: 0.6,

  // Status broadcast rate (Hz)
  statusHz: 20,
};

// -----------------------------
// Utils
// -----------------------------
function floatToInt16(value) {
  const v = Math.max(-1, Math.min(1, value));
  return v < 0 ? v * 0x8000 : v * 0x7fff;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function samplesToMs(samples, sr) {
  return (samples / sr) * 1000;
}
function msToSamples(ms, sr) {
  return (ms / 1000) * sr;
}

// -----------------------------
// Audio engine
// -----------------------------
// Add BPM tracking to your AudioEngine class
class AudioEngine {
  constructor(audioData, cfg) {
    this.cfg = cfg;
    this.sampleRate = audioData.sampleRate;
    this.channels = audioData.channelData.length;
    this.channelData = audioData.channelData;
    this.length = this.channelData[0].length;

    this.pos = 0.0;
    this.ghostPos = 0.0;
    this.bendSpeed = 0.0;
    this.paused = false;

    this.state = {
      isTouched: false,
      wheelVelRevPerSec: 0.0,
    };

    const tau = cfg.bendDecayTimeSeconds;
    this.bendDecayPerSample =
      tau > 0 ? Math.exp(-1 / (tau * this.sampleRate)) : 0.0;

    // Add BPM tracking
    this.bpm = 120;
    this.baseBpm = 120;
    this.bpmHistory = [];
    this.lastBpmUpdate = 0;

    // Calculate initial BPM
    this.baseBpm = detectBPMFromAudioData(audioData, audioData.sampleRate);
    this.bpm = this.baseBpm;

    console.log(`🎵 Initial BPM detected: ${this.baseBpm}`);
  }

  setTouch(isTouched) {
    if (!this.state.isTouched && isTouched && this.cfg.slipEnabled) {
      this.ghostPos = this.pos;
    }
    this.state.isTouched = isTouched;
  }
  setWheelVelocityRevPerSec(v) {
    this.state.wheelVelRevPerSec = v;
  }
  addBend(deltaSpeed) {
    this.bendSpeed += deltaSpeed;
    this.bendSpeed = Math.max(
      -this.cfg.bendMax,
      Math.min(this.cfg.bendMax, this.bendSpeed)
    );
  }
  setPaused(p) {
    this.paused = p;
  }
  seekToSamples(pos) {
    this.pos = this.normalizePos(pos);
  }
  setConfigPatch(patch) {
    Object.assign(this.cfg, patch);
  }

  normalizePos(pos) {
    if (this.cfg.loop) {
      if (pos >= this.length) return pos % this.length;
      if (pos < 0) return ((pos % this.length) + this.length) % this.length;
      return pos;
    }
    return Math.max(0, Math.min(this.length - 1.001, pos));
  }

  sampleAt(ch, pos) {
    const buf = this.channelData[ch];
    const p = this.cfg.loop
      ? ((pos % this.length) + this.length) % this.length
      : Math.max(0, Math.min(this.length - 1.0001, pos));
    const i0 = Math.floor(p);
    const i1 = (i0 + 1) % this.length;
    const t = p - i0;
    return lerp(buf[i0], buf[i1], t);
  }

  // Add method to update BPM during playback
  updateBPM() {
    const currentTime = this.pos / this.sampleRate;

    // Update BPM every 2 seconds
    if (currentTime - this.lastBpmUpdate > 2.0) {
      // Analyze recent audio data for BPM changes
      const recentSamples = Math.floor(2.0 * this.sampleRate);
      const startPos = Math.max(0, this.pos - recentSamples);
      const endPos = Math.min(this.length, this.pos + recentSamples);

      if (endPos > startPos) {
        // Create temporary audio data for recent segment
        const recentData = {
          channelData: this.channelData.map((channel) =>
            channel.slice(startPos, endPos)
          ),
          sampleRate: this.sampleRate,
        };

        const newBpm = detectBPMFromAudioData(recentData, this.sampleRate);

        // Smooth BPM changes
        if (Math.abs(newBpm - this.bpm) < 20) {
          // Max 20 BPM change
          this.bpm = this.bpm * 0.8 + newBpm * 0.2; // Smoothing
          this.bpm = Math.round(this.bpm);

          if (this.bpm !== this.baseBpm) {
            console.log(`🎵 BPM updated: ${this.baseBpm} → ${this.bpm}`);
          }
        }
      }

      this.lastBpmUpdate = currentTime;
    }
  }

  renderFrames(frameCount) {
    const out = Buffer.alloc(frameCount * this.channels * 2);
    const { isTouched, wheelVelRevPerSec } = this.state;
    const sr = this.sampleRate;

    // Update BPM during playback
    this.updateBPM();

    for (let f = 0; f < frameCount; f++) {
      let instSpeed;

      if (isTouched) {
        const samplesPerSec =
          wheelVelRevPerSec * this.cfg.scratchSamplesPerRevolution;
        instSpeed = samplesPerSec / sr;
        if (this.cfg.slipEnabled) {
          this.ghostPos = this.normalizePos(this.ghostPos + this.cfg.baseSpeed);
        }
      } else {
        if (this.paused) {
          instSpeed = 0;
        } else {
          instSpeed = this.cfg.baseSpeed + this.bendSpeed;
          this.bendSpeed *= this.bendDecayPerSample;
          if (Math.abs(this.bendSpeed) < 1e-6) this.bendSpeed = 0;
        }
      }

      this.pos = this.normalizePos(this.pos + instSpeed);

      for (let ch = 0; ch < this.channels; ch++) {
        const s = this.sampleAt(ch, this.pos);
        const int16 = floatToInt16(s);
        out.writeInt16LE(int16, (f * this.channels + ch) * 2);
      }
    }
    return out;
  }

  // Add getter for current BPM
  getCurrentBPM() {
    return {
      bpm: Math.round(this.bpm),
      baseBpm: this.baseBpm,
      speed: this.cfg.baseSpeed + (this.state.isTouched ? 0 : this.bendSpeed),
    };
  }
}

class JogController {
  constructor(engine, cfg) {
    this.engine = engine;
    this.cfg = cfg;
    this.emaAlpha = cfg.wheelVelEmaAlpha;
    this.wheelVelRevPerSec = 0;
    this.prevTouched = false;
  }
  touch(down) {
    this.engine.setTouch(down);
    if (this.prevTouched && !down && this.cfg.slipEnabled) {
      this.engine.pos = this.engine.ghostPos;
    }
    this.prevTouched = down;
  }
  rotateTop(angleDeltaDeg, dtSec) {
    if (dtSec <= 0) return;
    const instRevPerSec = angleDeltaDeg / 360.0 / dtSec;
    this.wheelVelRevPerSec =
      this.emaAlpha * instRevPerSec +
      (1 - this.emaAlpha) * this.wheelVelRevPerSec;
    this.engine.setWheelVelocityRevPerSec(this.wheelVelRevPerSec);
  }
  nudgeEdge(angleDeltaDeg, dtSec) {
    if (dtSec <= 0) return;
    const deltaSpeed = angleDeltaDeg * this.cfg.bendSensitivityPerDegree;
    this.engine.addBend(deltaSpeed);
  }
}

// Pull-based stream to Speaker
class PCMStream extends Readable {
  constructor(engine, framesPerChunk = 1024) {
    super();
    this.engine = engine;
    this.framesPerChunk = framesPerChunk;
  }
  _read() {
    const buf = this.engine.renderFrames(this.framesPerChunk);
    this.push(buf);
  }
}

// Add BPM detection utilities
function detectBPMFromAudioData(audioData, sampleRate) {
  // Simple onset detection for BPM calculation
  const channelData = audioData.channelData[0]; // Use first channel
  const frameSize = Math.floor(sampleRate * 0.1); // 100ms windows
  const onsets = [];

  for (let i = 0; i < channelData.length - frameSize; i += frameSize) {
    const frame = channelData.slice(i, i + frameSize);
    const energy =
      frame.reduce((sum, sample) => sum + Math.abs(sample), 0) / frame.length;

    // Detect onset (sudden increase in energy)
    if (i > 0) {
      const prevFrame = channelData.slice(i - frameSize, i);
      const prevEnergy =
        prevFrame.reduce((sum, sample) => sum + Math.abs(sample), 0) /
        frame.length;

      if (energy > prevEnergy * 1.5) {
        // 50% increase threshold
        onsets.push(i / sampleRate);
      }
    }
  }

  // Calculate BPM from onset intervals
  if (onsets.length > 2) {
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }

    // Find most common interval (beat length)
    const beatLength = findMostCommonInterval(intervals);
    const bpm = 60 / beatLength;

    return Math.round(bpm);
  }

  return 120; // Default BPM
}

function findMostCommonInterval(intervals) {
  const buckets = {};
  intervals.forEach((interval) => {
    const rounded = Math.round(interval * 100) / 100; // Round to 2 decimal places
    buckets[rounded] = (buckets[rounded] || 0) + 1;
  });

  let maxCount = 0;
  let mostCommon = 0.5; // Default 120 BPM

  Object.entries(buckets).forEach(([interval, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = parseFloat(interval);
    }
  });

  return mostCommon;
}

// -----------------------------
// Upload server (Express)
// -----------------------------
const app = express();
app.use(cors({ origin: true }));
const upload = multer({
  dest: path_module.join(os_module.tmpdir(), "deck-uploads"),
  limits: { fileSize: 1024 * 1024 * 200 }, // 200MB
});

// Add support for other formats
const audioDecoders = {
  ".wav": WavDecoder_module.decode,
  ".mp3": null,
  ".flac": null,
  ".ogg": null,
  ".m4a": null,
};

// Add a helper function for FFmpeg decoding:
function decodeWithFFmpeg(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .toFormat("wav")
      .audioChannels(2)
      .audioFrequency(44100)
      .on("end", () => {
        // Read the converted WAV file
        const wavData = fs_module.readFileSync(filePath + ".wav");
        WavDecoder_module.decode(wavData).then(resolve).catch(reject);
        // Clean up temp file
        fs_module.unlink(filePath + ".wav", () => {});
      })
      .on("error", reject)
      .save(filePath + ".wav");
  });
}

// Store loaded tracks by ID
const tracks = new Map(); // trackId -> { audioData, info }

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const ext = path_module.extname(req.file.originalname).toLowerCase();

    let audioData;
    if (ext === ".wav") {
      const data = fs_module.readFileSync(req.file.path);
      audioData = await WavDecoder_module.decode(data);
    } else {
      // Use FFmpeg for other formats
      audioData = await decodeWithFFmpeg(req.file.path);
    }

    // Validate decoded audio data
    if (!audioData || !audioData.channelData || !audioData.sampleRate) {
      throw new Error("Invalid audio data structure after decoding");
    }

    // Warn if format mismatch
    if (audioData.sampleRate !== config.sampleRate) {
      console.warn(
        `Sample rate mismatch: file=${audioData.sampleRate}, engine=${config.sampleRate}`
      );
    }
    if (audioData.channelData.length !== config.channels) {
      console.warn(
        `Channel mismatch: file=${audioData.channelData.length}, engine=${config.channels}`
      );
    }

    const trackId = path_module.parse(req.file.filename).name;
    tracks.set(trackId, {
      audioData,
      info: {
        trackId,
        durationMs: samplesToMs(
          audioData.channelData[0].length,
          audioData.sampleRate
        ),
        sampleRate: audioData.sampleRate,
        channels: audioData.channelData.length,
        name: req.file.originalname,
      },
    });

    // Clean temp file (we keep decoded in memory)
    fs_module.unlink(req.file.path, () => {});

    res.json({ ok: true, trackId, info: tracks.get(trackId).info });
  } catch (err) {
    console.error("Upload error details:", {
      message: err.message,
      stack: err.stack,
      file: req.file?.originalname,
      format: req.file ? path_module.extname(req.file.originalname) : "unknown",
    });

    res.status(500).json({
      error: "Decode failed",
      details: err.message,
      supportedFormats: Object.keys(audioDecoders).join(", "),
      receivedFormat: req.file
        ? path_module.extname(req.file.originalname)
        : "unknown",
    });
  }
});

app.listen(config.httpPort, () =>
  console.log(`HTTP upload listening on http://localhost:${config.httpPort}`)
);

// Add error handling for audio engine
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// -----------------------------
// WebSocket bridge
// -----------------------------
const wss = new WebSocketServer({ port: config.wsPort }, () =>
  console.log(`WS listening on ws://localhost:${config.wsPort}`)
);

// Single deck (can be extended to multiple)
const deck = {
  id: "A",
  engine: null,
  jog: null,
  speaker: null,
  pcm: null,
  loadedTrackId: null,
};

function unloadDeck() {
  if (deck.pcm) deck.pcm.destroy();
  if (deck.speaker) deck.speaker.end();
  deck.engine = null;
  deck.jog = null;
  deck.loadedTrackId = null;
  deck.pcm = null;
  deck.speaker = null;
}

function loadIntoDeck(trackId) {
  const entry = tracks.get(trackId);
  if (!entry) throw new Error("Unknown trackId");

  unloadDeck();

  deck.engine = new AudioEngine(entry.audioData, { ...config });
  deck.jog = new JogController(deck.engine, deck.engine.cfg);
  deck.loadedTrackId = trackId;

  deck.speaker = new Speaker({
    sampleRate: config.sampleRate,
    channels: config.channels,
    bitDepth: config.bitDepth,
    signed: true,
    float: false,
    endianness: "LE",
  });

  deck.pcm = new PCMStream(deck.engine);
  deck.pcm.pipe(deck.speaker);
}

// Broadcast status to all clients
function deckStatus() {
  if (!deck.engine) {
    // Return a default status when no track is loaded
    return {
      type: "status",
      deckId: deck.id,
      loadedTrackId: null,
      posMs: 0,
      durationMs: 0,
      speed: 0,
      touched: false,
      paused: true,
      slip: config.slipEnabled,
      scratchSPR: config.scratchSamplesPerRevolution,
      bendMax: config.bendMax,
      status: "idle",
      bpm: 0,
    };
  }

  const e = deck.engine;
  return {
    type: "status",
    deckId: deck.id,
    loadedTrackId: deck.loadedTrackId,
    posMs: samplesToMs(e.pos, e.sampleRate),
    durationMs: samplesToMs(e.length, e.sampleRate),
    speed: e.cfg.baseSpeed + (e.state.isTouched ? 0 : e.bendSpeed),
    touched: e.state.isTouched,
    paused: e.paused,
    slip: e.cfg.slipEnabled,
    scratchSPR: e.cfg.scratchSamplesPerRevolution,
    bendMax: e.cfg.bendMax,
    status: "playing",
    bpm: deck.engine.bpm,
  };
}

function send(ws, msg) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {}
}
function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((c) => {
    if (c.readyState === wss.OPEN) c.send(data);
  });
}

// Handle client messages
wss.on("connection", (ws) => {
  // Send initial status
  const status = deckStatus();
  if (status) send(ws, status);

  // Periodic status broadcast
  let lastStatusUpdate = 0;

  setInterval(() => {
    const now = Date.now();
    const s = deckStatus();

    if (s) {
      if (s.status === "playing" && !s.paused) {
        // High frequency updates when playing (50fps for smooth canvas)
        if (now - lastStatusUpdate >= 20) {
          // 20ms = 50fps
          broadcast(s);
          lastStatusUpdate = now;
        }
      } else {
        // Lower frequency updates when idle/paused (20fps)
        if (now - lastStatusUpdate >= 50) {
          // 50ms = 20fps
          broadcast(s);
          lastStatusUpdate = now;
        }
      }
    }
  }, 16); // 60fps base loop for responsive updates

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    try {
      switch (msg.type) {
        case "loadTrack": {
          const { trackId } = msg;
          loadIntoDeck(trackId);
          send(ws, {
            type: "loaded",
            deckId: deck.id,
            info: tracks.get(trackId).info,
          });
          broadcast(deckStatus());
          deck.engine.setPaused(true);
          break;
        }
        case "play": {
          if (!deck.engine) break;
          deck.engine.setPaused(false);
          send(ws, deckStatus());
          broadcast(deckStatus());
          break;
        }
        case "pause": {
          if (!deck.engine) break;
          deck.engine.setPaused(true);
          send(ws, deckStatus());
          broadcast(deckStatus());
          break;
        }
        case "touch": {
          if (!deck.jog) break;
          deck.jog.touch(!!msg.down);
          broadcast(deckStatus());
          break;
        }
        case "rotateTop": {
          if (!deck.jog) break;
          const { angleDeltaDeg, dtSec } = msg;
          deck.jog.rotateTop(angleDeltaDeg, dtSec);
          break;
        }
        case "nudgeEdge": {
          if (!deck.jog) break;
          const { angleDeltaDeg, dtSec } = msg;
          deck.jog.nudgeEdge(angleDeltaDeg, dtSec);
          broadcast(deckStatus());
          break;
        }
        case "seekMs": {
          if (!deck.engine) break;
          const { ms } = msg;
          deck.engine.seekToSamples(msToSamples(ms, deck.engine.sampleRate));
          broadcast(deckStatus());
          break;
        }
        case "setConfig": {
          if (!deck.engine) break;
          const patch = msg.patch || {};
          deck.engine.setConfigPatch(patch);
          broadcast(deckStatus());
          break;
        }
        case "unload": {
          unloadDeck();
          broadcast({ type: "status", deckId: deck.id, loadedTrackId: null });
          break;
        }
        default:
          send(ws, { type: "error", error: "Unknown message type" });
      }
    } catch (err) {
      console.error(err);
      send(ws, { type: "error", error: err.message || "Server error" });
    }
  });
});
