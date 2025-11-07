import { useState, useEffect } from "react";
import { DJKnob } from "./DJKnob";
import { DJButton } from "./DJButton";
import { DJFader } from "./DJFader";
import { ScratchWheel } from "./ScratchWheel";
import { PitchFader } from "./PitchFader";
import { AudioWaveform } from "./AudioWaveform";
import { useDJ } from "@/contexts/DJContext";
import { AudioService } from "@/services/AudioService";
import {
  useAudioEngine,
  AudioEffects,
  DeckAudioChain,
} from "@/hooks/useAudioEngine";
interface DJDeckProps {
  deckNumber: 1 | 2;
  deckState: boolean;
}

function DJDeck({ deckNumber, deckState }: DJDeckProps) {
  const { state, dispatch } = useDJ();
  const {
    initAudioContext,
    detectBPM,
    updateEQ,
    updateVolume,
    updatePitch,
    updateEffects,
    loadTrack,
    setDeckPlaying,
    setCuePoint,
    cue,
    seek,
    setBaseBPM,
    setSync,
    setHeadphoneRouting,
    scratch,
  } = useAudioEngine();

  // Deck state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCued, setIsCued] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [effectsActive, setEffectsActive] = useState<AudioEffects>({
    flanger: false,
    filter: false,
    echo: false,
    reverb: false,
  });

  // Control values
  const [lowEQ, setLowEQ] = useState(0);
  const [midEQ, setMidEQ] = useState(0);
  const [highEQ, setHighEQ] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [pitch, setPitch] = useState(0);

  // Reset functions for double-click
  const resetLowEQ = () => setLowEQ(0);
  const resetMidEQ = () => setMidEQ(0);
  const resetHighEQ = () => setHighEQ(0);
  const resetVolume = () => setVolume(1.0); // 100%
  const resetPitch = () => setPitch(0); // 0%

  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [baseBpm, setBaseBpm] = useState(120);
  const [isHeadphoneActive, setIsHeadphoneActive] = useState(false);

  // Audio playback is now handled by AudioService

  const toggleEffect = (effectType: keyof AudioEffects) => {
    const newEffects = {
      ...effectsActive,
      [effectType]: !effectsActive[effectType],
    };
    setEffectsActive(newEffects);
    updateEffects(deckNumber, newEffects);
  };

  const handleHeadphoneToggle = () => {
    const newState = !isHeadphoneActive;
    setIsHeadphoneActive(newState);
    setHeadphoneRouting(deckNumber, newState);
    dispatch({ type: "TOGGLE_HEADPHONE_DECK", payload: deckNumber });
  };

  // Fix: Use isHeadphoneActive state instead of undefined activeHeadphoneDecks
  const isHeadphone = isHeadphoneActive;

  // Audio handling functions

  const handleAudioLoad = async (file: File) => {
    setAudioFile(file);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    // Cue point is managed by AudioService

    // Initialize audio context
    await initAudioContext();

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load track into AudioService
      await loadTrack(deckNumber, arrayBuffer);

      // Detect BPM
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(
        arrayBuffer.slice(0)
      );
      const detectedBPM = await detectBPM(audioBuffer);
      setBaseBpm(detectedBPM);
      setBaseBPM(deckNumber, detectedBPM);
      setBpm(detectedBPM);
      setDuration(audioBuffer.duration);

      audioContext.close();

      console.log(`✅ Track loaded for deck ${deckNumber}`);
    } catch (error) {
      console.error("Failed to load track:", error);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    // Position updates are handled by AudioService internally
  };

  const handlePlayToggle = () => {
    if (!audioFile) return;

    if (isPlaying) {
      setIsPlaying(false);
      // Remove this - C++ engine handles playback
      // if (audioRef.current) {
      //   audioRef.current.pause();
      // }
      // Update C++ audio engine
      setDeckPlaying(deckNumber, false);
    } else {
      setIsPlaying(true);
      // Remove this - C++ engine handles playback
      // if (audioRef.current) {
      //   audioRef.current.play();
      // }
      // Update C++ audio engine
      setDeckPlaying(deckNumber, true);
    }
  };

  const handleCue = (pressed: boolean) => {
    if (!audioFile) return;

    setIsCued(pressed);
    cue(deckNumber, pressed);
  };

  // Duration is set when audio is loaded via handleDurationLoad

  // Update audio volume when volume changes
  useEffect(() => {
    updateVolume(deckNumber, volume);
  }, [volume, deckNumber, updateVolume]);

  // Update BPM when pitch changes
  useEffect(() => {
    const newBpm = baseBpm * Math.pow(2, pitch);
    setBpm(Number(newBpm.toFixed(2)));

    // Update pitch in audio engine
    updatePitch(deckNumber, pitch);
  }, [pitch, baseBpm, deckNumber, updatePitch]);

  // Update EQ when values change
  useEffect(() => {
    updateEQ(deckNumber, { low: lowEQ, mid: midEQ, high: highEQ });
  }, [lowEQ, midEQ, highEQ, deckNumber, updateEQ]);

  // Initialize audio context
  useEffect(() => {
    initAudioContext();
  }, [initAudioContext]);

  const handleDurationLoad = (audioDuration: number) => {
    setDuration(audioDuration);
  };

  // Position tracking - subscribe to AudioService position updates
  useEffect(() => {
    const audioService = AudioService.getInstance();
    let unsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const subscribe = () => {
      if (audioService.isInitialized()) {
        console.log(
          `✅ Subscribing to position updates for deck ${deckNumber}`
        );
        unsubscribe = audioService.onPositionUpdate(deckNumber, (position) => {
          setCurrentTime(position);
        });
      } else {
        console.log(
          `⏳ AudioService not initialized yet for deck ${deckNumber}, waiting...`
        );
        // Try again after a short delay
        timeoutId = setTimeout(() => {
          subscribe();
        }, 100);
      }
    };

    subscribe();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [deckNumber]);

  return (
    <div className="bg-dj-console border border-border rounded-sm p-2 space-y-2 flex flex-col h-full relative z-10">
      {/* Waveform Panel - Now purely visual */}
      <AudioWaveform
        deckNumber={deckNumber}
        audioFile={audioFile}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTimeUpdate={handleTimeUpdate}
        onLoad={handleAudioLoad}
        onDurationLoad={handleDurationLoad}
        onSeek={(time) => seek(deckNumber, time)}
      />

      {/* Deck Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-light">DECK {deckNumber}</h2>
        <div className="flex items-center gap-2">
          {audioFile && (
            <>
              <span className="text-[10px] text-neon-cyan bg-dj-panel px-1 py-0.5 rounded-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span className="text-[10px] text-neon-magenta bg-dj-panel px-1 py-0.5 rounded-sm">
                {bpm.toFixed(2)} BPM
              </span>
              <span className="text-[10px] text-muted-foreground bg-dj-panel px-1 py-0.5 rounded-sm">
                {isPlaying ? "▶ PLAY" : isCued ? "⏸ CUE" : "⏹ STOP"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Controls Layout - Optimized for smaller space */}
      <div className="flex-1 flex flex-col space-y-2">
        {/* Top Row - EQ and Main Controls */}
        <div className="grid grid-cols-3 gap-2">
          {/* EQ Section */}
          <div className="bg-dj-panel rounded-sm p-2">
            <h3 className="text-[10px] font-bold text-dj-panel-foreground mb-1 text-center">
              EQ
            </h3>
            <div className="flex gap-1">
              <DJKnob
                label="HIGH"
                value={highEQ}
                onChange={setHighEQ}
                color="magenta"
                onDoubleClick={resetHighEQ}
              />
              <DJKnob
                label="MID"
                value={midEQ}
                onChange={setMidEQ}
                color="yellow"
                onDoubleClick={resetMidEQ}
              />
              <DJKnob
                label="LOW"
                value={lowEQ}
                onChange={setLowEQ}
                color="green"
                onDoubleClick={resetLowEQ}
              />
            </div>
          </div>

          {/* Center - Scratch Wheel */}
          <div className="flex justify-center">
            <ScratchWheel
              isPlaying={isPlaying}
              onScratch={(delta) => {
                if (audioFile && duration > 0) {
                  scratch(deckNumber, delta);
                  // Position will be updated by position tracking
                }
              }}
            />
          </div>

          {/* Right Side - Pitch and Volume */}
          <div className="flex gap-2 justify-center">
            <PitchFader
              value={pitch}
              onChange={setPitch}
              deckNumber={deckNumber}
              onDoubleClick={resetPitch}
            />
            <DJFader
              label="VOLUME"
              value={volume}
              onChange={setVolume}
              onDoubleClick={resetVolume}
            />
          </div>
        </div>

        {/* Bottom Row - Main Controls and Effects */}
        <div className="grid grid-cols-2 gap-2">
          {/* Main Controls */}
          <div className="bg-dj-panel rounded-sm p-2 space-y-1">
            <h3 className="text-[10px] font-bold text-dj-panel-foreground mb-1 text-center">
              CONTROLS
            </h3>
            <div className="grid grid-cols-2 gap-1">
              <DJButton
                id={`deck${deckNumber}-cue`}
                label="CUE"
                variant="cue"
                active={isCued}
                onMouseDown={() => handleCue(true)}
                onMouseUp={() => handleCue(false)}
                onMouseLeave={() => handleCue(false)}
                size="sm"
              />
              <DJButton
                id={`deck${deckNumber}-play`}
                label="PLAY"
                variant="play"
                active={isPlaying}
                onClick={handlePlayToggle}
                disabled={!audioFile}
                size="sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <DJButton
                id={`deck${deckNumber}-sync`}
                label="SYNC"
                variant="sync"
                active={isSynced}
                onClick={() => {
                  const newSyncState = !isSynced;
                  setIsSynced(newSyncState);
                  setSync(deckNumber, newSyncState);
                }}
                size="sm"
              />
              <DJButton
                id={`deck${deckNumber}-phones`}
                label="PHONES"
                active={isHeadphone}
                onClick={handleHeadphoneToggle}
                size="sm"
              />
            </div>
          </div>

          {/* Effects Section */}
          <div className="bg-dj-panel rounded-sm p-2">
            <h3 className="text-[10px] font-bold text-dj-panel-foreground mb-1 text-center">
              EFFECTS
            </h3>
            <div className="grid grid-cols-2 gap-1">
              <DJButton
                key="flanger"
                id={`deck${deckNumber}-fx1`}
                label="FX1"
                active={effectsActive.flanger}
                onClick={() => toggleEffect("flanger")}
                size="xs"
              />
              <DJButton
                key="filter"
                id={`deck${deckNumber}-fx2`}
                label="FX2"
                active={effectsActive.filter}
                onClick={() => toggleEffect("filter")}
                size="xs"
              />
              <DJButton
                key="echo"
                id={`deck${deckNumber}-fx3`}
                label="FX3"
                active={effectsActive.echo}
                onClick={() => toggleEffect("echo")}
                size="xs"
              />
              <DJButton
                key="reverb"
                id={`deck${deckNumber}-fx4`}
                label="FX4"
                active={effectsActive.reverb}
                onClick={() => toggleEffect("reverb")}
                size="xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to format time
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export { DJDeck };
