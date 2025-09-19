#include "audio_engine.h"
#include <iostream>
#include <cstring>
#include <chrono>
#include <portaudio.h>

// Add M_PI definition for Windows
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

AudioEngine::AudioEngine() 
    : shared_state_(nullptr)
    , shared_memory_(nullptr)
    , shared_memory_size_(sizeof(AudioState))
    , sample_rate_(44100)
    , buffer_size_(512)
    , audio_stream_(nullptr) {
}

AudioEngine::~AudioEngine() {
    shutdown();
}

bool AudioEngine::initialize() {
    // Initialize PortAudio
    PaError err = Pa_Initialize();
    if (err != paNoError) {
        std::cerr << "PortAudio initialization failed: " << Pa_GetErrorText(err) << std::endl;
        return false;
    }
    
    // List available audio devices
    int numDevices = Pa_GetDeviceCount();
    std::cout << "Available audio devices:" << std::endl;
    
    int asioDevice = -1;
    int defaultOutputDevice = Pa_GetDefaultOutputDevice();
    
    for (int i = 0; i < numDevices; i++) {
        const PaDeviceInfo* deviceInfo = Pa_GetDeviceInfo(i);
        std::cout << "Device " << i << ": " << deviceInfo->name;
        std::cout << " (Host API: " << Pa_GetHostApiInfo(deviceInfo->hostApi)->name << ")";
        std::cout << " (Max outputs: " << deviceInfo->maxOutputChannels << ")" << std::endl;
        
        // Look for ASIO devices
        if (deviceInfo->maxOutputChannels > 0 && 
            strstr(Pa_GetHostApiInfo(deviceInfo->hostApi)->name, "ASIO") != nullptr) {
            asioDevice = i;
            std::cout << "  ^ ASIO device found!" << std::endl;
        }
    }
    
    // Choose device (prefer ASIO, fallback to default)
    PaDeviceIndex outputDevice = (asioDevice != -1) ? asioDevice : defaultOutputDevice;
    
    if (asioDevice != -1) {
        std::cout << "Using ASIO device: " << Pa_GetDeviceInfo(outputDevice)->name << std::endl;
    } else {
        std::cout << "Using default device: " << Pa_GetDeviceInfo(outputDevice)->name << std::endl;
    }
    
    // Create shared memory (existing code)
#ifdef _WIN32
    HANDLE hMapFile = CreateFileMappingA(
        INVALID_HANDLE_VALUE,
        NULL,
        PAGE_READWRITE,
        0,
        static_cast<DWORD>(shared_memory_size_),
        "DJAudioEngine"  // Changed from L"DJAudioEngine" to regular string
    );
    
    if (hMapFile == NULL) {
        std::cerr << "Failed to create shared memory" << std::endl;
        Pa_Terminate();
        return false;
    }
    
    shared_memory_ = MapViewOfFile(hMapFile, FILE_MAP_ALL_ACCESS, 0, 0, shared_memory_size_);
    if (shared_memory_ == NULL) {
        CloseHandle(hMapFile);
        Pa_Terminate();
        return false;
    }
#else
    int fd = shm_open("/dj_audio_engine", O_CREAT | O_RDWR, 0666);
    if (fd == -1) {
        std::cerr << "Failed to create shared memory" << std::endl;
        return false;
    }
    
    if (ftruncate(fd, shared_memory_size_) == -1) {
        close(fd);
        return false;
    }
    
    shared_memory_ = mmap(NULL, shared_memory_size_, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (shared_memory_ == MAP_FAILED) {
        close(fd);
        return false;
    }
    close(fd);
#endif
    
    // Initialize shared state
    shared_state_ = static_cast<AudioState*>(shared_memory_);
    memset(shared_state_, 0, sizeof(AudioState));
    
    // Set up audio stream with specific device
    PaStreamParameters outputParams;
    outputParams.device = outputDevice;
    outputParams.channelCount = 2;  // Stereo
    outputParams.sampleFormat = paFloat32;
    outputParams.suggestedLatency = Pa_GetDeviceInfo(outputDevice)->defaultLowOutputLatency;
    outputParams.hostApiSpecificStreamInfo = nullptr;
    
    err = Pa_OpenStream(
        &audio_stream_,
        nullptr,        // No input
        &outputParams,  // Output parameters
        sample_rate_,
        buffer_size_,
        paClipOff,      // Don't clip
        audioCallback,
        this
    );
    
    if (err != paNoError) {
        std::cerr << "Failed to open audio stream: " << Pa_GetErrorText(err) << std::endl;
        Pa_Terminate();
        return false;
    }
    
    // Start audio stream
    err = Pa_StartStream(audio_stream_);
    if (err != paNoError) {
        std::cerr << "Failed to start audio stream: " << Pa_GetErrorText(err) << std::endl;
        Pa_CloseStream(audio_stream_);
        Pa_Terminate();
        return false;
    }
    
    // Check if stream is actually running
    if (Pa_IsStreamActive(audio_stream_)) {
        std::cout << "✅ Audio stream is ACTIVE and running!" << std::endl;
    } else {
        std::cerr << "❌ Audio stream is NOT active!" << std::endl;
    }
    
    // Initialize audio buffer
    audio_buffer_.resize(buffer_size_ * 2); // Stereo
    
    // Start audio thread
    running_ = true;
    audio_thread_ = std::thread(&AudioEngine::audioThread, this);
    
    std::cout << "Audio engine initialized successfully" << std::endl;
    return true;
}

void AudioEngine::shutdown() {
    running_ = false;
    
    if (audio_thread_.joinable()) {
        audio_thread_.join();
    }

    if (audio_stream_) {
        Pa_StopStream(audio_stream_);
        Pa_CloseStream(audio_stream_);
        audio_stream_ = nullptr;
    }
    
    Pa_Terminate();
    
    if (shared_memory_) {
#ifdef _WIN32
        UnmapViewOfFile(shared_memory_);
#else
        munmap(shared_memory_, shared_memory_size_);
        shm_unlink("/dj_audio_engine");
#endif
    }
}

void AudioEngine::setDeckPlaying(int deck, bool playing) {
    if (!shared_state_) {
        std::cerr << "❌ setDeckPlaying: shared_state_ is null!" << std::endl;
        return;
    }
    
    std::cout << " C++ setDeckPlaying called: deck=" << deck << ", playing=" << playing << std::endl;
    
    if (deck >= 1 && deck <= 2) {
        shared_state_->deck_playing[deck - 1].store(playing);
        std::cout << "✅ C++ deck " << deck << " playing state set to: " << playing << std::endl;
        
        // Verify the value was set
        bool actualValue = shared_state_->deck_playing[deck - 1].load();
        std::cout << " Verified deck " << deck << " playing state: " << actualValue << std::endl;
    } else {
        std::cerr << "❌ Invalid deck number: " << deck << std::endl;
    }
}

void AudioEngine::setDeckVolume(int deck, float volume) {
    if (deck == 1) {
        shared_state_->deck1_volume = volume;
    } else if (deck == 2) {
        shared_state_->deck2_volume = volume;
    }
}

void AudioEngine::setDeckPitch(int deck, float pitch) {
    if (deck == 1) {
        shared_state_->deck1_pitch = pitch;
    } else if (deck == 2) {
        shared_state_->deck2_pitch = pitch;
    }
}

void AudioEngine::setDeckPosition(int deck, float position) {
    if (deck == 1) {
        shared_state_->deck1_position = position;
    } else if (deck == 2) {
        shared_state_->deck2_position = position;
    }
}

void AudioEngine::setDeckFile(int deck, const std::string& filepath) {
    if (deck == 1) {
        strncpy(shared_state_->deck1_file, filepath.c_str(), 255);
    } else if (deck == 2) {
        strncpy(shared_state_->deck2_file, filepath.c_str(), 255);
    }
}

void AudioEngine::setEffect(int deck, int effect, bool enabled) {
    if (deck == 1) {
        switch (effect) {
            case 0: shared_state_->deck1_flanger = enabled; break;
            case 1: shared_state_->deck1_filter = enabled; break;
            case 2: shared_state_->deck1_echo = enabled; break;
            case 3: shared_state_->deck1_reverb = enabled; break;
        }
    } else if (deck == 2) {
        switch (effect) {
            case 0: shared_state_->deck2_flanger = enabled; break;
            case 1: shared_state_->deck2_filter = enabled; break;
            case 2: shared_state_->deck2_echo = enabled; break;
            case 3: shared_state_->deck2_reverb = enabled; break;
        }
    }
}

void AudioEngine::setEQ(int deck, int band, float value) {
    if (deck == 1) {
        switch (band) {
            case 0: shared_state_->deck1_low_eq = value; break;
            case 1: shared_state_->deck1_mid_eq = value; break;
            case 2: shared_state_->deck1_high_eq = value; break;
        }
    } else if (deck == 2) {
        switch (band) {
            case 0: shared_state_->deck2_low_eq = value; break;
            case 1: shared_state_->deck2_mid_eq = value; break;
            case 2: shared_state_->deck2_high_eq = value; break;
        }
    }
}

void AudioEngine::setCrossfader(float value) {
    shared_state_->crossfader = value;
}

void AudioEngine::setMasterVolume(float volume) {
    shared_state_->master_volume = volume;
}

void AudioEngine::setHeadphoneVolume(float volume) {
    shared_state_->headphone_volume = volume;
}

void AudioEngine::audioThread() {
    while (running_) {
        processAudio();
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}

void AudioEngine::processAudio() {
    // This is where you'd implement actual audio processing
    // For now, just update positions using proper atomic operations
    if (shared_state_->deck_playing[0].load()) { // Changed from deck1_playing to deck_playing[0]
        float current_pos = shared_state_->deck1_position.load();
        shared_state_->deck1_position.store(current_pos + 0.01f); // Simulate playback
    }
    if (shared_state_->deck_playing[1].load()) { // Changed from deck2_playing to deck_playing[1]
        float current_pos = shared_state_->deck2_position.load();
        shared_state_->deck2_position.store(current_pos + 0.01f);
    }
}

// Add audio callback function
int AudioEngine::audioCallback(const void* inputBuffer, void* outputBuffer,
                              unsigned long framesPerBuffer,
                              const PaStreamCallbackTimeInfo* timeInfo,
                              PaStreamCallbackFlags statusFlags,
                              void* userData) {
    AudioEngine* engine = static_cast<AudioEngine*>(userData);
    float* out = static_cast<float*>(outputBuffer);
    
    // Clear output buffer
    memset(out, 0, framesPerBuffer * 2 * sizeof(float));
    
    // Check if any deck is playing
    bool deck1Playing = false;
    bool deck2Playing = false;
    
    if (engine->shared_state_) {
        deck1Playing = engine->shared_state_->deck_playing[0].load();
        deck2Playing = engine->shared_state_->deck_playing[1].load();
    }
    
    if (deck1Playing || deck2Playing) {
        // Generate test tones
        static float phase1 = 0.0f;
        static float phase2 = 0.0f;
        
        float frequency1 = 440.0f;  // A4
        float frequency2 = 554.37f; // C#5
        float sampleRate = 44100.0f;
        float volume = 0.3f;
        
        for (unsigned long i = 0; i < framesPerBuffer; i++) {
            float leftSample = 0.0f;
            float rightSample = 0.0f;
            
            if (deck1Playing) {
                leftSample += volume * sinf(phase1);
                phase1 += 2.0f * M_PI * frequency1 / sampleRate;
                if (phase1 > 2.0f * M_PI) phase1 -= 2.0f * M_PI;
            }
            
            if (deck2Playing) {
                rightSample += volume * sinf(phase2);
                phase2 += 2.0f * M_PI * frequency2 / sampleRate;
                if (phase2 > 2.0f * M_PI) phase2 -= 2.0f * M_PI;
            }
            
            out[i * 2] = leftSample;     // Left channel
            out[i * 2 + 1] = rightSample; // Right channel
        }
    }
    
    return paContinue;
}

// C-compatible exports
extern "C" {
    void* AudioEngine_New() {
        return new AudioEngine();
    }
    
    void AudioEngine_Delete(void* engine) {
        delete static_cast<AudioEngine*>(engine);
    }
    
    bool AudioEngine_Initialize(void* engine) {
        return static_cast<AudioEngine*>(engine)->initialize();
    }
    
    void AudioEngine_Shutdown(void* engine) {
        static_cast<AudioEngine*>(engine)->shutdown();
    }
    
    void AudioEngine_SetDeckPlaying(void* engine, int deck, bool playing) {
        static_cast<AudioEngine*>(engine)->setDeckPlaying(deck, playing);
    }
    
    void AudioEngine_SetDeckVolume(void* engine, int deck, float volume) {
        static_cast<AudioEngine*>(engine)->setDeckVolume(deck, volume);
    }
    
    void AudioEngine_SetDeckPitch(void* engine, int deck, float pitch) {
        static_cast<AudioEngine*>(engine)->setDeckPitch(deck, pitch);
    }
    
    void AudioEngine_SetDeckPosition(void* engine, int deck, float position) {
        static_cast<AudioEngine*>(engine)->setDeckPosition(deck, position);
    }
    
    void AudioEngine_SetDeckFile(void* engine, int deck, const char* filepath) {
        static_cast<AudioEngine*>(engine)->setDeckFile(deck, std::string(filepath));
    }
    
    void AudioEngine_SetEffect(void* engine, int deck, int effect, bool enabled) {
        static_cast<AudioEngine*>(engine)->setEffect(deck, effect, enabled);
    }
    
    void AudioEngine_SetEQ(void* engine, int deck, int band, float value) {
        static_cast<AudioEngine*>(engine)->setEQ(deck, band, value);
    }
    
    void AudioEngine_SetCrossfader(void* engine, float value) {
        static_cast<AudioEngine*>(engine)->setCrossfader(value);
    }
    
    void AudioEngine_SetMasterVolume(void* engine, float volume) {
        static_cast<AudioEngine*>(engine)->setMasterVolume(volume);
    }
    
    void AudioEngine_SetHeadphoneVolume(void* engine, float volume) {
        static_cast<AudioEngine*>(engine)->setHeadphoneVolume(volume);
    }
}