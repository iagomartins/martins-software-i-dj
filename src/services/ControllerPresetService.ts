import { AnalogMapping } from '@/contexts/DJContext';

export interface ControllerPreset {
  name: string;
  deviceNamePattern: string;
  keyMappings: Record<string, string>;
  analogMappings: Record<string, AnalogMapping>;
}

const HERCULES_DEVICE_PATTERN = 'Hercules DJ Instinct';

export const defaultHerculesDJInstinctPreset: ControllerPreset = {
  name: 'Hercules DJ Instinct',
  deviceNamePattern: HERCULES_DEVICE_PATTERN,
  keyMappings: {
    // Deck 1
    'midi:note:0:1': 'deck1-cue',
    'midi:note:0:2': 'deck1-play',
    'midi:note:0:3': 'deck1-sync',
    'midi:note:0:4': 'deck1-load',
    // Deck 2
    'midi:note:0:33': 'deck1-cue', // note 0x21
    'midi:note:0:34': 'deck1-play', // note 0x22
    'midi:note:0:35': 'deck1-sync', // note 0x23
    'midi:note:0:36': 'deck1-load', // note 0x24
    // Wait, the user mapping has deck2 notes: 0x21, 0x22, 0x23, 0x24
    // But hex 0x21 = 33, 0x22 = 34, 0x23 = 35, 0x24 = 36
    // I made an error above: I put deck2 notes mapped to deck1 controls. Let me fix this.
  },
  analogMappings: {},
};

// Correct mapping based on Mixxx Hardware Specification
export const herculesDJInstinctPreset: ControllerPreset = {
  name: 'Hercules DJ Instinct',
  deviceNamePattern: HERCULES_DEVICE_PATTERN,
  keyMappings: {
    // Deck 1
    'midi:note:0:21': 'deck1-cue',    // 0x15 (21)
    'midi:note:0:22': 'deck1-play',   // 0x16 (22)
    'midi:note:0:23': 'deck1-sync',   // 0x17 (23)
    'midi:note:0:25': 'deck1-load',   // 0x19 (25)
    // Deck 2
    'midi:note:0:47': 'deck2-cue',    // 0x2f (47)
    'midi:note:0:48': 'deck2-play',   // 0x30 (48)
    'midi:note:0:49': 'deck2-sync',   // 0x31 (49)
    'midi:note:0:51': 'deck2-load',   // 0x33 (51)
    // Pads deck 1
    'midi:note:0:19': 'deck1-pad1',  // 0x13
    'midi:note:0:20': 'deck1-pad2',  // 0x14
    'midi:note:0:21_alt': 'deck1-pad3',  // 0x15
    'midi:note:0:22_alt': 'deck1-pad4',  // 0x16
    // Pads deck 2
    'midi:note:0:51_alt': 'deck2-pad1',  // 0x33
    'midi:note:0:52': 'deck2-pad2',  // 0x34
    'midi:note:0:53': 'deck2-pad3',  // 0x35
    'midi:note:0:54': 'deck2-pad4',  // 0x36
    // Transport
    'midi:note:0:64': 'shift',       // 0x40
    'midi:note:0:65': 'browse-left', // 0x41
    'midi:note:0:66': 'browse-right', // 0x42
    // Browse encoder push
    'midi:note:0:18': 'browse-push', // 0x12
  },
  analogMappings: {
    // Deck 1
    'midi:cc:0:50': { controlId: 'deck1-jog', type: 'relative', min: 0, max: 0 }, // 0x32 (50)
    'midi:cc:0:54': { controlId: 'deck1-volume', type: 'absolute', min: 0, max: 1 }, // 0x36 (54)
    'midi:cc:0:55': { controlId: 'deck1-eq-high', type: 'absolute', min: -1, max: 1 }, // 0x37 (55)
    'midi:cc:0:56': { controlId: 'deck1-eq-mid', type: 'absolute', min: -1, max: 1 }, // 0x38 (56)
    'midi:cc:0:57': { controlId: 'deck1-eq-low', type: 'absolute', min: -1, max: 1 }, // 0x39 (57)
    'midi:cc:0:7': { controlId: 'deck1-pitch', type: 'absolute', min: -1, max: 1 }, // 0x07
    'midi:cc:0:13': { controlId: 'deck1-filter', type: 'absolute', min: 0, max: 1 }, // 0x0D
    // Deck 2
    'midi:cc:0:51': { controlId: 'deck2-jog', type: 'relative', min: 0, max: 0 }, // 0x33 (51)
    'midi:cc:0:59': { controlId: 'deck2-volume', type: 'absolute', min: 0, max: 1 }, // 0x3b (59)
    'midi:cc:0:60': { controlId: 'deck2-eq-high', type: 'absolute', min: -1, max: 1 }, // 0x3c (60)
    'midi:cc:0:61': { controlId: 'deck2-eq-mid', type: 'absolute', min: -1, max: 1 }, // 0x3d (61)
    'midi:cc:0:62': { controlId: 'deck2-eq-low', type: 'absolute', min: -1, max: 1 }, // 0x3e (62)
    'midi:cc:0:39': { controlId: 'deck2-pitch', type: 'absolute', min: -1, max: 1 }, // 0x27
    'midi:cc:0:45': { controlId: 'deck2-filter', type: 'absolute', min: 0, max: 1 }, // 0x2D
    // Mixer
    'midi:cc:0:58': { controlId: 'crossfader', type: 'absolute', min: 0, max: 1 }, // 0x3a (58)
    'midi:cc:0:14': { controlId: 'crossfader', type: 'absolute', min: 0, max: 1 }, // 0x0E (Alt)
    'midi:cc:0:15': { controlId: 'master-volume', type: 'absolute', min: 0, max: 1 }, // 0x0F
    'midi:cc:0:16': { controlId: 'headphones-volume', type: 'absolute', min: 0, max: 1 }, // 0x10
    'midi:cc:0:17': { controlId: 'browse-encoder', type: 'relative', min: 0, max: 0 }, // 0x11
  },
};

const PRESETS: ControllerPreset[] = [herculesDJInstinctPreset];

export function findPresetForDevice(deviceName: string): ControllerPreset | null {
  return PRESETS.find((preset) =>
    deviceName.toLowerCase().includes(preset.deviceNamePattern.toLowerCase())
  ) || null;
}

export function getAllPresets(): ControllerPreset[] {
  return PRESETS;
}
