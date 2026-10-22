/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AudioService - Singleton service managing Web Audio API and AudioWorklet
 * Replaces the Electron IPC audio bridge with native Web Audio API
 */

export type DeckId = 1 | 2;
export type EQBand = 'low' | 'mid' | 'high';

export interface DeckEQFilters {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
}

export interface DeckState {
  sourceNode: AudioBufferSourceNode | null;
  workletNode: AudioWorkletNode | null;
  gainNode: GainNode | null;
  eqFilters: DeckEQFilters | null;
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  startTime: number;
  pauseTime: number;
  volume: number;
  cuePoint: number;
  baseBPM: number;
  currentBPM: number;
  pitch: number;
  isSynced: boolean;
  /** True once the static audio graph (EQ chain → gain → crossfader) has been wired. Prevents duplicate connections. */
  graphConnected: boolean;
}

class AudioService {
  private static instance: AudioService;
  private static initializationPromise: Promise<void> | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private masterGain: GainNode | null = null;
  private crossfaderGain: GainNode | null = null;
  private headphoneGain: GainNode | null = null;
  private decks: Map<DeckId, DeckState> = new Map();
  private initialized = false;
  private masterDestination: MediaStreamAudioDestinationNode | null = null;
  private headphoneDestination: MediaStreamAudioDestinationNode | null = null;
  private masterStream: MediaStream | null = null;
  private headphoneStream: MediaStream | null = null;
  private deckHeadphoneGains: Map<DeckId, GainNode> = new Map();
  private headphoneRouting: Map<DeckId, boolean> = new Map();
  private deckCrossfaderGains: Map<DeckId, GainNode> = new Map(); // Crossfader gain for each deck
  private crossfaderValue: number = 0.5; // Current crossfader position (0.0 = Deck A, 0.5 = Center, 1.0 = Deck B)
  private positionUpdateCallbacks: Map<
    DeckId,
    Set<(position: number) => void>
  > = new Map();
  private positionUpdateInterval: number | null = null;
  private defaultAudioElement: HTMLAudioElement | null = null;

  private constructor() {
    // Initialize deck states
    this.decks.set(1, {
      sourceNode: null,
      workletNode: null,
      gainNode: null,
      eqFilters: null,
      audioBuffer: null,
      isPlaying: false,
      startTime: 0,
      pauseTime: 0,
      volume: 1.0,
      cuePoint: 0,
      baseBPM: 120,
      currentBPM: 120,
      pitch: 0,
      isSynced: false,
      graphConnected: false,
    });
    this.decks.set(2, {
      sourceNode: null,
      workletNode: null,
      gainNode: null,
      eqFilters: null,
      audioBuffer: null,
      isPlaying: false,
      startTime: 0,
      pauseTime: 0,
      volume: 1.0,
      cuePoint: 0,
      baseBPM: 120,
      currentBPM: 120,
      pitch: 0,
      isSynced: false,
      graphConnected: false,
    });
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (AudioService.initializationPromise) {
      return AudioService.initializationPromise;
    }

    console.log("Initializing AudioService...");

    AudioService.initializationPromise = (async () => {
      // Create AudioContext
      this.audioContext = new AudioContext({
        latencyHint: "interactive",
        sampleRate: 44100,
      });

      // Resume context if suspended (required by some browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Ensure AudioContext is running
      if (this.audioContext.state !== "running") {
        await this.audioContext.resume();
      }
      console.log(`🔊 AudioContext state: ${this.audioContext.state}`);

      // Load AudioWorklet processor
      // Construct path relative to current location for Electron compatibility
      // In Electron with file:// protocol, we need to use new URL() to resolve relative paths
      const workletPath = new URL("./audio-processor.js", window.location.href)
        .href;
      try {
        console.log("Loading AudioWorklet from:", workletPath);
        await this.audioContext.audioWorklet.addModule(workletPath);
        console.log("AudioWorklet module loaded successfully");

        // Small delay to ensure processor registration completes
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch (error) {
        console.error("Failed to load AudioWorklet module:", error);
        console.error("Attempted path:", workletPath);
        console.error("Current location:", window.location.href);
        // Try fallback with relative path
        try {
          console.log("Trying fallback path: ./audio-processor.js");
          await this.audioContext.audioWorklet.addModule(
            "./audio-processor.js"
          );
          console.log("AudioWorklet module loaded with fallback path");
          // Small delay to ensure processor registration completes
          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch (fallbackError) {
          console.error("Fallback path also failed:", fallbackError);
          throw error; // Throw original error
        }
      }

      // Create independent AudioWorkletNode for each deck (strict graph separation)
      for (const deckId of [1, 2] as const) {
        const deck = this.decks.get(deckId);
        if (deck) {
          try {
            const workletNode = new AudioWorkletNode(
              this.audioContext,
              "dj-audio-processor",
              {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 2, // Stereo
                channelCountMode: "explicit",
                processorOptions: { deckId },
              }
            );

            // Set up message handler per worklet
            workletNode.port.onmessage = (event) => {
              if (event.data.type === "WASM_READY") {
                console.log(
                  `✅ Wasm module loaded and ready in AudioWorklet for deck ${deckId}`
                );
              } else if (event.data.type === "ERROR") {
                console.error(
                  `❌ AudioWorklet error for deck ${deckId}:`,
                  event.data.message
                );
              } else {
                console.log(`AudioWorklet message for deck ${deckId}:`, event.data);
              }
            };

            deck.workletNode = workletNode;
            console.log(`AudioWorkletNode created successfully for deck ${deckId}`);
          } catch (error) {
            console.error(`Failed to create AudioWorkletNode for deck ${deckId}:`, error);
            console.error(
              "This usually means the processor wasn't registered. Check audio-processor.js for errors."
            );
            throw error;
          }
        }
      }

      // Legacy fallback and primary worklet reference
      this.workletNode = this.decks.get(1)?.workletNode ?? null;

      // Create gain nodes
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1.0;

      this.crossfaderGain = this.audioContext.createGain();
      this.crossfaderGain.gain.value = 1.0;

      this.headphoneGain = this.audioContext.createGain();
      this.headphoneGain.gain.value = 0.7;

      // Create MediaStream destinations for device selection
      this.masterDestination = this.audioContext.createMediaStreamDestination();
      this.headphoneDestination =
        this.audioContext.createMediaStreamDestination();
      this.masterStream = this.masterDestination.stream;
      this.headphoneStream = this.headphoneDestination.stream;

      // Create crossfader gain nodes for each deck (Constant Power Center ~0.7071)
      // NOTE: Do NOT connect to destinations here — setupDeckAudioGraph() below handles
      // the full chain (worklet -> EQ -> gain -> crossfader -> destination).
      // Connecting here AND in setupDeckAudioGraph would double the signal.
      const initialConstantPowerGain = Math.SQRT1_2;
      for (const deckId of [1, 2] as const) {
        const deckCrossfaderGain = this.audioContext.createGain();
        deckCrossfaderGain.gain.value = initialConstantPowerGain;
        this.deckCrossfaderGains.set(deckId, deckCrossfaderGain);
      }
      console.log(`✅ Crossfader gain nodes created (initial gain: ${initialConstantPowerGain.toFixed(4)})`);

      // Initialize audio graph for both decks (EQ -> gain -> crossfader -> destination)
      this.setupDeckAudioGraph(1);
      this.setupDeckAudioGraph(2);

      // Create Audio element to play the master stream (REQUIRED for MediaStream to work)
      this.defaultAudioElement = new Audio();
      this.defaultAudioElement.srcObject = this.masterStream;
      this.defaultAudioElement.volume = 1.0;
      this.defaultAudioElement.autoplay = true;

      // Set up event handlers for debugging
      this.defaultAudioElement.onplay = () => {
        console.log("✅ Default audio element started playing");
      };
      this.defaultAudioElement.onpause = () => {
        console.warn("⚠️ Default audio element paused");
      };
      this.defaultAudioElement.onerror = (error) => {
        console.error("❌ Default audio element error:", error);
      };
      this.defaultAudioElement.onloadedmetadata = () => {
        console.log("📊 Audio element metadata loaded");
      };

      // Try to start playing the master stream (required for audio output)
      try {
        const playPromise = this.defaultAudioElement.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log("🔊 Default audio element started playing master stream");
        }
      } catch (error) {
        console.warn(
          "⚠️ Could not auto-play master stream (will try on user interaction):",
          error
        );
        console.warn("⚠️ Audio will start when user clicks play button");
      }

      // Create headphone gain nodes for each deck (pre-fader routing)
      const deck1HeadphoneGain = this.audioContext.createGain();
      deck1HeadphoneGain.gain.value = 0;
      this.deckHeadphoneGains.set(1, deck1HeadphoneGain);

      const deck2HeadphoneGain = this.audioContext.createGain();
      deck2HeadphoneGain.gain.value = 0;
      this.deckHeadphoneGains.set(2, deck2HeadphoneGain);

      // Connect headphone gains to headphone output
      deck1HeadphoneGain.connect(this.headphoneGain);
      deck2HeadphoneGain.connect(this.headphoneGain);
      this.headphoneGain.connect(this.headphoneDestination);

      // Initialize headphone routing state
      this.headphoneRouting.set(1, false);
      this.headphoneRouting.set(2, false);

      // Initialize position update callbacks
      this.positionUpdateCallbacks.set(1, new Set());
      this.positionUpdateCallbacks.set(2, new Set());

      // Start position update loop
      this.startPositionUpdates();

      // Load Wasm module
      await this.loadWasmModule();

      // Final AudioContext state check
      if (this.audioContext.state !== "running") {
        console.warn(
          `⚠️ AudioContext state is ${this.audioContext.state}, attempting to resume...`
        );
        await this.audioContext.resume();
        console.log(
          `🔊 AudioContext state after resume: ${this.audioContext.state}`
        );
      }

      // Initialize crossfader to center position (Constant Power Center = 0.5)
      this.setCrossfader(0.5);

      this.initialized = true;
      console.log("✅ AudioService initialized successfully");
      console.log(`🔊 Final AudioContext state: ${this.audioContext.state}`);
    })();

    try {
      await AudioService.initializationPromise;
    } catch (error) {
      AudioService.initializationPromise = null;
      console.error("Failed to initialize AudioService:", error);
      throw error;
    }
  }

  private async loadWasmModule(): Promise<void> {
    try {
      // Load Wasm module bytes to send to worklet
      // ArrayBuffer is cloneable via postMessage, functions are not
      const wasmPath = new URL("./audio_processor.wasm", window.location.href)
        .href;
      console.log("Loading Wasm module from:", wasmPath);

      const wasmResponse = await fetch(wasmPath);
      if (!wasmResponse.ok) {
        throw new Error(
          `Failed to fetch Wasm module: ${wasmResponse.statusText}`
        );
      }

      const wasmBytes = await wasmResponse.arrayBuffer();
      console.log("Wasm module loaded, size:", wasmBytes.byteLength, "bytes");

      // Also fetch the JS glue code (fetch is not available in AudioWorklet)
      const jsPath = new URL("./audio_processor.js", window.location.href).href;
      console.log("Loading Wasm JS glue code from:", jsPath);

      const jsResponse = await fetch(jsPath);
      if (!jsResponse.ok) {
        throw new Error(
          `Failed to fetch Wasm JS glue code: ${jsResponse.statusText}`
        );
      }

      const jsCode = await jsResponse.text();
      console.log("Wasm JS glue code loaded, size:", jsCode.length, "chars");

      // Send Wasm bytes and JS code to all deck worklets
      for (const [deckId, deck] of this.decks.entries()) {
        if (deck.workletNode) {
          deck.workletNode.port.postMessage({
            type: "LOAD_WASM",
            wasmBytes: wasmBytes,
            wasmJsCode: jsCode,
            deckId,
          });
        }
      }
      if (
        this.workletNode &&
        !Array.from(this.decks.values()).some((d) => d.workletNode === this.workletNode)
      ) {
        this.workletNode.port.postMessage({
          type: "LOAD_WASM",
          wasmBytes: wasmBytes,
          wasmJsCode: jsCode,
        });
      }
    } catch (error) {
      console.error("Failed to load Wasm module:", error);
      const errorMsg =
        `Failed to load Wasm module. Make sure you have built the Wasm module using: cd cpp && ./build_wasm.ps1. ` +
        `The audio_processor.js and audio_processor.wasm files should be in the public/ folder.`;
      throw new Error(errorMsg);
    }
  }

  async loadTrack(
    deckId: DeckId,
    source: ArrayBuffer | Blob | string | Uint8Array
  ): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error("AudioService not initialized");
    }

    try {
      let arrayBuffer: ArrayBuffer;

      if (source instanceof ArrayBuffer) {
        arrayBuffer = source;
      } else if (source instanceof Uint8Array) {
        arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
      } else if (source instanceof Blob) {
        // Blob or File: direct native arrayBuffer conversion
        arrayBuffer = await source.arrayBuffer();
      } else if (typeof source === "string") {
        const res = await fetch(source);
        if (!res.ok) throw new Error(`HTTP error fetching audio: ${res.statusText}`);
        arrayBuffer = await res.arrayBuffer();
      } else {
        throw new Error("Unsupported audio source type");
      }

      // Safeguard: Ensure AudioContext is running before decodeAudioData
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Decode audio data safely with try/catch
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Get deck state
      const deck = this.decks.get(deckId);
      if (!deck) {
        throw new Error(`Invalid deck ID: ${deckId}`);
      }

      // Stop current playback if playing
      if (deck.isPlaying && deck.sourceNode) {
        this.pause(deckId);
      }

      // Store audio buffer
      deck.audioBuffer = audioBuffer;
      deck.pauseTime = 0;

      console.log(`Track loaded for deck ${deckId}:`, {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      });

      return audioBuffer;
    } catch (error) {
      console.error(`❌ Failed to load track for deck ${deckId}:`, error);
      throw error;
    }
  }

  getDeckAudioBuffer(deckId: DeckId): AudioBuffer | null {
    return this.decks.get(deckId)?.audioBuffer || null;
  }

  async play(deckId: DeckId): Promise<void> {
    if (!this.audioContext || !this.workletNode) {
      throw new Error("AudioService not initialized");
    }

    // Ensure AudioContext is running
    if (this.audioContext.state === "suspended") {
      console.log("⏸️ AudioContext suspended, resuming...");
      await this.audioContext.resume();
      console.log(`🔊 AudioContext state: ${this.audioContext.state}`);
    }

    const deck = this.decks.get(deckId);
    if (!deck || !deck.audioBuffer) {
      console.warn(`Cannot play deck ${deckId}: no track loaded`);
      return;
    }

    if (deck.isPlaying) {
      console.log(
        `▶️ Play called for deck ${deckId} but already playing (sourceNode=${!!deck.sourceNode})`
      );
      return; // Already playing
    }

    console.log(`▶️ Play deck ${deckId} | offset=${deck.pauseTime.toFixed(2)}s`);

    // Ensure any existing source node is stopped and disconnected without firing onended
    if (deck.sourceNode) {
      try {
        deck.sourceNode.onended = null;
        deck.sourceNode.stop();
        deck.sourceNode.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
      deck.sourceNode = null;
    }

    // Create new source node
    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = deck.audioBuffer;
    sourceNode.loop = true;
    sourceNode.loopStart = 0;
    sourceNode.loopEnd = deck.audioBuffer.duration;

    // Ensure 3-band Isolator EQ graph, worklet, and channel gain node are ready.
    // setupDeckAudioGraph is idempotent — it only wires nodes once (guarded by graphConnected).
    if (!deck.graphConnected) {
      this.setupDeckAudioGraph(deckId);
    }

    // Connect the newly-created source into the persistent static graph.
    // Only source->worklet is re-connected each play (AudioBufferSourceNode is one-shot).
    // All downstream nodes (worklet -> EQ -> gain -> crossfader -> destination) are permanent.
    if (deck.workletNode) {
      sourceNode.connect(deck.workletNode);
    } else if (deck.eqFilters) {
      // Fallback when worklet is unavailable
      sourceNode.connect(deck.eqFilters.low);
    }

    // Pre-fader headphone monitoring
    const headphoneGain = this.deckHeadphoneGains.get(deckId);
    if (headphoneGain) {
      sourceNode.connect(headphoneGain);
    }

    // Calculate start offset
    const startOffset = deck.pauseTime;

    // Ensure default audio element is playing (required for MediaStream in Electron)
    if (this.defaultAudioElement?.paused) {
      try {
        await this.defaultAudioElement.play();
      } catch (e) {
        console.error(`❌ Could not play audio element:`, e);
      }
    }

    if (!deck.audioBuffer) {
      console.error(`❌ No audio buffer for deck ${deckId}!`);
      return;
    }

    deck.sourceNode = sourceNode;

    // Start playback
    try {
      sourceNode.start(0, startOffset);
    } catch (error) {
      console.error(`❌ Failed to start source node for deck ${deckId}:`, error);
      deck.sourceNode = null;
      throw error;
    }

    // Set deck active in its dedicated worklet
    deck.workletNode?.port.postMessage({
      type: "SET_DECK_ACTIVE",
      deck: deckId,
      active: true,
    });
    if (this.workletNode && this.workletNode !== deck.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_DECK_ACTIVE",
        deck: deckId,
        active: true,
      });
    }

    // Handle end of playback (shouldn't happen with loop=true, but handle it anyway)
    sourceNode.onended = () => {
      console.warn(
        `⚠️ Source node ended for deck ${deckId} (this shouldn't happen with loop=true)`
      );
      console.warn(
        `⚠️ Loop was: ${sourceNode.loop}, loopStart: ${sourceNode.loopStart}, loopEnd: ${sourceNode.loopEnd}`
      );
      console.warn(
        `⚠️ Deck isPlaying: ${deck.isPlaying
        }, has buffer: ${!!deck.audioBuffer}`
      );

      // With loop=true, onended shouldn't fire, but if it does, restart playback
      if (deck.isPlaying && deck.audioBuffer) {
        // Restart from current position
        const currentTime = this.audioContext
          ? this.audioContext.currentTime - deck.startTime
          : deck.pauseTime;
        deck.pauseTime = currentTime % deck.audioBuffer.duration;
        console.log(
          `🔄 Restarting playback for deck ${deckId} from position ${deck.pauseTime.toFixed(
            2
          )}s`
        );
        this.play(deckId);
      } else {
        console.log(`⏹️ Stopping deck ${deckId} (not playing or no buffer)`);
        deck.isPlaying = false;
        deck.startTime = 0;
        deck.pauseTime = 0;
        deck.workletNode?.port.postMessage({
          type: "SET_DECK_ACTIVE",
          deck: deckId,
          active: false,
        });
        if (this.workletNode && this.workletNode !== deck.workletNode) {
          this.workletNode.port.postMessage({
            type: "SET_DECK_ACTIVE",
            deck: deckId,
            active: false,
          });
        }
      }
    };

    // Update deck state
    deck.isPlaying = true;
    deck.startTime = this.audioContext.currentTime - startOffset;
    console.log(`✅ Deck ${deckId} playing | startTime=${deck.startTime.toFixed(2)}s`);

    // Immediately emit position update to ensure UI is in sync
    const callbacks = this.positionUpdateCallbacks.get(deckId);
    if (callbacks && deck.audioBuffer) {
      callbacks.forEach((callback) =>
        callback(startOffset % deck.audioBuffer.duration)
      );
    }
  }

  pause(deckId: DeckId): void {
    const deck = this.decks.get(deckId);
    if (!deck || !deck.isPlaying || !deck.sourceNode) {
      console.log(
        `⏸️ Pause called for deck ${deckId} but not playing (isPlaying=${deck?.isPlaying
        }, hasSourceNode=${!!deck?.sourceNode})`
      );
      return;
    }

    console.log(`⏸️ Pausing deck ${deckId}`);

    // Calculate pause time
    if (this.audioContext && deck.audioBuffer) {
      const elapsed = this.audioContext.currentTime - deck.startTime;
      deck.pauseTime = elapsed % deck.audioBuffer.duration;
      console.log(
        `⏸️ Calculated pause time: ${deck.pauseTime.toFixed(
          2
        )}s (elapsed: ${elapsed.toFixed(
          2
        )}s, duration: ${deck.audioBuffer.duration.toFixed(2)}s)`
      );
    }

    // Stop source node
    try {
      // Nullify the handler BEFORE stopping to prevent the false 'ended' event
      deck.sourceNode.onended = null;
      deck.sourceNode.stop();
      console.log(`⏸️ Stopped source node for deck ${deckId}`);
    } catch (error) {
      console.warn(`⚠️ Error stopping source node for deck ${deckId}:`, error);
    }

    try {
      deck.sourceNode.disconnect();
      console.log(`⏸️ Disconnected source node for deck ${deckId}`);
    } catch (error) {
      console.warn(
        `⚠️ Error disconnecting source node for deck ${deckId}:`,
        error
      );
    }

    // Set deck inactive in worklet
    deck.workletNode?.port.postMessage({
      type: "SET_DECK_ACTIVE",
      deck: deckId,
      active: false,
    });
    if (this.workletNode && this.workletNode !== deck.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_DECK_ACTIVE",
        deck: deckId,
        active: false,
      });
    }

    // Update state
    deck.sourceNode = null;
    deck.isPlaying = false;
    deck.startTime = 0;

    // Emit position update with pauseTime when paused
    const callbacks = this.positionUpdateCallbacks.get(deckId);
    if (callbacks && deck.audioBuffer) {
      callbacks.forEach((callback) => callback(deck.pauseTime));
    }
  }

  setCuePoint(deckId: DeckId, position: number): void {
    const deck = this.decks.get(deckId);
    if (deck && deck.audioBuffer) {
      deck.cuePoint = Math.max(
        0,
        Math.min(position, deck.audioBuffer.duration)
      );
    }
  }

  cue(deckId: DeckId, pressed: boolean): void {
    const deck = this.decks.get(deckId);
    if (!deck || !deck.audioBuffer) {
      return;
    }

    if (pressed) {
      // If not playing, set cue point to current position
      if (!deck.isPlaying) {
        if (this.audioContext && deck.startTime > 0) {
          const elapsed = this.audioContext.currentTime - deck.startTime;
          deck.cuePoint = elapsed % deck.audioBuffer.duration;
        }
      }
      // Play from cue point
      if (!deck.isPlaying) {
        deck.pauseTime = deck.cuePoint;
        this.play(deckId);
      }
    } else {
      // Release: if not playing normally, return to cue point
      if (!deck.isPlaying) {
        // Already stopped, just ensure we're at cue point
        deck.pauseTime = deck.cuePoint;
      } else {
        // Check if this was a cue play (not normal play)
        // For now, we'll pause and return to cue point
        const wasPlaying = deck.isPlaying;
        this.pause(deckId);
        if (wasPlaying) {
          deck.pauseTime = deck.cuePoint;
        }
      }
    }
  }

  seek(deckId: DeckId, position: number): void {
    const deck = this.decks.get(deckId);
    if (!deck || !deck.audioBuffer) {
      return;
    }

    const wasPlaying = deck.isPlaying;
    if (wasPlaying) {
      this.pause(deckId);
    }

    deck.pauseTime = Math.max(0, Math.min(position, deck.audioBuffer.duration));

    // Immediately emit position update
    const callbacks = this.positionUpdateCallbacks.get(deckId);
    if (callbacks) {
      callbacks.forEach((callback) => callback(deck.pauseTime));
    }

    if (wasPlaying) {
      this.play(deckId);
    }
  }

  scratch(deckId: DeckId, delta: number): void {
    const deck = this.decks.get(deckId);
    if (!deck || !deck.audioBuffer) {
      return;
    }

    // Calculate position change from scratch delta
    // delta is in radians, convert to time change
    const scratchSensitivity = 0.1; // Adjust for sensitivity
    const timeChange =
      (delta * deck.audioBuffer.duration * scratchSensitivity) / (Math.PI * 2);

    // Update position
    const newPosition = Math.max(
      0,
      Math.min(deck.audioBuffer.duration, deck.pauseTime + timeChange)
    );
    deck.pauseTime = newPosition;

    // If playing, we need to recreate the source node with new position
    if (deck.isPlaying && deck.sourceNode) {
      const wasPlaying = true;
      this.pause(deckId);
      deck.pauseTime = newPosition;
      this.play(deckId);
    }
  }

  setVolume(deckId: DeckId, volume: number): void {
    // Update deck state
    const deck = this.decks.get(deckId);
    if (deck) {
      deck.volume = volume;
      // Update Web Audio API gain node
      if (deck.gainNode) {
        deck.gainNode.gain.value = volume;
      }
      // Send to deck Wasm processor
      deck.workletNode?.port.postMessage({
        type: "SET_DECK_VOLUME",
        deck: deckId,
        value: volume,
      });
    }

    if (this.workletNode && this.workletNode !== deck?.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_DECK_VOLUME",
        deck: deckId,
        value: volume,
      });
    }
  }

  setPitch(deckId: DeckId, pitch: number): void {
    // Update deck state
    const deck = this.decks.get(deckId);
    if (deck) {
      deck.pitch = pitch;
      // Calculate current BPM: BPM = baseBPM * 2^pitch
      deck.currentBPM = deck.baseBPM * Math.pow(2, pitch);
      // Send to deck Wasm processor
      deck.workletNode?.port.postMessage({
        type: "SET_DECK_PITCH",
        deck: deckId,
        value: pitch,
      });
    }

    if (this.workletNode && this.workletNode !== deck?.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_DECK_PITCH",
        deck: deckId,
        value: pitch,
      });
    }

    // If sync is enabled, update synced deck
    this.updateSync(deckId);

    // Also update playback rate on source node if playing
    if (deck?.sourceNode) {
      const playbackRate = Math.pow(2, pitch);
      deck.sourceNode.playbackRate.value = playbackRate;
    }
  }

  setBaseBPM(deckId: DeckId, bpm: number): void {
    const deck = this.decks.get(deckId);
    if (deck) {
      deck.baseBPM = bpm;
      // Recalculate current BPM with current pitch
      deck.currentBPM = deck.baseBPM * Math.pow(2, deck.pitch);
      // Update sync if enabled
      this.updateSync(deckId);
    }
  }

  setSync(deckId: DeckId, enabled: boolean): void {
    const deck = this.decks.get(deckId);
    if (deck) {
      deck.isSynced = enabled;
      if (enabled) {
        this.updateSync(deckId);
      }
    }
  }

  isDeckSynced(deckId: DeckId): boolean {
    return this.decks.get(deckId)?.isSynced ?? false;
  }

  private updateSync(syncedDeckId: DeckId): void {
    const syncedDeck = this.decks.get(syncedDeckId);
    if (!syncedDeck || !syncedDeck.isSynced) {
      return;
    }

    // Find the master deck (the other deck)
    const masterDeckId: DeckId = syncedDeckId === 1 ? 2 : 1;
    const masterDeck = this.decks.get(masterDeckId);

    if (!masterDeck || !masterDeck.audioBuffer) {
      return;
    }

    // Calculate required pitch to match master BPM
    // targetBPM = masterDeck.currentBPM
    // currentBPM = syncedDeck.baseBPM * 2^syncedDeck.pitch
    // We want: syncedDeck.baseBPM * 2^newPitch = masterDeck.currentBPM
    // So: 2^newPitch = masterDeck.currentBPM / syncedDeck.baseBPM
    // newPitch = log2(masterDeck.currentBPM / syncedDeck.baseBPM)
    const targetBPM = masterDeck.currentBPM;
    const requiredPitch = Math.log2(targetBPM / syncedDeck.baseBPM);

    // Clamp pitch to reasonable range (-1 to +1, which is -100% to +100%)
    const clampedPitch = Math.max(-1, Math.min(1, requiredPitch));

    // Update pitch (this will trigger another updateSync, but it should be idempotent)
    if (Math.abs(syncedDeck.pitch - clampedPitch) > 0.001) {
      syncedDeck.pitch = clampedPitch;
      syncedDeck.currentBPM = syncedDeck.baseBPM * Math.pow(2, clampedPitch);

      // Send pitch update to Wasm
      if (this.workletNode) {
        this.workletNode.port.postMessage({
          type: "SET_DECK_PITCH",
          deck: syncedDeckId,
          value: clampedPitch,
        });
      }

      // Update playback rate
      if (syncedDeck.sourceNode) {
        const playbackRate = Math.pow(2, clampedPitch);
        syncedDeck.sourceNode.playbackRate.value = playbackRate;
      }
    }
  }

  public normalizeDeckId(deckId: string | number): DeckId {
    if (typeof deckId === "number") {
      return deckId === 2 ? 2 : 1;
    }
    const clean = String(deckId).toLowerCase().trim();
    if (
      clean === "deck2" ||
      clean === "2" ||
      clean === "deck_b" ||
      clean === "b"
    ) {
      return 2;
    }
    return 1;
  }

  public setupDeckAudioGraph(deckId: DeckId): void {
    if (!this.audioContext) return;
    const deck = this.decks.get(deckId);
    if (!deck) return;

    // Guard: only wire the static graph once per deck to prevent duplicate connections
    // which would cause audio duplication (signal summed N times).
    if (deck.graphConnected) return;

    // 1. Ensure independent AudioWorkletNode exists for this deck
    if (!deck.workletNode) {
      try {
        deck.workletNode = new AudioWorkletNode(
          this.audioContext,
          "dj-audio-processor",
          {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 2,
            channelCountMode: "explicit",
            processorOptions: { deckId },
          }
        );
      } catch (e) {
        // Fallback if worklet processor is not registered in mock environment
      }
    }

    // 2. Create 3-band Isolator EQ BiquadFilterNodes
    if (!deck.eqFilters) {
      // Low Shelf filter: 250 Hz
      const lowFilter = this.audioContext.createBiquadFilter();
      lowFilter.type = "lowshelf";
      lowFilter.frequency.value = 250;
      lowFilter.gain.value = 0; // 0 dB flat

      // Mid Peaking filter: 1000 Hz, Q = 1.0
      const midFilter = this.audioContext.createBiquadFilter();
      midFilter.type = "peaking";
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1.0;
      midFilter.gain.value = 0; // 0 dB flat

      // High Shelf filter: 4000 Hz
      const highFilter = this.audioContext.createBiquadFilter();
      highFilter.type = "highshelf";
      highFilter.frequency.value = 4000;
      highFilter.gain.value = 0; // 0 dB flat

      // Internal EQ chain: Low -> Mid -> High
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);

      deck.eqFilters = {
        low: lowFilter,
        mid: midFilter,
        high: highFilter,
      };
    }

    // 3. Connect Worklet output -> EQ Low input
    if (deck.workletNode && deck.eqFilters) {
      deck.workletNode.connect(deck.eqFilters.low);
    }

    // 4. Create persistent deck volume GainNode
    if (!deck.gainNode) {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = deck.volume ?? 1.0;
      deck.gainNode = gainNode;
    }

    // 5. Connect EQ High output -> GainNode
    if (deck.eqFilters) {
      deck.eqFilters.high.connect(deck.gainNode);
    }

    // 6. Connect GainNode -> CrossfaderGain -> Destinations
    const crossfaderGain = this.deckCrossfaderGains.get(deckId);
    if (crossfaderGain) {
      deck.gainNode.connect(crossfaderGain);
      crossfaderGain.connect(this.audioContext.destination);
      if (this.masterDestination) {
        crossfaderGain.connect(this.masterDestination);
      }
    }

    // Mark graph as wired — never connect these static nodes again
    deck.graphConnected = true;
    console.log(`🔗 Audio graph wired for deck ${deckId}: worklet -> EQ(low->mid->high) -> gain -> crossfader -> output`);
  }

  getDeckEQFilters(deckId: string | number): DeckEQFilters | null {
    const id = this.normalizeDeckId(deckId);
    return this.decks.get(id)?.eqFilters ?? null;
  }

  setDeckEQ(
    deckId: string | number,
    band: EQBand,
    value: number
  ): void {
    const id = this.normalizeDeckId(deckId);
    const deck = this.decks.get(id);
    if (!deck?.eqFilters) return;

    // Normalizing incoming value:
    // UI value comes in as 0.0 to 1.0 (0.5 flat / center).
    // Defensively handle bipolar [-1.0, 1.0] if negative:
    const normVal =
      value < 0
        ? Math.max(0, Math.min(1, (value + 1) * 0.5))
        : Math.max(0, Math.min(1, value));

    // Map [0.0, 1.0] to decibels (dB):
    // 0.0 = -40dB (kill)
    // 0.5 = 0dB (flat)
    // 1.0 = +6dB (boost)
    let targetDb: number;
    if (normVal <= 0.5) {
      targetDb = -40 + (normVal / 0.5) * 40; // (normVal - 0.5) * 80
    } else {
      targetDb = ((normVal - 0.5) / 0.5) * 6; // (normVal - 0.5) * 12
    }

    const filter = deck.eqFilters[band];
    if (!filter) return;

    const currentTime = this.audioContext?.currentTime ?? 0;
    const timeConstant = 0.015; // 15ms exponential transition to eliminate clicks/zipper noise

    if (this.audioContext && this.audioContext.state === "running") {
      filter.gain.setTargetAtTime(targetDb, currentTime, timeConstant);
    } else {
      filter.gain.value = targetDb;
    }

    // Forward to AudioWorklet (for Wasm DSP)
    const bandIndex = band === "low" ? 0 : band === "mid" ? 1 : 2;
    const eqMessage = {
      type: "SET_DECK_EQ",
      deck: id,
      band: bandIndex,
      value: normVal,
    };
    deck.workletNode?.port.postMessage(eqMessage);
    if (this.workletNode && this.workletNode !== deck.workletNode) {
      this.workletNode.port.postMessage(eqMessage);
    }
  }

  setEQ(
    deckId: DeckId | string,
    band: number | EQBand,
    value: number
  ): void {
    let bandName: EQBand;
    if (typeof band === "string") {
      bandName = band;
    } else if (band === 0) {
      bandName = "low";
    } else if (band === 1) {
      bandName = "mid";
    } else {
      bandName = "high";
    }
    this.setDeckEQ(deckId, bandName, value);
  }

  get fxWorkletNode(): AudioWorkletNode | null {
    return this.workletNode;
  }

  getDeckWorkletNode(deckId: string | number): AudioWorkletNode | null {
    const id = this.normalizeDeckId(deckId);
    return this.decks.get(id)?.workletNode ?? null;
  }

  public getEffectIndex(effectName: string | number): number {
    if (typeof effectName === 'number') return effectName;
    const name = String(effectName).toLowerCase().trim();
    switch (name) {
      case 'filter':
      case 'fx2':
        return 1;
      case 'echo':
      case 'fx3':
        return 2;
      case 'reverb':
      case 'fx4':
        return 3;
      case 'flanger':
      case 'fx1':
      default:
        return 0;
    }
  }

  setEffectState(
    deckId: string | number,
    effectName: string,
    isActive: boolean,
    amount: number = 1.0
  ): void {
    const id = this.normalizeDeckId(deckId);
    const targetDeck = this.decks.get(id);
    const targetWorklet = targetDeck?.workletNode;

    const payload = {
      type: 'UPDATE_FX',
      payload: { deckId, effectName, isActive, amount },
    };

    if (targetWorklet) {
      targetWorklet.port.postMessage(payload);
    }

    // Also dispatch to fxWorkletNode if distinct (supports tests spying on fxWorkletNode)
    if (this.fxWorkletNode && this.fxWorkletNode !== targetWorklet) {
      this.fxWorkletNode.port.postMessage(payload);
    }
  }

  setEffect(deckId: DeckId, effect: number, enabled: boolean): void {
    const deck = this.decks.get(deckId);
    const message = {
      type: "SET_DECK_EFFECT",
      deck: deckId,
      effect,
      enabled,
    };
    deck?.workletNode?.port.postMessage(message);
    if (this.workletNode && this.workletNode !== deck?.workletNode) {
      this.workletNode.port.postMessage(message);
    }

    const effectNames = ['flanger', 'filter', 'echo', 'reverb'];
    const effectName = effectNames[effect] || 'flanger';
    this.setEffectState(deckId, effectName, enabled, enabled ? 1.0 : 0.0);
  }

  setFilter(deckId: DeckId, cutoff: number): void {
    const deck = this.decks.get(deckId);
    const message = {
      type: "SET_DECK_FILTER",
      deck: deckId,
      cutoff,
    };
    deck?.workletNode?.port.postMessage(message);
    if (this.workletNode && this.workletNode !== deck?.workletNode) {
      this.workletNode.port.postMessage(message);
    }
  }

  setBrowsePosition(position: number): void {
    // This is a UI-only state; audio does not directly change.
    // Caller can use this to navigate a library list.
    console.log(`Browse position set to: ${position}`);
  }

  setCrossfader(value: number): void {
    // Incoming crossfader value ranges from 0.0 (Deck A only) to 1.0 (Deck B only), with 0.5 being center.
    // Defensively handle bipolar values [-1.0, 1.0] by converting to [0.0, 1.0].
    const normalizedValue = value < 0
      ? Math.max(0, Math.min(1, (value + 1) * 0.5))
      : Math.max(0, Math.min(1, value));

    this.crossfaderValue = normalizedValue;

    // Constant Power Crossfader Curve (Equal Power Crossfade):
    // - Deck A Gain: Math.cos(value * 0.5 * Math.PI)
    // - Deck B Gain: Math.sin(value * 0.5 * Math.PI)
    // At center (0.5), both gains are cos(pi/4) = sin(pi/4) = 1/sqrt(2) ≈ 0.7071.
    // Sum of acoustic powers: cos²(θ) + sin²(θ) = 1.0 (eliminates center volume drop/hole).
    const angle = normalizedValue * 0.5 * Math.PI;
    const deck1Gain = Math.cos(angle);
    const deck2Gain = Math.sin(angle);

    // Update crossfader gain nodes with smooth transition to prevent zipper noise
    const deck1CrossfaderGain = this.deckCrossfaderGains.get(1);
    const deck2CrossfaderGain = this.deckCrossfaderGains.get(2);

    const currentTime = this.audioContext?.currentTime ?? 0;
    const timeConstant = 0.015; // 15ms exponential transition to eliminate clicks/zipper noise

    if (deck1CrossfaderGain) {
      if (this.audioContext && this.audioContext.state === "running") {
        deck1CrossfaderGain.gain.setTargetAtTime(deck1Gain, currentTime, timeConstant);
      } else {
        deck1CrossfaderGain.gain.value = deck1Gain;
      }
      console.log(`🎚️ Deck 1 crossfader gain set to: ${deck1Gain.toFixed(3)} (Constant Power)`);
    }

    if (deck2CrossfaderGain) {
      if (this.audioContext && this.audioContext.state === "running") {
        deck2CrossfaderGain.gain.setTargetAtTime(deck2Gain, currentTime, timeConstant);
      } else {
        deck2CrossfaderGain.gain.value = deck2Gain;
      }
      console.log(`🎚️ Deck 2 crossfader gain set to: ${deck2Gain.toFixed(3)} (Constant Power)`);
    }

    // Also send to all deck worklets
    for (const deck of this.decks.values()) {
      deck.workletNode?.port.postMessage({
        type: "SET_CROSSFADER",
        value: normalizedValue,
      });
    }
    if (
      this.workletNode &&
      !Array.from(this.decks.values()).some((d) => d.workletNode === this.workletNode)
    ) {
      this.workletNode.port.postMessage({
        type: "SET_CROSSFADER",
        value: normalizedValue,
      });
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }

    for (const deck of this.decks.values()) {
      deck.workletNode?.port.postMessage({
        type: "SET_MASTER_VOLUME",
        value: volume,
      });
    }
    if (
      this.workletNode &&
      !Array.from(this.decks.values()).some((d) => d.workletNode === this.workletNode)
    ) {
      this.workletNode.port.postMessage({
        type: "SET_MASTER_VOLUME",
        value: volume,
      });
    }
  }

  setHeadphoneVolume(volume: number): void {
    if (this.headphoneGain) {
      this.headphoneGain.gain.value = volume;
    }
  }

  setHeadphoneRouting(deckId: DeckId, enabled: boolean): void {
    this.headphoneRouting.set(deckId, enabled);
    const headphoneGain = this.deckHeadphoneGains.get(deckId);
    if (headphoneGain) {
      // Enable/disable headphone routing (pre-fader)
      headphoneGain.gain.value = enabled ? 1.0 : 0.0;
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getDeckState(deckId: DeckId): DeckState | undefined {
    return this.decks.get(deckId);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private startPositionUpdates(): void {
    if (this.positionUpdateInterval !== null) {
      return; // Already started
    }

    // Update position every 50ms for smoother updates
    this.positionUpdateInterval = window.setInterval(() => {
      if (!this.audioContext) return;

      for (const [deckId, deck] of this.decks.entries()) {
        if (deck.audioBuffer) {
          let position = 0;

          if (deck.isPlaying && deck.startTime > 0) {
            // Calculate position when playing
            const elapsed = this.audioContext.currentTime - deck.startTime;
            // Account for initial offset (startOffset) by adding it to elapsed
            // Since startTime = currentTime - startOffset, elapsed already includes the offset
            position = elapsed % deck.audioBuffer.duration;

            // Ensure position is within valid range
            position = Math.max(
              0,
              Math.min(position, deck.audioBuffer.duration)
            );
          } else {
            // When paused, use pauseTime
            position = deck.pauseTime;
          }

          // Notify callbacks
          const callbacks = this.positionUpdateCallbacks.get(deckId);
          if (callbacks && callbacks.size > 0) {
            callbacks.forEach((callback) => {
              try {
                callback(position);
              } catch (error) {
                console.error(
                  `Error in position callback for deck ${deckId}:`,
                  error
                );
              }
            });
          } else if (deck.isPlaying) {
            // Debug: Log when we have a playing deck but no callbacks
            console.warn(
              `⚠️ Deck ${deckId} is playing but has no position callbacks registered`
            );
          }
        }
      }
    }, 50); // Reduced from 100ms to 50ms for smoother updates

    console.log(`✅ Position update interval started (50ms)`);
  }

  onPositionUpdate(
    deckId: DeckId,
    callback: (position: number) => void
  ): () => void {
    const callbacks = this.positionUpdateCallbacks.get(deckId);
    if (callbacks) {
      callbacks.add(callback);
      console.log(
        `📡 Registered position callback for deck ${deckId} (total callbacks: ${callbacks.size})`
      );

      // Immediately send current position if available
      const deck = this.decks.get(deckId);
      if (deck && deck.audioBuffer) {
        let currentPosition = 0;
        if (deck.isPlaying && deck.startTime > 0 && this.audioContext) {
          const elapsed = this.audioContext.currentTime - deck.startTime;
          currentPosition = elapsed % deck.audioBuffer.duration;
        } else {
          currentPosition = deck.pauseTime;
        }
        // Send initial position asynchronously to avoid blocking
        setTimeout(() => {
          try {
            callback(currentPosition);
            console.log(
              `📍 Sent initial position to callback for deck ${deckId}: ${currentPosition.toFixed(
                2
              )}s`
            );
          } catch (error) {
            console.error(`Error sending initial position to callback:`, error);
          }
        }, 0);
      }

      // Return unsubscribe function
      return () => {
        callbacks.delete(callback);
        console.log(
          `📡 Unregistered position callback for deck ${deckId} (remaining callbacks: ${callbacks.size})`
        );
      };
    }
    console.warn(`⚠️ No callback set found for deck ${deckId}`);
    return () => { };
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.masterStream) {
      console.warn("Master stream not initialized");
      return;
    }

    try {
      // Use setSinkId if available (Chrome/Edge)
      if ("setSinkId" in HTMLAudioElement.prototype) {
        // Create a temporary audio element to use setSinkId
        const audioElement = new Audio();
        audioElement.srcObject = this.masterStream;
        if (deviceId === "default") {
          await (audioElement as any).setSinkId("");
        } else {
          await (audioElement as any).setSinkId(deviceId);
        }
        // Keep the audio element alive
        audioElement.play().catch(() => {
          // Ignore play errors - we just need the stream to be active
        });
      } else {
        console.warn(
          "setSinkId not available, device selection may be limited"
        );
      }
    } catch (error) {
      console.error("Failed to set output device:", error);
    }
  }

  async setHeadphoneDevice(deviceId: string): Promise<void> {
    if (!this.headphoneStream) {
      console.warn("Headphone stream not initialized");
      return;
    }

    try {
      if ("setSinkId" in HTMLAudioElement.prototype) {
        const audioElement = new Audio();
        audioElement.srcObject = this.headphoneStream;
        if (deviceId === "default") {
          await (audioElement as any).setSinkId("");
        } else {
          await (audioElement as any).setSinkId(deviceId);
        }
        audioElement.play().catch(() => { });
      } else {
        console.warn(
          "setSinkId not available, device selection may be limited"
        );
      }
    } catch (error) {
      console.error("Failed to set headphone device:", error);
    }
  }
}

export { AudioService };
export default AudioService;
