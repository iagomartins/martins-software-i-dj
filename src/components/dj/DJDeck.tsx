import { useState, useEffect, useRef } from "react";
import { DJKnob } from "./DJKnob";
import { DJButton } from "./DJButton";
import { DJFader } from "./DJFader";
import { ScratchWheel } from "./ScratchWheel";
import { PitchFader } from "./PitchFader";
import { AudioWaveform } from "./AudioWaveform";
import { useDJ } from "@/contexts/DJContext";

interface DJDeckProps {
  deckNumber: 1 | 2;
}

function DJDeck({ deckNumber }: DJDeckProps) {
  const { state, dispatch } = useDJ();

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
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleEffect = (index: number) => {
    setEffectsActive(prev => 
      prev.map((active, i) => i === index ? !active : active)
    );
  };

  const handleHeadphoneToggle = () => {
    dispatch({ type: 'TOGGLE_HEADPHONE_DECK', payload: deckNumber });
  };

  const isHeadphone = state.activeHeadphoneDecks.has(deckNumber);

  // Audio handling functions
  const handleAudioLoad = (file: File) => {
    setAudioFile(file);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handlePlayToggle = () => {
    if (!audioFile) return;
    
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
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

    return (
    <div className="bg-dj-console border border-border rounded-sm p-4 space-y-4">
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
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-neon-cyan">DECK {deckNumber}</h2>
          {audioFile && (
            <span className="text-sm text-neon-cyan/80 font-medium">
              {audioFile.name.replace(/\.[^/.]+$/, "")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {audioFile && (
            <>
              <span className="text-xs text-neon-cyan bg-dj-panel px-2 py-1 rounded-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span className="text-xs text-muted-foreground bg-dj-panel px-2 py-1 rounded-sm">
                {isPlaying ? '▶ PLAYING' : '⏸ PAUSED'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Top Row - Scratch Wheel and Controls */}
      <div className="flex justify-between items-start">
        {/* Left Side - EQ and Controls */}
        <div className="space-y-6">
          {/* EQ Section */}
                     <div className="bg-dj-panel rounded-sm p-3">
            <h3 className="text-sm font-bold text-dj-panel-foreground mb-3 text-center">EQ</h3>
            <div className="flex gap-3">
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

          {/* Main Controls */}
                     <div className="bg-dj-panel rounded-sm p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <DJButton
                id={`deck${deckNumber}-cue`}
                label="CUE"
                variant="cue"
                active={isCued}
                onClick={() => setIsCued(!isCued)}
              />
              <DJButton
                id={`deck${deckNumber}-play`}
                label="PLAY"
                variant="play"
                active={isPlaying}
                onClick={handlePlayToggle}
                disabled={!audioFile}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <DJButton
                id={`deck${deckNumber}-sync`}
                label="SYNC"
                variant="sync"
                active={isSynced}
                onClick={() => setIsSynced(!isSynced)}
              />
              <DJButton
                id={`deck${deckNumber}-phones`}
                label="PHONES"
                active={isHeadphone}
                onClick={handleHeadphoneToggle}
              />
            </div>
          </div>
        </div>

        {/* Center - Scratch Wheel */}
        <ScratchWheel 
          isPlaying={isPlaying}
          onScratch={(delta) => console.log(`Scratch delta: ${delta}`)}
        />

        {/* Right Side - Pitch and Volume */}
        <div className="flex gap-6 items-start">
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

      {/* Effects Section */}
              <div className="bg-dj-panel rounded-sm p-3">
        <h3 className="text-sm font-bold text-dj-panel-foreground mb-3 text-center">EFFECTS</h3>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((fx) => (
            <DJButton
              key={fx}
              id={`deck${deckNumber}-fx${fx}`}
              label={`FX ${fx}`}
              active={effectsActive[fx - 1]}
              onClick={() => toggleEffect(fx - 1)}
              size="sm"
            />
          ))}
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