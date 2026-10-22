import { useRef, useCallback, useEffect } from "react";
import { useDJ } from "@/contexts/DJContext";
import AudioService from "@/services/AudioService";

// Keep type declarations for window.electronAPI (for file system access only)
declare global {
  interface Window {
    electronAPI?: {
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
      path?: {
        getDocumentsPath: () => Promise<{ success: boolean; path?: string; error?: string }>;
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

// Legacy interface for compatibility (not used with AudioService)
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

let globalAudioEngineInitPromise: Promise<void> | null = null;

export const useAudioEngine = () => {
  const audioServiceRef = useRef<AudioService>(AudioService.getInstance());
  const { dispatch, state } = useDJ();
  const devicesRef = useRef<MediaDeviceInfo[]>([]);

  // Safe accessor guaranteeing singleton AudioService is always defined
  const getAudioService = useCallback((): AudioService => {
    if (!audioServiceRef.current) {
      audioServiceRef.current = AudioService.getInstance();
    }
    return audioServiceRef.current;
  }, []);

  // Initialize AudioService (Absolute Singleton)
  const initAudioContext = useCallback(async () => {
    const audioService = getAudioService();

    if (globalAudioEngineInitPromise) {
      await globalAudioEngineInitPromise;
      return;
    }

    globalAudioEngineInitPromise = (async () => {
      await audioService.initialize();

      // Get AudioContext for device enumeration
      const audioContext = audioService.getAudioContext();
      if (audioContext) {
        // Enumerate audio devices
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          try {
            let devices = await navigator.mediaDevices.enumerateDevices();

            // Request permission if needed for device labels
            if (devices.some((device) => !device.label)) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                });
                stream.getTracks().forEach((track) => track.stop());
                devices = await navigator.mediaDevices.enumerateDevices();
              } catch (permError) {
                console.error("Permission denied:", permError);
              }
            }

            devicesRef.current = devices;
            const audioDevicesFound = devices.filter(
              (device) =>
                device.kind === "audioinput" || device.kind === "audiooutput"
            );

            dispatch({
              type: "SET_CONNECTED_DEVICES",
              payload: audioDevicesFound,
            });

            console.log("Audio devices found:", audioDevicesFound.length);
          } catch (error) {
            console.error("Could not enumerate audio devices:", error);
          }
        }
      }
    })();

    try {
      await globalAudioEngineInitPromise;
    } catch (error) {
      globalAudioEngineInitPromise = null;
      console.error("Failed to initialize AudioService:", error);
      throw error;
    }
  }, [dispatch]);

  // Auto-initialize AudioService on mount across all hook consumers (DJInterface, DJDeck, useKeyMapping)
  useEffect(() => {
    initAudioContext();
  }, [initAudioContext]);

  // Load track from file buffer, Blob or URL
  const loadTrack = useCallback(
    async (deckNumber: 1 | 2, source: ArrayBuffer | Blob | string): Promise<AudioBuffer> => {
      const audioService = getAudioService();
      return await audioService.loadTrack(deckNumber, source);
    },
    [getAudioService]
  );

  // Set base BPM for a deck
  const setBaseBPM = useCallback((deckNumber: 1 | 2, bpm: number) => {
    const audioService = getAudioService();
    audioService.setBaseBPM(deckNumber, bpm);
  }, [getAudioService]);

  // Set sync for a deck
  const setSync = useCallback((deckNumber: 1 | 2, enabled: boolean) => {
    const audioService = getAudioService();
    audioService.setSync(deckNumber, enabled);
  }, [getAudioService]);

  // Detect BPM from audio buffer
  const detectBPM = useCallback(
    async (audioBuffer: AudioBuffer): Promise<number> => {
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

  // Update EQ
  const updateEQ = useCallback(
    (deckNumber: 1 | 2, eq: { low: number; mid: number; high: number }) => {
      const audioService = getAudioService();
      audioService.setDeckEQ(deckNumber, 'low', eq.low);
      audioService.setDeckEQ(deckNumber, 'mid', eq.mid);
      audioService.setDeckEQ(deckNumber, 'high', eq.high);
    },
    [getAudioService]
  );

  // Update volume
  const updateVolume = useCallback((deckNumber: 1 | 2, volume: number) => {
    const audioService = getAudioService();
    audioService.setVolume(deckNumber, volume);
  }, [getAudioService]);

  // Update pitch
  const updatePitch = useCallback((deckNumber: 1 | 2, pitch: number) => {
    const audioService = getAudioService();
    audioService.setPitch(deckNumber, pitch);
  }, [getAudioService]);

  // Update effects
  const updateEffects = useCallback(
    (deckNumber: 1 | 2, effects: AudioEffects) => {
      const audioService = getAudioService();
      audioService.setEffectState(deckNumber, 'flanger', effects.flanger, effects.flanger ? 1.0 : 0.0);
      audioService.setEffectState(deckNumber, 'filter', effects.filter, effects.filter ? 1.0 : 0.0);
      audioService.setEffectState(deckNumber, 'echo', effects.echo, effects.echo ? 1.0 : 0.0);
      audioService.setEffectState(deckNumber, 'reverb', effects.reverb, effects.reverb ? 1.0 : 0.0);

      audioService.setEffect(deckNumber, 0, effects.flanger);
      audioService.setEffect(deckNumber, 1, effects.filter);
      audioService.setEffect(deckNumber, 2, effects.echo);
      audioService.setEffect(deckNumber, 3, effects.reverb);
    },
    [getAudioService]
  );

  // Set individual effect state
  const setEffectState = useCallback(
    (deckId: string | number, effectName: string, isActive: boolean, amount: number = 1.0) => {
      const audioService = getAudioService();
      audioService.setEffectState(deckId, effectName, isActive, amount);
    },
    [getAudioService]
  );

  // Update filter cutoff for a deck
  const updateFilter = useCallback((deckNumber: 1 | 2, cutoff: number) => {
    const audioService = getAudioService();
    audioService.setFilter(deckNumber, cutoff);
  }, [getAudioService]);

  // Update headphone volume
  const updateHeadphoneVolume = useCallback((volume: number) => {
    const audioService = getAudioService();
    audioService.setHeadphoneVolume(volume);
  }, [getAudioService]);

  // Set deck playing state
  const setDeckPlaying = useCallback(async (deckNumber: 1 | 2, playing: boolean) => {
    const audioService = getAudioService();
    if (playing) {
      await audioService.play(deckNumber);
    } else {
      audioService.pause(deckNumber);
    }
  }, [getAudioService]);

  // CUE functionality
  const setCuePoint = useCallback((deckNumber: 1 | 2, position: number) => {
    const audioService = getAudioService();
    audioService.setCuePoint(deckNumber, position);
  }, [getAudioService]);

  const cue = useCallback((deckNumber: 1 | 2, pressed: boolean) => {
    const audioService = getAudioService();
    audioService.cue(deckNumber, pressed);
  }, [getAudioService]);

  // Seek functionality
  const seek = useCallback((deckNumber: 1 | 2, position: number) => {
    const audioService = getAudioService();
    audioService.seek(deckNumber, position);
  }, [getAudioService]);

  // Scratch functionality
  const scratch = useCallback((deckNumber: 1 | 2, delta: number) => {
    const audioService = getAudioService();
    audioService.scratch(deckNumber, delta);
  }, [getAudioService]);

  // Headphone routing
  const setHeadphoneRouting = useCallback((deckNumber: 1 | 2, enabled: boolean) => {
    const audioService = getAudioService();
    audioService.setHeadphoneRouting(deckNumber, enabled);
  }, [getAudioService]);

  // Set crossfader
  const setCrossfader = useCallback((value: number) => {
    const audioService = getAudioService();
    audioService.setCrossfader(value);
  }, [getAudioService]);

  // Set browse position
  const setBrowsePosition = useCallback((delta: number) => {
    dispatch({ type: 'SET_BROWSE_POSITION', payload: delta });
  }, [dispatch]);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    const audioService = getAudioService();
    audioService.setMasterVolume(volume);
  }, [getAudioService]);

  // Legacy function for compatibility (not used with AudioService)
  const createDeckChain = useCallback(
    async (deckNumber: 1 | 2, audioBuffer: AudioBuffer) => {
      // This is no longer used - AudioService handles audio chains internally
      console.warn("createDeckChain is deprecated - use AudioService.loadTrack instead");
      return null;
    },
    []
  );

  // Legacy function for compatibility
  const applyCrossfader = useCallback((crossfaderValue: number) => {
    setCrossfader(crossfaderValue);
  }, [setCrossfader]);

  // Legacy function for compatibility
  const setDeckChain = useCallback((deckNumber: 1 | 2, chain: DeckAudioChain | null) => {
    // This is no longer used - AudioService handles audio chains internally
    console.warn("setDeckChain is deprecated");
  }, []);

  // Get AudioContext (for compatibility)
  const audioContext = audioServiceRef.current?.getAudioContext() || null;

  return {
    initAudioContext,
    loadTrack,
    createDeckChain,
    detectBPM,
    applyCrossfader,
    updateEQ,
    updateVolume,
    updatePitch,
    updateEffects,
    setEffectState,
    updateFilter,
    updateHeadphoneVolume,
    setDeckChain,
    setDeckPlaying,
    setCrossfader,
    setBrowsePosition,
    setMasterVolume,
    setHeadphoneVolume: updateHeadphoneVolume,
    setCuePoint,
    cue,
    seek,
    setBaseBPM,
    setSync,
    setHeadphoneRouting,
    scratch,
    audioContext,
    masterGain: null, // Not exposed directly anymore
    headphoneGain: null, // Not exposed directly anymore
    audioDevices: state.connectedDevices,
  };
};
