/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AudioService Unit Tests - Singleton & Memory Integrity
 * Location: src/services/__tests__/AudioService.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import AudioService from '../AudioService';
import { MockAudioContext, MockAudioBuffer } from '@/test/setupTests';

describe('AudioService - Singleton & Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acts as a strict Singleton, returning the identical instance on repeated calls', () => {
    const instanceA = AudioService.getInstance();
    const instanceB = AudioService.getInstance();
    expect(instanceA).toBe(instanceB);
  });

  it('guarantees single initialization without duplicate AudioContext instantiation on concurrent initialize() calls', async () => {
    const service = AudioService.getInstance();
    const audioContextSpy = vi.spyOn(globalThis as any, 'AudioContext');

    // Trigger concurrent initialization calls (e.g. from React StrictMode or multiple components)
    const [init1, init2, init3] = await Promise.all([
      service.initialize(),
      service.initialize(),
      service.initialize(),
    ]);

    expect(service.isInitialized()).toBe(true);
    // AudioContext should only have been created once across all concurrent calls
    expect(audioContextSpy.mock.calls.length).toBeLessThanOrEqual(1);

    // Subsequent call after already initialized should be a no-op
    await service.initialize();
    expect(audioContextSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('AudioService - Track Loading & Memory Safety', () => {
  let service: AudioService;

  beforeEach(async () => {
    service = AudioService.getInstance();
    await service.initialize();
  });

  it('loads audio via asynchronous Blob.arrayBuffer without synchronous blocking', async () => {
    const mockArrayBuffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]).buffer; // 'RIFF' header
    const mockBlob = new Blob([mockArrayBuffer], { type: 'audio/wav' });

    const arrayBufferSpy = vi.spyOn(mockBlob, 'arrayBuffer').mockResolvedValue(mockArrayBuffer);

    const resultBuffer = await service.loadTrack(1, mockBlob);

    expect(arrayBufferSpy).toHaveBeenCalledTimes(1);
    expect(resultBuffer).toBeDefined();
    expect(service.getDeckAudioBuffer(1)).toBe(resultBuffer);
  });

  it('safely handles ArrayBuffer sources and updates deck audio state', async () => {
    const rawBuffer = new ArrayBuffer(1024);
    const audioBuffer = await service.loadTrack(2, rawBuffer);

    expect(audioBuffer).toBeDefined();
    expect(service.getDeckAudioBuffer(2)).toBe(audioBuffer);
  });

  it('safely handles direct Uint8Array sources from zero-copy Electron IPC without re-allocation', async () => {
    const rawUint8 = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]); // 'RIFF'
    const audioBuffer = await service.loadTrack(1, rawUint8);

    expect(audioBuffer).toBeDefined();
    expect(service.getDeckAudioBuffer(1)).toBe(audioBuffer);
  });

  it('rejects unsupported source types cleanly with descriptive error', async () => {
    await expect(service.loadTrack(1, null as any)).rejects.toThrow('Unsupported audio source type');
  });

  it('handles decode errors gracefully without corrupting existing deck state', async () => {
    const ctx = (service as any).audioContext as MockAudioContext;
    const initialBuffer = service.getDeckAudioBuffer(1);

    // Mock decodeAudioData rejection (e.g. corrupted WAV)
    ctx.decodeAudioData = vi.fn().mockRejectedValueOnce(new Error('Corrupted WAV header'));

    await expect(service.loadTrack(1, new ArrayBuffer(512))).rejects.toThrow('Corrupted WAV header');

    // Deck buffer should retain previous state or remain clean
    expect(service.getDeckAudioBuffer(1)).toBe(initialBuffer);
  });
});

describe('AudioService - Equal Power Crossfader', () => {
  let service: AudioService;

  beforeEach(async () => {
    service = AudioService.getInstance();
    await service.initialize();
  });

  it('calculates Constant Power trigonometric gain at center (0.5 -> ~0.7071)', () => {
    service.setCrossfader(0.5);

    const deck1GainNode = (service as any).deckCrossfaderGains.get(1);
    const deck2GainNode = (service as any).deckCrossfaderGains.get(2);

    expect(deck1GainNode).toBeDefined();
    expect(deck2GainNode).toBeDefined();

    // Verify setTargetAtTime was called with ~0.7071
    const expectedGain = Math.SQRT1_2; // ~0.70710678
    const lastCallDeck1 = deck1GainNode.gain.setTargetAtTime.mock.calls.at(-1);
    const lastCallDeck2 = deck2GainNode.gain.setTargetAtTime.mock.calls.at(-1);

    expect(lastCallDeck1[0]).toBeCloseTo(expectedGain, 3);
    expect(lastCallDeck2[0]).toBeCloseTo(expectedGain, 3);

    // Total acoustic power must equal 1.0 (no volume hole)
    const totalPower = Math.pow(lastCallDeck1[0], 2) + Math.pow(lastCallDeck2[0], 2);
    expect(totalPower).toBeCloseTo(1.0, 4);
  });

  it('routes 100% to Deck A at crossfader 0.0 and 100% to Deck B at 1.0', () => {
    const deck1GainNode = (service as any).deckCrossfaderGains.get(1);
    const deck2GainNode = (service as any).deckCrossfaderGains.get(2);

    // Full Left (Deck A only)
    service.setCrossfader(0.0);
    const callLeftA = deck1GainNode.gain.setTargetAtTime.mock.calls.at(-1)[0];
    const callLeftB = deck2GainNode.gain.setTargetAtTime.mock.calls.at(-1)[0];
    expect(callLeftA).toBeCloseTo(1.0, 4);
    expect(callLeftB).toBeCloseTo(0.0, 4);

    // Full Right (Deck B only)
    service.setCrossfader(1.0);
    const callRightA = deck1GainNode.gain.setTargetAtTime.mock.calls.at(-1)[0];
    const callRightB = deck2GainNode.gain.setTargetAtTime.mock.calls.at(-1)[0];
    expect(callRightA).toBeCloseTo(0.0, 4);
    expect(callRightB).toBeCloseTo(1.0, 4);
  });

  it('guarantees zero duplicate audio output streams (no default HTMLAudioElement duplicating native destination)', () => {
    // defaultAudioElement must not exist to prevent duplicate playback to default device
    expect((service as any).defaultAudioElement).toBeUndefined();
  });
});

describe('AudioService - 3-Band DJ Isolator EQ', () => {
  let service: AudioService;

  beforeEach(async () => {
    service = AudioService.getInstance();
    await service.initialize();
  });

  it('initializes 3-band BiquadFilter EQ chain with exact DJ filter specifications for each deck', () => {
    const deck1Filters = service.getDeckEQFilters(1);
    const deck2Filters = service.getDeckEQFilters(2);

    expect(deck1Filters).toBeDefined();
    expect(deck2Filters).toBeDefined();

    // Deck 1 filter specs
    expect(deck1Filters?.low.type).toBe('lowshelf');
    expect(deck1Filters?.low.frequency.value).toBe(250);

    expect(deck1Filters?.mid.type).toBe('peaking');
    expect(deck1Filters?.mid.frequency.value).toBe(1000);
    expect(deck1Filters?.mid.Q.value).toBe(1.0);

    expect(deck1Filters?.high.type).toBe('highshelf');
    expect(deck1Filters?.high.frequency.value).toBe(4000);

    // Initial state must be flat (0 dB)
    expect(deck1Filters?.low.gain.value).toBe(0);
    expect(deck1Filters?.mid.gain.value).toBe(0);
    expect(deck1Filters?.high.gain.value).toBe(0);
  });

  it('maps UI value [0.0, 1.0] to dB with 0.0=-40dB (kill), 0.5=0dB (flat), and 1.0=+6dB (boost)', () => {
    const deck1Filters = service.getDeckEQFilters(1);

    // Low Kill: value = 0.0 -> -40 dB
    service.setDeckEQ('1', 'low', 0.0);
    const lowCall = deck1Filters?.low.gain.setTargetAtTime.mock.calls.at(-1);
    expect(lowCall?.[0]).toBeCloseTo(-40, 1);

    // Mid Flat: value = 0.5 -> 0 dB
    service.setDeckEQ(1, 'mid', 0.5);
    const midCall = deck1Filters?.mid.gain.setTargetAtTime.mock.calls.at(-1);
    expect(midCall?.[0]).toBeCloseTo(0, 1);

    // High Boost: value = 1.0 -> +6 dB
    service.setDeckEQ('deck1', 'high', 1.0);
    const highCall = deck1Filters?.high.gain.setTargetAtTime.mock.calls.at(-1);
    expect(highCall?.[0]).toBeCloseTo(6, 1);

    // Intermediate position: 0.25 -> -20 dB
    service.setDeckEQ('1', 'low', 0.25);
    const lowMidCall = deck1Filters?.low.gain.setTargetAtTime.mock.calls.at(-1);
    expect(lowMidCall?.[0]).toBeCloseTo(-20, 1);
  });

  it('connects audio graph in sequence: Source -> Low -> Mid -> High -> GainNode on playback', async () => {
    const ctx = (service as any).audioContext;
    ctx.decodeAudioData = vi.fn().mockResolvedValue(
      new MockAudioBuffer({ duration: 120, sampleRate: 44100, numberOfChannels: 2 })
    );

    // Reset graph so setupDeckAudioGraph re-runs and we can observe workletNode.connect
    const deckState = service.getDeckState(1);
    (deckState as any).eqFilters = null;
    (deckState as any).gainNode = null;
    (deckState as any).graphConnected = false;
    service.setupDeckAudioGraph(1);

    const filters = service.getDeckEQFilters(1);

    const mockArrayBuffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]).buffer;
    const mockBlob = new Blob([mockArrayBuffer], { type: 'audio/wav' });
    vi.spyOn(mockBlob, 'arrayBuffer').mockResolvedValue(mockArrayBuffer);
    await service.loadTrack(1, mockBlob);

    await service.play(1);

    expect(deckState?.sourceNode).toBeDefined();
    expect(filters).toBeDefined();

    // Source must connect to WorkletNode
    expect(deckState?.sourceNode?.connect).toHaveBeenCalledWith(deckState?.workletNode);
    // Worklet must connect to LowFilter (wired during setupDeckAudioGraph)
    expect(deckState?.workletNode?.connect).toHaveBeenCalledWith(filters?.low);

    // Verify filter chain internal wiring
    // LowFilter must connect to MidFilter
    expect(filters?.low.connect).toHaveBeenCalledWith(filters?.mid);
    // MidFilter must connect to HighFilter
    expect(filters?.mid.connect).toHaveBeenCalledWith(filters?.high);
    // HighFilter must connect to GainNode
    expect(filters?.high.connect).toHaveBeenCalledWith(deckState?.gainNode);

    // Deck crossfader gain must connect to destination and masterDestination for audio output
    const crossfaderGain = (service as any).deckCrossfaderGains.get(1);
    expect(crossfaderGain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(crossfaderGain.connect).toHaveBeenCalledWith((service as any).masterDestination);
  });
});

describe('AudioService - Effects (FX) Integration', () => {
  let service: AudioService;

  beforeEach(async () => {
    service = AudioService.getInstance();
    await service.initialize();
  });

  it('exposes fxWorkletNode getter referencing the active AudioWorkletNode', () => {
    expect(service.fxWorkletNode).toBeDefined();
    expect(service.fxWorkletNode?.port?.postMessage).toBeDefined();
  });

  it('implements setEffectState and posts UPDATE_FX payload to AudioWorkletNode', () => {
    const postMessageSpy = vi.spyOn(service.fxWorkletNode!.port, 'postMessage');

    service.setEffectState('deck1', 'flanger', true, 0.75);

    expect(postMessageSpy).toHaveBeenCalledWith({
      type: 'UPDATE_FX',
      payload: {
        deckId: 'deck1',
        effectName: 'flanger',
        isActive: true,
        amount: 0.75,
      },
    });
  });

  it('handles disabling effects with setEffectState', () => {
    const postMessageSpy = vi.spyOn(service.fxWorkletNode!.port, 'postMessage');

    service.setEffectState('deck2', 'echo', false, 0.0);

    expect(postMessageSpy).toHaveBeenCalledWith({
      type: 'UPDATE_FX',
      payload: {
        deckId: 'deck2',
        effectName: 'echo',
        isActive: false,
        amount: 0.0,
      },
    });
  });
});

describe('AudioService - Strict Graph Separation & Routing Isolation', () => {
  let service: AudioService;

  beforeEach(async () => {
    service = AudioService.getInstance();
    await service.initialize();
  });

  it('instantiates dedicated, isolated AudioWorkletNode instances for each deck', () => {
    const deck1 = service.getDeckState(1);
    const deck2 = service.getDeckState(2);

    expect(deck1?.workletNode).toBeDefined();
    expect(deck2?.workletNode).toBeDefined();
    expect(deck1?.workletNode).not.toBe(deck2?.workletNode);
  });

  it('enforces single path: Source -> Worklet -> Low -> Mid -> High -> VolumeGain -> CrossfaderGain -> Destination', async () => {
    const ctx = (service as any).audioContext;
    ctx.decodeAudioData = vi.fn().mockResolvedValue(
      new MockAudioBuffer({ duration: 120, sampleRate: 44100, numberOfChannels: 2 })
    );

    const deck1 = service.getDeckState(1);
    (deck1 as any).eqFilters = null;
    (deck1 as any).gainNode = null;
    (deck1 as any).graphConnected = false;
    service.setupDeckAudioGraph(1);

    const mockArrayBuffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]).buffer;
    const mockBlob = new Blob([mockArrayBuffer], { type: 'audio/wav' });
    vi.spyOn(mockBlob, 'arrayBuffer').mockResolvedValue(mockArrayBuffer);
    await service.loadTrack(1, mockBlob);

    await service.play(1);

    const filters = service.getDeckEQFilters(1);
    const crossfaderGain = (service as any).deckCrossfaderGains.get(1);

    // 1. Source must connect to Worklet
    expect(deck1?.sourceNode?.connect).toHaveBeenCalledWith(deck1?.workletNode);

    // 2. Worklet must connect to LowFilter
    expect(deck1?.workletNode?.connect).toHaveBeenCalledWith(filters?.low);

    // 3. LowFilter -> MidFilter -> HighFilter
    expect(filters?.low.connect).toHaveBeenCalledWith(filters?.mid);
    expect(filters?.mid.connect).toHaveBeenCalledWith(filters?.high);

    // 4. HighFilter -> VolumeGain
    expect(filters?.high.connect).toHaveBeenCalledWith(deck1?.gainNode);

    // 5. VolumeGain -> CrossfaderGain
    expect(deck1?.gainNode?.connect).toHaveBeenCalledWith(crossfaderGain);

    // 6. CrossfaderGain -> Destination and masterDestination
    expect(crossfaderGain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(crossfaderGain.connect).toHaveBeenCalledWith((service as any).masterDestination);

    // 7. Prohibit rogue bypass connections
    expect(deck1?.sourceNode?.connect).not.toHaveBeenCalledWith(ctx.destination);
    expect(deck1?.sourceNode?.connect).not.toHaveBeenCalledWith((service as any).masterDestination);
    expect(deck1?.sourceNode?.connect).not.toHaveBeenCalledWith((service as any).masterGain);
    expect(deck1?.workletNode?.connect).not.toHaveBeenCalledWith((service as any).masterGain);
    expect(deck1?.gainNode?.connect).not.toHaveBeenCalledWith(ctx.destination);
  });

  it('routes Deck 2 dynamically through Deck 2 dedicated nodes without crosstalk or Deck 1 leaks', async () => {
    const ctx = (service as any).audioContext;
    ctx.decodeAudioData = vi.fn().mockResolvedValue(
      new MockAudioBuffer({ duration: 120, sampleRate: 44100, numberOfChannels: 2 })
    );

    const deck2 = service.getDeckState(2);
    (deck2 as any).eqFilters = null;
    (deck2 as any).gainNode = null;
    (deck2 as any).graphConnected = false;
    service.setupDeckAudioGraph(2);

    const mockArrayBuffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]).buffer;
    const mockBlob = new Blob([mockArrayBuffer], { type: 'audio/wav' });
    vi.spyOn(mockBlob, 'arrayBuffer').mockResolvedValue(mockArrayBuffer);
    await service.loadTrack(2, mockBlob);

    await service.play(2);

    const filters2 = service.getDeckEQFilters(2);
    const crossfaderGain2 = (service as any).deckCrossfaderGains.get(2);

    expect(deck2?.sourceNode).toBeDefined();
    expect(deck2?.workletNode).toBeDefined();

    // Source2 must connect to Worklet2
    expect(deck2?.sourceNode?.connect).toHaveBeenCalledWith(deck2?.workletNode);
    // Worklet2 must connect to LowFilter2
    expect(deck2?.workletNode?.connect).toHaveBeenCalledWith(filters2?.low);
    // LowFilter2 -> MidFilter2 -> HighFilter2
    expect(filters2?.low.connect).toHaveBeenCalledWith(filters2?.mid);
    expect(filters2?.mid.connect).toHaveBeenCalledWith(filters2?.high);
    // HighFilter2 must connect to GainNode2
    expect(filters2?.high.connect).toHaveBeenCalledWith(deck2?.gainNode);
    // GainNode2 must connect to CrossfaderGain2
    expect(deck2?.gainNode?.connect).toHaveBeenCalledWith(crossfaderGain2);

    // Verify Deck 2 is NOT connected to Deck 1 nodes
    const deck1 = service.getDeckState(1);
    expect(deck2?.sourceNode?.connect).not.toHaveBeenCalledWith(deck1?.workletNode);
    expect(deck2?.gainNode?.connect).not.toHaveBeenCalledWith((service as any).deckCrossfaderGains.get(1));
  });
});


