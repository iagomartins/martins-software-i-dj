#include "audio_engine.h"
#include <iostream>
#include <cstring>
#include <chrono>
#include <portaudio.h>
#include <fstream>
#include <algorithm>

// Add M_PI definition for Windows
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Add a function to send logs to renderer (we'll implement this in the bridge)
extern "C" {
    // This will be called from the audio bridge
    void (*logCallback)(const char* message) = nullptr;
}

// Helper function to log to both console and renderer
void logMessage(const std::string& message) {
    std::cout << message << std::endl;
    if (logCallback) {
        logCallback(message.c_str());
    }
}

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
        "DJAudioEngine"
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

// Fix the setDeckPlaying function
void AudioEngine::setDeckPlaying(int deck, bool playing) {
    if (!shared_state_) {
        std::cout << "❌ setDeckPlaying: shared_state_ is null!" << std::endl;
        return;
    }
    
    std::cout << " C++ setDeckPlaying called: deck=" << deck << ", playing=" << (playing ? "true" : "false") << std::endl;
    
    if (deck >= 1 && deck <= 2) {
        shared_state_->deck_playing[deck - 1].store(playing);
        std::cout << "✅ C++ deck " << deck << " playing state set to: " << (playing ? "true" : "false") << std::endl;
        
        // Verify the value was set
        bool actualValue = shared_state_->deck_playing[deck - 1].load();
        std::cout << " Verified deck " << deck << " playing state: " << (actualValue ? "true" : "false") << std::endl;
        
        // Check if audio file is loaded
        if (deck == 1) {
            std::cout << " Deck 1 audio loaded: " << (deck1_audio_.loaded ? "true" : "false") << std::endl;
            std::cout << " Deck 1 samples: " << deck1_audio_.leftChannel.size() << std::endl;
        } else if (deck == 2) {
            std::cout << " Deck 2 audio loaded: " << (deck2_audio_.loaded ? "true" : "false") << std::endl;
            std::cout << " Deck 2 samples: " << deck2_audio_.leftChannel.size() << std::endl;
        }
    } else {
        std::cout << "❌ Invalid deck number: " << deck << std::endl;
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

// Fix the setDeckPosition function
void AudioEngine::setDeckPosition(int deck, float position) {
    if (!shared_state_) return;
    
    if (deck >= 1 && deck <= 2) {
        int deckIndex = deck - 1;
        AudioFile* audioFile = (deckIndex == 0) ? &deck1_audio_ : &deck2_audio_;
        
        if (audioFile->loaded) {
            int totalSamples = audioFile->leftChannel.size();
            int newPosition = static_cast<int>(position * totalSamples);
            if (deckIndex == 0) {
                deck1_position_.store(newPosition);
            } else {
                deck2_position_.store(newPosition);
            }
        }
    }
}

float AudioEngine::getDeckPosition(int deck) {
    if (!shared_state_) return 0.0f;
    
    if (deck >= 1 && deck <= 2) {
        int deckIndex = deck - 1;
        AudioFile* audioFile = (deckIndex == 0) ? &deck1_audio_ : &deck2_audio_;
        
        if (audioFile->loaded) {
            int totalSamples = audioFile->leftChannel.size();
            size_t currentPos = (deckIndex == 0) ? deck1_position_.load() : deck2_position_.load();
            return static_cast<float>(currentPos) / totalSamples;
        }
    }
    
    return 0.0f;
}

// Fix the setDeckFile function
void AudioEngine::setDeckFile(int deck, const std::string& filepath) {
    if (!shared_state_) {
        std::cout << "❌ setDeckFile: shared_state_ is null!" << std::endl;
        return;
    }
    
    std::cout << " Loading audio file for deck " << deck << ": " << filepath << std::endl;
    
    if (deck >= 1 && deck <= 2) {
        // Reset position when loading new file
        if (deck == 1) {
            deck1_position_.store(0);
        } else {
            deck2_position_.store(0);
        }
        
        // Load the audio file
        AudioFile* audioFile = (deck == 1) ? &deck1_audio_ : &deck2_audio_;
        if (loadAudioFile(filepath, *audioFile)) {
            std::cout << "✅ Successfully loaded audio file for deck " << deck << std::endl;
        } else {
            std::cout << "❌ Failed to load audio file for deck " << deck << std::endl;
        }
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
    if (shared_state_->deck_playing[0].load()) {
        float current_pos = shared_state_->deck1_position.load();
        shared_state_->deck1_position.store(current_pos + 0.01f); // Simulate playback
    }
    if (shared_state_->deck_playing[1].load()) {
        float current_pos = shared_state_->deck2_position.load();
        shared_state_->deck2_position.store(current_pos + 0.01f);
    }
}

bool AudioEngine::loadWavFile(const std::string& filepath, AudioFile& audioFile) {
    std::ifstream file(filepath, std::ios::binary);
    if (!file.is_open()) {
        std::cerr << "Failed to open file: " << filepath << std::endl;
        return false;
    }
    
    std::cout << "📁 Opening WAV file: " << filepath << std::endl;
    
    // Read WAV header
    char header[44];
    file.read(header, 44);
    
    // Check RIFF header
    if (strncmp(header, "RIFF", 4) != 0) {
        std::cerr << "Not a valid WAV file (missing RIFF header)" << std::endl;
        return false;
    }
    
    // Check WAVE format
    if (strncmp(header + 8, "WAVE", 4) != 0) {
        std::cerr << "Not a valid WAV file (missing WAVE format)" << std::endl;
        return false;
    }
    
    std::cout << "✅ WAV file header validated" << std::endl;
    
    // Find fmt chunk
    uint32_t chunkSize = 0;
    uint32_t dataSize = 0;
    uint32_t sampleRate = 0;
    uint16_t channels = 0;
    uint16_t bitsPerSample = 0;
    
    // Parse chunks
    uint32_t offset = 12;
    while (offset < 44) {
        char chunkId[4];
        memcpy(chunkId, header + offset, 4);
        uint32_t chunkSize;
        memcpy(&chunkSize, header + offset + 4, 4);
        
        if (strncmp(chunkId, "fmt ", 4) == 0) {
            // Parse fmt chunk
            uint16_t audioFormat;
            memcpy(&audioFormat, header + offset + 8, 2);
            memcpy(&channels, header + offset + 10, 2);
            memcpy(&sampleRate, header + offset + 12, 4);
            memcpy(&bitsPerSample, header + offset + 22, 2);
            
            std::cout << "WAV Format: " << audioFormat << ", Channels: " << channels 
                      << ", Sample Rate: " << sampleRate << ", Bits: " << bitsPerSample << std::endl;
        } else if (strncmp(chunkId, "data", 4) == 0) {
            dataSize = chunkSize;
            break;
        }
        
        offset += 8 + chunkSize;
    }
    
    if (dataSize == 0) {
        std::cerr << "No data chunk found in WAV file" << std::endl;
        return false;
    }
    
    std::cout << "📊 Data size: " << dataSize << " bytes" << std::endl;
    
    // Read audio data
    std::vector<char> audioData(dataSize);
    file.read(audioData.data(), dataSize);
    file.close();
    
    std::cout << "📖 Read " << audioData.size() << " bytes of audio data" << std::endl;
    
    // Convert to float samples
    audioFile.sampleRate = sampleRate;
    audioFile.channels = channels;
    audioFile.duration = static_cast<float>(dataSize) / (sampleRate * channels * (bitsPerSample / 8));
    
    if (channels == 1) {
        // Mono
        audioFile.leftChannel.reserve(dataSize / (bitsPerSample / 8));
        audioFile.rightChannel.reserve(dataSize / (bitsPerSample / 8));
        
        if (bitsPerSample == 16) {
            int16_t* samples = reinterpret_cast<int16_t*>(audioData.data());
            int sampleCount = dataSize / 2;
            
            for (int i = 0; i < sampleCount; i++) {
                float sample = static_cast<float>(samples[i]) / 32768.0f;
                audioFile.leftChannel.push_back(sample);
                audioFile.rightChannel.push_back(sample); // Duplicate for stereo
            }
        } else if (bitsPerSample == 32) {
            int32_t* samples = reinterpret_cast<int32_t*>(audioData.data());
            int sampleCount = dataSize / 4;
            
            for (int i = 0; i < sampleCount; i++) {
                float sample = static_cast<float>(samples[i]) / 2147483648.0f;
                audioFile.leftChannel.push_back(sample);
                audioFile.rightChannel.push_back(sample); // Duplicate for stereo
            }
        }
    } else if (channels == 2) {
        // Stereo
        audioFile.leftChannel.reserve(dataSize / (bitsPerSample / 8) / 2);
        audioFile.rightChannel.reserve(dataSize / (bitsPerSample / 8) / 2);
        
        if (bitsPerSample == 16) {
            int16_t* samples = reinterpret_cast<int16_t*>(audioData.data());
            int sampleCount = dataSize / 4; // 2 channels * 2 bytes per sample
            
            for (int i = 0; i < sampleCount; i += 2) {
                float leftSample = static_cast<float>(samples[i]) / 32768.0f;
                float rightSample = static_cast<float>(samples[i + 1]) / 32768.0f;
                audioFile.leftChannel.push_back(leftSample);
                audioFile.rightChannel.push_back(rightSample);
            }
        } else if (bitsPerSample == 32) {
            int32_t* samples = reinterpret_cast<int32_t*>(audioData.data());
            int sampleCount = dataSize / 8; // 2 channels * 4 bytes per sample
            
            for (int i = 0; i < sampleCount; i += 2) {
                float leftSample = static_cast<float>(samples[i]) / 2147483648.0f;
                float rightSample = static_cast<float>(samples[i + 1]) / 2147483648.0f;
                audioFile.leftChannel.push_back(leftSample);
                audioFile.rightChannel.push_back(rightSample);
            }
        }
    }
    
    audioFile.loaded = true;
    std::cout << "✅ Loaded " << audioFile.leftChannel.size() << " samples" << std::endl;
    return true;
}

bool AudioEngine::loadAudioFile(const std::string& filepath, AudioFile& audioFile) {
    // Reset audio file
    audioFile = AudioFile();
    
    // Check file extension
    std::string extension = filepath.substr(filepath.find_last_of(".") + 1);
    std::transform(extension.begin(), extension.end(), extension.begin(), ::tolower);
    
    if (extension == "wav") {
        return loadWavFile(filepath, audioFile);
    } else {
        std::cerr << "Unsupported audio format: " << extension << std::endl;
        return false;
    }
}

// Add debug messages to the audioCallback function
int AudioEngine::audioCallback(const void* inputBuffer, void* outputBuffer,
                              unsigned long framesPerBuffer,
                              const PaStreamCallbackTimeInfo* timeInfo,
                              PaStreamCallbackFlags statusFlags,
                              void* userData) {
    AudioEngine* engine = static_cast<AudioEngine*>(userData);
    float* out = static_cast<float*>(outputBuffer);
    
    // Add debug counter (only log every 1000 calls to avoid spam)
    static int callbackCount = 0;
    static float phase = 0.0f;
    callbackCount++;
    
    if (callbackCount % 1000 == 0) {
        std::cout << "🔊 Audio callback #" << callbackCount << " - Deck1: " 
                  << engine->shared_state_->deck_playing[0].load() 
                  << ", Deck2: " << engine->shared_state_->deck_playing[1].load() << std::endl;
    }
    
    // Clear output buffer
    memset(out, 0, framesPerBuffer * 2 * sizeof(float));
    
    // Play deck 1
    if (engine->shared_state_->deck_playing[0].load()) {
        if (engine->deck1_audio_.loaded) {
            // Play actual audio file
            size_t currentPos = engine->deck1_position_.load();
            size_t totalSamples = engine->deck1_audio_.leftChannel.size();
            
            if (callbackCount <= 5) {
                std::cout << "🎵 Playing actual audio from deck 1 - Pos: " << currentPos 
                          << ", Total: " << totalSamples << std::endl;
            }
            
            // Play audio data
            for (unsigned long i = 0; i < framesPerBuffer; i++) {
                if (currentPos + i < totalSamples) {
                    // Apply volume control
                    float volume = engine->shared_state_->deck1_volume.load();
                    
                    out[i * 2] += engine->deck1_audio_.leftChannel[currentPos + i] * volume;
                    out[i * 2 + 1] += engine->deck1_audio_.rightChannel[currentPos + i] * volume;
                }
            }
            
            // Update position
            engine->deck1_position_.store(currentPos + framesPerBuffer);
            
            // Loop if we reach the end
            if (currentPos + framesPerBuffer >= totalSamples) {
                engine->deck1_position_.store(0);
            }
        } else {
            // Play test tone only if no audio file loaded
            float frequency = 440.0f; // A4 note
            float sampleRate = 44100.0f;
            
            for (unsigned long i = 0; i < framesPerBuffer; i++) {
                float sample = 0.1f * sin(phase); // Low volume test tone
                out[i * 2] = sample;     // Left channel
                out[i * 2 + 1] = sample; // Right channel
                phase += 2.0f * M_PI * frequency / sampleRate;
                
                if (phase >= 2.0f * M_PI) {
                    phase -= 2.0f * M_PI;
                }
            }
            
            if (callbackCount <= 5) {
                std::cout << "🔊 Generating test tone for deck 1 (no audio file loaded)" << std::endl;
            }
        }
    }
    
    // Play deck 2
    if (engine->shared_state_->deck_playing[1].load()) {
        if (engine->deck2_audio_.loaded) {
            // Play actual audio file
            size_t currentPos = engine->deck2_position_.load();
            size_t totalSamples = engine->deck2_audio_.leftChannel.size();
            
            if (callbackCount <= 5) {
                std::cout << "🎵 Playing actual audio from deck 2 - Pos: " << currentPos 
                          << ", Total: " << totalSamples << std::endl;
            }
            
            // Play audio data
            for (unsigned long i = 0; i < framesPerBuffer; i++) {
                if (currentPos + i < totalSamples) {
                    // Apply volume control
                    float volume = engine->shared_state_->deck2_volume.load();
                    
                    out[i * 2] += engine->deck2_audio_.leftChannel[currentPos + i] * volume;
                    out[i * 2 + 1] += engine->deck2_audio_.rightChannel[currentPos + i] * volume;
                }
            }
            
            // Update position
            engine->deck2_position_.store(currentPos + framesPerBuffer);
            
            // Loop if we reach the end
            if (currentPos + framesPerBuffer >= totalSamples) {
                engine->deck2_position_.store(0);
            }
        } else {
            // Play test tone only if no audio file loaded
            float frequency = 880.0f; // A5 note (different from deck 1)
            float sampleRate = 44100.0f;
            
            for (unsigned long i = 0; i < framesPerBuffer; i++) {
                float sample = 0.1f * sin(phase + M_PI); // Different phase for deck 2
                out[i * 2] += sample;     // Left channel
                out[i * 2 + 1] += sample; // Right channel
                phase += 2.0f * M_PI * frequency / sampleRate;
                
                if (phase >= 2.0f * M_PI) {
                    phase -= 2.0f * M_PI;
                }
            }
            
            if (callbackCount <= 5) {
                std::cout << "🔊 Generating test tone for deck 2 (no audio file loaded)" << std::endl;
            }
        }
    }
    
    // Apply master volume
    float masterVolume = engine->shared_state_->master_volume.load();
    for (unsigned long i = 0; i < framesPerBuffer * 2; i++) {
        out[i] *= masterVolume;
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
        static_cast<AudioEngine*>(engine)->setDeckFile(deck, filepath);
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