/**
 * MidiParser - Hardware Translation Layer for Hercules DJ Control Instinct
 * Location: src/services/MidiParser.ts
 *
 * Implements strict hardware translation from Mixxx mapping specifications:
 * - Status 144 (0x90): Buttons (Note On). Triggers ONLY when Value === 127.
 * - Status 176 (0xb0): Faders, Knobs, Jog Wheels (Control Change).
 *   - Faders/Knobs: Normalized 0-127 -> 0.0 to 1.0 (linear) / -1.0 to +1.0 (bipolar).
 *   - Jog Wheels (0x32 & 0x33): Relative delta (val > 64 ? val - 128 : val).
 */

import type { RawMidiEvent } from '../types/midi.ts';

// ============================================================================
// MIDI Status Byte Constants
// ============================================================================
export const MIDI_STATUS = {
  NOTE_ON: 144,         // 0x90 - Buttons (Channel 1)
  CONTROL_CHANGE: 176,  // 0xb0 - Faders, Knobs, Jogs (Channel 1)
} as const;

// ============================================================================
// Hercules Action Identifier Types
// ============================================================================
export type HerculesAction =
  // Control Change Actions (Status 176 / 0xb0)
  | 'CROSSFADER'
  | 'DECK_A_VOLUME'
  | 'DECK_B_VOLUME'
  | 'DECK_A_EQ_HIGH'
  | 'DECK_A_EQ_MID'
  | 'DECK_A_EQ_LOW'
  | 'DECK_B_EQ_HIGH'
  | 'DECK_B_EQ_MID'
  | 'DECK_B_EQ_LOW'
  | 'DECK_A_JOG'
  | 'DECK_B_JOG'
  // Button Actions (Status 144 / 0x90)
  | 'DECK_A_PLAY_PAUSE'
  | 'DECK_B_PLAY_PAUSE'
  | 'DECK_A_CUE'
  | 'DECK_B_CUE'
  | 'DECK_A_SYNC'
  | 'DECK_B_SYNC'
  | 'DECK_A_LOAD'
  | 'DECK_B_LOAD';

export type MidiControlKind = 'CC' | 'BUTTON' | 'JOG';

// ============================================================================
// Parsed Message Interface
// ============================================================================
export interface ParsedMidiMessage {
  action: HerculesAction;
  status: number;
  controlId: number;
  rawValue: number;
  kind: MidiControlKind;
  deck?: 1 | 2;
  normalizedValue?: number; // 0.0 to 1.0 (linear for faders, volumes, crossfader UI)
  bipolarValue?: number;    // -1.0 to +1.0 (bipolar for EQs, crossfader audio)
  delta?: number;           // Relative delta for jog wheels (-63 to +64)
}

// ============================================================================
// Hardware Dictionaries (Mixxx Specification)
// ============================================================================

/**
 * Control Change (Status 176 / 0xb0) Dictionary:
 * - Crossfader: 0x3a (58)
 * - Deck A Volume: 0x36 (54)
 * - Deck B Volume: 0x3b (59)
 * - Deck A EQ High: 0x37 (55)
 * - Deck A EQ Mid: 0x38 (56)
 * - Deck A EQ Low: 0x39 (57)
 * - Deck B EQ High: 0x3c (60)
 * - Deck B EQ Mid: 0x3d (61)
 * - Deck B EQ Low: 0x3e (62)
 * - Deck A Jog Wheel Turn: 0x32 (50)
 * - Deck B Jog Wheel Turn: 0x33 (51)
 */
export const HERCULES_CC_MAP: Readonly<Record<number, HerculesAction>> = {
  0x3a: 'CROSSFADER',     // 58: Crossfader
  0x36: 'DECK_A_VOLUME',  // 54: Deck A Volume
  0x3b: 'DECK_B_VOLUME',  // 59: Deck B Volume
  0x37: 'DECK_A_EQ_HIGH', // 55: Deck A EQ High
  0x38: 'DECK_A_EQ_MID',  // 56: Deck A EQ Mid
  0x39: 'DECK_A_EQ_LOW',  // 57: Deck A EQ Low
  0x3c: 'DECK_B_EQ_HIGH', // 60: Deck B EQ High
  0x3d: 'DECK_B_EQ_MID',  // 61: Deck B EQ Mid
  0x3e: 'DECK_B_EQ_LOW',  // 62: Deck B EQ Low
  0x32: 'DECK_A_JOG',     // 50: Deck A Jog Wheel Turn
  0x33: 'DECK_B_JOG',     // 51: Deck B Jog Wheel Turn
};

/**
 * Buttons (Status 144 / 0x90) Dictionary:
 * - Deck A Play/Pause: 0x16 (22)
 * - Deck B Play/Pause: 0x30 (48)
 * - Deck A Cue: 0x15 (21)
 * - Deck B Cue: 0x2f (47)
 * - Deck A Sync: 0x17 (23)
 * - Deck B Sync: 0x31 (49)
 * - Deck A Load Track: 0x19 (25)
 * - Deck B Load Track: 0x33 (51)
 */
export const HERCULES_BUTTON_MAP: Readonly<Record<number, HerculesAction>> = {
  0x16: 'DECK_A_PLAY_PAUSE', // 22: Deck A Play/Pause
  0x30: 'DECK_B_PLAY_PAUSE', // 48: Deck B Play/Pause
  0x15: 'DECK_A_CUE',        // 21: Deck A Cue
  0x2f: 'DECK_B_CUE',        // 47: Deck B Cue
  0x17: 'DECK_A_SYNC',       // 23: Deck A Sync
  0x31: 'DECK_B_SYNC',       // 49: Deck B Sync
  0x19: 'DECK_A_LOAD',       // 25: Deck A Load Track
  0x33: 'DECK_B_LOAD',       // 51: Deck B Load Track
};

// ============================================================================
// Deck Resolution Helper
// ============================================================================
export function getDeckForAction(action: HerculesAction): 1 | 2 | undefined {
  if (action.startsWith('DECK_A_')) return 1;
  if (action.startsWith('DECK_B_')) return 2;
  return undefined;
}

// ============================================================================
// Core Parser Logic
// ============================================================================

/**
 * Parses raw 3-byte MIDI message [Status, ControlID, Value] according to the
 * Hercules DJ Control Instinct specification.
 *
 * Rules:
 * 1. Identifies if status is 144 (0x90 Note On) or 176 (0xb0 CC).
 * 2. Looks up the ControlID in the respective dictionary.
 * 3. Normalizes CC Value (0-127) to 0.0 - 1.0 (and -1.0 to +1.0 bipolar).
 * 4. Filters Button events: triggers ONLY when Value === 127 (ignores release Value === 0).
 * 5. Computes Jog Wheel delta: if Value > 64, delta = Value - 128 (backward); else delta = Value (forward).
 */
export function parseHerculesMidiMessage(
  status: number,
  controlId: number,
  value: number
): ParsedMidiMessage | null {
  // 1. Identify if the message is 144 (0x90) or 176 (0xb0)
  // Check exact status byte or standard MIDI channel mask (0x90-0x9F and 0xB0-0xBF)
  const isButton = status === 144 || (status & 0xf0) === 0x90;
  const isCC = status === 176 || (status & 0xf0) === 0xb0;

  if (!isButton && !isCC) {
    return null;
  }

  // Handle Buttons (Status 144 / 0x90)
  if (isButton) {
    const action = HERCULES_BUTTON_MAP[controlId];
    if (!action) {
      return null;
    }

    // Rule 4: Action only triggers when Value === 127 (button press)
    // to avoid double-triggering on button release (Value === 0)
    if (value !== 127) {
      return null;
    }

    return {
      action,
      status,
      controlId,
      rawValue: value,
      kind: 'BUTTON',
      deck: getDeckForAction(action),
    };
  }

  // Handle Control Change (Status 176 / 0xb0)
  if (isCC) {
    const action = HERCULES_CC_MAP[controlId];
    if (!action) {
      return null;
    }

    // Rule 5: For the Jog Wheels (0x32 and 0x33), implement delta calculation
    // If value > 64, moving backward (value - 128); otherwise moving forward
    if (action === 'DECK_A_JOG' || action === 'DECK_B_JOG' || controlId === 0x32 || controlId === 0x33) {
      const delta = value > 64 ? value - 128 : value;
      const deck: 1 | 2 = (action === 'DECK_A_JOG' || controlId === 0x32) ? 1 : 2;

      return {
        action,
        status,
        controlId,
        rawValue: value,
        kind: 'JOG',
        deck,
        delta,
      };
    }

    // Rule 3: Normalize CC Value from 0-127 to float between 0.0 and 1.0
    const normalizedValue = Math.max(0, Math.min(1, value / 127));
    // Bipolar value (-1.0 to +1.0) for EQs and crossfader audio engine
    const bipolarValue = Math.max(-1, Math.min(1, (value / 127) * 2 - 1));

    return {
      action,
      status,
      controlId,
      rawValue: value,
      kind: 'CC',
      deck: getDeckForAction(action),
      normalizedValue,
      bipolarValue,
    };
  }

  return null;
}

/**
 * Parses a 3-byte Uint8Array or number array: [Status, ControlID, Value]
 */
export function parseMidiBytes(data: Uint8Array | number[]): ParsedMidiMessage | null {
  if (!data || data.length < 3) return null;
  return parseHerculesMidiMessage(data[0], data[1], data[2]);
}

/**
 * Parses a RawMidiEvent from MidiService
 */
export function parseRawMidiEvent(event: RawMidiEvent): ParsedMidiMessage | null {
  return parseHerculesMidiMessage(event.status, event.data1, event.data2);
}
