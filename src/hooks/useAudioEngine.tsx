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
  pitch: number;
  volume: number;
  lowEQ: number;
  midEQ: number;
  highEQ: number;
  effects: AudioEffects;
}

export const useAudioEngine = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const deck1NodeRef = useRef<AudioBufferSourceNode | null>(null);
  const deck2NodeRef = useRef<AudioBufferSourceNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const headphoneGainRef = useRef<GainNode | null>(null);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      
      // Create master output
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      
      // Create headphone output
      headphoneGainRef.current = audioContextRef.current.createGain();
      headphoneGainRef.current.connect(audioContextRef.current.destination);
    }
  }, []);

  const createEQFilter = useCallback((context: AudioContext, type: BiquadFilterType, frequency: number) => {
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, context.currentTime);
    return filter;
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
    
    // Connect chain
    source.connect(lowFilter);
    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(volumeGain);
    
    // Split to master and headphone outputs
    volumeGain.connect(masterGain);
    volumeGain.connect(headphoneGain);
    
    if (masterGainRef.current) {
      masterGain.connect(masterGainRef.current);
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
      headphoneGain
    };
  }, [createEQFilter]);

  const detectBPM = useCallback(async (audioBuffer: AudioBuffer): Promise<number> => {
    // Simplified BPM detection - in a real app, you'd use more sophisticated algorithms
    // This is a placeholder that returns a random BPM between 120-140
    return Math.round(120 + Math.random() * 20);
  }, []);

  const applyCrossfader = useCallback((crossfaderValue: number, deck1Gain: GainNode, deck2Gain: GainNode) => {
    // crossfaderValue: -1 = deck1 only, 0 = both equal, 1 = deck2 only
    const deck1Volume = crossfaderValue <= 0 ? 1 : Math.max(0, 1 - crossfaderValue);
    const deck2Volume = crossfaderValue >= 0 ? 1 : Math.max(0, 1 + crossfaderValue);
    
    if (deck1Gain) {
      deck1Gain.gain.setValueAtTime(deck1Volume, audioContextRef.current?.currentTime || 0);
    }
    if (deck2Gain) {
      deck2Gain.gain.setValueAtTime(deck2Volume, audioContextRef.current?.currentTime || 0);
    }
  }, []);

  const updateEQ = useCallback((
    filters: { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode },
    eq: { low: number; mid: number; high: number }
  ) => {
    const context = audioContextRef.current;
    if (!context) return;

    // Convert -1..1 range to dB gain
    const lowGain = eq.low * 12; // +/- 12dB
    const midGain = eq.mid * 12;
    const highGain = eq.high * 12;

    filters.low.gain.setValueAtTime(lowGain, context.currentTime);
    filters.mid.gain.setValueAtTime(midGain, context.currentTime);
    filters.high.gain.setValueAtTime(highGain, context.currentTime);
  }, []);

  return {
    initAudioContext,
    createDeckChain,
    detectBPM,
    applyCrossfader,
    updateEQ,
    audioContext: audioContextRef.current,
    masterGain: masterGainRef.current,
    headphoneGain: headphoneGainRef.current
  };
};