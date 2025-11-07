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

export const useAudioEngine = () => {
  const audioServiceRef = useRef<AudioService | null>(null);
  const { dispatch, state } = useDJ();
  const devicesRef = useRef<MediaDeviceInfo[]>([]);
  const initializedRef = useRef(false);

  // Initialize AudioService
  const initAudioContext = useCallback(async () => {
    if (initializedRef.current) {
      return;
    }

    try {
      console.log("Initializing AudioService...");

      // Get AudioService instance
      const audioService = AudioService.getInstance();
      audioServiceRef.current = audioService;

      // Initialize AudioService
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

      initializedRef.current = true;
      console.log("AudioService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize AudioService:", error);
      throw error;
    }
  }, [dispatch]);

  // Load track from file buffer
  const loadTrack = useCallback(
    async (deckNumber: 1 | 2, fileBuffer: ArrayBuffer) => {
      const audioService = audioServiceRef.current;
      if (!audioService) {
        throw new Error("AudioService not initialized");
      }

      await audioService.loadTrack(deckNumber, fileBuffer);
    },
    []
  );

  // Set base BPM for a deck
  const setBaseBPM = useCallback((deckNumber: 1 | 2, bpm: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;
    audioService.setBaseBPM(deckNumber, bpm);
  }, []);

  // Set sync for a deck
  const setSync = useCallback((deckNumber: 1 | 2, enabled: boolean) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;
    audioService.setSync(deckNumber, enabled);
  }, []);

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
      const audioService = audioServiceRef.current;
      if (!audioService) return;

      audioService.setEQ(deckNumber, 0, eq.low);
      audioService.setEQ(deckNumber, 1, eq.mid);
      audioService.setEQ(deckNumber, 2, eq.high);
    },
    []
  );

  // Update volume
  const updateVolume = useCallback((deckNumber: 1 | 2, volume: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;

    audioService.setVolume(deckNumber, volume);
  }, []);

  // Update pitch
  const updatePitch = useCallback((deckNumber: 1 | 2, pitch: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;

    audioService.setPitch(deckNumber, pitch);
  }, []);

  // Update effects
  const updateEffects = useCallback(
    (deckNumber: 1 | 2, effects: AudioEffects) => {
      const audioService = audioServiceRef.current;
      if (!audioService) return;

      audioService.setEffect(deckNumber, 0, effects.flanger);
      audioService.setEffect(deckNumber, 1, effects.filter);
      audioService.setEffect(deckNumber, 2, effects.echo);
      audioService.setEffect(deckNumber, 3, effects.reverb);
    },
    []
  );

  // Update headphone volume
  const updateHeadphoneVolume = useCallback((volume: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;

    audioService.setHeadphoneVolume(volume);
  }, []);

  // Set deck playing state
  const setDeckPlaying = useCallback(async (deckNumber: 1 | 2, playing: boolean) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;

    if (playing) {
      await audioService.play(deckNumber);
    } else {
      audioService.pause(deckNumber);
    }
  }, []);

  // CUE functionality
  const setCuePoint = useCallback((deckNumber: 1 | 2, position: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;
    audioService.setCuePoint(deckNumber, position);
  }, []);

  const cue = useCallback((deckNumber: 1 | 2, pressed: boolean) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;
    audioService.cue(deckNumber, pressed);
  }, []);

  // Seek functionality
  const seek = useCallback((deckNumber: 1 | 2, position: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;
    audioService.seek(deckNumber, position);
  }, []);

  // Scratch functionality
  const scratch = useCallback((deckNumber: 1 | 2, delta: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;
    audioService.scratch(deckNumber, delta);
  }, []);

  // Headphone routing
  const setHeadphoneRouting = useCallback((deckNumber: 1 | 2, enabled: boolean) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;
    audioService.setHeadphoneRouting(deckNumber, enabled);
  }, []);

  // Set crossfader
  const setCrossfader = useCallback((value: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;

    audioService.setCrossfader(value);
  }, []);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    const audioService = audioServiceRef.current;
    if (!audioService) return;

    audioService.setMasterVolume(volume);
  }, []);

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
    updateHeadphoneVolume,
    setDeckChain,
    setDeckPlaying,
    setCrossfader,
    setMasterVolume,
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
