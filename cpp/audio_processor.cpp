#include "audio_processor.h"
#include <cmath>
#include <algorithm>
#include <cstring>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Simple biquad filter implementation
BiquadFilter::BiquadFilter() {
    reset();
}

void BiquadFilter::setLowpass(float cutoff, float q, float sampleRate) {
    float w = 2.0f * M_PI * cutoff / sampleRate;
    float cosw = cosf(w);
    float sinw = sinf(w);
    float alpha = sinw / (2.0f * q);
    
    float b0 = (1.0f - cosw) / 2.0f;
    float b1 = 1.0f - cosw;
    float b2 = (1.0f - cosw) / 2.0f;
    float a0 = 1.0f + alpha;
    float a1 = -2.0f * cosw;
    float a2 = 1.0f - alpha;
    
    setCoefficients(b0, b1, b2, a0, a1, a2);
}

void BiquadFilter::setHighpass(float cutoff, float q, float sampleRate) {
    float w = 2.0f * M_PI * cutoff / sampleRate;
    float cosw = cosf(w);
    float sinw = sinf(w);
    float alpha = sinw / (2.0f * q);
    
    float b0 = (1.0f + cosw) / 2.0f;
    float b1 = -(1.0f + cosw);
    float b2 = (1.0f + cosw) / 2.0f;
    float a0 = 1.0f + alpha;
    float a1 = -2.0f * cosw;
    float a2 = 1.0f - alpha;
    
    setCoefficients(b0, b1, b2, a0, a1, a2);
}

void BiquadFilter::setPeaking(float freq, float q, float gain, float sampleRate) {
    float w = 2.0f * M_PI * freq / sampleRate;
    float cosw = cosf(w);
    float sinw = sinf(w);
    float alpha = sinw / (2.0f * q);
    float A = powf(10.0f, gain / 40.0f);
    float S = 1.0f;
    float beta = sqrtf(A) / q;
    
    float b0 = 1.0f + alpha * A;
    float b1 = -2.0f * cosw;
    float b2 = 1.0f - alpha * A;
    float a0 = 1.0f + alpha / A;
    float a1 = -2.0f * cosw;
    float a2 = 1.0f - alpha / A;
    
    setCoefficients(b0, b1, b2, a0, a1, a2);
}

void BiquadFilter::setLowshelf(float freq, float q, float gain, float sampleRate) {
    float w = 2.0f * M_PI * freq / sampleRate;
    float cosw = cosf(w);
    float sinw = sinf(w);
    float A = powf(10.0f, gain / 40.0f);
    float S = 1.0f;
    float alpha = sinw / 2.0f * sqrtf((A + 1.0f / A) * (1.0f / S - 1.0f) + 2.0f);
    float beta = sqrtf(A) / q;
    
    float b0 = A * ((A + 1.0f) - (A - 1.0f) * cosw + beta * sinw);
    float b1 = 2.0f * A * ((A - 1.0f) - (A + 1.0f) * cosw);
    float b2 = A * ((A + 1.0f) - (A - 1.0f) * cosw - beta * sinw);
    float a0 = (A + 1.0f) + (A - 1.0f) * cosw + beta * sinw;
    float a1 = -2.0f * ((A - 1.0f) + (A + 1.0f) * cosw);
    float a2 = (A + 1.0f) + (A - 1.0f) * cosw - beta * sinw;
    
    setCoefficients(b0, b1, b2, a0, a1, a2);
}

void BiquadFilter::setHighshelf(float freq, float q, float gain, float sampleRate) {
    float w = 2.0f * M_PI * freq / sampleRate;
    float cosw = cosf(w);
    float sinw = sinf(w);
    float A = powf(10.0f, gain / 40.0f);
    float S = 1.0f;
    float alpha = sinw / 2.0f * sqrtf((A + 1.0f / A) * (1.0f / S - 1.0f) + 2.0f);
    float beta = sqrtf(A) / q;
    
    float b0 = A * ((A + 1.0f) + (A - 1.0f) * cosw + beta * sinw);
    float b1 = -2.0f * A * ((A - 1.0f) + (A + 1.0f) * cosw);
    float b2 = A * ((A + 1.0f) + (A - 1.0f) * cosw - beta * sinw);
    float a0 = (A + 1.0f) - (A - 1.0f) * cosw + beta * sinw;
    float a1 = 2.0f * ((A - 1.0f) - (A + 1.0f) * cosw);
    float a2 = (A + 1.0f) - (A - 1.0f) * cosw - beta * sinw;
    
    setCoefficients(b0, b1, b2, a0, a1, a2);
}

void BiquadFilter::setCoefficients(float b0, float b1, float b2, float a0, float a1, float a2) {
    // Normalize coefficients
    this->b0 = b0 / a0;
    this->b1 = b1 / a0;
    this->b2 = b2 / a0;
    this->a1 = a1 / a0;
    this->a2 = a2 / a0;
}

void BiquadFilter::reset() {
    x1 = x2 = y1 = y2 = 0.0f;
}

float BiquadFilter::process(float input) {
    float output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = output;
    return output;
}

// Delay line for echo/flanger
DelayLine::DelayLine(int maxDelaySamples) : maxDelay(maxDelaySamples), writePos(0) {
    buffer = new float[maxDelaySamples];
    memset(buffer, 0, maxDelaySamples * sizeof(float));
}

DelayLine::~DelayLine() {
    delete[] buffer;
}

void DelayLine::write(float sample) {
    buffer[writePos] = sample;
    writePos = (writePos + 1) % maxDelay;
}

float DelayLine::read(int delay) {
    int readPos = (writePos - delay + maxDelay) % maxDelay;
    return buffer[readPos];
}

// AudioProcessor implementation
AudioProcessor::AudioProcessor(int sampleRate) 
    : sampleRate(sampleRate), 
      flangerPhase(0.0f),
      flangerDelay(0.0f),
      flangerDelayLine(static_cast<int>(sampleRate * 0.01f)), // 10ms max delay for flanger
      echoDelayLine(static_cast<int>(sampleRate * 2)), // 2 seconds max delay
      reverbDelayLine(static_cast<int>(sampleRate * 1)) { // 1 second max delay
    params.volume = 1.0f;
    params.pitch = 0.0f;
    params.lowEQ = 0.0f;
    params.midEQ = 0.0f;
    params.highEQ = 0.0f;
    params.flangerEnabled = false;
    params.filterEnabled = false;
    params.echoEnabled = false;
    params.reverbEnabled = false;
    
    // Initialize EQ filters
    lowFilter.setLowshelf(320.0f, 0.707f, 0.0f, sampleRate);
    midFilter.setPeaking(1000.0f, 0.707f, 0.0f, sampleRate);
    highFilter.setHighshelf(3200.0f, 0.707f, 0.0f, sampleRate);
    
    // Initialize filter effect
    filterEffect.setLowpass(1000.0f, 0.707f, sampleRate);
}

void AudioProcessor::setVolume(float volume) {
    params.volume = volume;
}

void AudioProcessor::setPitch(float pitch) {
    params.pitch = pitch;
}

void AudioProcessor::setEQ(int band, float value) {
    switch (band) {
        case 0: // Low
            params.lowEQ = value;
            lowFilter.setLowshelf(320.0f, 0.707f, value * 12.0f, sampleRate);
            break;
        case 1: // Mid
            params.midEQ = value;
            midFilter.setPeaking(1000.0f, 0.707f, value * 12.0f, sampleRate);
            break;
        case 2: // High
            params.highEQ = value;
            highFilter.setHighshelf(3200.0f, 0.707f, value * 12.0f, sampleRate);
            break;
    }
}

void AudioProcessor::setEffect(int effect, bool enabled) {
    switch (effect) {
        case 0: params.flangerEnabled = enabled; break;
        case 1: params.filterEnabled = enabled; break;
        case 2: params.echoEnabled = enabled; break;
        case 3: params.reverbEnabled = enabled; break;
    }
}

void AudioProcessor::process(float* input, float* output, int numSamples) {
    for (int i = 0; i < numSamples; i++) {
        float sample = input[i];
        
        // Apply pitch (simple playback rate change - for real pitch shift, use time-stretch)
        // For now, we'll just pass through as pitch is handled at source level
        
        // Apply EQ
        sample = lowFilter.process(sample);
        sample = midFilter.process(sample);
        sample = highFilter.process(sample);
        
        // Apply effects
        if (params.flangerEnabled) {
            // Flanger: short delay with LFO modulation
            flangerPhase += 0.1f; // LFO rate
            if (flangerPhase > 2.0f * M_PI) flangerPhase -= 2.0f * M_PI;
            
            float delayTime = 0.003f + 0.002f * sinf(flangerPhase); // 1-5ms delay
            int delaySamples = (int)(delayTime * sampleRate);
            int maxDelay = flangerDelayLine.getMaxDelay();
            delaySamples = std::min(delaySamples, maxDelay - 1);
            delaySamples = std::max(1, delaySamples); // Ensure at least 1 sample delay
            
            float delayed = flangerDelayLine.read(delaySamples);
            flangerDelayLine.write(sample);
            sample = sample + delayed * 0.5f; // Mix original and delayed
        }
        
        if (params.filterEnabled) {
            sample = filterEffect.process(sample);
        }
        
        if (params.echoEnabled) {
            // Echo: longer delay with feedback
            int delaySamples = (int)(0.3f * sampleRate); // 300ms delay
            float delayed = echoDelayLine.read(delaySamples);
            echoDelayLine.write(sample + delayed * 0.3f); // Feedback
            sample = sample + delayed * 0.4f; // Mix
        }
        
        if (params.reverbEnabled) {
            // Simple reverb: multiple delays with feedback
            int delay1 = (int)(0.05f * sampleRate);
            int delay2 = (int)(0.1f * sampleRate);
            int delay3 = (int)(0.15f * sampleRate);
            
            float rev1 = reverbDelayLine.read(delay1);
            float rev2 = reverbDelayLine.read(delay2);
            float rev3 = reverbDelayLine.read(delay3);
            
            float reverbSum = (rev1 + rev2 + rev3) * 0.33f;
            reverbDelayLine.write(sample + reverbSum * 0.2f);
            sample = sample + reverbSum * 0.3f;
        }
        
        // Apply volume
        sample *= params.volume;
        
        output[i] = sample;
    }
}

void AudioProcessor::processStereo(float* inputLeft, float* inputRight, 
                                   float* outputLeft, float* outputRight, 
                                   int numSamples) {
    // Process left and right channels separately
    process(inputLeft, outputLeft, numSamples);
    process(inputRight, outputRight, numSamples);
}

