/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

// Web MIDI API type definitions
declare namespace WebMidi {
  interface MIDIAccess extends EventTarget {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
    sysexEnabled: boolean;
    onstatechange: ((e: MIDIConnectionEvent) => void) | null;
  }

  interface MIDIInputMap extends Map<string, MIDIInput> {}
  interface MIDIOutputMap extends Map<string, MIDIOutput> {}

  interface MIDIInput extends MIDIPort {
    onmidimessage: ((e: MIDIMessageEvent) => void) | null;
  }

  interface MIDIOutput extends MIDIPort {
    send(data: number[] | Uint8Array, timestamp?: number): void;
    clear(): void;
  }

  interface MIDIPort extends EventTarget {
    id: string;
    manufacturer: string;
    name: string;
    type: 'input' | 'output';
    version: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
    open(): Promise<MIDIPort>;
    close(): Promise<MIDIPort>;
    onstatechange: ((e: MIDIConnectionEvent) => void) | null;
  }

  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
    receivedTime: number;
  }

  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }

  interface MIDIOptions {
    sysex?: boolean;
    software?: boolean;
  }
}

interface Navigator {
  requestMIDIAccess(options?: WebMidi.MIDIOptions): Promise<WebMidi.MIDIAccess>;
}