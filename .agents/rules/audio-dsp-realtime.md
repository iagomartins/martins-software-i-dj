# Real-Time C++ Audio DSP Rules & Safety Constraints

Real-time audio processing operates under strict hard real-time execution bounds (e.g., 128 samples at 44.1kHz gives exactly **2.9 milliseconds** per quantum; 256 samples gives **5.8 ms**). A single missed deadline causes an audible dropout, pop, or glitch (buffer underrun).

Any code running in the audio hot path (`AudioProcessor::process`, `processStereo`, `process_deck_audio`, or `AudioEngine::audioCallback`) **MUST strictly observe these rules**.

---

## 1. The Audio Thread "Golden Rules" (Zero Tolerances)

Inside any audio rendering callback or DSP block:

1. **NO Heap Memory Allocations or Deallocations**:
   - FORBIDDEN: `new`, `delete`, `malloc`, `free`, `realloc`.
   - FORBIDDEN: Methods that may trigger reallocations: `std::vector::push_back`, `std::string` concatenation, `std::make_shared`, `std::make_unique`.
   - RULE: All buffers (delay lines, FFT scratchpads, filter states) must be pre-allocated at initialization time (`init_processors` or constructor).

2. **NO Blocking Synchronization (Mutexes / Locks)**:
   - FORBIDDEN: `std::mutex::lock()`, `std::unique_lock`, `std::condition_variable::wait()`. Priority inversion will starve the audio thread.
   - RULE: Use lock-free Single-Producer Single-Consumer (SPSC) ring buffers or `std::atomic<T>` with relaxed or acquire-release memory orderings (`std::memory_order_relaxed`, `std::memory_order_release`, `std::memory_order_acquire`).

3. **NO System Calls, I/O, or Logging**:
   - FORBIDDEN: `std::cout`, `printf`, `fprintf`, file access (`std::ifstream`, `fopen`), network calls.
   - FORBIDDEN: OS sleep or yields (`std::this_thread::sleep_for`, `Sleep()`).
   - RULE: Push telemetry or debugging flags to a lock-free queue; let a worker thread read and print/log.

4. **NO Objective-C / COM / Garbage Collected Runtime Invocations**:
   - Keep the audio loop pure C/C++ without JNI, COM apartment transitions, or V8 engine calls.

---

## 2. DSP Numerical Stability & Anti-Denormal Rules

1. **Denormal / Subnormal Floats**:
   - Underflowing floats (values very close to zero in IIR feedback loops or decay tails) can drop modern CPUs to microcode emulation, increasing CPU usage by 10x-100x and causing massive dropouts.
   - **Protection Strategy**:
     - Add a tiny DC offset or flush denormals to zero:
       ```cpp
       inline float killDenormal(float val) {
           static const float anti_denormal = 1e-18f;
           return val + anti_denormal - anti_denormal;
       }
       ```
     - In native builds, enable CPU Flush-To-Zero (FTZ) and Denormals-Are-Zero (DAZ):
       ```cpp
       #if defined(_MSC_VER) || defined(__SSE__)
       #include <xmmintrin.h>
       #include <pmmintrin.h>
       _MM_SET_FLUSH_ZERO_MODE(_MM_FLUSH_ZERO_ON);
       _MM_SET_DENORMALS_ZERO_MODE(_MM_DENORMALS_ZERO_ON);
       #endif
       ```

2. **Biquad Filter Topologies**:
   - For IIR filters (Lowpass, Highpass, Peaking, Shelf), use **Transposed Direct Form II** to reduce round-off noise and maintain stability during coefficient modulation.
   - Smooth parameter changes: When updating filter cutoff, resonance (Q), or gain, interpolate coefficients per sample or in sub-blocks (e.g. 16 or 32 samples) to eliminate audible zippering artifacts.

3. **Gain & Crossfader Curves**:
   - Use constant-power curves for DJ crossfaders:
     $$\text{Gain}_{\text{Deck1}} = \cos\left(\frac{\pi}{2} \cdot x\right), \quad \text{Gain}_{\text{Deck2}} = \sin\left(\frac{\pi}{2} \cdot x\right), \quad x \in [0, 1]$$
   - Linear crossfading drops volume by 3dB at the center.

---

## 3. WebAssembly / Emscripten Hot-Path Standards

1. **Zero-Copy Memory Interop**:
   - When passing audio frames between JavaScript (AudioWorklet) and WebAssembly, pass pointers to pre-allocated float arrays in the Wasm heap (`HEAPF32.subarray(ptr >> 2, ...)`).
   - Never serialize or copy audio sample arrays over JSON or unstructured `postMessage`.

2. **Compiler Optimization Flags**:
   - Build Wasm with `-O3 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1`.
   - Keep exported function table lean to minimize module startup time.
