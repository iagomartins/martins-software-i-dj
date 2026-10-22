# Real-Time Multithreading & Lock-Free Design

This document covers thread synchronization, lock-free communication, and priority management between the UI/worker threads and the real-time audio thread.

---

## 1. Why Mutexes Break Real-Time Audio (Priority Inversion)

In an operating system scheduler (Windows MMSS, macOS CoreAudio, Linux ALSA/JACK):
1. The **audio thread** runs at elevated or real-time priority (e.g. `THREAD_PRIORITY_TIME_CRITICAL` in Windows).
2. The **UI thread** runs at normal priority.
3. If the audio thread attempts to acquire a `std::mutex` held by the UI thread, the audio thread is immediately placed in a wait state.
4. If a medium-priority thread (e.g., file worker, background task) preempts the UI thread before it releases the lock, the audio thread is starved.
5. Result: Immediate buffer underflow and loud pop/glitch.

---

## 2. Lock-Free Single-Producer Single-Consumer (SPSC) Ring Buffer

For passing audio buffers or complex command events between threads without locks:

```cpp
#include <atomic>
#include <vector>
#include <cstddef>

template <typename T, size_t Capacity>
class SPSCRingBuffer {
    static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be power of two");
public:
    SPSCRingBuffer() : head_(0), tail_(0) {}

    bool push(const T& item) {
        const size_t current_tail = tail_.load(std::memory_order_relaxed);
        const size_t current_head = head_.load(std::memory_order_acquire);

        if ((current_tail - current_head) >= Capacity) {
            return false; // Buffer full
        }

        buffer_[current_tail & (Capacity - 1)] = item;
        tail_.store(current_tail + 1, std::memory_order_release);
        return true;
    }

    bool pop(T& item) {
        const size_t current_head = head_.load(std::memory_order_relaxed);
        const size_t current_tail = tail_.load(std::memory_order_acquire);

        if (current_head == current_tail) {
            return false; // Buffer empty
        }

        item = buffer_[current_head & (Capacity - 1)];
        head_.store(current_head + 1, std::memory_order_release);
        return true;
    }

private:
    T buffer_[Capacity];
    // Separate cache lines to prevent false sharing:
    alignas(64) std::atomic<size_t> head_;
    alignas(64) std::atomic<size_t> tail_;
};
```

---

## 3. Atomic Parameter Modulation

For scalar controls (volume, pitch, EQ values, crossfader, play status):

1. **Use `std::atomic<float>` or `std::atomic<bool>`**:
   ```cpp
   std::atomic<float> master_volume{1.0f};
   ```
2. **Memory Ordering**:
   - Audio parameter reads on the audio thread should use `std::memory_order_relaxed`:
     ```cpp
     float vol = master_volume.load(std::memory_order_relaxed);
     ```
   - Control updates from the UI/IPC thread can use `std::memory_order_relaxed` or `std::memory_order_release`.
3. **Parameter De-zippering / Smoothing**:
   Never jump abruptly between values. Use a 1-pole lowpass smoother:
   ```cpp
   float currentVol = targetVol + 0.995f * (currentVol - targetVol);
   ```

---

## 4. PortAudio Callback Contract

PortAudio invokes the callback function on its own high-priority thread:

```cpp
static int audioCallback(
    const void* inputBuffer,
    void* outputBuffer,
    unsigned long framesPerBuffer,
    const PaStreamCallbackTimeInfo* timeInfo,
    PaStreamCallbackFlags statusFlags,
    void* userData
) {
    AudioEngine* engine = static_cast<AudioEngine*>(userData);
    float* out = static_cast<float*>(outputBuffer);

    // 1. Never allocate memory
    // 2. Never lock standard mutexes
    // 3. Process frames directly
    engine->processAudioBlock(out, framesPerBuffer);

    return paContinue;
}
```
If an unexpected error occurs, return `paAbort` or zero out the buffer; never throw C++ exceptions across the PortAudio C interface.
