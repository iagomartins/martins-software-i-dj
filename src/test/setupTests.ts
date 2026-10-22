/**
 * Global Test Setup & Mocking Boundaries
 * Location: src/test/setupTests.ts
 */

import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// ============================================================================
// 1. Web Audio API Global Mocks
// ============================================================================
export class MockAudioParam {
  public value: number;
  public defaultValue: number;

  constructor(defaultValue = 1.0) {
    this.value = defaultValue;
    this.defaultValue = defaultValue;
  }

  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });

  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });

  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });

  exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });

  cancelScheduledValues = vi.fn(() => this);
}

export class MockGainNode {
  public gain = new MockAudioParam(1.0);
  public context: any;

  constructor(context?: any) {
    this.context = context;
  }

  connect = vi.fn((dest: any) => dest);
  disconnect = vi.fn();
}

export class MockAudioBufferSourceNode {
  public buffer: any = null;
  public playbackRate = new MockAudioParam(1.0);
  public loop = false;
  public loopStart = 0;
  public loopEnd = 0;
  public onended: (() => void) | null = null;

  connect = vi.fn((dest: any) => dest);
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

export class MockAudioBuffer {
  public duration: number;
  public sampleRate: number;
  public numberOfChannels: number;
  public length: number;
  private channelData: Float32Array[];

  constructor(options: { numberOfChannels?: number; length?: number; sampleRate?: number; duration?: number } = {}) {
    this.numberOfChannels = options.numberOfChannels ?? 2;
    this.sampleRate = options.sampleRate ?? 44100;
    this.duration = options.duration ?? 180; // 3 minutes default
    this.length = options.length ?? Math.floor(this.sampleRate * this.duration);
    this.channelData = Array.from({ length: this.numberOfChannels }, () => new Float32Array(this.length));
  }

  getChannelData = vi.fn((channel: number) => {
    return this.channelData[channel] || this.channelData[0];
  });
  copyFromChannel = vi.fn();
  copyToChannel = vi.fn();
}

export function createMockAudioContext(_options?: any) {
  const ctx = {
    state: 'running' as AudioContextState,
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    audioWorklet: {
      addModule: vi.fn().mockResolvedValue(undefined),
    },
    createGain: vi.fn(() => new MockGainNode(ctx)),
    createBufferSource: vi.fn(() => new MockAudioBufferSourceNode()),
    createMediaStreamDestination: vi.fn(() => ({
      stream: { id: 'mock-stream', getAudioTracks: () => [] },
    })),
    decodeAudioData: vi.fn(async (_data: ArrayBuffer) => {
      return new MockAudioBuffer({ duration: 120, sampleRate: 44100, numberOfChannels: 2 });
    }),
    resume: vi.fn(async function (this: any) {
      this.state = 'running';
    }),
    suspend: vi.fn(async function (this: any) {
      this.state = 'suspended';
    }),
    close: vi.fn(async function (this: any) {
      this.state = 'closed';
    }),
  };
  return ctx;
}

export const MockAudioContext = vi.fn().mockImplementation(createMockAudioContext);
export const MockAudioWorkletNode = vi.fn().mockImplementation(() => ({
  port: {
    postMessage: vi.fn(),
    onmessage: null as any,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  connect: vi.fn((dest: any) => dest),
  disconnect: vi.fn(),
}));

// Attach Web Audio to global scope
(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).webkitAudioContext = MockAudioContext;
(globalThis as any).AudioWorkletNode = MockAudioWorkletNode;
(globalThis as any).AudioBuffer = MockAudioBuffer;

// Mock window.Audio constructor
export const MockAudioElement = vi.fn().mockImplementation(() => ({
  src: '',
  srcObject: null as any,
  volume: 1.0,
  autoplay: false,
  currentTime: 0,
  onplay: null as any,
  onpause: null as any,
  onerror: null as any,
  onloadedmetadata: null as any,
  play: vi.fn(async () => {}),
  pause: vi.fn(),
}));
(globalThis as any).Audio = MockAudioElement;

// ============================================================================
// 2. Web MIDI API Global Mock
// ============================================================================
export class MockMIDIInput {
  public id: string;
  public name: string;
  public manufacturer: string;
  public state: 'connected' | 'disconnected' = 'connected';
  public connection: 'open' | 'closed' | 'pending' = 'open';
  public onmidimessage: ((event: { data: Uint8Array; receivedTime?: number }) => void) | null = null;

  constructor(id: string, name: string, manufacturer = 'Hercules') {
    this.id = id;
    this.name = name;
    this.manufacturer = manufacturer;
  }

  open = vi.fn(async () => {
    this.connection = 'open';
    return this;
  });

  close = vi.fn(async () => {
    this.connection = 'closed';
    return this;
  });

  // Test helper to simulate incoming MIDI packet
  simulateMessage(bytes: number[] | Uint8Array) {
    if (this.onmidimessage) {
      this.onmidimessage({
        data: new Uint8Array(bytes),
        receivedTime: performance.now(),
      });
    }
  }
}

export class MockMIDIAccess {
  public inputs = new Map<string, MockMIDIInput>();
  public outputs = new Map<string, any>();
  public sysexEnabled = true;
  private listeners: Map<string, Set<(e: any) => void>> = new Map();

  constructor() {
    const instinct = new MockMIDIInput('instinct-1', 'Hercules DJ Control Instinct', 'Hercules');
    this.inputs.set(instinct.id, instinct);
  }

  addEventListener = vi.fn((type: string, listener: (e: any) => void) => {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  });

  removeEventListener = vi.fn((type: string, listener: (e: any) => void) => {
    this.listeners.get(type)?.delete(listener);
  });

  dispatchStateChange(port: any) {
    const listeners = this.listeners.get('statechange');
    if (listeners) {
      listeners.forEach((l) => l({ port }));
    }
  }
}

let activeMockMIDIAccess: MockMIDIAccess = new MockMIDIAccess();

(navigator as any).requestMIDIAccess = vi.fn(async () => {
  return activeMockMIDIAccess;
});

// ============================================================================
// 3. Electron IPC & Node Integration Mocks
// ============================================================================
export const mockIpcRenderer = {
  on: vi.fn(),
  once: vi.fn(),
  send: vi.fn(),
  invoke: vi.fn().mockImplementation(async (channel: string, ..._args: any[]) => {
    if (channel === 'show-open-dialog') {
      return { canceled: false, filePaths: ['C:/Music/test.mp3'] };
    }
    if (channel === 'read-file') {
      return new Uint8Array([0, 1, 2, 3]);
    }
    return null;
  }),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

(window as any).electron = {
  ipcRenderer: mockIpcRenderer,
};

(window as any).require = vi.fn((moduleName: string) => {
  if (moduleName === 'electron') {
    return { ipcRenderer: mockIpcRenderer };
  }
  return {};
});

// ============================================================================
// 4. HTML Canvas 2D Mock (Avoid jsdom Canvas errors)
// ============================================================================
HTMLCanvasElement.prototype.getContext = vi.fn((_type: string) => {
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
  } as any;
}) as any;

// ============================================================================
// 5. Global Fetch Mock for Wasm and Asset Loading in Node Environment
// ============================================================================
export const mockFetch = vi.fn().mockImplementation(async (url: any) => {
  const urlStr = String(url);
  if (urlStr.includes('.wasm')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]).buffer,
    };
  }
  if (urlStr.includes('.js')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => 'var createAudioProcessorModule = function() {};',
    };
  }
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new ArrayBuffer(1024),
    text: async () => '',
  };
});
(globalThis as any).fetch = mockFetch;

// Global test cleanup
beforeEach(() => {
  vi.clearAllMocks();
  activeMockMIDIAccess = new MockMIDIAccess();
  (navigator as any).requestMIDIAccess = vi.fn(async () => activeMockMIDIAccess);
  (globalThis as any).fetch = mockFetch;
});
