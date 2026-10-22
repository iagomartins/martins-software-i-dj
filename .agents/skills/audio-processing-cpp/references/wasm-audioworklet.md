# WebAssembly & AudioWorklet Zero-Copy Pipeline

This guide covers the integration between the C++ DSP engine compiled to WebAssembly and the browser's `AudioWorkletProcessor`.

---

## 1. Emscripten Compilation Configuration

The build script compiles `audio_processor.cpp` and `wasm_bindings.cpp` to Wasm:

```bash
emcc audio_processor.cpp wasm_bindings.cpp \
  -o ../public/audio_processor.js \
  -O3 \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_init_processors","_set_deck1_volume","_set_deck1_pitch","_set_deck1_eq","_set_deck1_effect","_set_deck1_filter","_set_deck2_volume","_set_deck2_pitch","_set_deck2_eq","_set_deck2_effect","_set_deck2_filter","_set_crossfader","_set_master_volume","_process_deck_audio","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=createAudioProcessorModule \
  -s ENVIRONMENT=web,worker \
  --no-entry
```

### Key Flag Analysis
- **`-O3`**: Maximum performance optimization, loop vectorization, function inlining.
- **`-s MODULARIZE=1`**: Prevents Emscripten from polluting global scope; creates an instantiator factory function `createAudioProcessorModule()`.
- **`-s ENVIRONMENT=web,worker`**: Strips Node.js file system dependencies, keeping the output compatible with `AudioWorkletGlobalScope`.
- **`--no-entry`**: No `main()` function required.

---

## 2. AudioWorklet Thread Loading Lifecycle

Because `AudioWorkletGlobalScope` does not support standard DOM `fetch()` or dynamic script loading in all browsers:

1. **Main Thread (`AudioService.ts`)**:
   - Fetches the wasm binary (`/audio_processor.wasm`) as an `ArrayBuffer`.
   - Fetches the Emscripten glue script (`/audio_processor.js`) as text.
   - Posts both to the worklet via `workletNode.port.postMessage({ type: 'LOAD_WASM', wasmBytes, wasmJsCode })`.

2. **AudioWorklet (`public/audio-processor.js`)**:
   - Executes the glue script using `eval()` or function constructor within the worklet context.
   - Instantiates the module:
     ```javascript
     const module = await createAudioProcessorModule({
       wasmBinary: wasmBytes,
       print: (text) => console.log('[Wasm]:', text),
       printErr: (text) => console.error('[Wasm Error]:', text)
     });
     ```
   - Pre-allocates float buffers in Wasm linear memory:
     ```javascript
     const bytesPerChannel = 128 * Float32Array.BYTES_PER_ELEMENT;
     this.deck1InputLeftPtr = module._malloc(bytesPerChannel);
     // ... repeat for all 8 input/output channel pointers
     ```

---

## 3. Zero-Copy Audio Processing Loop

Inside `DJAudioProcessor.process(inputs, outputs, parameters)`:

```javascript
process(inputs, outputs, parameters) {
  const output = outputs[0];
  const deck1Input = inputs[0];
  const deck2Input = inputs[1];

  const numSamples = output[0]?.length || 128;

  // 1. Copy input from AudioWorklet directly into Wasm heap
  if (deck1Input && deck1Input[0]) {
    this.wasmInstance.HEAPF32.set(deck1Input[0], this.deck1InputLeftPtr >> 2);
    this.wasmInstance.HEAPF32.set(deck1Input[1] || deck1Input[0], this.deck1InputRightPtr >> 2);
  }

  // 2. Execute C++ DSP inside WebAssembly
  this.wasmInstance._process_deck_audio(
    this.deck1InputLeftPtr, this.deck1InputRightPtr,
    this.deck1OutputLeftPtr, this.deck1OutputRightPtr,
    this.deck2InputLeftPtr, this.deck2InputRightPtr,
    this.deck2OutputLeftPtr, this.deck2OutputRightPtr,
    numSamples,
    this.deck1Active,
    this.deck2Active
  );

  // 3. Read processed samples from Wasm heap into final audio output buffer
  const outL = this.wasmInstance.HEAPF32.subarray(
    this.deck1OutputLeftPtr >> 2,
    (this.deck1OutputLeftPtr >> 2) + numSamples
  );
  output[0].set(outL);

  return true; // Keep processor alive
}
```
*Note*: `ptr >> 2` converts byte offset into a 32-bit float index for `HEAPF32`.
