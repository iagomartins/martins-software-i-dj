#pragma once

#include <JuceHeader.h>
#include <napi.h>

class JUCEAudioProcessor : public juce::AudioProcessor
{
public:
    JUCEAudioProcessor();
    ~JUCEAudioProcessor() override;

    // AudioProcessor overrides
    const juce::String getName() const override;
    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;
    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;
    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    // AudioProcessorGraph overrides
    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) override;

    // Custom methods for DJ effects
    void setPitchBend(float semitones);
    void setFlangerEnabled(bool enabled);
    void setFlangerRate(float rate);
    void setFlangerDepth(float depth);
    void setFilterCutoff(float cutoff);
    void setFilterResonance(float resonance);
    void setJogWheelPosition(float position);
    void setVolume(float volume);

private:
    // Audio effects
    juce::dsp::PitchShifter pitchShifter;
    juce::dsp::Chorus flanger;
    juce::dsp::StateVariableTPTFilter<float> filter;
    juce::dsp::Gain<float> volumeGain;
    
    // Jog wheel state
    float jogWheelPosition = 0.0f;
    float jogWheelVelocity = 0.0f;
    
    // Effect parameters
    bool flangerEnabled = false;
    float flangerRate = 1.0f;
    float flangerDepth = 0.5f;
    float filterCutoff = 1000.0f;
    float filterResonance = 1.0f;
    float currentPitch = 0.0f;
    float currentVolume = 1.0f;
};
