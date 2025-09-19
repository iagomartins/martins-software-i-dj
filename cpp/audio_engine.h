#pragma once
#include <memory>
#include <atomic>
#include <thread>
#include <vector>
#include <string>
#include <mutex>

#ifdef _WIN32
#include <windows.h>
#else
#include <sys/mman.h>
#include <fcntl.h>
#endif

#include <portaudio.h>

// C-compatible exports for Koffi
extern "C" {
    // Create and destroy
    void* AudioEngine_New();
    void AudioEngine_Delete(void* engine);
    
    // Initialize and shutdown
    bool AudioEngine_Initialize(void* engine);
    void AudioEngine_Shutdown(void* engine);
    
    // Deck controls
    void AudioEngine_SetDeckPlaying(void* engine, int deck, bool playing);
    void AudioEngine_SetDeckVolume(void* engine, int deck, float volume);
    void AudioEngine_SetDeckPitch(void* engine, int deck, float pitch);
    void AudioEngine_SetDeckPosition(void* engine, int deck, float position);
    void AudioEngine_SetDeckFile(void* engine, int deck, const char* filepath);
    
    // Effects
    void AudioEngine_SetEffect(void* engine, int deck, int effect, bool enabled);
    void AudioEngine_SetEQ(void* engine, int deck, int band, float value);
    
    // Global controls
    void AudioEngine_SetCrossfader(void* engine, float value);
    void AudioEngine_SetMasterVolume(void* engine, float volume);
    void AudioEngine_SetHeadphoneVolume(void* engine, float volume);
}

struct AudioState {
    // Deck playing states (array format)
    std::atomic<bool> deck_playing[2]{false, false};
    
    // Deck 1
    std::atomic<float> deck1_volume{0.8f};
    std::atomic<float> deck1_pitch{0.0f};
    std::atomic<float> deck1_position{0.0f};
    std::atomic<float> deck1_duration{0.0f};
    std::atomic<bool> deck1_flanger{false};
    std::atomic<bool> deck1_filter{false};
    std::atomic<bool> deck1_echo{false};
    std::atomic<bool> deck1_reverb{false};
    
    // Deck 2
    std::atomic<float> deck2_volume{0.8f};
    std::atomic<float> deck2_pitch{0.0f};
    std::atomic<float> deck2_position{0.0f};
    std::atomic<float> deck2_duration{0.0f};
    std::atomic<bool> deck2_flanger{false};
    std::atomic<bool> deck2_filter{false};
    std::atomic<bool> deck2_echo{false};
    std::atomic<bool> deck2_reverb{false};
    
    // File paths (add these missing members)
    char deck1_file[256]{0};
    char deck2_file[256]{0};
    
    // Master controls
    std::atomic<float> crossfader{0.5f};
    std::atomic<float> master_volume{0.8f};
    std::atomic<float> headphone_volume{0.8f};
    
    // EQ controls (fix the naming to match what the code expects)
    std::atomic<float> deck1_low_eq{0.0f};
    std::atomic<float> deck1_mid_eq{0.0f};
    std::atomic<float> deck1_high_eq{0.0f};
    std::atomic<float> deck2_low_eq{0.0f};
    std::atomic<float> deck2_mid_eq{0.0f};
    std::atomic<float> deck2_high_eq{0.0f};
};

class AudioEngine {
public:
    AudioEngine();
    ~AudioEngine();
    
    bool initialize();
    void shutdown();
    
    // Control methods
    void setDeckPlaying(int deck, bool playing);
    void setDeckVolume(int deck, float volume);
    void setDeckPitch(int deck, float pitch);
    void setDeckPosition(int deck, float position);
    void setDeckFile(int deck, const std::string& filepath);
    void setEffect(int deck, int effect, bool enabled);
    void setEQ(int deck, int band, float value);
    void setCrossfader(float value);
    void setMasterVolume(float volume);
    void setHeadphoneVolume(float volume);
    
    // Getters
    AudioState* getState() { return shared_state_; }
    
private:
    static int audioCallback(const void* inputBuffer, void* outputBuffer,
                           unsigned long framesPerBuffer,
                           const PaStreamCallbackTimeInfo* timeInfo,
                           PaStreamCallbackFlags statusFlags,
                           void* userData);
    
    void audioThread();
    void processAudio();
    
    AudioState* shared_state_;
    void* shared_memory_;
    size_t shared_memory_size_;
    
    std::thread audio_thread_;
    std::atomic<bool> running_{false};
    
    // Audio processing
    std::vector<float> audio_buffer_;
    int sample_rate_;
    int buffer_size_;
    PaStream* audio_stream_;
};
