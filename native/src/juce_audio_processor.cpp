#include "juce_audio_processor.h"

JUCEAudioProcessor::JUCEAudioProcessor()
    : AudioProcessor(BusesProperties()
        .withInput("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize effects
    pitchShifter.setPitch(1.0f);
    flanger.setRate(1.0f);
    flanger.setDepth(0.5f);
    flanger.setMix(0.5f);
    filter.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    filter.setCutoffFrequency(1000.0f);
    filter.setResonance(1.0f);
}

void JUCEAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = samplesPerBlock;
    spec.numChannels = 2;

    pitchShifter.prepare(spec);
    flanger.prepare(spec);
    filter.prepare(spec);
    volumeGain.prepare(spec);
}

void JUCEAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    
    // Apply pitch shifting
    if (currentPitch != 0.0f) {
        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> context(block);
        pitchShifter.process(context);
    }
    
    // Apply flanger
    if (flangerEnabled) {
        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> context(block);
        flanger.process(context);
    }
    
    // Apply filter
    juce::dsp::AudioBlock<float> block(buffer);
    juce::dsp::ProcessContextReplacing<float> context(block);
    filter.process(context);
    
    // Apply volume
    volumeGain.process(context);
}

void JUCEAudioProcessor::setPitchBend(float semitones)
{
    currentPitch = semitones;
    float pitchRatio = juce::juce::pow(2.0f, semitones / 12.0f);
    pitchShifter.setPitch(pitchRatio);
}

void JUCEAudioProcessor::setFlangerEnabled(bool enabled)
{
    flangerEnabled = enabled;
}

void JUCEAudioProcessor::setFlangerRate(float rate)
{
    flangerRate = rate;
    flanger.setRate(rate);
}

void JUCEAudioProcessor::setFlangerDepth(float depth)
{
    flangerDepth = depth;
    flanger.setDepth(depth);
}

void JUCEAudioProcessor::setFilterCutoff(float cutoff)
{
    filterCutoff = cutoff;
    filter.setCutoffFrequency(cutoff);
}

void JUCEAudioProcessor::setFilterResonance(float resonance)
{
    filterResonance = resonance;
    filter.setResonance(resonance);
}

void JUCEAudioProcessor::setJogWheelPosition(float position)
{
    jogWheelPosition = position;
    // Implement jog wheel logic here
}

void JUCEAudioProcessor::setVolume(float volume)
{
    currentVolume = volume;
    volumeGain.setGainLinear(volume);
}

// ... other required overrides ...