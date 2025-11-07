#pragma once

#include <cmath>
#include <cstring>

// Biquad filter for EQ and effects
class BiquadFilter {
public:
    BiquadFilter();
    void setLowpass(float cutoff, float q, float sampleRate);
    void setHighpass(float cutoff, float q, float sampleRate);
    void setPeaking(float freq, float q, float gain, float sampleRate);
    void setLowshelf(float freq, float q, float gain, float sampleRate);
    void setHighshelf(float freq, float q, float gain, float sampleRate);
    void reset();
    float process(float input);
    
private:
    void setCoefficients(float b0, float b1, float b2, float a0, float a1, float a2);
    float b0, b1, b2, a1, a2;
    float x1, x2, y1, y2; // Filter state
};

// Delay line for echo/flanger/reverb
class DelayLine {
public:
    DelayLine(int maxDelay);
    ~DelayLine();
    void write(float sample);
    float read(int delay);
    int getMaxDelay() const { return maxDelay; }
    
private:
    float* buffer;
    int maxDelay;
    int writePos;
};

// Processing parameters
struct ProcessingParams {
    float volume;
    float pitch;
    float lowEQ;
    float midEQ;
    float highEQ;
    bool flangerEnabled;
    bool filterEnabled;
    bool echoEnabled;
    bool reverbEnabled;
};

// Main audio processor
class AudioProcessor {
public:
    AudioProcessor(int sampleRate);
    
    void setVolume(float volume);
    void setPitch(float pitch);
    void setEQ(int band, float value); // 0=low, 1=mid, 2=high
    void setEffect(int effect, bool enabled); // 0=flanger, 1=filter, 2=echo, 3=reverb
    
    void process(float* input, float* output, int numSamples);
    void processStereo(float* inputLeft, float* inputRight, 
                      float* outputLeft, float* outputRight, 
                      int numSamples);
    
private:
    int sampleRate;
    ProcessingParams params;
    
    // EQ filters
    BiquadFilter lowFilter;
    BiquadFilter midFilter;
    BiquadFilter highFilter;
    
    // Effect filters
    BiquadFilter filterEffect;
    
    // Delay lines
    DelayLine flangerDelayLine;
    DelayLine echoDelayLine;
    DelayLine reverbDelayLine;
    
    // Flanger LFO
    float flangerPhase;
    float flangerDelay;
};

