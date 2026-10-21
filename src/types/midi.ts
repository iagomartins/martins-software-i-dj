/**
 * MIDI Protocol and Controller Type Definitions
 * Location: src/types/midi.ts
 */

export type MidiCommandType =
  | 'NOTE_ON'
  | 'NOTE_OFF'
  | 'CONTROL_CHANGE'
  | 'PITCH_BEND'
  | 'PROGRAM_CHANGE'
  | 'POLY_AFTERTOUCH'
  | 'CHANNEL_AFTERTOUCH'
  | 'UNKNOWN';

export interface RawMidiEvent {
  status: number;
  data1: number;
  data2: number;
  channel: number; // 0 to 15 (MIDI Channel 1 to 16)
  command: MidiCommandType;
  timestamp: number;
  raw: Uint8Array;
}

export type MidiControlType = 'CC' | 'NOTE';

export type HerculesActionId =
  // Deck 1 (Deck A)
  | 'DECK_1_PLAY'
  | 'DECK_1_CUE'
  | 'DECK_1_SYNC'
  | 'DECK_1_LOAD'
  | 'DECK_1_HEADPHONES'
  | 'DECK_1_VOLUME'
  | 'DECK_1_PITCH'
  | 'DECK_1_EQ_HIGH'
  | 'DECK_1_EQ_MID'
  | 'DECK_1_EQ_LOW'
  | 'DECK_1_FILTER'
  | 'DECK_1_JOG'
  | 'DECK_1_JOG_TOUCH'
  | 'DECK_1_PAD_1'
  | 'DECK_1_PAD_2'
  | 'DECK_1_PAD_3'
  | 'DECK_1_PAD_4'
  | 'DECK_1_FX_1'
  | 'DECK_1_FX_2'
  | 'DECK_1_FX_3'
  | 'DECK_1_FX_4'

  // Deck 2 (Deck B)
  | 'DECK_2_PLAY'
  | 'DECK_2_CUE'
  | 'DECK_2_SYNC'
  | 'DECK_2_LOAD'
  | 'DECK_2_HEADPHONES'
  | 'DECK_2_VOLUME'
  | 'DECK_2_PITCH'
  | 'DECK_2_EQ_HIGH'
  | 'DECK_2_EQ_MID'
  | 'DECK_2_EQ_LOW'
  | 'DECK_2_FILTER'
  | 'DECK_2_JOG'
  | 'DECK_2_JOG_TOUCH'
  | 'DECK_2_PAD_1'
  | 'DECK_2_PAD_2'
  | 'DECK_2_PAD_3'
  | 'DECK_2_PAD_4'
  | 'DECK_2_FX_1'
  | 'DECK_2_FX_2'
  | 'DECK_2_FX_3'
  | 'DECK_2_FX_4'

  // Global / Mixer / Navigation
  | 'CROSSFADER'
  | 'MASTER_VOLUME'
  | 'HEADPHONES_VOLUME'
  | 'BROWSE_ENCODER'
  | 'BROWSE_PUSH'
  | 'VINYL_MODE'
  | 'SHIFT';

export interface MidiMappingDefinition {
  type: MidiControlType;
  channel?: number; // 0-based channel (0 = Channel 1) or undefined for any channel
  noteOrCc: number; // Data1
  action: HerculesActionId;
  isRelative?: boolean; // For endless encoders / jog wheels
  description?: string;
}

export interface MidiDeviceState {
  id: string;
  name: string;
  manufacturer?: string;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
}
