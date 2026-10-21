/**
 * MidiService - Low-Level Hardware MIDI Layer (Web MIDI API)
 * Location: src/services/MidiService.ts
 */

import { RawMidiEvent, MidiCommandType, MidiDeviceState } from '@/types/midi';

export type MidiEventListener = (event: RawMidiEvent) => void;
export type DeviceStateListener = (devices: MidiDeviceState[]) => void;

export class MidiService {
  private static instance: MidiService;
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private inputs: Map<string, WebMidi.MIDIInput> = new Map();
  private messageListeners: Set<MidiEventListener> = new Set();
  private stateListeners: Set<DeviceStateListener> = new Set();
  private initialized = false;
  private isInitializing = false;
  private lastErrorMessage: string | null = null;

  private constructor() {}

  public static getInstance(): MidiService {
    if (!MidiService.instance) {
      MidiService.instance = new MidiService();
    }
    return MidiService.instance;
  }

  /**
   * Request MIDI hardware access and establish listeners
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.lastErrorMessage = null;

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      this.lastErrorMessage = 'Web MIDI API is not supported in this environment.';
      console.warn(`⚠️ [MidiService] ${this.lastErrorMessage}`);
      this.isInitializing = false;
      return false;
    }

    try {
      console.log('🔍 [MidiService] Requesting Web MIDI access (with SysEx)...');
      let access: WebMidi.MIDIAccess;
      try {
        access = await navigator.requestMIDIAccess({ sysex: true });
      } catch (sysexErr) {
        console.warn('⚠️ [MidiService] SysEx access rejected, falling back to sysex: false', sysexErr);
        access = await navigator.requestMIDIAccess({ sysex: false });
      }

      this.midiAccess = access;
      this.initialized = true;
      this.isInitializing = false;

      console.log(`✅ [MidiService] Access granted. Inputs: ${access.inputs.size}, Outputs: ${access.outputs.size}`);

      // Bind all existing inputs
      this.refreshInputs();

      // Listen for hardware connections/disconnections
      access.addEventListener('statechange', (e: Event) => {
        const connEvent = e as WebMidi.MIDIConnectionEvent;
        const port = connEvent.port;
        console.log(`🔄 [MidiService] Hardware statechange: "${port.name}" [${port.type}] -> state: ${port.state}, conn: ${port.connection}`);
        this.refreshInputs();
      });

      return true;
    } catch (error: unknown) {
      this.isInitializing = false;
      const message = error instanceof Error ? error.message : String(error);
      this.lastErrorMessage = message || 'Failed to request MIDI access';
      console.error('❌ [MidiService] Failed to initialize Web MIDI API:', error);
      return false;
    }
  }

  /**
   * Scan and attach listeners to all MIDI inputs
   */
  private refreshInputs(): void {
    if (!this.midiAccess) return;

    this.inputs.clear();

    this.midiAccess.inputs.forEach((input: WebMidi.MIDIInput, id: string) => {
      this.inputs.set(id, input);

      // Open input if not open
      if (input.connection !== 'open') {
        input.open().catch((err) => {
          console.warn(`⚠️ [MidiService] Could not open port "${input.name}":`, err);
        });
      }

      // Attach message handler
      input.onmidimessage = (event: WebMidi.MIDIMessageEvent) => {
        this.handleIncomingMidi(event, input.name || 'Unknown MIDI Device');
      };

      console.log(`🔌 [MidiService] Connected MIDI Input: "${input.name}" (ID: ${id}) [State: ${input.state}]`);
    });

    this.notifyStateListeners();
  }

  /**
   * Parse raw incoming MIDI event bytes and dispatch to subscribers
   */
  private handleIncomingMidi(event: WebMidi.MIDIMessageEvent, deviceName: string): void {
    const raw = event.data;
    if (!raw || raw.length < 2) return;

    const status = raw[0];
    const data1 = raw[1];
    const data2 = raw.length > 2 ? raw[2] : 0;

    const statusNibble = status & 0xf0;
    const channel = status & 0x0f; // 0-based channel

    let command: MidiCommandType = 'UNKNOWN';

    if (statusNibble === 0x90) {
      command = data2 > 0 ? 'NOTE_ON' : 'NOTE_OFF';
    } else if (statusNibble === 0x80) {
      command = 'NOTE_OFF';
    } else if (statusNibble === 0xb0) {
      command = 'CONTROL_CHANGE';
    } else if (statusNibble === 0xe0) {
      command = 'PITCH_BEND';
    } else if (statusNibble === 0xc0) {
      command = 'PROGRAM_CHANGE';
    } else if (statusNibble === 0xa0) {
      command = 'POLY_AFTERTOUCH';
    } else if (statusNibble === 0xd0) {
      command = 'CHANNEL_AFTERTOUCH';
    }

    // MANDATORY: Log raw bytes clearly to console for hardware inspection as requested by user
    console.log(
      `🎛️ [MIDI IN] [${status}, ${data1}, ${data2}] | Status: 0x${status.toString(16).toUpperCase()} (${command}) | Ch: ${channel + 1} | Data1: ${data1} (0x${data1.toString(16).toUpperCase()}) | Data2: ${data2} | Device: "${deviceName}"`
    );

    const parsedEvent: RawMidiEvent = {
      status,
      data1,
      data2,
      channel,
      command,
      timestamp: event.receivedTime || performance.now(),
      raw
    };

    // Notify all registered router / listeners
    this.messageListeners.forEach((listener) => {
      try {
        listener(parsedEvent);
      } catch (err) {
        console.error('❌ [MidiService] Error in message listener callback:', err);
      }
    });
  }

  /**
   * Subscribe to parsed incoming MIDI events
   */
  public onMessage(listener: MidiEventListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  /**
   * Subscribe to device connection changes
   */
  public onStateChange(listener: DeviceStateListener): () => void {
    this.stateListeners.add(listener);
    // Trigger immediately with current state
    listener(this.getConnectedDevices());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyStateListeners(): void {
    const devices = this.getConnectedDevices();
    this.stateListeners.forEach((listener) => {
      try {
        listener(devices);
      } catch (err) {
        console.error('❌ [MidiService] Error in state listener callback:', err);
      }
    });
  }

  public getConnectedDevices(): MidiDeviceState[] {
    const list: MidiDeviceState[] = [];
    this.inputs.forEach((input, id) => {
      list.push({
        id,
        name: input.name || 'Unknown Controller',
        manufacturer: input.manufacturer,
        state: input.state,
        connection: input.connection
      });
    });
    return list;
  }

  public isAvailable(): boolean {
    return this.initialized && this.inputs.size > 0;
  }

  public getLastError(): string | null {
    return this.lastErrorMessage;
  }
}
