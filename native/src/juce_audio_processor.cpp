#include "juce_audio_processor.h"

JUCEAudioProcessor::JUCEAudioProcessor()
    : AudioProcessor(BusesProperties()
        .withInput("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize effects
    flanger.setRate(1.0f);
    flanger.setDepth(0.5f);
    flanger.setMix(0.5f);
    filter.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    filter.setCutoffFrequency(1000.0f);
    filter.setResonance(1.0f);
    
    // Initialize pitch shifting
    pitchDelay.setMaximumDelayInSamples(1024);
    pitchGain.setGainLinear(1.0f);
}

JUCEAudioProcessor::~JUCEAudioProcessor() = default;

// Required abstract method implementations
juce::AudioProcessorEditor* JUCEAudioProcessor::createEditor()
{
    return nullptr; // No GUI editor for Node.js addon
}

bool JUCEAudioProcessor::hasEditor() const
{
    return false; // No GUI editor for Node.js addon
}

// AudioProcessor overrides
const juce::String JUCEAudioProcessor::getName() const
{
    return "DJ Audio Processor";
}

bool JUCEAudioProcessor::acceptsMidi() const
{
    return true;
}

bool JUCEAudioProcessor::producesMidi() const
{
    return false;
}

bool JUCEAudioProcessor::isMidiEffect() const
{
    return false;
}

double JUCEAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int JUCEAudioProcessor::getNumPrograms()
{
    return 1;
}

int JUCEAudioProcessor::getCurrentProgram()
{
    return 0;
}

void JUCEAudioProcessor::setCurrentProgram(int index)
{
    juce::ignoreUnused(index);
}

const juce::String JUCEAudioProcessor::getProgramName(int index)
{
    juce::ignoreUnused(index);
    return "Default";
}

void JUCEAudioProcessor::changeProgramName(int index, const juce::String& newName)
{
    juce::ignoreUnused(index, newName);
}

void JUCEAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::ignoreUnused(destData);
}

void JUCEAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::ignoreUnused(data, sizeInBytes);
}

void JUCEAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = samplesPerBlock;
    spec.numChannels = 2;

    flanger.prepare(spec);
    filter.prepare(spec);
    volumeGain.prepare(spec);
    pitchDelay.prepare(spec);
    pitchGain.prepare(spec);
}

void JUCEAudioProcessor::releaseResources()
{
    // Clean up resources if needed
}

void JUCEAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    juce::ignoreUnused(midiMessages);
    
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
    float pitchRatio = std::pow(2.0f, semitones / 12.0f);
    pitchGain.setGainLinear(pitchRatio);
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