// AudioWorklet processor that runs the Wasm audio processing module
// Define self as alias to globalThis for Emscripten compatibility
if (typeof self === 'undefined') {
  var self = globalThis;
}

class DJAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.deckId = options?.processorOptions?.deckId ?? null;
    this.wasmModule = null;
    this.wasmInstance = null;
    this.wasm = null;
    this.initialized = false;
    this.sampleRate = 44100;
    
    // Deck states
    this.deck1Active = this.deckId === 1;
    this.deck2Active = this.deckId === 2;
    
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
      case 'SET_DECK_ID':
        this.deckId = data.deckId;
        break;
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
      case 'UPDATE_FX': {
        const payload = data.payload || data;
        const { deckId, effectName, isActive, amount } = payload;

        // Normalize deckId (supports 1, 2, '1', '2', 'deck1', 'deck2', 'deck_a', 'deck_b')
        let deckNum = 1;
        if (typeof deckId === 'number') {
          deckNum = deckId === 2 ? 2 : 1;
        } else if (typeof deckId === 'string') {
          const clean = deckId.toLowerCase();
          if (clean.includes('2') || clean.includes('b')) {
            deckNum = 2;
          }
        }
        const deckKey = deckNum === 1 ? 'deck1' : 'deck2';

        // Map effectName to integer index: 0=flanger, 1=filter, 2=echo, 3=reverb
        let fxIndex = 0;
        if (typeof effectName === 'number') {
          fxIndex = effectName;
        } else if (typeof effectName === 'string') {
          const name = effectName.toLowerCase().trim();
          if (name === 'filter' || name === 'fx2') {
            fxIndex = 1;
          } else if (name === 'echo' || name === 'fx3') {
            fxIndex = 2;
          } else if (name === 'reverb' || name === 'fx4') {
            fxIndex = 3;
          } else {
            fxIndex = 0; // flanger / fx1
          }
        }

        const wasm = this.wasmInstance || this.wasm;
        if (wasm) {
          // Call exported C function: _set_deck1_effect / _set_deck2_effect
          const effectFn = wasm[`_set_${deckKey}_effect`];
          if (typeof effectFn === 'function') {
            effectFn(fxIndex, Boolean(isActive));
          }

          // Call set_effect_param if available on wasm module
          const paramFn = wasm.set_effect_param || wasm._set_effect_param;
          if (typeof paramFn === 'function') {
            const fxAmount = typeof amount === 'number' ? amount : (isActive ? 1.0 : 0.0);
            paramFn(deckNum, fxIndex, fxAmount);
          }

          // If filter effect has cutoff / amount parameter
          if (fxIndex === 1 && typeof amount === 'number') {
            const filterFn = wasm[`_set_${deckKey}_filter`];
            if (typeof filterFn === 'function') {
              filterFn(amount);
            }
          }
        }
        break;
      }
      case 'SET_DECK_FILTER':
        if (this.wasmInstance) {
          const deck = data.deck === 1 ? 'deck1' : 'deck2';
          const fn = this.wasmInstance[`_set_${deck}_filter`];
          if (typeof fn === 'function') {
            fn(data.cutoff);
          }
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
        if (this.deckId) {
          if (this.deckId === 1) {
            this.deck1Active = Boolean(data.active);
          } else if (this.deckId === 2) {
            this.deck2Active = Boolean(data.active);
          }
        } else {
          if (data.deck === 1) {
            this.deck1Active = Boolean(data.active);
          } else {
            this.deck2Active = Boolean(data.active);
          }
        }
        break;
    }
  }
  
  async loadWasmModule(wasmBytes, wasmJsCode) {
    try {
      const globalScope = globalThis;
      
      // Patch wasmJsCode so Emscripten exposes HEAPF32 and wasmMemory on the returned Module
      let preparedJsCode = wasmJsCode;
      if (!preparedJsCode.includes('Module["HEAPF32"]=HEAPF32')) {
        preparedJsCode = preparedJsCode.replace(
          'updateMemoryViews();return wasmExports',
          'updateMemoryViews();Module["HEAPF32"]=HEAPF32;Module["wasmMemory"]=wasmMemory;return wasmExports'
        );
        preparedJsCode = preparedJsCode.replace(
          'function updateMemoryViews(){',
          'function updateMemoryViews(){Module["HEAPF32"]=HEAPF32;'
        );
      }

      // Create a scope where we can capture the function
      const extractCode = `
        ${preparedJsCode}
        return typeof createAudioProcessorModule !== 'undefined' ? createAudioProcessorModule : null;
      `;
      const extractFunc = new Function(extractCode);
      const moduleFactory = extractFunc();
      
      // Assign to globalScope for future access
      if (moduleFactory) {
        globalScope.createAudioProcessorModule = moduleFactory;
      } else {
        throw new Error('Emscripten module factory not found. The createAudioProcessorModule function was not created.');
      }
      
      // Instantiate the Wasm module with the bytes
      this.wasmModule = await moduleFactory({ wasmBinary: wasmBytes });
      this.wasmInstance = this.wasmModule;
      this.wasm = this.wasmInstance;

      // Ensure HEAPF32 is initialized and updateMemoryViews is functional
      if (!this.wasmInstance.HEAPF32 && this.wasmInstance.wasmMemory) {
        this.wasmInstance.HEAPF32 = new Float32Array(this.wasmInstance.wasmMemory.buffer);
      }
      if (!this.wasmInstance.updateMemoryViews && this.wasmInstance.wasmMemory) {
        this.wasmInstance.updateMemoryViews = () => {
          this.wasmInstance.HEAPF32 = new Float32Array(this.wasmInstance.wasmMemory.buffer);
        };
      }

      // Provide set_effect_param on wasm instance if not exported natively
      if (this.wasmInstance && !this.wasmInstance.set_effect_param) {
        this.wasmInstance.set_effect_param = (deck, effect, amount) => {
          const deckKey = deck === 2 || deck === 'deck2' || (typeof deck === 'string' && (deck.includes('2') || deck.includes('b'))) ? 'deck2' : 'deck1';
          const isEnabled = typeof amount === 'boolean' ? amount : amount > 0;
          const fn = this.wasmInstance[`_set_${deckKey}_effect`];
          if (typeof fn === 'function') {
            fn(effect, isEnabled);
          }
        };
      }
      
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
    if (!this.wasmInstance || !size || size <= 0) return;
    
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
      this.deck1InputLeftPtr = null;
      this.deck1InputRightPtr = null;
      this.deck1OutputLeftPtr = null;
      this.deck1OutputRightPtr = null;
      this.deck2InputLeftPtr = null;
      this.deck2InputRightPtr = null;
      this.deck2OutputLeftPtr = null;
      this.deck2OutputRightPtr = null;
    }
    
    // Allocate new buffers (4 bytes per 32-bit float)
    const allocSize = Math.max(128, size);
    const bufferSizeBytes = allocSize * 4;
    this.deck1InputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck1InputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck1OutputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck1OutputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2InputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2InputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2OutputLeftPtr = this.wasmInstance._malloc(bufferSizeBytes);
    this.deck2OutputRightPtr = this.wasmInstance._malloc(bufferSizeBytes);
    
    this.bufferSize = allocSize;
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
      if (this.deckId) {
        // Dedicated worklet for a single deck (pass-through when Wasm not ready)
        const input = inputs[0];
        const inLeft = (input && input[0]) ? input[0] : null;
        const inRight = (input && input.length > 1 && input[1]) ? input[1] : inLeft;
        if (inLeft) {
          output[0].set(inLeft);
          output[1].set(inRight);
        } else {
          output[0].fill(0);
          output[1].fill(0);
        }
        return true;
      }

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

    if (this.deckId) {
      // Dedicated worklet for a single deck
      const input = inputs[0];
      const inLeft = (input && input[0]) ? input[0] : null;
      const inRight = (input && input.length > 1 && input[1]) ? input[1] : inLeft;
      const numSamples = inLeft ? inLeft.length : 128;

      if (!this.deck1InputLeftPtr || numSamples > this.bufferSize) {
        this.allocateBuffers(numSamples);
      }
      if (!this.deck1InputLeftPtr) {
        if (inLeft) {
          output[0].set(inLeft);
          output[1].set(inRight);
        } else {
          output[0].fill(0);
          output[1].fill(0);
        }
        return true;
      }

      let heap = this.wasmInstance.HEAPF32;
      if (!heap || heap.buffer.byteLength === 0) {
        if (typeof this.wasmInstance.updateMemoryViews === 'function') {
          this.wasmInstance.updateMemoryViews();
          heap = this.wasmInstance.HEAPF32;
        } else if (this.wasmInstance.wasmMemory) {
          heap = new Float32Array(this.wasmInstance.wasmMemory.buffer);
          this.wasmInstance.HEAPF32 = heap;
        }
      }
      if (!heap || heap.length === 0) {
        // Fallback pass-through: NEVER silence audio!
        if (inLeft) {
          output[0].set(inLeft);
          output[1].set(inRight);
        } else {
          output[0].fill(0);
          output[1].fill(0);
        }
        return true;
      }

      const heapOffset = heap.byteOffset / 4;
      const startIndex1L = (this.deck1InputLeftPtr / 4) + heapOffset;
      if (startIndex1L + numSamples > heap.length) {
        this.allocateBuffers(numSamples);
        heap = this.wasmInstance.HEAPF32 || (this.wasmInstance.wasmMemory && new Float32Array(this.wasmInstance.wasmMemory.buffer));
      }

      if (this.deckId === 2) {
        const deck2InputLeft = heap.subarray(
          (this.deck2InputLeftPtr / 4) + heapOffset,
          (this.deck2InputLeftPtr / 4) + heapOffset + numSamples
        );
        const deck2InputRight = heap.subarray(
          (this.deck2InputRightPtr / 4) + heapOffset,
          (this.deck2InputRightPtr / 4) + heapOffset + numSamples
        );
        if (inLeft) {
          deck2InputLeft.set(inLeft);
          deck2InputRight.set(inRight);
        } else {
          deck2InputLeft.fill(0);
          deck2InputRight.fill(0);
        }

        // Set crossfader to 1.0 in Wasm so deck 2 outputs at unity gain
        if (this.wasmInstance._set_crossfader) {
          this.wasmInstance._set_crossfader(1.0);
        }

        this.wasmInstance._process_deck_audio(
          this.deck1InputLeftPtr, this.deck1InputRightPtr,
          this.deck1OutputLeftPtr, this.deck1OutputRightPtr,
          this.deck2InputLeftPtr, this.deck2InputRightPtr,
          this.deck2OutputLeftPtr, this.deck2OutputRightPtr,
          numSamples,
          false,
          true
        );

        const deck2OutputLeft = heap.subarray(
          (this.deck2OutputLeftPtr / 4) + heapOffset,
          (this.deck2OutputLeftPtr / 4) + heapOffset + numSamples
        );
        const deck2OutputRight = heap.subarray(
          (this.deck2OutputRightPtr / 4) + heapOffset,
          (this.deck2OutputRightPtr / 4) + heapOffset + numSamples
        );

        // If Wasm produced pure silence from non-silent input, fallback to pass-through
        if (inLeft && deck2OutputLeft[0] === 0 && deck2OutputLeft[1] === 0 && inLeft[0] !== 0) {
          output[0].set(inLeft);
          output[1].set(inRight);
        } else {
          output[0].set(deck2OutputLeft);
          output[1].set(deck2OutputRight);
        }
      } else {
        const deck1InputLeft = heap.subarray(
          (this.deck1InputLeftPtr / 4) + heapOffset,
          (this.deck1InputLeftPtr / 4) + heapOffset + numSamples
        );
        const deck1InputRight = heap.subarray(
          (this.deck1InputRightPtr / 4) + heapOffset,
          (this.deck1InputRightPtr / 4) + heapOffset + numSamples
        );
        if (inLeft) {
          deck1InputLeft.set(inLeft);
          deck1InputRight.set(inRight);
        } else {
          deck1InputLeft.fill(0);
          deck1InputRight.fill(0);
        }

        // Set crossfader to 0.0 in Wasm so deck 1 outputs at unity gain
        if (this.wasmInstance._set_crossfader) {
          this.wasmInstance._set_crossfader(0.0);
        }

        this.wasmInstance._process_deck_audio(
          this.deck1InputLeftPtr, this.deck1InputRightPtr,
          this.deck1OutputLeftPtr, this.deck1OutputRightPtr,
          this.deck2InputLeftPtr, this.deck2InputRightPtr,
          this.deck2OutputLeftPtr, this.deck2OutputRightPtr,
          numSamples,
          true,
          false
        );

        const deck1OutputLeft = heap.subarray(
          (this.deck1OutputLeftPtr / 4) + heapOffset,
          (this.deck1OutputLeftPtr / 4) + heapOffset + numSamples
        );
        const deck1OutputRight = heap.subarray(
          (this.deck1OutputRightPtr / 4) + heapOffset,
          (this.deck1OutputRightPtr / 4) + heapOffset + numSamples
        );

        // If Wasm produced pure silence from non-silent input, fallback to pass-through
        if (inLeft && deck1OutputLeft[0] === 0 && deck1OutputLeft[1] === 0 && inLeft[0] !== 0) {
          output[0].set(inLeft);
          output[1].set(inRight);
        } else {
          output[0].set(deck1OutputLeft);
          output[1].set(deck1OutputRight);
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
    
    // Reallocate buffers if size changed or not yet allocated
    if (!this.deck1InputLeftPtr || numSamples > this.bufferSize) {
      this.allocateBuffers(numSamples);
    }
    if (!this.deck1InputLeftPtr) {
      return true;
    }
    
    let heap = this.wasmInstance.HEAPF32;
    if (!heap || heap.buffer.byteLength === 0) {
      if (typeof this.wasmInstance.updateMemoryViews === 'function') {
        this.wasmInstance.updateMemoryViews();
        heap = this.wasmInstance.HEAPF32;
      } else if (this.wasmInstance.wasmMemory) {
        heap = new Float32Array(this.wasmInstance.wasmMemory.buffer);
        this.wasmInstance.HEAPF32 = heap;
      }
    }
    if (!heap || heap.length === 0) {
      if (deck1Input && deck1Input[0] && deck1Input[1]) {
        output[0].set(deck1Input[0]);
        output[1].set(deck1Input[1]);
      } else {
        output[0].fill(0);
        output[1].fill(0);
      }
      if (deck2Input && deck2Input[0] && deck2Input[1]) {
        for (let i = 0; i < output[0].length; i++) {
          output[0][i] += deck2Input[0][i];
          output[1][i] += deck2Input[1][i];
        }
      }
      return true;
    }
    const heapOffset = heap.byteOffset / 4;
    
    // Validate bounds before creating subarrays
    const startIndex1L = (this.deck1InputLeftPtr / 4) + heapOffset;
    if (startIndex1L + numSamples > heap.length) {
      this.allocateBuffers(numSamples);
      heap = this.wasmInstance.HEAPF32 || (this.wasmInstance.wasmMemory && new Float32Array(this.wasmInstance.wasmMemory.buffer));
    }
    
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
    
    // Mix both decks with Constant Power crossfader curve
    // Crossfader value: 0.0 = deck 1 only, 0.5 = center, 1.0 = deck 2 only (supports bipolar fallback)
    const normCf = this.crossfader < 0 ? (this.crossfader + 1) * 0.5 : Math.max(0, Math.min(1, this.crossfader));
    const angle = normCf * 0.5 * Math.PI;
    const deck1Gain = Math.cos(angle);
    const deck2Gain = Math.sin(angle);
    
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

