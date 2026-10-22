/**
 * MidiRouter - Routes Parsed MIDI Events to AudioService and Global State (DJContext)
 * Location: src/services/MidiRouter.ts
 */

import { RawMidiEvent } from '@/types/midi';
import { resolveHerculesAction, MidiNormalizer } from './hercules-instinct-map';
import { parseRawMidiEvent, ParsedMidiMessage } from './MidiParser';
import AudioService from './AudioService';
import { DJState, DJAction } from '@/contexts/DJContext';

export interface RouterDependencies {
  getState: () => DJState;
  dispatch: React.Dispatch<DJAction>;
}

export class MidiRouter {
  private audioService: AudioService;
  private deps: RouterDependencies | null = null;
  private previousCCValues: Map<string, number> = new Map();

  // Throttled UI dispatch queue
  private pendingDispatches: Map<string, DJAction> = new Map();
  private rafScheduled = false;

  constructor() {
    this.audioService = AudioService.getInstance();
  }

  public setDependencies(deps: RouterDependencies): void {
    this.deps = deps;
  }

  /**
   * Main route entrypoint called for every incoming MIDI message
   */
  public route(event: RawMidiEvent): void {
    if (!this.deps) return;

    // 1. Strict Mixxx hardware translation layer for Hercules DJ Control Instinct
    const parsed = parseRawMidiEvent(event);
    if (parsed) {
      this.executeHerculesParsedAction(parsed);
      return;
    }

    // 2. Resolve action via extended Hercules hardware map
    const mapping = resolveHerculesAction(event);

    if (mapping) {
      this.executeAction(mapping.action, event);
      return;
    }

    // 3. Fallback to custom mapped identifiers (e.g. midi:note:0:1 or midi:cc:0:14)
    this.executeCustomMapping(event);
  }

  /**
   * Executes strictly translated actions from MidiParser
   */
  private executeHerculesParsedAction(parsed: ParsedMidiMessage): void {
    if (!this.deps) return;
    const { getState, dispatch } = this.deps;
    const currentState = getState();

    switch (parsed.action) {
      // ============================================
      // MIXER / CROSSFADER (CC 0x3A / 58)
      // ============================================
      case 'CROSSFADER': {
        const norm01 = parsed.normalizedValue ?? 0.5; // 0.0 to 1.0 (UI slider & Constant Power audio)
        this.audioService.setCrossfader(norm01);
        this.scheduleDispatch('SET_CROSSFADER', {
          type: 'SET_CROSSFADER',
          payload: norm01,
        });
        break;
      }

      // ============================================
      // DECK VOLUMES (CC 0x36 / 54 & CC 0x3B / 59)
      // ============================================
      case 'DECK_A_VOLUME': {
        const vol = parsed.normalizedValue ?? 1;
        this.audioService.setVolume(1, vol);
        this.scheduleDispatch('DECK_1_VOL', {
          type: 'SET_DECK_1_STATE',
          payload: { volume: vol },
        });
        break;
      }

      case 'DECK_B_VOLUME': {
        const vol = parsed.normalizedValue ?? 1;
        this.audioService.setVolume(2, vol);
        this.scheduleDispatch('DECK_2_VOL', {
          type: 'SET_DECK_2_STATE',
          payload: { volume: vol },
        });
        break;
      }

      // ============================================
      // DECK A EQ (CC 0x37 / 55, CC 0x38 / 56, CC 0x39 / 57)
      // ============================================
      case 'DECK_A_EQ_HIGH': {
        const eqVal = parsed.bipolarValue ?? 0;
        this.audioService.setEQ(1, 2, eqVal);
        this.scheduleDispatch('DECK_1_EQ_HIGH', {
          type: 'SET_DECK_1_STATE',
          payload: { highEQ: eqVal },
        });
        break;
      }

      case 'DECK_A_EQ_MID': {
        const eqVal = parsed.bipolarValue ?? 0;
        this.audioService.setEQ(1, 1, eqVal);
        this.scheduleDispatch('DECK_1_EQ_MID', {
          type: 'SET_DECK_1_STATE',
          payload: { midEQ: eqVal },
        });
        break;
      }

      case 'DECK_A_EQ_LOW': {
        const eqVal = parsed.bipolarValue ?? 0;
        this.audioService.setEQ(1, 0, eqVal);
        this.scheduleDispatch('DECK_1_EQ_LOW', {
          type: 'SET_DECK_1_STATE',
          payload: { lowEQ: eqVal },
        });
        break;
      }

      // ============================================
      // DECK B EQ (CC 0x3C / 60, CC 0x3D / 61, CC 0x3E / 62)
      // ============================================
      case 'DECK_B_EQ_HIGH': {
        const eqVal = parsed.bipolarValue ?? 0;
        this.audioService.setEQ(2, 2, eqVal);
        this.scheduleDispatch('DECK_2_EQ_HIGH', {
          type: 'SET_DECK_2_STATE',
          payload: { highEQ: eqVal },
        });
        break;
      }

      case 'DECK_B_EQ_MID': {
        const eqVal = parsed.bipolarValue ?? 0;
        this.audioService.setEQ(2, 1, eqVal);
        this.scheduleDispatch('DECK_2_EQ_MID', {
          type: 'SET_DECK_2_STATE',
          payload: { midEQ: eqVal },
        });
        break;
      }

      case 'DECK_B_EQ_LOW': {
        const eqVal = parsed.bipolarValue ?? 0;
        this.audioService.setEQ(2, 0, eqVal);
        this.scheduleDispatch('DECK_2_EQ_LOW', {
          type: 'SET_DECK_2_STATE',
          payload: { lowEQ: eqVal },
        });
        break;
      }

      // ============================================
      // JOG WHEELS & SCRATCH (CC 0x32 / 50 & CC 0x33 / 51)
      // ============================================
      case 'DECK_A_JOG': {
        const delta = parsed.delta ?? 0;
        if (delta !== 0) {
          const deltaRadians = (delta / 127) * Math.PI * 0.2;
          this.audioService.scratch(1, deltaRadians);
        }
        break;
      }

      case 'DECK_B_JOG': {
        const delta = parsed.delta ?? 0;
        if (delta !== 0) {
          const deltaRadians = (delta / 127) * Math.PI * 0.2;
          this.audioService.scratch(2, deltaRadians);
        }
        break;
      }

      // ============================================
      // TRANSPORT BUTTONS: PLAY / PAUSE (Note 0x16 / 22 & Note 0x30 / 48)
      // ============================================
      case 'DECK_A_PLAY_PAUSE': {
        const nextPlaying = !currentState.deck1.isPlaying;
        if (nextPlaying) {
          this.audioService.play(1);
        } else {
          this.audioService.pause(1);
        }
        dispatch({
          type: 'SET_DECK_1_STATE',
          payload: { isPlaying: nextPlaying },
        });
        break;
      }

      case 'DECK_B_PLAY_PAUSE': {
        const nextPlaying = !currentState.deck2.isPlaying;
        if (nextPlaying) {
          this.audioService.play(2);
        } else {
          this.audioService.pause(2);
        }
        dispatch({
          type: 'SET_DECK_2_STATE',
          payload: { isPlaying: nextPlaying },
        });
        break;
      }

      // ============================================
      // TRANSPORT BUTTONS: CUE (Note 0x15 / 21 & Note 0x2F / 47)
      // ============================================
      case 'DECK_A_CUE': {
        if (currentState.deck1.isPlaying) {
          this.audioService.pause(1);
          this.audioService.cue(1, true);
          dispatch({
            type: 'SET_DECK_1_STATE',
            payload: { isPlaying: false, isCued: true },
          });
        } else {
          this.audioService.cue(1, true);
          dispatch({
            type: 'SET_DECK_1_STATE',
            payload: { isCued: true },
          });
        }
        break;
      }

      case 'DECK_B_CUE': {
        if (currentState.deck2.isPlaying) {
          this.audioService.pause(2);
          this.audioService.cue(2, true);
          dispatch({
            type: 'SET_DECK_2_STATE',
            payload: { isPlaying: false, isCued: true },
          });
        } else {
          this.audioService.cue(2, true);
          dispatch({
            type: 'SET_DECK_2_STATE',
            payload: { isCued: true },
          });
        }
        break;
      }

      // ============================================
      // TRANSPORT BUTTONS: SYNC (Note 0x17 / 23 & Note 0x31 / 49)
      // ============================================
      case 'DECK_A_SYNC': {
        const newSync = !this.audioService.isDeckSynced(1);
        this.audioService.setSync(1, newSync);
        break;
      }

      case 'DECK_B_SYNC': {
        const newSync = !this.audioService.isDeckSynced(2);
        this.audioService.setSync(2, newSync);
        break;
      }

      // ============================================
      // LOAD TRACK BUTTONS (Note 0x19 / 25 & Note 0x33 / 51)
      // ============================================
      case 'DECK_A_LOAD': {
        const loadBtn = document.getElementById('deck1-load') || document.getElementById('file-input-1');
        if (loadBtn) {
          loadBtn.click();
        }
        break;
      }

      case 'DECK_B_LOAD': {
        const loadBtn = document.getElementById('deck2-load') || document.getElementById('file-input-2');
        if (loadBtn) {
          loadBtn.click();
        }
        break;
      }

      default:
        console.warn(`[MidiRouter] Unhandled Hercules action: ${parsed.action}`);
        break;
    }
  }

  private executeAction(action: string, event: RawMidiEvent): void {
    if (!this.deps) return;
    const { getState, dispatch } = this.deps;
    const currentState = getState();
    const isNoteOn = event.command === 'NOTE_ON' && event.data2 > 0;
    const isNoteOff = event.command === 'NOTE_OFF' || (event.command === 'NOTE_ON' && event.data2 === 0);

    switch (action) {
      // ============================================
      // MIXER CONTROLS
      // ============================================
      case 'CROSSFADER': {
        const norm01 = MidiNormalizer.toLinear(event.data2); // 0.0 to 1.0
        // 0ms instant audio response with Constant Power curve
        this.audioService.setCrossfader(norm01);
        // Throttled UI update
        this.scheduleDispatch('SET_CROSSFADER', { type: 'SET_CROSSFADER', payload: norm01 });
        break;
      }

      case 'MASTER_VOLUME': {
        const vol = MidiNormalizer.toLinear(event.data2);
        this.audioService.setMasterVolume(vol);
        break;
      }

      case 'HEADPHONES_VOLUME': {
        const vol = MidiNormalizer.toLinear(event.data2);
        this.audioService.setHeadphoneVolume(vol);
        this.scheduleDispatch('SET_HEADPHONE_VOLUME', { type: 'SET_HEADPHONE_VOLUME', payload: vol });
        break;
      }

      // ============================================
      // DECK 1 (A) - ANALOG CONTROLS
      // ============================================
      case 'DECK_1_VOLUME': {
        const vol = MidiNormalizer.toLinear(event.data2);
        this.audioService.setVolume(1, vol);
        this.scheduleDispatch('DECK_1_VOL', {
          type: 'SET_DECK_1_STATE',
          payload: { volume: vol }
        });
        break;
      }

      case 'DECK_1_PITCH': {
        // Pitch slider: center is 0, range is -1 to +1
        const pitch = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setPitch(1, pitch);
        this.scheduleDispatch('DECK_1_PITCH', {
          type: 'SET_DECK_1_STATE',
          payload: { pitch }
        });
        break;
      }

      case 'DECK_1_EQ_HIGH': {
        const eqVal = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setEQ(1, 2, eqVal);
        this.scheduleDispatch('DECK_1_EQ_HIGH', {
          type: 'SET_DECK_1_STATE',
          payload: { highEQ: eqVal }
        });
        break;
      }

      case 'DECK_1_EQ_MID': {
        const eqVal = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setEQ(1, 1, eqVal);
        this.scheduleDispatch('DECK_1_EQ_MID', {
          type: 'SET_DECK_1_STATE',
          payload: { midEQ: eqVal }
        });
        break;
      }

      case 'DECK_1_EQ_LOW': {
        const eqVal = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setEQ(1, 0, eqVal);
        this.scheduleDispatch('DECK_1_EQ_LOW', {
          type: 'SET_DECK_1_STATE',
          payload: { lowEQ: eqVal }
        });
        break;
      }

      case 'DECK_1_FILTER': {
        const filterVal = MidiNormalizer.toLinear(event.data2);
        this.audioService.setFilter(1, filterVal);
        this.scheduleDispatch('DECK_1_FILTER', {
          type: 'SET_DECK_FILTER',
          payload: { deck: 1, value: filterVal }
        });
        break;
      }

      // ============================================
      // DECK 2 (B) - ANALOG CONTROLS
      // ============================================
      case 'DECK_2_VOLUME': {
        const vol = MidiNormalizer.toLinear(event.data2);
        this.audioService.setVolume(2, vol);
        this.scheduleDispatch('DECK_2_VOL', {
          type: 'SET_DECK_2_STATE',
          payload: { volume: vol }
        });
        break;
      }

      case 'DECK_2_PITCH': {
        const pitch = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setPitch(2, pitch);
        this.scheduleDispatch('DECK_2_PITCH', {
          type: 'SET_DECK_2_STATE',
          payload: { pitch }
        });
        break;
      }

      case 'DECK_2_EQ_HIGH': {
        const eqVal = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setEQ(2, 2, eqVal);
        this.scheduleDispatch('DECK_2_EQ_HIGH', {
          type: 'SET_DECK_2_STATE',
          payload: { highEQ: eqVal }
        });
        break;
      }

      case 'DECK_2_EQ_MID': {
        const eqVal = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setEQ(2, 1, eqVal);
        this.scheduleDispatch('DECK_2_EQ_MID', {
          type: 'SET_DECK_2_STATE',
          payload: { midEQ: eqVal }
        });
        break;
      }

      case 'DECK_2_EQ_LOW': {
        const eqVal = MidiNormalizer.toBipolar(event.data2);
        this.audioService.setEQ(2, 0, eqVal);
        this.scheduleDispatch('DECK_2_EQ_LOW', {
          type: 'SET_DECK_2_STATE',
          payload: { lowEQ: eqVal }
        });
        break;
      }

      case 'DECK_2_FILTER': {
        const filterVal = MidiNormalizer.toLinear(event.data2);
        this.audioService.setFilter(2, filterVal);
        this.scheduleDispatch('DECK_2_FILTER', {
          type: 'SET_DECK_FILTER',
          payload: { deck: 2, value: filterVal }
        });
        break;
      }

      // ============================================
      // JOG WHEELS & SCRATCH
      // ============================================
      case 'DECK_1_JOG': {
        const prev = this.previousCCValues.get('deck1_jog') ?? 64;
        const delta = MidiNormalizer.toRelativeDelta(event.data2, prev);
        this.previousCCValues.set('deck1_jog', event.data2);
        if (delta !== 0) {
          const deltaRadians = (delta / 127) * Math.PI * 0.15;
          this.audioService.scratch(1, deltaRadians);
        }
        break;
      }

      case 'DECK_2_JOG': {
        const prev = this.previousCCValues.get('deck2_jog') ?? 64;
        const delta = MidiNormalizer.toRelativeDelta(event.data2, prev);
        this.previousCCValues.set('deck2_jog', event.data2);
        if (delta !== 0) {
          const deltaRadians = (delta / 127) * Math.PI * 0.15;
          this.audioService.scratch(2, deltaRadians);
        }
        break;
      }

      // ============================================
      // TRANSPORT BUTTONS (PLAY, CUE, SYNC)
      // ============================================
      case 'DECK_1_PLAY': {
        if (isNoteOn) {
          const newPlaying = !currentState.deck1.isPlaying;
          if (newPlaying) {
            this.audioService.play(1);
          } else {
            this.audioService.pause(1);
          }
          dispatch({
            type: 'SET_DECK_1_STATE',
            payload: { isPlaying: newPlaying }
          });
        }
        break;
      }

      case 'DECK_2_PLAY': {
        if (isNoteOn) {
          const newPlaying = !currentState.deck2.isPlaying;
          if (newPlaying) {
            this.audioService.play(2);
          } else {
            this.audioService.pause(2);
          }
          dispatch({
            type: 'SET_DECK_2_STATE',
            payload: { isPlaying: newPlaying }
          });
        }
        break;
      }

      case 'DECK_1_CUE': {
        if (isNoteOn) {
          this.audioService.cue(1, true);
          dispatch({ type: 'SET_DECK_1_STATE', payload: { isCued: true } });
        } else if (isNoteOff) {
          this.audioService.cue(1, false);
          dispatch({ type: 'SET_DECK_1_STATE', payload: { isCued: false } });
        }
        break;
      }

      case 'DECK_2_CUE': {
        if (isNoteOn) {
          this.audioService.cue(2, true);
          dispatch({ type: 'SET_DECK_2_STATE', payload: { isCued: true } });
        } else if (isNoteOff) {
          this.audioService.cue(2, false);
          dispatch({ type: 'SET_DECK_2_STATE', payload: { isCued: false } });
        }
        break;
      }

      case 'DECK_1_SYNC': {
        if (isNoteOn) {
          const newSync = !this.audioService.isDeckSynced(1);
          this.audioService.setSync(1, newSync);
        }
        break;
      }

      case 'DECK_2_SYNC': {
        if (isNoteOn) {
          const newSync = !this.audioService.isDeckSynced(2);
          this.audioService.setSync(2, newSync);
        }
        break;
      }

      case 'DECK_1_HEADPHONES': {
        if (isNoteOn) {
          dispatch({ type: 'TOGGLE_HEADPHONE_DECK', payload: 1 });
          const isAct = currentState.activeHeadphoneDecks.has(1);
          this.audioService.setHeadphoneRouting(1, !isAct);
        }
        break;
      }

      case 'DECK_2_HEADPHONES': {
        if (isNoteOn) {
          dispatch({ type: 'TOGGLE_HEADPHONE_DECK', payload: 2 });
          const isAct = currentState.activeHeadphoneDecks.has(2);
          this.audioService.setHeadphoneRouting(2, !isAct);
        }
        break;
      }

      // ============================================
      // EFFECTS / PADS
      // ============================================
      case 'DECK_1_PAD_1':
      case 'DECK_1_FX_1': {
        if (isNoteOn) {
          const newFx = !currentState.deck1.effects.flanger;
          this.audioService.setEffect(1, 0, newFx);
          dispatch({
            type: 'SET_DECK_1_STATE',
            payload: { effects: { ...currentState.deck1.effects, flanger: newFx } }
          });
        }
        break;
      }

      case 'DECK_1_PAD_2':
      case 'DECK_1_FX_2': {
        if (isNoteOn) {
          const newFx = !currentState.deck1.effects.filter;
          this.audioService.setEffect(1, 1, newFx);
          dispatch({
            type: 'SET_DECK_1_STATE',
            payload: { effects: { ...currentState.deck1.effects, filter: newFx } }
          });
        }
        break;
      }

      case 'DECK_1_PAD_3':
      case 'DECK_1_FX_3': {
        if (isNoteOn) {
          const newFx = !currentState.deck1.effects.echo;
          this.audioService.setEffect(1, 2, newFx);
          dispatch({
            type: 'SET_DECK_1_STATE',
            payload: { effects: { ...currentState.deck1.effects, echo: newFx } }
          });
        }
        break;
      }

      case 'DECK_1_PAD_4':
      case 'DECK_1_FX_4': {
        if (isNoteOn) {
          const newFx = !currentState.deck1.effects.reverb;
          this.audioService.setEffect(1, 3, newFx);
          dispatch({
            type: 'SET_DECK_1_STATE',
            payload: { effects: { ...currentState.deck1.effects, reverb: newFx } }
          });
        }
        break;
      }

      case 'DECK_2_PAD_1':
      case 'DECK_2_FX_1': {
        if (isNoteOn) {
          const newFx = !currentState.deck2.effects.flanger;
          this.audioService.setEffect(2, 0, newFx);
          dispatch({
            type: 'SET_DECK_2_STATE',
            payload: { effects: { ...currentState.deck2.effects, flanger: newFx } }
          });
        }
        break;
      }

      case 'DECK_2_PAD_2':
      case 'DECK_2_FX_2': {
        if (isNoteOn) {
          const newFx = !currentState.deck2.effects.filter;
          this.audioService.setEffect(2, 1, newFx);
          dispatch({
            type: 'SET_DECK_2_STATE',
            payload: { effects: { ...currentState.deck2.effects, filter: newFx } }
          });
        }
        break;
      }

      case 'DECK_2_PAD_3':
      case 'DECK_2_FX_3': {
        if (isNoteOn) {
          const newFx = !currentState.deck2.effects.echo;
          this.audioService.setEffect(2, 2, newFx);
          dispatch({
            type: 'SET_DECK_2_STATE',
            payload: { effects: { ...currentState.deck2.effects, echo: newFx } }
          });
        }
        break;
      }

      case 'DECK_2_PAD_4':
      case 'DECK_2_FX_4': {
        if (isNoteOn) {
          const newFx = !currentState.deck2.effects.reverb;
          this.audioService.setEffect(2, 3, newFx);
          dispatch({
            type: 'SET_DECK_2_STATE',
            payload: { effects: { ...currentState.deck2.effects, reverb: newFx } }
          });
        }
        break;
      }

      // ============================================
      // NAVIGATION & BROWSE
      // ============================================
      case 'BROWSE_ENCODER': {
        const prev = this.previousCCValues.get('browse') ?? 64;
        const delta = MidiNormalizer.toRelativeDelta(event.data2, prev);
        this.previousCCValues.set('browse', event.data2);
        if (delta !== 0) {
          dispatch({ type: 'SET_BROWSE_POSITION', payload: delta });
        }
        break;
      }

      default:
        console.log(`ℹ️ [MidiRouter] Action not handled: ${action}`);
        break;
    }
  }

  /**
   * Check for user-defined custom MIDI keys in keyMappings / analogMappings
   */
  private executeCustomMapping(event: RawMidiEvent): void {
    if (!this.deps) return;
    const { getState, dispatch } = this.deps;
    const state = getState();

    const isCC = event.command === 'CONTROL_CHANGE';
    const isNote = event.command === 'NOTE_ON' && event.data2 > 0;

    const id = isCC
      ? `midi:cc:${event.channel}:${event.data1}`
      : `midi:note:${event.channel}:${event.data1}`;

    // 1. Check custom analog mapping
    if (isCC && state.analogMappings && state.analogMappings[id]) {
      const mapping = state.analogMappings[id];
      const norm01 = MidiNormalizer.toLinear(event.data2);
      const val = mapping.min + norm01 * (mapping.max - mapping.min);

      if (mapping.controlId === 'deck1-volume') {
        this.audioService.setVolume(1, val);
        this.scheduleDispatch('DECK_1_VOL', { type: 'SET_DECK_1_STATE', payload: { volume: val } });
      } else if (mapping.controlId === 'deck2-volume') {
        this.audioService.setVolume(2, val);
        this.scheduleDispatch('DECK_2_VOL', { type: 'SET_DECK_2_STATE', payload: { volume: val } });
      } else if (mapping.controlId === 'crossfader') {
        this.audioService.setCrossfader(norm01);
        this.scheduleDispatch('SET_CROSSFADER', { type: 'SET_CROSSFADER', payload: norm01 });
      }
      return;
    }

    // 2. Check custom button mapping
    if (isNote && state.keyMappings && state.keyMappings[id]) {
      const buttonId = state.keyMappings[id];
      const el = document.getElementById(buttonId);
      if (el) {
        el.click();
      }
    }
  }

  /**
   * Batch/Throttle high-frequency UI dispatches to requestAnimationFrame (60 FPS)
   * while keeping zero-latency on the audio thread
   */
  private scheduleDispatch(key: string, action: DJAction): void {
    this.pendingDispatches.set(key, action);

    if (!this.rafScheduled) {
      this.rafScheduled = true;
      requestAnimationFrame(() => {
        this.rafScheduled = false;
        if (!this.deps) return;

        this.pendingDispatches.forEach((act) => {
          this.deps!.dispatch(act);
        });
        this.pendingDispatches.clear();
      });
    }
  }
}
