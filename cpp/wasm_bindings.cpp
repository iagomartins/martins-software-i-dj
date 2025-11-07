#include "audio_processor.h"
#include <emscripten.h>
#include <memory>

// Global processor instances for two decks
static std::unique_ptr<AudioProcessor> deck1Processor;
static std::unique_ptr<AudioProcessor> deck2Processor;

// Global state
static float crossfaderValue = 0.5f; // 0.0 = deck1 only, 1.0 = deck2 only
static float masterVolume = 1.0f;
static int currentSampleRate = 44100;

// Initialize processors
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void init_processors(int sampleRate) {
        currentSampleRate = sampleRate;
        deck1Processor = std::make_unique<AudioProcessor>(sampleRate);
        deck2Processor = std::make_unique<AudioProcessor>(sampleRate);
    }
    
    // Deck 1 controls
    EMSCRIPTEN_KEEPALIVE
    void set_deck1_volume(float volume) {
        if (deck1Processor) {
            deck1Processor->setVolume(volume);
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void set_deck1_pitch(float pitch) {
        if (deck1Processor) {
            deck1Processor->setPitch(pitch);
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void set_deck1_eq(int band, float value) {
        if (deck1Processor) {
            deck1Processor->setEQ(band, value);
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void set_deck1_effect(int effect, bool enabled) {
        if (deck1Processor) {
            deck1Processor->setEffect(effect, enabled);
        }
    }
    
    // Deck 2 controls
    EMSCRIPTEN_KEEPALIVE
    void set_deck2_volume(float volume) {
        if (deck2Processor) {
            deck2Processor->setVolume(volume);
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void set_deck2_pitch(float pitch) {
        if (deck2Processor) {
            deck2Processor->setPitch(pitch);
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void set_deck2_eq(int band, float value) {
        if (deck2Processor) {
            deck2Processor->setEQ(band, value);
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void set_deck2_effect(int effect, bool enabled) {
        if (deck2Processor) {
            deck2Processor->setEffect(effect, enabled);
        }
    }
    
    // Global controls
    EMSCRIPTEN_KEEPALIVE
    void set_crossfader(float value) {
        crossfaderValue = value;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void set_master_volume(float volume) {
        masterVolume = volume;
    }
    
    // Main processing function
    // Input: pointers to float arrays in Wasm memory
    // deck1Input, deck1Output, deck2Input, deck2Output are pointers to float arrays
    // numSamples is the number of samples per channel
    EMSCRIPTEN_KEEPALIVE
    void process_deck_audio(
        float* deck1InputLeft, float* deck1InputRight,
        float* deck1OutputLeft, float* deck1OutputRight,
        float* deck2InputLeft, float* deck2InputRight,
        float* deck2OutputLeft, float* deck2OutputRight,
        int numSamples,
        bool deck1Active,
        bool deck2Active
    ) {
        // Process deck 1
        if (deck1Active && deck1Processor && deck1InputLeft && deck1OutputLeft) {
            deck1Processor->processStereo(
                deck1InputLeft, deck1InputRight,
                deck1OutputLeft, deck1OutputRight,
                numSamples
            );
            
            // Apply crossfader to deck 1
            float deck1Gain = (crossfaderValue <= 0.0f) ? 1.0f : (1.0f - crossfaderValue);
            for (int i = 0; i < numSamples; i++) {
                deck1OutputLeft[i] *= deck1Gain;
                deck1OutputRight[i] *= deck1Gain;
            }
        } else if (deck1OutputLeft) {
            // Clear output if deck not active
            for (int i = 0; i < numSamples; i++) {
                deck1OutputLeft[i] = 0.0f;
                deck1OutputRight[i] = 0.0f;
            }
        }
        
        // Process deck 2
        if (deck2Active && deck2Processor && deck2InputLeft && deck2OutputLeft) {
            deck2Processor->processStereo(
                deck2InputLeft, deck2InputRight,
                deck2OutputLeft, deck2OutputRight,
                numSamples
            );
            
            // Apply crossfader to deck 2
            float deck2Gain = (crossfaderValue >= 0.0f) ? 1.0f : (1.0f + crossfaderValue);
            for (int i = 0; i < numSamples; i++) {
                deck2OutputLeft[i] *= deck2Gain;
                deck2OutputRight[i] *= deck2Gain;
            }
        } else if (deck2OutputLeft) {
            // Clear output if deck not active
            for (int i = 0; i < numSamples; i++) {
                deck2OutputLeft[i] = 0.0f;
                deck2OutputRight[i] = 0.0f;
            }
        }
        
        // Mix decks and apply master volume
        if (deck1OutputLeft && deck2OutputLeft) {
            for (int i = 0; i < numSamples; i++) {
                deck1OutputLeft[i] = (deck1OutputLeft[i] + deck2OutputLeft[i]) * masterVolume;
                deck1OutputRight[i] = (deck1OutputRight[i] + deck2OutputRight[i]) * masterVolume;
            }
        }
    }
}

