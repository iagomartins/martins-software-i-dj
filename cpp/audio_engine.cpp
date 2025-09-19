#include "audio_engine.h"
#include <iostream>
#include <cstring>
#include <chrono>

AudioEngine::AudioEngine() 
    : shared_state_(nullptr)
    , shared_memory_(nullptr)
    , shared_memory_size_(sizeof(AudioState))
    , sample_rate_(44100)
    , buffer_size_(512) {
}

AudioEngine::~AudioEngine() {
    shutdown();
}

bool AudioEngine::initialize() {
    // Create shared memory
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
        return false;
    }
    
    shared_memory_ = MapViewOfFile(hMapFile, FILE_MAP_ALL_ACCESS, 0, 0, shared_memory_size_);
    if (shared_memory_ == NULL) {
        CloseHandle(hMapFile);
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
    
    shared_state_ = static_cast<AudioState*>(shared_memory_);
    
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
    if (deck == 1) {
        shared_state_->deck1_playing = playing;
    } else if (deck == 2) {
        shared_state_->deck2_playing = playing;
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
    if (shared_state_->deck1_playing) {
        float current_pos = shared_state_->deck1_position.load();
        shared_state_->deck1_position.store(current_pos + 0.01f); // Simulate playback
    }
    if (shared_state_->deck2_playing) {
        float current_pos = shared_state_->deck2_position.load();
        shared_state_->deck2_position.store(current_pos + 0.01f);
    }
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