/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AudioService - Singleton service managing Web Audio API and AudioWorklet
 * Replaces the Electron IPC audio bridge with native Web Audio API
 */

type DeckId = 1 | 2;

interface DeckState {
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
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
}

class AudioService {
  private static instance: AudioService;
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
  private crossfaderValue: number = 0; // Current crossfader value (-1 to +1)
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
      gainNode: null,
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
    });
    this.decks.set(2, {
      sourceNode: null,
      gainNode: null,
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

    try {
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

      // Create AudioWorkletNode with 2 inputs (one for each deck)
      try {
        this.workletNode = new AudioWorkletNode(
          this.audioContext,
          "dj-audio-processor",
          {
            numberOfInputs: 2,
            numberOfOutputs: 1,
            channelCount: 2, // Stereo
            channelCountMode: "explicit",
          }
        );
        console.log("AudioWorkletNode created successfully");
      } catch (error) {
        console.error("Failed to create AudioWorkletNode:", error);
        console.error(
          "This usually means the processor wasn't registered. Check audio-processor.js for errors."
        );
        throw error;
      }

      // Set up message handler
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === "WASM_READY") {
          console.log("✅ Wasm module loaded and ready in AudioWorklet");
        } else if (event.data.type === "ERROR") {
          console.error("❌ AudioWorklet error:", event.data.message);
        } else {
          console.log("AudioWorklet message:", event.data);
        }
      };

      // Create gain nodes
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1.0;

      this.crossfaderGain = this.audioContext.createGain();
      this.crossfaderGain.gain.value = 1.0;

      this.headphoneGain = this.audioContext.createGain();
      this.headphoneGain.gain.value = 0.7;

      // Create crossfader gain nodes for each deck
      const deck1CrossfaderGain = this.audioContext.createGain();
      deck1CrossfaderGain.gain.value = 0.5; // Center position = 50% for both decks
      this.deckCrossfaderGains.set(1, deck1CrossfaderGain);

      const deck2CrossfaderGain = this.audioContext.createGain();
      deck2CrossfaderGain.gain.value = 0.5; // Center position = 50% for both decks
      this.deckCrossfaderGains.set(2, deck2CrossfaderGain);
      console.log(
        "🎚️ Crossfader gain nodes created for both decks (initialized to 0.5 = center)"
      );

      // Create MediaStream destinations for device selection
      this.masterDestination = this.audioContext.createMediaStreamDestination();
      this.headphoneDestination =
        this.audioContext.createMediaStreamDestination();
      this.masterStream = this.masterDestination.stream;
      this.headphoneStream = this.headphoneDestination.stream;

      // Connect audio graph: worklet -> masterGain -> crossfaderGain -> destinations
      this.workletNode.connect(this.masterGain);
      this.masterGain.connect(this.crossfaderGain);

      // Connect to MediaStream destination (PRIMARY - required for Electron)
      this.crossfaderGain.connect(this.masterDestination);
      console.log(
        "🔗 Connected: worklet -> masterGain -> crossfaderGain -> masterDestination (MediaStream)"
      );

      // Also connect to audioContext.destination as fallback
      this.crossfaderGain.connect(this.audioContext.destination);
      console.log("🔗 Also connected to audioContext.destination as fallback");

      console.log(`🔊 Master gain value: ${this.masterGain.gain.value}`);
      console.log(
        `🔊 Crossfader gain value: ${this.crossfaderGain.gain.value}`
      );

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

      // Initialize crossfader to center position
      this.setCrossfader(0); // Center = 0, which gives 50% gain to both decks

      this.initialized = true;
      console.log("✅ AudioService initialized successfully");
      console.log(`🔊 Final AudioContext state: ${this.audioContext.state}`);
    } catch (error) {
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

      // Send Wasm bytes and JS code to worklet (both are cloneable)
      if (this.workletNode) {
        this.workletNode.port.postMessage({
          type: "LOAD_WASM",
          wasmBytes: wasmBytes,
          wasmJsCode: jsCode, // Send JS code as string instead of path
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

  async loadTrack(deckId: DeckId, fileBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      throw new Error("AudioService not initialized");
    }

    try {
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(
        fileBuffer.slice(0)
      );

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
    } catch (error) {
      console.error(`Failed to load track for deck ${deckId}:`, error);
      throw error;
    }
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

    console.log(`▶️ Starting playback for deck ${deckId}`);
    console.log(
      `📊 Deck ${deckId} state before play: isPlaying=${
        deck.isPlaying
      }, pauseTime=${deck.pauseTime.toFixed(
        2
      )}s, hasBuffer=${!!deck.audioBuffer}`
    );
    console.log(`🔊 AudioContext state: ${this.audioContext?.state}`);
    console.log(`🔊 Master gain: ${this.masterGain?.gain.value}`);
    console.log(`🔊 Crossfader gain: ${this.crossfaderGain?.gain.value}`);

    // Create new source node
    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = deck.audioBuffer;
    sourceNode.loop = true; // Enable looping for continuous playback (DJ standard)

    // Explicitly set loop boundaries for reliable looping
    sourceNode.loopStart = 0;
    sourceNode.loopEnd = deck.audioBuffer.duration;
    console.log(`🔊 Source node created with looping enabled`);
    console.log(
      `🔁 Loop properties: loopStart=${sourceNode.loopStart.toFixed(
        2
      )}s, loopEnd=${sourceNode.loopEnd.toFixed(2)}s, loop=${sourceNode.loop}`
    );

    // Create gain node for this deck (for volume control)
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = deck?.volume ?? 1.0;
    console.log(
      `🔊 Deck ${deckId} gain node created with volume: ${gainNode.gain.value}`
    );

    // Get crossfader gain node for this deck
    const crossfaderGain = this.deckCrossfaderGains.get(deckId);
    if (!crossfaderGain) {
      console.error(`❌ No crossfader gain node for deck ${deckId}`);
      return;
    }

    // Connect: source -> deckGain -> deckCrossfaderGain -> destination
    sourceNode.connect(gainNode);
    gainNode.connect(crossfaderGain);
    crossfaderGain.connect(this.audioContext.destination);
    console.log(
      `🔗 Connected: source -> gain -> crossfaderGain -> destination for deck ${deckId}`
    );
    console.log(
      `🎚️ Deck ${deckId} crossfader gain: ${crossfaderGain.gain.value}`
    );

    // Also connect to worklet for future processing (when worklet is working)
    const workletInputIndex = deckId - 1; // deckId 1 -> input 0, deckId 2 -> input 1
    gainNode.connect(this.workletNode, 0, workletInputIndex);
    console.log(
      `🔗 Also connected gainNode -> workletNode input ${workletInputIndex} for deck ${deckId}`
    );

    // Also connect to headphone gain for pre-fader monitoring (if routing enabled)
    const headphoneGain = this.deckHeadphoneGains.get(deckId);
    if (headphoneGain) {
      // Connect source directly to headphone gain (pre-fader)
      sourceNode.connect(headphoneGain);
    }

    // Calculate start offset
    const startOffset = deck.pauseTime;

    // CRITICAL: Ensure default audio element is playing (REQUIRED for MediaStream in Electron)
    if (this.defaultAudioElement) {
      if (this.defaultAudioElement.paused) {
        try {
          await this.defaultAudioElement.play();
          console.log("🔊 Default audio element resumed/started");
        } catch (error) {
          console.error(
            "❌ CRITICAL: Could not play default audio element:",
            error
          );
          console.error("❌ This will prevent audio from playing in Electron!");
        }
      } else {
        console.log("✅ Default audio element is already playing");
      }

      // Verify it's actually playing
      console.log(
        `🔊 Audio element state: paused=${this.defaultAudioElement.paused}, readyState=${this.defaultAudioElement.readyState}`
      );
    } else {
      console.error("❌ CRITICAL: defaultAudioElement is null!");
    }

    // Verify audio buffer has data
    if (!deck.audioBuffer) {
      console.error("❌ No audio buffer!");
      return;
    }
    console.log(
      `📊 Audio buffer: ${deck.audioBuffer.duration.toFixed(2)}s, ${
        deck.audioBuffer.sampleRate
      }Hz, ${deck.audioBuffer.numberOfChannels} channels`
    );
    console.log(
      `📊 Source node buffer: ${sourceNode.buffer?.duration.toFixed(2)}s`
    );

    // CRITICAL: Store source node and gain node in deck state BEFORE starting
    // This prevents garbage collection and ensures proper lifecycle management
    deck.sourceNode = sourceNode;
    deck.gainNode = gainNode;
    console.log(
      `💾 Stored source node and gain node in deck ${deckId} state before start()`
    );

    // Start playback
    try {
      sourceNode.start(0, startOffset);
      console.log(`▶️ Playback started at offset ${startOffset.toFixed(2)}s`);
      console.log(
        `▶️ Source node state: loop=${
          sourceNode.loop
        }, loopStart=${sourceNode.loopStart?.toFixed(
          2
        )}s, loopEnd=${sourceNode.loopEnd?.toFixed(2)}s`
      );
    } catch (error) {
      console.error("❌ Failed to start source node:", error);
      // Clean up on error
      deck.sourceNode = null;
      deck.gainNode = null;
      throw error;
    }

    // Set deck active in worklet
    this.workletNode.port.postMessage({
      type: "SET_DECK_ACTIVE",
      deck: deckId,
      active: true,
    });

    // Handle end of playback (shouldn't happen with loop=true, but handle it anyway)
    sourceNode.onended = () => {
      console.warn(
        `⚠️ Source node ended for deck ${deckId} (this shouldn't happen with loop=true)`
      );
      console.warn(
        `⚠️ Loop was: ${sourceNode.loop}, loopStart: ${sourceNode.loopStart}, loopEnd: ${sourceNode.loopEnd}`
      );
      console.warn(
        `⚠️ Deck isPlaying: ${
          deck.isPlaying
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
        this.workletNode?.port.postMessage({
          type: "SET_DECK_ACTIVE",
          deck: deckId,
          active: false,
        });
      }
    };

    // Update deck state (sourceNode and gainNode already stored above before start())
    deck.isPlaying = true;
    deck.startTime = this.audioContext.currentTime - startOffset;
    console.log(
      `✅ Deck ${deckId} state updated: isPlaying=${
        deck.isPlaying
      }, startTime=${deck.startTime.toFixed(2)}s`
    );
  }

  pause(deckId: DeckId): void {
    const deck = this.decks.get(deckId);
    if (!deck || !deck.isPlaying || !deck.sourceNode) {
      console.log(
        `⏸️ Pause called for deck ${deckId} but not playing (isPlaying=${
          deck?.isPlaying
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

    if (deck.gainNode) {
      try {
        deck.gainNode.disconnect();
        console.log(`⏸️ Disconnected gain node for deck ${deckId}`);
      } catch (error) {
        console.warn(
          `⚠️ Error disconnecting gain node for deck ${deckId}:`,
          error
        );
      }
    }

    // Set deck inactive in worklet
    this.workletNode?.port.postMessage({
      type: "SET_DECK_ACTIVE",
      deck: deckId,
      active: false,
    });

    // Update state
    deck.sourceNode = null;
    deck.gainNode = null;
    deck.isPlaying = false;
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
    if (!this.workletNode) return;

    // Update deck state
    const deck = this.decks.get(deckId);
    if (deck) {
      deck.volume = volume;
      // Update Web Audio API gain node as fallback
      if (deck.gainNode) {
        deck.gainNode.gain.value = volume;
      }
    }

    // Send to Wasm processor
    this.workletNode.port.postMessage({
      type: "SET_DECK_VOLUME",
      deck: deckId,
      value: volume,
    });
  }

  setPitch(deckId: DeckId, pitch: number): void {
    if (!this.workletNode) return;

    // Update deck state
    const deck = this.decks.get(deckId);
    if (deck) {
      deck.pitch = pitch;
      // Calculate current BPM: BPM = baseBPM * 2^pitch
      deck.currentBPM = deck.baseBPM * Math.pow(2, pitch);
    }

    this.workletNode.port.postMessage({
      type: "SET_DECK_PITCH",
      deck: deckId,
      value: pitch,
    });

    // If sync is enabled, update synced deck
    this.updateSync(deckId);

    // Also update playback rate on source node if playing
    const deck2 = this.decks.get(deckId);
    if (deck2?.sourceNode) {
      const playbackRate = Math.pow(2, pitch);
      deck2.sourceNode.playbackRate.value = playbackRate;
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

  setEQ(deckId: DeckId, band: number, value: number): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: "SET_DECK_EQ",
      deck: deckId,
      band,
      value,
    });
  }

  setEffect(deckId: DeckId, effect: number, enabled: boolean): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: "SET_DECK_EFFECT",
      deck: deckId,
      effect,
      enabled,
    });
  }

  setCrossfader(value: number): void {
    // Store crossfader value (-1 to +1)
    this.crossfaderValue = value;

    // Calculate gain values for each deck
    // Crossfader value: -1 = full deck1, 0 = center, +1 = full deck2
    // deck1Gain = (1 - crossfader) * 0.5, deck2Gain = (1 + crossfader) * 0.5
    const deck1Gain = (1 - value) * 0.5;
    const deck2Gain = (1 + value) * 0.5;

    // Update crossfader gain nodes
    const deck1CrossfaderGain = this.deckCrossfaderGains.get(1);
    const deck2CrossfaderGain = this.deckCrossfaderGains.get(2);

    if (deck1CrossfaderGain) {
      deck1CrossfaderGain.gain.value = deck1Gain;
      console.log(`🎚️ Deck 1 crossfader gain set to: ${deck1Gain.toFixed(3)}`);
    }

    if (deck2CrossfaderGain) {
      deck2CrossfaderGain.gain.value = deck2Gain;
      console.log(`🎚️ Deck 2 crossfader gain set to: ${deck2Gain.toFixed(3)}`);
    }

    // Also send to worklet (for Wasm processing when it's working)
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_CROSSFADER",
        value,
      });
    }
  }

  setMasterVolume(volume: number): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: "SET_MASTER_VOLUME",
      value: volume,
    });
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

    // Update position every 100ms
    this.positionUpdateInterval = window.setInterval(() => {
      if (!this.audioContext) return;

      for (const [deckId, deck] of this.decks.entries()) {
        if (deck.isPlaying && deck.audioBuffer && deck.startTime > 0) {
          const elapsed = this.audioContext.currentTime - deck.startTime;
          const position = elapsed % deck.audioBuffer.duration;

          // Notify callbacks
          const callbacks = this.positionUpdateCallbacks.get(deckId);
          if (callbacks) {
            callbacks.forEach((callback) => callback(position));
          }
        }
      }
    }, 100);
  }

  onPositionUpdate(
    deckId: DeckId,
    callback: (position: number) => void
  ): () => void {
    const callbacks = this.positionUpdateCallbacks.get(deckId);
    if (callbacks) {
      callbacks.add(callback);
      // Return unsubscribe function
      return () => {
        callbacks.delete(callback);
      };
    }
    return () => {};
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
        audioElement.play().catch(() => {});
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
