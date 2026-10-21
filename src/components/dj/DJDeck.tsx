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

  const deckKey = deckNumber === 1 ? 'deck1' : 'deck2';
  const deckData = state[deckKey];

  // Control values (initialized from global state)
  const [lowEQ, setLowEQ] = useState(deckData?.lowEQ ?? 0);
  const [midEQ, setMidEQ] = useState(deckData?.midEQ ?? 0);
  const [highEQ, setHighEQ] = useState(deckData?.highEQ ?? 0);
  const [volume, setVolume] = useState(deckData?.volume ?? 0.8);
  const [pitch, setPitch] = useState(deckData?.pitch ?? 0);

  // Synchronize from global store (MIDI / controller presets) into local deck UI state
  useEffect(() => {
    if (deckData?.volume !== undefined && Math.abs(deckData.volume - volume) > 0.001) {
      setVolume(deckData.volume);
    }
  }, [deckData?.volume, volume]);

  useEffect(() => {
    if (deckData?.pitch !== undefined && Math.abs(deckData.pitch - pitch) > 0.001) {
      setPitch(deckData.pitch);
    }
  }, [deckData?.pitch, pitch]);

  useEffect(() => {
    if (deckData?.lowEQ !== undefined && Math.abs(deckData.lowEQ - lowEQ) > 0.001) {
      setLowEQ(deckData.lowEQ);
    }
  }, [deckData?.lowEQ, lowEQ]);

  useEffect(() => {
    if (deckData?.midEQ !== undefined && Math.abs(deckData.midEQ - midEQ) > 0.001) {
      setMidEQ(deckData.midEQ);
    }
  }, [deckData?.midEQ, midEQ]);

  useEffect(() => {
    if (deckData?.highEQ !== undefined && Math.abs(deckData.highEQ - highEQ) > 0.001) {
      setHighEQ(deckData.highEQ);
    }
  }, [deckData?.highEQ, highEQ]);

  useEffect(() => {
    if (deckData?.isPlaying !== undefined && deckData.isPlaying !== isPlaying) {
      setIsPlaying(deckData.isPlaying);
    }
  }, [deckData?.isPlaying, isPlaying]);

  useEffect(() => {
    if (deckData?.isCued !== undefined && deckData.isCued !== isCued) {
      setIsCued(deckData.isCued);
    }
  }, [deckData?.isCued, isCued]);

  useEffect(() => {
    if (deckData?.effects) {
      setEffectsActive(deckData.effects);
    }
  }, [deckData?.effects]);

  // UI Handlers with bidirectional store update
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    updateVolume(deckNumber, newVolume);
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { volume: newVolume },
    });
  };

  const handleLowEQChange = (val: number) => {
    setLowEQ(val);
    updateEQ(deckNumber, { low: val, mid: midEQ, high: highEQ });
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { lowEQ: val },
    });
  };

  const handleMidEQChange = (val: number) => {
    setMidEQ(val);
    updateEQ(deckNumber, { low: lowEQ, mid: val, high: highEQ });
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { midEQ: val },
    });
  };

  const handleHighEQChange = (val: number) => {
    setHighEQ(val);
    updateEQ(deckNumber, { low: lowEQ, mid: midEQ, high: val });
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { highEQ: val },
    });
  };

  const handlePitchChange = (val: number) => {
    setPitch(val);
    updatePitch(deckNumber, val);
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { pitch: val },
    });
  };

  // Reset functions for double-click
  const resetLowEQ = () => handleLowEQChange(0);
  const resetMidEQ = () => handleMidEQChange(0);
  const resetHighEQ = () => handleHighEQChange(0);
  const resetVolume = () => handleVolumeChange(1.0); // 100%
  const resetPitch = () => handlePitchChange(0); // 0%

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
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { effects: newEffects },
    });
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

    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    setDeckPlaying(deckNumber, newPlaying);
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { isPlaying: newPlaying },
    });
  };

  const handleCue = (pressed: boolean) => {
    if (!audioFile) return;

    setIsCued(pressed);
    cue(deckNumber, pressed);
    dispatch({
      type: deckNumber === 1 ? 'SET_DECK_1_STATE' : 'SET_DECK_2_STATE',
      payload: { isCued: pressed },
    });
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
                onChange={handleHighEQChange}
                color="magenta"
                onDoubleClick={resetHighEQ}
              />
              <DJKnob
                label="MID"
                value={midEQ}
                onChange={handleMidEQChange}
                color="yellow"
                onDoubleClick={resetMidEQ}
              />
              <DJKnob
                label="LOW"
                value={lowEQ}
                onChange={handleLowEQChange}
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
              onChange={handlePitchChange}
              deckNumber={deckNumber}
              onDoubleClick={resetPitch}
            />
            <DJFader
              label="VOLUME"
              value={volume}
              onChange={handleVolumeChange}
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
