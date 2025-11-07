// AudioWorklet processor that runs the Wasm audio processing module
// Define self as alias to globalThis for Emscripten compatibility
if (typeof self === 'undefined') {
  var self = globalThis;
}

class DJAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasmModule = null;
    this.wasmInstance = null;
    this.initialized = false;
    this.sampleRate = 44100;
    
    // Deck states
    this.deck1Active = false;
    this.deck2Active = false;
    
    // Crossfader state (-1 = full deck1, 0 = center, +1 = full deck2)
    this.crossfader = 0;
    
    // Buffer pointers in Wasm memory
    this.deck1InputLeftPtr = null;
    this.deck1InputRightPtr = null;
    this.deck1OutputLeftPtr = null;
    this.deck1OutputRightPtr = null;
    this.deck2InputLeftPtr = null;
    this.deck2InputRightPtr = null;
    this.deck2OutputLeftPtr = null;
    this.deck2OutputRightPtr = null;
    this.bufferSize = 128; // Default buffer size
    
    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'LOAD_WASM':
        this.loadWasmModule(data.wasmBytes, data.wasmJsCode);
        break;
      case 'SET_DECK_VOLUME':
        if (this.wasmInstance) {
          const deck = data.deck === 1 ? 'deck1' : 'deck2';
          this.wasmInstance[`_set_${deck}_volume`](data.value);
        }
        break;
      case 'SET_DECK_PITCH':
        if (this.wasmInstance) {
          const deck = data.deck === 1 ? 'deck1' : 'deck2';
          this.wasmInstance[`_set_${deck}_pitch`](data.value);
        }
        break;
      case 'SET_DECK_EQ':
        if (this.wasmInstance) {
          const deck = data.deck === 1 ? 'deck1' : 'deck2';
          this.wasmInstance[`_set_${deck}_eq`](data.band, data.value);
        }
        break;
      case 'SET_DECK_EFFECT':
        if (this.wasmInstance) {
          const deck = data.deck === 1 ? 'deck1' : 'deck2';
          this.wasmInstance[`_set_${deck}_effect`](data.effect, data.enabled);
        }
        break;
      case 'SET_CROSSFADER':
        // Store crossfader value for mixing
        this.crossfader = data.value; // Expected range: -1 to +1
        if (this.wasmInstance) {
          this.wasmInstance._set_crossfader(data.value);
        }
        break;
      case 'SET_MASTER_VOLUME':
        if (this.wasmInstance) {
          this.wasmInstance._set_master_volume(data.value);
        }
        break;
      case 'SET_DECK_ACTIVE':
        if (data.deck === 1) {
          this.deck1Active = data.active;
        } else {
          this.deck2Active = data.active;
        }
        break;
    }
  }
  
  async loadWasmModule(wasmBytes, wasmJsCode) {
    try {
      // Execute the Emscripten JS code in the worklet's global scope
      // The JS code is already fetched in the main thread and passed as a string
      // With MODULARIZE=1, Emscripten creates: var createAudioProcessorModule = function(...) {...}
      // We need to execute it and capture the function assignment
      const globalScope = globalThis;
      
      // Create a scope where we can capture the function
      // Execute the Emscripten code, which will create createAudioProcessorModule
      const executeCode = new Function(wasmJsCode);
      executeCode();
      
      // The function should now be in the current scope (not globalScope due to 'var')
      // We need to access it from the function's scope
      // Try to get it from the current scope using eval in a controlled way
      let moduleFactory;
      try {
        // Try to access it directly (it might be in the function scope)
        moduleFactory = typeof createAudioProcessorModule !== 'undefined' ? createAudioProcessorModule : null;
      } catch (e) {
        // createAudioProcessorModule is not in scope, need to extract it differently
        moduleFactory = null;
      }
      
      // If not found, try to extract it from the code string
      if (!moduleFactory) {
        // Emscripten MODULARIZE creates: var createAudioProcessorModule = (function() {...})();
        // We need to execute it in a way that exposes it to globalScope
        const extractCode = `
          ${wasmJsCode}
          return typeof createAudioProcessorModule !== 'undefined' ? createAudioProcessorModule : null;
        `;
        const extractFunc = new Function(extractCode);
        moduleFactory = extractFunc();
      }
      
      // Assign to globalScope for future access
      if (moduleFactory) {
        globalScope.createAudioProcessorModule = moduleFactory;
      } else {
        throw new Error('Emscripten module factory not found. The createAudioProcessorModule function was not created.');
      }
      
      // Instantiate the Wasm module with the bytes
      this.wasmModule = await moduleFactory({ wasmBinary: wasmBytes });
      this.wasmInstance = this.wasmModule;
      
      // Initialize processors with sample rate
      if (this.wasmInstance._init_processors) {
        this.wasmInstance._init_processors(this.sampleRate);
      }
      
      // Allocate buffers for processing
      this.allocateBuffers(128); // Initial buffer size
      
      this.initialized = true;
      this.port.postMessage({ type: 'WASM_READY' });
    } catch (error) {
      console.error('Failed to load Wasm module in worklet:', error);
      this.port.postMessage({ type: 'ERROR', message: error.message });
    }
  }
  
  allocateBuffers(size) {
    if (!this.wasmInstance) return;
    
    // Free old buffers if they exist
    if (this.deck1InputLeftPtr) {
      this.wasmInstance._free(this.deck1InputLeftPtr);
      this.wasmInstance._free(this.deck1InputRightPtr);
      this.wasmInstance._free(this.deck1OutputLeftPtr);
      this.wasmInstance._free(this.deck1OutputRightPtr);
      this.wasmInstance._free(this.deck2InputLeftPtr);
      this.wasmInstance._free(this.deck2InputRightPtr);
      this.wasmInstance._free(this.deck2OutputLeftPtr);
      this.wasmInstance._free(this.deck2OutputRightPtr);
    }
    
    // Allocate new buffers (4 bytes per float)
    const bufferSizeBytes = size * 4;
    this.deck1InputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck1InputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck1OutputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck1OutputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2InputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2InputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2OutputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2OutputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    
    this.bufferSize = size;
  }
  
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) {
      return true;
    }
    
    // Debug: Log first few calls to verify processing
    if (!this._processCallCount) {
      this._processCallCount = 0;
    }
    this._processCallCount++;
    if (this._processCallCount <= 5 || this._processCallCount % 1000 === 0) {
      const deck1HasInput = inputs[0] && inputs[0][0] && inputs[0][0].length > 0;
      const deck2HasInput = inputs[1] && inputs[1][0] && inputs[1][0].length > 0;
      const deck1Active = this.deck1Active;
      const deck2Active = this.deck2Active;
      const sampleValue = deck1HasInput ? inputs[0][0][0] : 0;
      console.log(`[AudioWorklet] Process call #${this._processCallCount}: deck1Active=${deck1Active}, deck2Active=${deck2Active}, deck1HasInput=${deck1HasInput}, deck2HasInput=${deck2HasInput}, firstSample=${sampleValue.toFixed(4)}, initialized=${this.initialized}`);
    }
    
    if (!this.initialized || !this.wasmInstance) {
      // Pass through if not initialized - mix both deck inputs
      const deck1Input = inputs[0];
      const deck2Input = inputs[1];
      
      // Mix deck1 and deck2 inputs directly to output
      if (deck1Input && deck1Input[0] && deck1Input[1]) {
        output[0].set(deck1Input[0]);
        output[1].set(deck1Input[1]);
        if (this._processCallCount <= 5) {
          console.log(`[AudioWorklet] Pass-through: copied ${deck1Input[0].length} samples, first sample=${deck1Input[0][0].toFixed(4)}`);
        }
      } else {
        output[0].fill(0);
        output[1].fill(0);
        if (this._processCallCount <= 5) {
          console.log(`[AudioWorklet] Pass-through: no deck1 input, filling with zeros`);
        }
      }
      
      // Add deck2 if present
      if (deck2Input && deck2Input[0] && deck2Input[1]) {
        for (let i = 0; i < output[0].length; i++) {
          output[0][i] += deck2Input[0][i];
          output[1][i] += deck2Input[1][i];
        }
      }
      return true;
    }
    
    // Get inputs for both decks (input[0] = deck1, input[1] = deck2)
    const deck1Input = inputs[0];
    const deck2Input = inputs[1];
    
    // Determine buffer size from available inputs
    let numSamples = 128; // Default
    if (deck1Input && deck1Input[0]) {
      numSamples = deck1Input[0].length;
    } else if (deck2Input && deck2Input[0]) {
      numSamples = deck2Input[0].length;
    }
    
    // Reallocate buffers if size changed
    if (numSamples !== this.bufferSize) {
      this.allocateBuffers(numSamples);
    }
    
    // Get Wasm memory views
    const heap = new Float32Array(this.wasmInstance.HEAPF32.buffer);
    const heapOffset = this.wasmInstance.HEAPF32.byteOffset / 4;
    
    // Copy deck1 input to Wasm memory
    const deck1InputLeft = heap.subarray(
      (this.deck1InputLeftPtr / 4) + heapOffset,
      (this.deck1InputLeftPtr / 4) + heapOffset + numSamples
    );
    const deck1InputRight = heap.subarray(
      (this.deck1InputRightPtr / 4) + heapOffset,
      (this.deck1InputRightPtr / 4) + heapOffset + numSamples
    );
    
    if (deck1Input && deck1Input[0] && deck1Input[1]) {
      deck1InputLeft.set(deck1Input[0]);
      deck1InputRight.set(deck1Input[1]);
    } else {
      deck1InputLeft.fill(0);
      deck1InputRight.fill(0);
    }
    
    // Copy deck2 input to Wasm memory
    const deck2InputLeft = heap.subarray(
      (this.deck2InputLeftPtr / 4) + heapOffset,
      (this.deck2InputLeftPtr / 4) + heapOffset + numSamples
    );
    const deck2InputRight = heap.subarray(
      (this.deck2InputRightPtr / 4) + heapOffset,
      (this.deck2InputRightPtr / 4) + heapOffset + numSamples
    );
    
    if (deck2Input && deck2Input[0] && deck2Input[1]) {
      deck2InputLeft.set(deck2Input[0]);
      deck2InputRight.set(deck2Input[1]);
    } else {
      deck2InputLeft.fill(0);
      deck2InputRight.fill(0);
    }
    
    // Process audio
    this.wasmInstance._process_deck_audio(
      this.deck1InputLeftPtr,
      this.deck1InputRightPtr,
      this.deck1OutputLeftPtr,
      this.deck1OutputRightPtr,
      this.deck2InputLeftPtr,
      this.deck2InputRightPtr,
      this.deck2OutputLeftPtr,
      this.deck2OutputRightPtr,
      numSamples,
      this.deck1Active,
      this.deck2Active
    );
    
    // Copy output from Wasm memory for both decks
    const deck1OutputLeft = heap.subarray(
      (this.deck1OutputLeftPtr / 4) + heapOffset,
      (this.deck1OutputLeftPtr / 4) + heapOffset + numSamples
    );
    const deck1OutputRight = heap.subarray(
      (this.deck1OutputRightPtr / 4) + heapOffset,
      (this.deck1OutputRightPtr / 4) + heapOffset + numSamples
    );
    
    const deck2OutputLeft = heap.subarray(
      (this.deck2OutputLeftPtr / 4) + heapOffset,
      (this.deck2OutputLeftPtr / 4) + heapOffset + numSamples
    );
    const deck2OutputRight = heap.subarray(
      (this.deck2OutputRightPtr / 4) + heapOffset,
      (this.deck2OutputRightPtr / 4) + heapOffset + numSamples
    );
    
    // Mix both decks with crossfader
    // Crossfader value: -1 = full deck1, 0 = center, +1 = full deck2
    // Convert to gain values: deck1Gain = (1 - crossfader) / 2, deck2Gain = (1 + crossfader) / 2
    const deck1Gain = (1 - this.crossfader) * 0.5;
    const deck2Gain = (1 + this.crossfader) * 0.5;
    
    for (let i = 0; i < numSamples; i++) {
      output[0][i] = (deck1OutputLeft[i] * deck1Gain) + (deck2OutputLeft[i] * deck2Gain);
      output[1][i] = (deck1OutputRight[i] * deck1Gain) + (deck2OutputRight[i] * deck2Gain);
    }
    
    // Debug: Log output values occasionally
    if (this._processCallCount <= 5 || this._processCallCount % 1000 === 0) {
      const firstOutputSample = output[0][0];
      const maxOutput = Math.max(...output[0].slice(0, 10));
      console.log(`[AudioWorklet] Wasm output: firstSample=${firstOutputSample.toFixed(4)}, maxSample=${maxOutput.toFixed(4)}, deck1Gain=${deck1Gain.toFixed(2)}, deck2Gain=${deck2Gain.toFixed(2)}`);
    }
    
    return true;
  }
}

// Register the processor - this must be at the top level
try {
  registerProcessor('dj-audio-processor', DJAudioProcessor);
  console.log('[AudioWorklet] Processor registered successfully');
} catch (error) {
  console.error('[AudioWorklet] Failed to register processor:', error);
  throw error;
}

