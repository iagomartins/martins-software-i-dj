import { useState, useEffect, useRef } from "react";
import { DJKnob } from "./DJKnob";
import { DJButton } from "./DJButton";
import { DJFader } from "./DJFader";
import { ScratchWheel } from "./ScratchWheel";
import { PitchFader } from "./PitchFader";
import { AudioWaveform } from "./AudioWaveform";
import { useDJ } from "@/contexts/DJContext";
import { useAudioEngine } from "@/hooks/useAudioEngine";

interface DJDeckProps {
  deckNumber: 1 | 2;
}

function DJDeck({ deckNumber }: DJDeckProps) {
  const { state, dispatch } = useDJ();
  const { initAudioContext, detectBPM, updateEQ } = useAudioEngine();

  // Deck state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCued, setIsCued] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [effectsActive, setEffectsActive] = useState([false, false, false, false]);
  
  // Control values
  const [lowEQ, setLowEQ] = useState(0);
  const [midEQ, setMidEQ] = useState(0);
  const [highEQ, setHighEQ] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [pitch, setPitch] = useState(0);
  
  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [baseBpm, setBaseBpm] = useState(120);
  const [cuePoint, setCuePoint] = useState(0);
  const [isHeadphoneActive, setIsHeadphoneActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<{ low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode } | null>(null);

  const toggleEffect = (index: number) => {
    setEffectsActive(prev => 
      prev.map((active, i) => i === index ? !active : active)
    );
    // TODO: Apply audio effects based on effectsActive state
  };

  const handleHeadphoneToggle = () => {
    setIsHeadphoneActive(!isHeadphoneActive);
    dispatch({ type: 'TOGGLE_HEADPHONE_DECK', payload: deckNumber });
  };

  const isHeadphone = state.activeHeadphoneDecks.has(deckNumber);

  // Audio handling functions
  const handleAudioLoad = async (file: File) => {
    setAudioFile(file);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setCuePoint(0);
    
    // Detect BPM
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const detectedBPM = await detectBPM(audioBuffer);
      setBaseBpm(detectedBPM);
      setBpm(detectedBPM);
      audioContext.close();
    } catch (error) {
      console.warn('Could not detect BPM:', error);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handlePlayToggle = () => {
    if (!audioFile) return;
    
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.play();
      }
    }
  };

  const handleCue = (pressed: boolean) => {
    if (!audioFile || !audioRef.current) return;
    
    if (pressed) {
      // Store current position as cue point if not playing
      if (!isPlaying) {
        setCuePoint(currentTime);
      }
      setIsCued(true);
      // Play from current position
      audioRef.current.play();
    } else {
      setIsCued(false);
      // If play button is not active, stop and return to cue point
      if (!isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = cuePoint;
        setCurrentTime(cuePoint);
      }
    }
  };

  // Update duration when audio metadata is loaded
  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => {
        setDuration(audioRef.current?.duration || 0);
      };
      
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => {
        audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [audioFile]);

  // Update audio volume when volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Update BPM when pitch changes
  useEffect(() => {
    const newBpm = baseBpm * (1 + pitch);
    setBpm(Number(newBpm.toFixed(2)));
    
    // Update playback rate
    if (audioRef.current) {
      audioRef.current.playbackRate = 1 + pitch;
    }
  }, [pitch, baseBpm]);

  // Initialize audio context and EQ
  useEffect(() => {
    const initAudio = async () => {
      await initAudioContext();
      
      if (audioRef.current && !filtersRef.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audioRef.current);
        
        // Create EQ filters
        const lowFilter = context.createBiquadFilter();
        lowFilter.type = 'lowshelf';
        lowFilter.frequency.setValueAtTime(320, context.currentTime);
        
        const midFilter = context.createBiquadFilter();
        midFilter.type = 'peaking';
        midFilter.frequency.setValueAtTime(1000, context.currentTime);
        midFilter.Q.setValueAtTime(1, context.currentTime);
        
        const highFilter = context.createBiquadFilter();
        highFilter.type = 'highshelf';
        highFilter.frequency.setValueAtTime(3200, context.currentTime);
        
        // Connect chain
        source.connect(lowFilter);
        lowFilter.connect(midFilter);
        midFilter.connect(highFilter);
        highFilter.connect(context.destination);
        
        filtersRef.current = { low: lowFilter, mid: midFilter, high: highFilter };
        audioContextRef.current = context;
      }
    };
    
    initAudio();
  }, [audioFile, initAudioContext]);

  // Update EQ when values change
  useEffect(() => {
    if (filtersRef.current && audioContextRef.current) {
      updateEQ(filtersRef.current, { low: lowEQ, mid: midEQ, high: highEQ });
    }
  }, [lowEQ, midEQ, highEQ, updateEQ]);

    return (
    <div className="bg-dj-console border border-border rounded-sm p-2 space-y-2 flex flex-col h-full">
      {/* Waveform Panel */}
      <AudioWaveform
        deckNumber={deckNumber}
        audioFile={audioFile}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTimeUpdate={handleTimeUpdate}
        onLoad={handleAudioLoad}
      />

      {/* Deck Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-neon-cyan">DECK {deckNumber}</h2>
        <div className="flex items-center gap-2">
          {audioFile && (
            <>
              <span className="text-[10px] text-neon-cyan bg-dj-panel px-1 py-0.5 rounded-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span className="text-[10px] text-neon-magenta bg-dj-panel px-1 py-0.5 rounded-sm">
                {bpm} BPM
              </span>
              <span className="text-[10px] text-muted-foreground bg-dj-panel px-1 py-0.5 rounded-sm">
                {isPlaying ? '▶ PLAY' : isCued ? '⏸ CUE' : '⏹ STOP'}
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
            <h3 className="text-[10px] font-bold text-dj-panel-foreground mb-1 text-center">EQ</h3>
            <div className="flex gap-1">
              <DJKnob
                label="HIGH"
                value={highEQ}
                onChange={setHighEQ}
                color="magenta"
              />
              <DJKnob
                label="MID"
                value={midEQ}
                onChange={setMidEQ}
                color="yellow"
              />
              <DJKnob
                label="LOW"
                value={lowEQ}
                onChange={setLowEQ}
                color="green"
              />
            </div>
          </div>

          {/* Center - Scratch Wheel */}
          <div className="flex justify-center">
            <ScratchWheel 
              isPlaying={isPlaying}
              onScratch={(delta) => {
                if (audioRef.current && duration > 0) {
                  const timeChange = (delta * duration) / (Math.PI * 2) * 10; // Scale factor for sensitivity
                  const newTime = Math.max(0, Math.min(duration, currentTime + timeChange));
                  audioRef.current.currentTime = newTime;
                  setCurrentTime(newTime);
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
            />
            <DJFader
              label="VOLUME"
              value={volume}
              onChange={setVolume}
            />
          </div>
        </div>

        {/* Bottom Row - Main Controls and Effects */}
        <div className="grid grid-cols-2 gap-2">
          {/* Main Controls */}
          <div className="bg-dj-panel rounded-sm p-2 space-y-1">
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
                onClick={() => setIsSynced(!isSynced)}
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
            <h3 className="text-[10px] font-bold text-dj-panel-foreground mb-1 text-center">EFFECTS</h3>
            <div className="grid grid-cols-2 gap-1">
              {[1, 2, 3, 4].map((fx) => (
                <DJButton
                  key={fx}
                  id={`deck${deckNumber}-fx${fx}`}
                  label={`FX${fx}`}
                  active={effectsActive[fx - 1]}
                  onClick={() => toggleEffect(fx - 1)}
                  size="xs"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden audio element for playback control */}
      <audio 
        ref={audioRef} 
        preload="metadata"
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export { DJDeck };