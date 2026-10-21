/**
 * Hardware MIDI Mapping for Hercules DJControl Instinct
 * Location: src/services/hercules-instinct-map.ts
 */

import { MidiMappingDefinition, HerculesActionId, RawMidiEvent } from '@/types/midi';

export const HERCULES_DEVICE_NAMES = [
  'hercules dj instinct',
  'hercules djcontrol instinct',
  'djcontrol instinct',
  'djcontrol instinct s',
  'dj instinct',
  'hercules'
];

/**
 * Static mapping definitions for Hercules DJ Instinct.
 * Handles both factory specification and common hardware firmware variants.
 */
export const HERCULES_MAP_DEFINITIONS: MidiMappingDefinition[] = [
  // --- CROSSFADER ---
  // Factory standard: CC 14 (0x0E); also alias CC 10 as per user specification/revisions
  { type: 'CC', noteOrCc: 14, action: 'CROSSFADER', description: 'Crossfader' },
  { type: 'CC', noteOrCc: 10, action: 'CROSSFADER', description: 'Crossfader (Alt CC 10)' },

  // --- MASTER & HEADPHONES VOLUME ---
  { type: 'CC', noteOrCc: 15, action: 'MASTER_VOLUME', description: 'Master Volume' },
  { type: 'CC', noteOrCc: 16, action: 'HEADPHONES_VOLUME', description: 'Headphones Volume' },

  // --- BROWSE / NAVIGATION ---
  { type: 'CC', noteOrCc: 17, action: 'BROWSE_ENCODER', isRelative: true, description: 'Library Browse Wheel' },
  { type: 'NOTE', noteOrCc: 18, action: 'BROWSE_PUSH', description: 'Browse Encoder Push' },

  // --- DECK 1 (DECK A) CONTROLS ---
  // Transport & Action Buttons
  { type: 'NOTE', noteOrCc: 1, action: 'DECK_1_CUE', description: 'Deck 1 CUE' },
  { type: 'NOTE', noteOrCc: 2, action: 'DECK_1_PLAY', description: 'Deck 1 PLAY/PAUSE' },
  { type: 'NOTE', noteOrCc: 32, action: 'DECK_1_PLAY', description: 'Deck 1 PLAY/PAUSE (Alt Note 32)' },
  { type: 'NOTE', noteOrCc: 3, action: 'DECK_1_SYNC', description: 'Deck 1 SYNC' },
  { type: 'NOTE', noteOrCc: 4, action: 'DECK_1_LOAD', description: 'Deck 1 LOAD Track' },
  { type: 'NOTE', noteOrCc: 14, action: 'DECK_1_HEADPHONES', description: 'Deck 1 Headphone PFL' },

  // Faders & Knobs
  { type: 'CC', noteOrCc: 9, action: 'DECK_1_VOLUME', description: 'Deck 1 Volume Fader' },
  { type: 'CC', noteOrCc: 45, action: 'DECK_1_VOLUME', description: 'Deck 1 Volume Fader (Alt CC 45)' },
  { type: 'CC', noteOrCc: 7, action: 'DECK_1_PITCH', description: 'Deck 1 Pitch Slider' },
  { type: 'CC', noteOrCc: 10, action: 'DECK_1_EQ_HIGH', description: 'Deck 1 EQ High' },
  { type: 'CC', noteOrCc: 11, action: 'DECK_1_EQ_MID', description: 'Deck 1 EQ Mid' },
  { type: 'CC', noteOrCc: 12, action: 'DECK_1_EQ_LOW', description: 'Deck 1 EQ Low' },
  { type: 'CC', noteOrCc: 13, action: 'DECK_1_FILTER', description: 'Deck 1 Filter' },

  // Jog Wheel & Platter Touch
  { type: 'CC', noteOrCc: 22, action: 'DECK_1_JOG', isRelative: true, description: 'Deck 1 Jog Wheel' },
  { type: 'NOTE', noteOrCc: 23, action: 'DECK_1_JOG_TOUCH', description: 'Deck 1 Jog Platter Touch' },

  // Performance Pads / FX (Hot Cue / Loop / FX / Sampler)
  { type: 'NOTE', noteOrCc: 19, action: 'DECK_1_PAD_1', description: 'Deck 1 Pad 1 / FX 1' },
  { type: 'NOTE', noteOrCc: 20, action: 'DECK_1_PAD_2', description: 'Deck 1 Pad 2 / FX 2' },
  { type: 'NOTE', noteOrCc: 21, action: 'DECK_1_PAD_3', description: 'Deck 1 Pad 3 / FX 3' },
  { type: 'NOTE', noteOrCc: 22, action: 'DECK_1_PAD_4', description: 'Deck 1 Pad 4 / FX 4' },

  // --- DECK 2 (DECK B) CONTROLS ---
  // Transport & Action Buttons
  { type: 'NOTE', noteOrCc: 33, action: 'DECK_2_CUE', description: 'Deck 2 CUE' },
  { type: 'NOTE', noteOrCc: 34, action: 'DECK_2_PLAY', description: 'Deck 2 PLAY/PAUSE' },
  { type: 'NOTE', noteOrCc: 64, action: 'DECK_2_PLAY', description: 'Deck 2 PLAY/PAUSE (Alt Note 64)' },
  { type: 'NOTE', noteOrCc: 35, action: 'DECK_2_SYNC', description: 'Deck 2 SYNC' },
  { type: 'NOTE', noteOrCc: 36, action: 'DECK_2_LOAD', description: 'Deck 2 LOAD Track' },
  { type: 'NOTE', noteOrCc: 46, action: 'DECK_2_HEADPHONES', description: 'Deck 2 Headphone PFL' },

  // Faders & Knobs
  { type: 'CC', noteOrCc: 41, action: 'DECK_2_VOLUME', description: 'Deck 2 Volume Fader' },
  { type: 'CC', noteOrCc: 39, action: 'DECK_2_PITCH', description: 'Deck 2 Pitch Slider' },
  { type: 'CC', noteOrCc: 42, action: 'DECK_2_EQ_HIGH', description: 'Deck 2 EQ High' },
  { type: 'CC', noteOrCc: 43, action: 'DECK_2_EQ_MID', description: 'Deck 2 EQ Mid' },
  { type: 'CC', noteOrCc: 44, action: 'DECK_2_EQ_LOW', description: 'Deck 2 EQ Low' },
  { type: 'CC', noteOrCc: 45, action: 'DECK_2_FILTER', description: 'Deck 2 Filter' },

  // Jog Wheel & Platter Touch
  { type: 'CC', noteOrCc: 54, action: 'DECK_2_JOG', isRelative: true, description: 'Deck 2 Jog Wheel' },
  { type: 'NOTE', noteOrCc: 55, action: 'DECK_2_JOG_TOUCH', description: 'Deck 2 Jog Platter Touch' },

  // Performance Pads / FX
  { type: 'NOTE', noteOrCc: 51, action: 'DECK_2_PAD_1', description: 'Deck 2 Pad 1 / FX 1' },
  { type: 'NOTE', noteOrCc: 52, action: 'DECK_2_PAD_2', description: 'Deck 2 Pad 2 / FX 2' },
  { type: 'NOTE', noteOrCc: 53, action: 'DECK_2_PAD_3', description: 'Deck 2 Pad 3 / FX 3' },
  { type: 'NOTE', noteOrCc: 54, action: 'DECK_2_PAD_4', description: 'Deck 2 Pad 4 / FX 4' },

  // Global modifiers
  { type: 'NOTE', noteOrCc: 64, action: 'SHIFT', description: 'Vinyl / Shift Modifier' },
];

/**
 * Pre-indexed lookup cache for sub-microsecond routing
 */
const lookupMap = new Map<string, MidiMappingDefinition>();

HERCULES_MAP_DEFINITIONS.forEach((def) => {
  if (def.channel !== undefined) {
    lookupMap.set(`${def.type}:${def.channel}:${def.noteOrCc}`, def);
  }
  // Also register with wildcard channel '*' for robust device matching
  const wildcardKey = `${def.type}:*:${def.noteOrCc}`;
  if (!lookupMap.has(wildcardKey)) {
    lookupMap.set(wildcardKey, def);
  }
});

/**
 * Resolve a raw MIDI event to a mapped Hercules control definition
 */
export function resolveHerculesAction(event: RawMidiEvent): MidiMappingDefinition | null {
  const isCC = event.command === 'CONTROL_CHANGE';
  const isNote = event.command === 'NOTE_ON' || event.command === 'NOTE_OFF';

  if (!isCC && !isNote) return null;

  const type = isCC ? 'CC' : 'NOTE';

  // 1. Try exact channel match
  const exactKey = `${type}:${event.channel}:${event.data1}`;
  const exactMatch = lookupMap.get(exactKey);
  if (exactMatch) return exactMatch;

  // 2. Try wildcard channel match
  const wildcardKey = `${type}:*:${event.data1}`;
  return lookupMap.get(wildcardKey) || null;
}

/**
 * Normalization helpers for MIDI values (0-127)
 */
export const MidiNormalizer = {
  // Linear 0.0 to 1.0 (for volume, filters)
  toLinear: (val: number): number => {
    return Math.max(0, Math.min(1, val / 127));
  },

  // Bipolar -1.0 to +1.0 (for crossfader, pitch, bipolar EQ)
  toBipolar: (val: number): number => {
    return Math.max(-1, Math.min(1, (val / 127) * 2 - 1));
  },

  // EQ gain in dB (e.g. -24dB at 0, 0dB at 64, +6dB at 127)
  toEQDb: (val: number): number => {
    if (val === 64) return 0;
    if (val < 64) {
      return ((val - 64) / 64) * 24; // Down to -24 dB
    } else {
      return ((val - 64) / 63) * 6; // Up to +6 dB
    }
  },

  // Relative delta for jog wheels / encoders (handles 2s complement or wrap-around)
  toRelativeDelta: (currentVal: number, previousVal: number): number => {
    let delta = currentVal - previousVal;
    if (delta > 64) delta -= 127;
    if (delta < -64) delta += 127;
    return delta;
  }
};
