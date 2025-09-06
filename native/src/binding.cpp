#include <napi.h>
#include "juce_audio_processor.h"

class JUCEAudioProcessorWrapper : public Napi::ObjectWrap<JUCEAudioProcessorWrapper>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    JUCEAudioProcessorWrapper(const Napi::CallbackInfo& info);
    ~JUCEAudioProcessorWrapper();

private:
    static Napi::FunctionReference constructor;
    JUCEAudioProcessor* processor;
    
    Napi::Value SetPitchBend(const Napi::CallbackInfo& info);
    Napi::Value SetFlangerEnabled(const Napi::CallbackInfo& info);
    Napi::Value SetFlangerRate(const Napi::CallbackInfo& info);
    Napi::Value SetFlangerDepth(const Napi::CallbackInfo& info);
    Napi::Value SetFilterCutoff(const Napi::CallbackInfo& info);
    Napi::Value SetFilterResonance(const Napi::CallbackInfo& info);
    Napi::Value SetJogWheelPosition(const Napi::CallbackInfo& info);
    Napi::Value SetVolume(const Napi::CallbackInfo& info);
    Napi::Value ProcessAudio(const Napi::CallbackInfo& info);
};

Napi::FunctionReference JUCEAudioProcessorWrapper::constructor;

Napi::Object JUCEAudioProcessorWrapper::Init(Napi::Env env, Napi::Object exports)
{
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(env, "JUCEAudioProcessor", {
        InstanceMethod("setPitchBend", &JUCEAudioProcessorWrapper::SetPitchBend),
        InstanceMethod("setFlangerEnabled", &JUCEAudioProcessorWrapper::SetFlangerEnabled),
        InstanceMethod("setFlangerRate", &JUCEAudioProcessorWrapper::SetFlangerRate),
        InstanceMethod("setFlangerDepth", &JUCEAudioProcessorWrapper::SetFlangerDepth),
        InstanceMethod("setFilterCutoff", &JUCEAudioProcessorWrapper::SetFilterCutoff),
        InstanceMethod("setFilterResonance", &JUCEAudioProcessorWrapper::SetFilterResonance),
        InstanceMethod("setJogWheelPosition", &JUCEAudioProcessorWrapper::SetJogWheelPosition),
        InstanceMethod("setVolume", &JUCEAudioProcessorWrapper::SetVolume),
        InstanceMethod("processAudio", &JUCEAudioProcessorWrapper::ProcessAudio)
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("JUCEAudioProcessor", func);
    return exports;
}

JUCEAudioProcessorWrapper::JUCEAudioProcessorWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<JUCEAudioProcessorWrapper>(info)
{
    processor = new JUCEAudioProcessor();
}

JUCEAudioProcessorWrapper::~JUCEAudioProcessorWrapper()
{
    delete processor;
}

Napi::Value JUCEAudioProcessorWrapper::SetPitchBend(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float semitones = info[0].As<Napi::Number>().FloatValue();
    processor->setPitchBend(semitones);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::SetFlangerEnabled(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsBoolean()) {
        Napi::TypeError::New(env, "Boolean expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    bool enabled = info[0].As<Napi::Boolean>().Value();
    processor->setFlangerEnabled(enabled);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::SetFlangerRate(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float rate = info[0].As<Napi::Number>().FloatValue();
    processor->setFlangerRate(rate);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::SetFlangerDepth(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float depth = info[0].As<Napi::Number>().FloatValue();
    processor->setFlangerDepth(depth);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::SetFilterCutoff(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float cutoff = info[0].As<Napi::Number>().FloatValue();
    processor->setFilterCutoff(cutoff);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::SetFilterResonance(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float resonance = info[0].As<Napi::Number>().FloatValue();
    processor->setFilterResonance(resonance);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::SetJogWheelPosition(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float position = info[0].As<Napi::Number>().FloatValue();
    processor->setJogWheelPosition(position);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::SetVolume(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float volume = info[0].As<Napi::Number>().FloatValue();
    processor->setVolume(volume);
    
    return env.Null();
}

Napi::Value JUCEAudioProcessorWrapper::ProcessAudio(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArrayBuffer()) {
        Napi::TypeError::New(env, "ArrayBuffer expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // For now, just return success - actual audio processing would go here
    // In a real implementation, you'd process the audio buffer
    return env.Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return JUCEAudioProcessorWrapper::Init(env, exports);
}

NODE_API_MODULE(juce_audio_processor, Init)
