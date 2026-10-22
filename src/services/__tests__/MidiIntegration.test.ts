/**
 * MIDI Controller Integration Tests
 * Location: src/services/__tests__/MidiIntegration.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseHerculesMidiMessage,
  parseMidiBytes,
  parseRawMidiEvent,
  HERCULES_CC_MAP,
  HERCULES_BUTTON_MAP,
} from '../MidiParser';
import { MidiRouter } from '../MidiRouter';
import { MidiService } from '../MidiService';
import AudioService from '../AudioService';
import { DJState, DJAction } from '@/contexts/DJContext';
import { RawMidiEvent } from '@/types/midi';

describe('MidiParser - Strict Hardware Translation (Mixxx Spec)', () => {
  it('correctly maps all Mixxx Control Change (Status 176 / 0xb0) IDs', () => {
    expect(HERCULES_CC_MAP[0x3a]).toBe('CROSSFADER');     // 58
    expect(HERCULES_CC_MAP[0x36]).toBe('DECK_A_VOLUME');  // 54
    expect(HERCULES_CC_MAP[0x3b]).toBe('DECK_B_VOLUME');  // 59
    expect(HERCULES_CC_MAP[0x37]).toBe('DECK_A_EQ_HIGH'); // 55
    expect(HERCULES_CC_MAP[0x38]).toBe('DECK_A_EQ_MID');  // 56
    expect(HERCULES_CC_MAP[0x39]).toBe('DECK_A_EQ_LOW');  // 57
    expect(HERCULES_CC_MAP[0x3c]).toBe('DECK_B_EQ_HIGH'); // 60
    expect(HERCULES_CC_MAP[0x3d]).toBe('DECK_B_EQ_MID');  // 61
    expect(HERCULES_CC_MAP[0x3e]).toBe('DECK_B_EQ_LOW');  // 62
    expect(HERCULES_CC_MAP[0x32]).toBe('DECK_A_JOG');     // 50
    expect(HERCULES_CC_MAP[0x33]).toBe('DECK_B_JOG');     // 51
  });

  it('correctly maps all Mixxx Button (Status 144 / 0x90) IDs', () => {
    expect(HERCULES_BUTTON_MAP[0x16]).toBe('DECK_A_PLAY_PAUSE'); // 22
    expect(HERCULES_BUTTON_MAP[0x30]).toBe('DECK_B_PLAY_PAUSE'); // 48
    expect(HERCULES_BUTTON_MAP[0x15]).toBe('DECK_A_CUE');        // 21
    expect(HERCULES_BUTTON_MAP[0x2f]).toBe('DECK_B_CUE');        // 47
    expect(HERCULES_BUTTON_MAP[0x17]).toBe('DECK_A_SYNC');       // 23
    expect(HERCULES_BUTTON_MAP[0x31]).toBe('DECK_B_SYNC');       // 49
    expect(HERCULES_BUTTON_MAP[0x19]).toBe('DECK_A_LOAD');       // 25
    expect(HERCULES_BUTTON_MAP[0x33]).toBe('DECK_B_LOAD');       // 51
  });

  it('normalizes CC values from 0-127 to float 0.0 - 1.0 (linear) and -1.0 - 1.0 (bipolar)', () => {
    // Crossfader center (64)
    const center = parseMidiBytes([176, 0x3a, 64])!;
    expect(center).not.toBeNull();
    expect(center.normalizedValue).toBeCloseTo(64 / 127, 3);
    expect(center.bipolarValue).toBeCloseTo(0.0078, 3);

    // Deck Volume min (0) & max (127)
    const minVol = parseMidiBytes([176, 0x36, 0])!;
    expect(minVol.normalizedValue).toBe(0.0);

    const maxVol = parseMidiBytes([176, 0x36, 127])!;
    expect(maxVol.normalizedValue).toBe(1.0);
  });

  it('triggers buttons ONLY on press (Value === 127) and ignores release (Value === 0)', () => {
    const playPress = parseMidiBytes([144, 0x16, 127]);
    expect(playPress).not.toBeNull();
    expect(playPress?.action).toBe('DECK_A_PLAY_PAUSE');

    // Button release: must return null to prevent double toggling
    const playRelease = parseMidiBytes([144, 0x16, 0]);
    expect(playRelease).toBeNull();

    const partialVelocity = parseMidiBytes([144, 0x16, 64]);
    expect(partialVelocity).toBeNull();
  });

  it('computes correct relative delta for Jog Wheels (forward <= 64, backward > 64)', () => {
    // Forward rotation (+1 tick, +5 ticks)
    const fwd1 = parseMidiBytes([176, 0x32, 1])!;
    expect(fwd1.delta).toBe(1);

    const fwd5 = parseMidiBytes([176, 0x32, 5])!;
    expect(fwd5.delta).toBe(5);

    // Backward rotation: 127 = -1 tick (127 - 128), 123 = -5 ticks (123 - 128)
    const back1 = parseMidiBytes([176, 0x32, 127])!;
    expect(back1.delta).toBe(-1);

    const back5 = parseMidiBytes([176, 0x32, 123])!;
    expect(back5.delta).toBe(-5);
  });

  it('disambiguates ControlID 51 (0x33) between Deck B Load (Note 144) and Deck B Jog (CC 176)', () => {
    const loadDeckB = parseMidiBytes([144, 0x33, 127]);
    expect(loadDeckB?.action).toBe('DECK_B_LOAD');
    expect(loadDeckB?.kind).toBe('BUTTON');

    const jogDeckB = parseMidiBytes([176, 0x33, 2]);
    expect(jogDeckB?.action).toBe('DECK_B_JOG');
    expect(jogDeckB?.kind).toBe('JOG');
    expect(jogDeckB?.delta).toBe(2);
  });
});

describe('MidiRouter - State & Audio Routing Integration', () => {
  let router: MidiRouter;
  let audioService: AudioService;
  let mockState: DJState;
  let mockDispatch: any;

  beforeEach(async () => {
    audioService = AudioService.getInstance();
    await audioService.initialize();

    mockState = {
      activeHeadphoneDecks: new Set<number>(),
      connectedDevices: [],
      audioConfig: {
        masterOutput: 'default',
        headphoneOutput: 'default',
        latency: 128,
        sampleRate: 44100,
        inputChannels: 'default',
      },
      isConfigModalOpen: false,
      keyMappings: {},
      analogMappings: {},
      deck1: {
        isPlaying: false,
        isCued: false,
        currentTime: 0,
        duration: 120,
        bpm: 120,
        baseBpm: 120,
        pitch: 0,
        volume: 1,
        lowEQ: 0,
        midEQ: 0,
        highEQ: 0,
        filter: 0,
        isLoadingTrack: false,
        loadingProgress: 0,
        trackLoadError: null,
        trackName: null,
        effects: { flanger: false, filter: false, echo: false, reverb: false },
      },
      deck2: {
        isPlaying: false,
        isCued: false,
        currentTime: 0,
        duration: 120,
        bpm: 120,
        baseBpm: 120,
        pitch: 0,
        volume: 1,
        lowEQ: 0,
        midEQ: 0,
        highEQ: 0,
        filter: 0,
        isLoadingTrack: false,
        loadingProgress: 0,
        trackLoadError: null,
        trackName: null,
        effects: { flanger: false, filter: false, echo: false, reverb: false },
      },
      crossfader: 0.5,
      headphoneVolume: 1,
      browsePosition: 0,
      selectedControllerPreset: null,
    };

    mockDispatch = vi.fn((action: DJAction) => {
      if (action.type === 'SET_DECK_1_STATE') {
        mockState.deck1 = { ...mockState.deck1, ...action.payload };
      }
      if (action.type === 'SET_CROSSFADER') {
        mockState.crossfader = action.payload;
      }
    });

    router = new MidiRouter();
    router.setDependencies({
      getState: () => mockState,
      dispatch: mockDispatch,
    });
  });

  it('routes Crossfader CC to AudioService with Constant Power and dispatches to state', () => {
    const crossfaderSpy = vi.spyOn(audioService, 'setCrossfader');

    const event: RawMidiEvent = {
      status: 176,
      data1: 0x3a,
      data2: 64, // Center position
      channel: 0,
      command: 'CONTROL_CHANGE',
      timestamp: performance.now(),
      raw: new Uint8Array([176, 0x3a, 64]),
    };

    router.route(event);

    // AudioService receives normalized 0.0 - 1.0 (64/127 ≈ 0.5039)
    expect(crossfaderSpy).toHaveBeenCalledTimes(1);
    expect(crossfaderSpy.mock.calls[0][0]).toBeCloseTo(64 / 127, 3);
  });

  it('routes Deck A Volume to AudioService and schedules state update', () => {
    const volumeSpy = vi.spyOn(audioService, 'setVolume');

    const event: RawMidiEvent = {
      status: 176,
      data1: 0x36,
      data2: 127,
      channel: 0,
      command: 'CONTROL_CHANGE',
      timestamp: performance.now(),
      raw: new Uint8Array([176, 0x36, 127]),
    };

    router.route(event);

    expect(volumeSpy).toHaveBeenCalledWith(1, 1.0);
  });

  it('routes Deck A Play button press to AudioService.play and toggles isPlaying', () => {
    const playSpy = vi.spyOn(audioService, 'play');

    const event: RawMidiEvent = {
      status: 144,
      data1: 0x16, // Deck A Play
      data2: 127,  // Press
      channel: 0,
      command: 'NOTE_ON',
      timestamp: performance.now(),
      raw: new Uint8Array([144, 0x16, 127]),
    };

    router.route(event);

    expect(playSpy).toHaveBeenCalledWith(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_DECK_1_STATE',
      payload: { isPlaying: true },
    });
  });

  it('ignores button release packet (data2 === 0) completely without modifying play state', () => {
    const playSpy = vi.spyOn(audioService, 'play');
    const pauseSpy = vi.spyOn(audioService, 'pause');

    const releaseEvent: RawMidiEvent = {
      status: 144,
      data1: 0x16,
      data2: 0, // Release
      channel: 0,
      command: 'NOTE_OFF',
      timestamp: performance.now(),
      raw: new Uint8Array([144, 0x16, 0]),
    };

    router.route(releaseEvent);

    expect(playSpy).not.toHaveBeenCalled();
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('routes Jog Wheel turn to AudioService.scratch with radians calculation', () => {
    const scratchSpy = vi.spyOn(audioService, 'scratch');

    // Turn 5 ticks forward
    const jogEvent: RawMidiEvent = {
      status: 176,
      data1: 0x32, // Deck A Jog
      data2: 5,
      channel: 0,
      command: 'CONTROL_CHANGE',
      timestamp: performance.now(),
      raw: new Uint8Array([176, 0x32, 5]),
    };

    router.route(jogEvent);

    expect(scratchSpy).toHaveBeenCalledTimes(1);
    const [deckId, radians] = scratchSpy.mock.calls[0];
    expect(deckId).toBe(1);
    expect(radians).toBeCloseTo((5 / 127) * Math.PI * 0.2, 4);
  });
});
