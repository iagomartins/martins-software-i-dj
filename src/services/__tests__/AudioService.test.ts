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
});
