import { useRef, useCallback, useState } from "react";
import { useDJ } from "@/contexts/DJContext";

// Add type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      audio: {
        setDeckPlaying: (
          deck: number,
          playing: boolean
        ) => Promise<{ success: boolean }>;
        setDeckVolume: (
          deck: number,
          volume: number
        ) => Promise<{ success: boolean }>;
        setDeckPitch: (
          deck: number,
          pitch: number
        ) => Promise<{ success: boolean }>;
        setDeckPosition: (
          deck: number,
          position: number
        ) => Promise<{ success: boolean }>;
        setDeckFile: (
          deck: number,
          filepath: string
        ) => Promise<{ success: boolean }>;
        setEffect: (
          deck: number,
          effect: number,
          enabled: boolean
        ) => Promise<{ success: boolean }>;
        setEQ: (
          deck: number,
          band: number,
          value: number
        ) => Promise<{ success: boolean }>;
        setCrossfader: (value: number) => Promise<{ success: boolean }>;
        setMasterVolume: (volume: number) => Promise<{ success: boolean }>;
        setHeadphoneVolume: (volume: number) => Promise<{ success: boolean }>;
      };
      dialog?: {
        showOpenDialog: (options: {
          properties: string[];
          filters: { name: string; extensions: string[] }[];
        }) => Promise<{ canceled: boolean; filePaths: string[] }>;
      };
      fs?: {
        writeFile: (
          filePath: string,
          data: ArrayBuffer
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        readFile: (
          filePath: string
        ) => Promise<{ success: boolean; data?: number[]; error?: string }>;
        exists: (
          filePath: string
        ) => Promise<{ success: boolean; exists: boolean }>;
        unlink: (
          filePath: string
        ) => Promise<{ success: boolean; error?: string }>;
        mkdir: (
          dirPath: string
        ) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

export interface AudioEffects {
  flanger: boolean;
  filter: boolean;
  echo: boolean;
  reverb: boolean;
}

export interface DeckAudioState {
  isPlaying: boolean;
  isCued: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  baseBpm: number;
  pitch: number;
  volume: number;
  lowEQ: number;
  midEQ: number;
  highEQ: number;
  effects: AudioEffects;
}

export interface DeckAudioChain {
  reverbGain: GainNode;
  echoGain: GainNode;
  filterGain: GainNode;
  flangerGain: GainNode;
  source: AudioBufferSourceNode;
  lowFilter: BiquadFilterNode;
  midFilter: BiquadFilterNode;
  highFilter: BiquadFilterNode;
  volumeGain: GainNode;
  masterGain: GainNode;
  headphoneGain: GainNode;
  flanger: DelayNode;
  filter: BiquadFilterNode;
  echo: DelayNode;
  reverb: ConvolverNode;
  pitchGain: GainNode;
}

export const useAudioEngine = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const deck1ChainRef = useRef<DeckAudioChain | null>(null);
  const deck2ChainRef = useRef<DeckAudioChain | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const headphoneGainRef = useRef<GainNode | null>(null);
  const crossfaderGainRef = useRef<GainNode | null>(null);
  const headphoneVolumeRef = useRef<GainNode | null>(null);
  const { dispatch, state } = useDJ();
  const devicesRef = useRef<MediaDeviceInfo[]>([]);

  // Check if we're in Electron with C++ audio engine
  const isElectronWithCpp = useCallback(() => {
    console.log("�� DEBUGGING electronAPI:");
    console.log("- typeof window:", typeof window);
    console.log("- window.electronAPI:", window.electronAPI);
    console.log("- window.electronAPI?.audio:", window.electronAPI?.audio);

    if (window.electronAPI?.audio) {
      console.log(
        "- Available audio methods:",
        Object.keys(window.electronAPI.audio)
      );
    }

    const result = typeof window !== "undefined" && window.electronAPI?.audio;
    console.log("- isElectronWithCpp result:", result);

    return result;
  }, []);

  // Fix the Electron detection
  const initAudioContext = useCallback(async () => {
    try {
      console.log("�� Initializing audio context...");
      console.log("🔧 Environment check:");
      console.log("  - navigator.mediaDevices:", !!navigator.mediaDevices);
      console.log("  - window.require:", !!window.require);
      console.log("  - window.electronAPI:", !!window.electronAPI);
      console.log("  - User agent:", navigator.userAgent);

      // Check if we're in Electron - use electronAPI instead of window.require
      const isElectron = !!window.electronAPI;
      console.log("🔧 Is Electron:", isElectron);

      if (isElectron) {
        console.log("🔧 Running in Electron environment");

        // In Electron, we don't need to request permissions through IPC
        // Just initialize the audio context
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({
            latencyHint: "interactive",
            sampleRate: 48000,
          });

          // Create master output
          masterGainRef.current = audioContextRef.current.createGain();
          masterGainRef.current.gain.setValueAtTime(
            1,
            audioContextRef.current.currentTime
          );

          // Create crossfader
          crossfaderGainRef.current = audioContextRef.current.createGain();
          crossfaderGainRef.current.gain.setValueAtTime(
            1,
            audioContextRef.current.currentTime
          );

          // Create headphone output
          headphoneGainRef.current = audioContextRef.current.createGain();
          headphoneGainRef.current.gain.setValueAtTime(
            1,
            audioContextRef.current.currentTime
          );

          // Create headphone volume control
          headphoneVolumeRef.current = audioContextRef.current.createGain();
          headphoneVolumeRef.current.gain.setValueAtTime(
            0.7,
            audioContextRef.current.currentTime
          );

          // Connect chain
          crossfaderGainRef.current.connect(masterGainRef.current);
          headphoneGainRef.current.connect(headphoneVolumeRef.current);
          masterGainRef.current.connect(audioContextRef.current.destination);
          headphoneVolumeRef.current.connect(
            audioContextRef.current.destination
          );

          console.log("Electron audio context initialized successfully");
        }

        // Get available audio devices directly (in renderer process)
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          try {
            console.log("🔍 Attempting to enumerate audio devices...");
            console.log("🔍 MediaDevices available:", !!navigator.mediaDevices);
            console.log(
              "🔍 enumerateDevices available:",
              !!navigator.mediaDevices.enumerateDevices
            );

            // First try to get devices without requesting permission
            let devices = await navigator.mediaDevices.enumerateDevices();
            console.log("📱 Initial devices found:", devices.length);
            console.log("�� Initial devices:", devices);

            // Check if we have any devices with labels
            const devicesWithLabels = devices.filter((device) => device.label);
            console.log(" Devices with labels:", devicesWithLabels.length);

            // If we don't have labels, try requesting permission
            if (devices.some((device) => !device.label)) {
              console.log(
                "🔐 Requesting audio permission for device labels..."
              );
              try {
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                });
                console.log("✅ Permission granted, stream:", stream);

                // Stop the stream immediately as we only needed it for permission
                stream.getTracks().forEach((track) => track.stop());

                // Now enumerate devices again
                devices = await navigator.mediaDevices.enumerateDevices();
                console.log(" Devices after permission:", devices.length);
                console.log(" Devices after permission:", devices);
              } catch (permError) {
                console.error("❌ Permission denied:", permError);
                console.error("❌ Permission error details:", {
                  name: permError.name,
                  message: permError.message,
                  constraint: permError.constraint,
                });
              }
            }

            devicesRef.current = devices;
            const audioDevicesFound = devices.filter(
              (device) =>
                device.kind === "audioinput" || device.kind === "audiooutput"
            );

            console.log("🎵 Audio devices found:", audioDevicesFound.length);
            console.log(
              "Device details:",
              audioDevicesFound.map((d) => ({
                kind: d.kind,
                label: d.label || "Unknown Device",
                deviceId: d.deviceId,
                groupId: d.groupId,
              }))
            );

            // Dispatch to DJContext
            dispatch({
              type: "SET_CONNECTED_DEVICES",
              payload: audioDevicesFound,
            });

            console.log(
              "✅ Audio devices dispatched to context:",
              audioDevicesFound.length
            );
          } catch (error) {
            console.error("❌ Could not enumerate audio devices:", error);
            console.error("❌ Error details:", {
              name: error.name,
              message: error.message,
              stack: error.stack,
            });

            // Don't use fallback devices, just log the error
            console.log("❌ No devices available due to error");
          }
        } else {
          console.warn("❌ MediaDevices API not available");
          console.log("❌ navigator.mediaDevices:", navigator.mediaDevices);
          console.log(
            "❌ navigator.mediaDevices.enumerateDevices:",
            navigator.mediaDevices?.enumerateDevices
          );
        }
      } else {
        console.log(" Running in web browser environment");
      }
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      throw error;
    }
  }, [dispatch]);

  const createEQFilter = useCallback(
    (context: AudioContext, type: BiquadFilterType, frequency: number) => {
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(frequency, context.currentTime);
      filter.Q.setValueAtTime(1, context.currentTime);
      return filter;
    },
    []
  );

  const createEffects = useCallback((context: AudioContext) => {
    // Flanger effect
    const flanger = context.createDelay(0.003);
    flanger.delayTime.setValueAtTime(0.003, context.currentTime);

    // Filter effect
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, context.currentTime);
    filter.Q.setValueAtTime(1, context.currentTime);

    // Echo effect
    const echo = context.createDelay(0.5);
    echo.delayTime.setValueAtTime(0.5, context.currentTime);

    // Reverb effect (simple convolution)
    const reverb = context.createConvolver();
    // Create a simple impulse response for reverb
    const sampleRate = context.sampleRate;
    const length = sampleRate * 0.5; // 0.5 second reverb
    const impulse = context.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.1));
      }
    }
    reverb.buffer = impulse;

    return { flanger, filter, echo, reverb };
  }, []);

  const createDeckChain = useCallback(
    async (deckNumber: 1 | 2, audioBuffer: AudioBuffer) => {
      if (!audioContextRef.current) return null;

      const context = audioContextRef.current;

      // Create source
      const source = context.createBufferSource();
      source.buffer = audioBuffer;

      // Create EQ filters
      const lowFilter = createEQFilter(context, "lowshelf", 320);
      const midFilter = createEQFilter(context, "peaking", 1000);
      const highFilter = createEQFilter(context, "highshelf", 3200);

      // Create gain nodes
      const volumeGain = context.createGain();
      const masterGain = context.createGain();
      const headphoneGain = context.createGain();
      const pitchGain = context.createGain();

      // Create effects
      const effects = createEffects(context);

      // Connect chain
      source.connect(pitchGain);
      pitchGain.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(volumeGain);

      // Effects chain (bypass by default)
      const effectsGain = context.createGain();
      effectsGain.gain.setValueAtTime(0, context.currentTime);
      volumeGain.connect(effectsGain);

      // Connect effects
      effects.flanger.connect(effects.filter);
      effects.filter.connect(effects.echo);
      effects.echo.connect(effects.reverb);
      effects.reverb.connect(effectsGain);

      // Split to master and headphone outputs
      volumeGain.connect(masterGain);
      volumeGain.connect(headphoneGain);

      if (crossfaderGainRef.current) {
        masterGain.connect(crossfaderGainRef.current);
      }

      if (headphoneGainRef.current) {
        headphoneGain.connect(headphoneGainRef.current);
      }

      return {
        source,
        lowFilter,
        midFilter,
        highFilter,
        volumeGain,
        masterGain,
        headphoneGain,
        pitchGain,
        ...effects,
      };
    },
    [createEQFilter, createEffects]
  );

  const detectBPM = useCallback(
    async (audioBuffer: AudioBuffer): Promise<number> => {
      // Enhanced BPM detection using autocorrelation
      const sampleRate = audioBuffer.sampleRate;
      const length = audioBuffer.length;
      const channelData = audioBuffer.getChannelData(0);

      // Downsample for performance
      const downsampleFactor = 4;
      const downsampledLength = Math.floor(length / downsampleFactor);
      const downsampled = new Float32Array(downsampledLength);

      for (let i = 0; i < downsampledLength; i++) {
        downsampled[i] = channelData[i * downsampleFactor];
      }

      // Simple onset detection
      const onsetThreshold = 0.1;
      const onsets: number[] = [];

      for (let i = 1; i < downsampledLength; i++) {
        if (
          downsampled[i] > onsetThreshold &&
          downsampled[i - 1] <= onsetThreshold
        ) {
          onsets.push(i);
        }
      }

      if (onsets.length < 2) return 120;

      // Calculate intervals between onsets
      const intervals: number[] = [];
      for (let i = 1; i < onsets.length; i++) {
        intervals.push(onsets[i] - onsets[i - 1]);
      }

      // Find most common interval (BPM)
      const intervalCounts: { [key: number]: number } = {};
      intervals.forEach((interval) => {
        const rounded = Math.round(interval / 10) * 10;
        intervalCounts[rounded] = (intervalCounts[rounded] || 0) + 1;
      });

      let maxCount = 0;
      let mostCommonInterval = 120;

      Object.entries(intervalCounts).forEach(([interval, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonInterval = parseInt(interval);
        }
      });

      // Convert interval to BPM
      const bpm = Math.round(
        ((sampleRate / downsampleFactor) * 60) / mostCommonInterval
      );
      return Math.max(60, Math.min(200, bpm)); // Clamp between 60-200 BPM
    },
    []
  );

  const applyCrossfader = useCallback((crossfaderValue: number) => {
    if (
      !crossfaderGainRef.current ||
      !deck1ChainRef.current ||
      !deck2ChainRef.current
    )
      return;

    // crossfaderValue: -1 = deck1 only, 0 = both equal, 1 = deck2 only
    const deck1Volume =
      crossfaderValue <= 0 ? 1 : Math.max(0, 1 - crossfaderValue);
    const deck2Volume =
      crossfaderValue >= 0 ? 1 : Math.max(0, 1 + crossfaderValue);

    deck1ChainRef.current.masterGain.gain.setValueAtTime(
      deck1Volume,
      audioContextRef.current?.currentTime || 0
    );
    deck2ChainRef.current.masterGain.gain.setValueAtTime(
      deck2Volume,
      audioContextRef.current?.currentTime || 0
    );
  }, []);

  // Updated functions to use C++ audio engine when available (synchronous)
  const updateEQ = useCallback(
    (deckNumber: 1 | 2, eq: { low: number; mid: number; high: number }) => {
      // Use C++ audio engine if available
      if (isElectronWithCpp()) {
        try {
          window.electronAPI!.audio.setEQ(deckNumber, 0, eq.low); // Low band
          window.electronAPI!.audio.setEQ(deckNumber, 1, eq.mid); // Mid band
          window.electronAPI!.audio.setEQ(deckNumber, 2, eq.high); // High band
          console.log(`C++ EQ updated for deck ${deckNumber}:`, eq);
        } catch (error) {
          console.error("Failed to update C++ EQ:", error);
        }
      }

      // Fallback to Web Audio API
      const chain =
        deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
      if (!chain || !audioContextRef.current) return;

      const context = audioContextRef.current;

      // Convert -1..1 range to dB gain
      const lowGain = eq.low * 12; // +/- 12dB
      const midGain = eq.mid * 12;
      const highGain = eq.high * 12;

      chain.lowFilter.gain.setValueAtTime(lowGain, context.currentTime);
      chain.midFilter.gain.setValueAtTime(midGain, context.currentTime);
      chain.highFilter.gain.setValueAtTime(highGain, context.currentTime);
    },
    [isElectronWithCpp]
  );

  const updateVolume = useCallback(
    (deckNumber: 1 | 2, volume: number) => {
      console.log(
        `🔍 updateVolume called: deck=${deckNumber}, volume=${volume}`
      );
      console.log(` isElectronWithCpp():`, isElectronWithCpp());

      // Use C++ audio engine if available
      if (isElectronWithCpp()) {
        try {
          console.log(` Calling C++ setDeckVolume...`);
          window.electronAPI!.audio.setDeckVolume(deckNumber, volume);
          console.log(`✅ C++ volume updated for deck ${deckNumber}:`, volume);
        } catch (error) {
          console.error("❌ Failed to update C++ volume:", error);
        }
      } else {
        console.log("⚠️ Using Web Audio fallback");
      }

      // Fallback to Web Audio API
      const chain =
        deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
      if (!chain) return;

      chain.volumeGain.gain.setValueAtTime(
        volume,
        audioContextRef.current?.currentTime || 0
      );
    },
    [isElectronWithCpp]
  );

  const updatePitch = useCallback(
    (deckNumber: 1 | 2, pitch: number) => {
      // Use C++ audio engine if available
      if (isElectronWithCpp()) {
        try {
          window.electronAPI!.audio.setDeckPitch(deckNumber, pitch);
          console.log(`C++ pitch updated for deck ${deckNumber}:`, pitch);
        } catch (error) {
          console.error("Failed to update C++ pitch:", error);
        }
      }

      // Fallback to Web Audio API
      const chain =
        deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
      if (!chain) return;

      // Pitch affects playback rate
      const playbackRate = Math.pow(2, pitch);
      chain.source.playbackRate.setValueAtTime(
        playbackRate,
        audioContextRef.current?.currentTime || 0
      );
    },
    [isElectronWithCpp]
  );

  const updateEffects = useCallback(
    (deckNumber: 1 | 2, effects: AudioEffects) => {
      // Use C++ audio engine if available
      if (isElectronWithCpp()) {
        try {
          window.electronAPI!.audio.setEffect(deckNumber, 0, effects.flanger); // Flanger
          window.electronAPI!.audio.setEffect(deckNumber, 1, effects.filter); // Filter
          window.electronAPI!.audio.setEffect(deckNumber, 2, effects.echo); // Echo
          window.electronAPI!.audio.setEffect(deckNumber, 3, effects.reverb); // Reverb
          console.log(`C++ effects updated for deck ${deckNumber}:`, effects);
        } catch (error) {
          console.error("Failed to update C++ effects:", error);
        }
      }

      // Fallback to Web Audio API
      const chain =
        deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
      if (!chain || !audioContextRef.current) return;

      const context = audioContextRef.current;

      // Ensure all effects and their gain nodes exist before trying to access them
      if (
        chain.flangerGain &&
        chain.filterGain &&
        chain.echoGain &&
        chain.reverbGain
      ) {
        // Flanger effect
        if (effects.flanger) {
          chain.flangerGain.gain.setValueAtTime(0.3, context.currentTime);
        } else {
          chain.flangerGain.gain.setValueAtTime(0, context.currentTime);
        }

        // Filter effect
        if (effects.filter) {
          chain.filterGain.gain.setValueAtTime(0.5, context.currentTime);
        } else {
          chain.filterGain.gain.setValueAtTime(0, context.currentTime);
        }

        // Echo effect
        if (effects.echo) {
          chain.echoGain.gain.setValueAtTime(0.4, context.currentTime);
        } else {
          chain.echoGain.gain.setValueAtTime(0, context.currentTime);
        }

        // Reverb effect
        if (effects.reverb) {
          chain.reverbGain.gain.setValueAtTime(0.3, context.currentTime);
        } else {
          chain.reverbGain.gain.setValueAtTime(0, context.currentTime);
        }
      }
    },
    [isElectronWithCpp]
  );

  const updateHeadphoneVolume = useCallback(
    (volume: number) => {
      // Use C++ audio engine if available
      if (isElectronWithCpp()) {
        try {
          window.electronAPI!.audio.setHeadphoneVolume(volume);
          console.log("C++ headphone volume updated:", volume);
        } catch (error) {
          console.error("Failed to update C++ headphone volume:", error);
        }
      }

      // Fallback to Web Audio API
      if (!headphoneVolumeRef.current) return;
      headphoneVolumeRef.current.gain.setValueAtTime(
        volume,
        audioContextRef.current?.currentTime || 0
      );
    },
    [isElectronWithCpp]
  );

  const setDeckChain = useCallback(
    (deckNumber: 1 | 2, chain: DeckAudioChain) => {
      if (deckNumber === 1) {
        deck1ChainRef.current = chain;
      } else {
        deck2ChainRef.current = chain;
      }
    },
    []
  );

  // New function to handle deck playing state (synchronous)
  const setDeckPlaying = useCallback(
    (deckNumber: 1 | 2, playing: boolean) => {
      if (isElectronWithCpp()) {
        try {
          window.electronAPI!.audio.setDeckPlaying(deckNumber, playing);
          console.log(`C++ deck ${deckNumber} playing state:`, playing);
        } catch (error) {
          console.error("Failed to update C++ deck playing state:", error);
        }
      }
    },
    [isElectronWithCpp]
  );

  // New function to handle crossfader (synchronous)
  const setCrossfader = useCallback(
    (value: number) => {
      if (isElectronWithCpp()) {
        try {
          window.electronAPI!.audio.setCrossfader(value);
          console.log("C++ crossfader updated:", value);
        } catch (error) {
          console.error("Failed to update C++ crossfader:", error);
        }
      }

      // Fallback to Web Audio API
      applyCrossfader(value);
    },
    [isElectronWithCpp, applyCrossfader]
  );

  // New function to handle master volume (synchronous)
  const setMasterVolume = useCallback(
    (volume: number) => {
      if (isElectronWithCpp()) {
        try {
          window.electronAPI!.audio.setMasterVolume(volume);
          console.log("C++ master volume updated:", volume);
        } catch (error) {
          console.error("Failed to update C++ master volume:", error);
        }
      }

      // Fallback to Web Audio API
      if (masterGainRef.current) {
        masterGainRef.current.gain.setValueAtTime(
          volume,
          audioContextRef.current?.currentTime || 0
        );
      }
    },
    [isElectronWithCpp]
  );

  return {
    initAudioContext,
    createDeckChain,
    detectBPM,
    applyCrossfader,
    updateEQ,
    updateVolume,
    updatePitch,
    updateEffects,
    updateHeadphoneVolume,
    setDeckChain,
    setDeckPlaying,
    setCrossfader,
    setMasterVolume,
    audioContext: audioContextRef.current,
    masterGain: masterGainRef.current,
    headphoneGain: headphoneGainRef.current,
    audioDevices: state.connectedDevices,
  };
};
