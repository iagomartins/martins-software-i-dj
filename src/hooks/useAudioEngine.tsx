import { useRef, useCallback, useEffect } from 'react';

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

  const initAudioContext = useCallback(async () => {
    try {
      // Check if we're in Electron
      const isElectron = window.require && window.require('electron');
      
      if (isElectron) {
        // In Electron, we don't need to request permissions through IPC
        // Just initialize the audio context
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 48000
          });
          
          // Create master output
          masterGainRef.current = audioContextRef.current.createGain();
          masterGainRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime);
          
          // Create crossfader
          crossfaderGainRef.current = audioContextRef.current.createGain();
          crossfaderGainRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime);
          
          // Create headphone output
          headphoneGainRef.current = audioContextRef.current.createGain();
          headphoneGainRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime);
          
          // Create headphone volume control
          headphoneVolumeRef.current = audioContextRef.current.createGain();
          headphoneVolumeRef.current.gain.setValueAtTime(0.7, audioContextRef.current.currentTime);
          
          // Connect chain
          crossfaderGainRef.current.connect(masterGainRef.current);
          headphoneGainRef.current.connect(headphoneVolumeRef.current);
          masterGainRef.current.connect(audioContextRef.current.destination);
          headphoneVolumeRef.current.connect(audioContextRef.current.destination);
          
          console.log('Electron audio context initialized successfully');
        }

        // Get available audio devices directly (in renderer process)
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => 
              device.kind === 'audioinput' || device.kind === 'audiooutput'
            );
            // setAudioDevices(audioDevices); // This line was not in the original file, so it's removed.
            console.log('Audio devices found:', audioDevices.length);
          } catch (error) {
            console.warn('Could not enumerate audio devices:', error);
          }
        }
      } else {
        // Web version - request permissions normally
        const hasPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
        // ... rest of web initialization
      }
      
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw error;
    }
  }, []);

  const createEQFilter = useCallback((context: AudioContext, type: BiquadFilterType, frequency: number) => {
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, context.currentTime);
    filter.Q.setValueAtTime(1, context.currentTime);
    return filter;
  }, []);

  const createEffects = useCallback((context: AudioContext) => {
    // Flanger effect
    const flanger = context.createDelay(0.003);
    flanger.delayTime.setValueAtTime(0.003, context.currentTime);
    
    // Filter effect
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
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
        channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.1));
      }
    }
    reverb.buffer = impulse;
    
    return { flanger, filter, echo, reverb };
  }, []);

  const createDeckChain = useCallback(async (deckNumber: 1 | 2, audioBuffer: AudioBuffer) => {
    if (!audioContextRef.current) return null;

    const context = audioContextRef.current;
    
    // Create source
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    
    // Create EQ filters
    const lowFilter = createEQFilter(context, 'lowshelf', 320);
    const midFilter = createEQFilter(context, 'peaking', 1000);
    const highFilter = createEQFilter(context, 'highshelf', 3200);
    
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
      ...effects
    };
  }, [createEQFilter, createEffects]);

  const detectBPM = useCallback(async (audioBuffer: AudioBuffer): Promise<number> => {
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
      if (downsampled[i] > onsetThreshold && downsampled[i - 1] <= onsetThreshold) {
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
    intervals.forEach(interval => {
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
    const bpm = Math.round((sampleRate / downsampleFactor) * 60 / mostCommonInterval);
    return Math.max(60, Math.min(200, bpm)); // Clamp between 60-200 BPM
  }, []);

  const applyCrossfader = useCallback((crossfaderValue: number) => {
    if (!crossfaderGainRef.current || !deck1ChainRef.current || !deck2ChainRef.current) return;
    
    // crossfaderValue: -1 = deck1 only, 0 = both equal, 1 = deck2 only
    const deck1Volume = crossfaderValue <= 0 ? 1 : Math.max(0, 1 - crossfaderValue);
    const deck2Volume = crossfaderValue >= 0 ? 1 : Math.max(0, 1 + crossfaderValue);
    
    deck1ChainRef.current.masterGain.gain.setValueAtTime(deck1Volume, audioContextRef.current?.currentTime || 0);
    deck2ChainRef.current.masterGain.gain.setValueAtTime(deck2Volume, audioContextRef.current?.currentTime || 0);
  }, []);

  const updateEQ = useCallback((
    deckNumber: 1 | 2,
    eq: { low: number; mid: number; high: number }
  ) => {
    const chain = deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
    if (!chain || !audioContextRef.current) return;

    const context = audioContextRef.current;
    
    // Convert -1..1 range to dB gain
    const lowGain = eq.low * 12; // +/- 12dB
    const midGain = eq.mid * 12;
    const highGain = eq.high * 12;

    chain.lowFilter.gain.setValueAtTime(lowGain, context.currentTime);
    chain.midFilter.gain.setValueAtTime(midGain, context.currentTime);
    chain.highFilter.gain.setValueAtTime(highGain, context.currentTime);
  }, []);

  const updateVolume = useCallback((deckNumber: 1 | 2, volume: number) => {
    const chain = deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
    if (!chain) return;
    
    chain.volumeGain.gain.setValueAtTime(volume, audioContextRef.current?.currentTime || 0);
  }, []);

  const updatePitch = useCallback((deckNumber: 1 | 2, pitch: number) => {
    const chain = deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
    if (!chain) return;
    
    // Pitch affects playback rate
    const playbackRate = Math.pow(2, pitch);
    chain.source.playbackRate.setValueAtTime(playbackRate, audioContextRef.current?.currentTime || 0);
  }, []);

  const updateEffects = useCallback((deckNumber: 1 | 2, effects: AudioEffects) => {
    const chain = deckNumber === 1 ? deck1ChainRef.current : deck2ChainRef.current;
    if (!chain || !audioContextRef.current) return;

    const context = audioContextRef.current;
    
    // Ensure all effects and their gain nodes exist before trying to access them
    if (chain.flangerGain && chain.filterGain && chain.echoGain && chain.reverbGain) {
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
  }, []);

  const updateHeadphoneVolume = useCallback((volume: number) => {
    if (!headphoneVolumeRef.current) return;
    headphoneVolumeRef.current.gain.setValueAtTime(volume, audioContextRef.current?.currentTime || 0);
  }, []);

  const setDeckChain = useCallback((deckNumber: 1 | 2, chain: DeckAudioChain) => {
    if (deckNumber === 1) {
      deck1ChainRef.current = chain;
    } else {
      deck2ChainRef.current = chain;
    }
  }, []);

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
    audioContext: audioContextRef.current,
    masterGain: masterGainRef.current,
    headphoneGain: headphoneGainRef.current
  };
};