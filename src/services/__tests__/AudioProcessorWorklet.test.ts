import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock AudioWorkletProcessor base class
class MockAudioWorkletProcessor {
  port: {
    postMessage: (msg: any) => void;
    onmessage: ((event: { data: any }) => void) | null;
  };

  constructor() {
    this.port = {
      postMessage: () => {},
      onmessage: null,
    };
  }
}

// Install mock in global
(globalThis as any).AudioWorkletProcessor = MockAudioWorkletProcessor;
(globalThis as any).registerProcessor = (name: string, processorClass: any) => {};

// Evaluate public/audio-processor.js in this test context
const processorPath = path.resolve(__dirname, '../../../public/audio-processor.js');
const processorCode = fs.readFileSync(processorPath, 'utf8');

// Load DJAudioProcessor class
const loadProcessorClass = () => {
  const runCode = `
    ${processorCode}
    return DJAudioProcessor;
  `;
  const fn = new Function(runCode);
  return fn();
};

const DJAudioProcessor = loadProcessorClass();

describe('DJAudioProcessor (AudioWorklet real-time DSP)', () => {
  let processorDeck1: any;
  let processorDeck2: any;

  beforeEach(() => {
    processorDeck1 = new DJAudioProcessor({ processorOptions: { deckId: 1 } });
    processorDeck2 = new DJAudioProcessor({ processorOptions: { deckId: 2 } });
  });

  it('instantiates dedicated processor with proper deck identification', () => {
    expect(processorDeck1.deckId).toBe(1);
    expect(processorDeck1.deck1Active).toBe(true);
    expect(processorDeck1.deck2Active).toBe(false);

    expect(processorDeck2.deckId).toBe(2);
    expect(processorDeck2.deck1Active).toBe(false);
    expect(processorDeck2.deck2Active).toBe(true);
  });

  it('guarantees transparent pass-through audio before Wasm is loaded (never mutes)', () => {
    // Inputs: [ [ Float32Array(128) channel 0, Float32Array(128) channel 1 ] ]
    const inL = new Float32Array(128).fill(0.42);
    const inR = new Float32Array(128).fill(0.84);
    const inputs = [[inL, inR]];

    const outL = new Float32Array(128).fill(0);
    const outR = new Float32Array(128).fill(0);
    const outputs = [[outL, outR]];

    const result = processorDeck1.process(inputs, outputs, {});

    expect(result).toBe(true);
    expect(outL[0]).toBeCloseTo(0.42, 4);
    expect(outR[0]).toBeCloseTo(0.84, 4);
  });

  it('handles mono input without silencing audio', () => {
    // Mono input: only 1 channel in inputs[0]
    const inL = new Float32Array(128).fill(0.65);
    const inputs = [[inL]]; // in[1] is undefined

    const outL = new Float32Array(128).fill(0);
    const outR = new Float32Array(128).fill(0);
    const outputs = [[outL, outR]];

    const result = processorDeck1.process(inputs, outputs, {});

    expect(result).toBe(true);
    // Left channel copied, Right channel duplicates left (mono -> stereo)
    expect(outL[0]).toBeCloseTo(0.65, 4);
    expect(outR[0]).toBeCloseTo(0.65, 4);
  });

  it('processes Deck 2 audio independently without zeroing output', () => {
    const inL = new Float32Array(128).fill(0.77);
    const inR = new Float32Array(128).fill(0.33);
    const inputs = [[inL, inR]];

    const outL = new Float32Array(128).fill(0);
    const outR = new Float32Array(128).fill(0);
    const outputs = [[outL, outR]];

    const result = processorDeck2.process(inputs, outputs, {});

    expect(result).toBe(true);
    expect(outL[0]).toBeCloseTo(0.77, 4);
    expect(outR[0]).toBeCloseTo(0.33, 4);
  });

  it('initializes Wasm with patched HEAPF32 and processes non-zero output', async () => {
    const wasmPath = path.resolve(__dirname, '../../../public/audio_processor.wasm');
    const wasmJsPath = path.resolve(__dirname, '../../../public/audio_processor.js');

    if (!fs.existsSync(wasmPath) || !fs.existsSync(wasmJsPath)) {
      return; // Skip if wasm binary not in test environment
    }

    const wasmBytes = fs.readFileSync(wasmPath);
    const wasmJsCode = fs.readFileSync(wasmJsPath, 'utf8');

    await processorDeck1.loadWasmModule(wasmBytes, wasmJsCode);
    expect(processorDeck1.initialized).toBe(true);
    expect(processorDeck1.wasmInstance).toBeDefined();
    expect(processorDeck1.wasmInstance.HEAPF32).toBeDefined();

    // Process with Wasm active
    const inL = new Float32Array(128).fill(0.5);
    const inR = new Float32Array(128).fill(0.5);
    const inputs = [[inL, inR]];

    const outL = new Float32Array(128).fill(0);
    const outR = new Float32Array(128).fill(0);
    const outputs = [[outL, outR]];

    const result = processorDeck1.process(inputs, outputs, {});
    expect(result).toBe(true);
    expect(outL[0]).toBeGreaterThan(0);
    expect(outR[0]).toBeGreaterThan(0);
  });
});
