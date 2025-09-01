import { useState, useEffect, useRef } from "react";
import { DJKnob } from "./DJKnob";
import { DJButton } from "./DJButton";
import { DJFader } from "./DJFader";
import { ScratchWheel } from "./ScratchWheel";
import { PitchFader } from "./PitchFader";
import { AudioWaveform } from "./AudioWaveform";
import { useDJ } from "@/contexts/DJContext";
import { useAudioEngine, AudioEffects, DeckAudioChain } from "@/hooks/useAudioEngine";
import { useDeckBridge } from "@/hooks/useDeckBridge";


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
    setDeckChain,
    createDeckChain 
  } = useAudioEngine();

  // Deck state
  // const [isPlaying, setIsPlaying] = useState(false);
  const [isCued, setIsCued] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [effectsActive, setEffectsActive] = useState<AudioEffects>({
    flanger: false,
    filter: false,
    echo: false,
    reverb: false
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
  const [cuePoint, setCuePoint] = useState(0);
  const [isHeadphoneActive, setIsHeadphoneActive] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const deckBridge = useDeckBridge('ws://localhost:4001', deckNumber === 1 ? 'A' : 'B');
  
  const toggleEffect = (effectType: keyof AudioEffects) => {
    const newEffects = { ...effectsActive, [effectType]: !effectsActive[effectType] };
    setEffectsActive(newEffects);
    updateEffects(deckNumber, newEffects);
  };

  const handleHeadphoneToggle = () => {
    setIsHeadphoneActive(!isHeadphoneActive);
    dispatch({ type: 'TOGGLE_HEADPHONE_DECK', payload: deckNumber });
  };

  // Fix: Use isHeadphoneActive state instead of undefined activeHeadphoneDecks
  const isHeadphone = isHeadphoneActive;

  // Audio handling functions - IMPROVED to handle server auto-play
  const handleAudioLoad = async (file: File) => {
    try {
      console.log(`[Deck ${deckNumber}] Loading audio file:`, file.name);
      
      // Just upload the file directly - let the server handle conversion
      const trackId = await deckBridge.uploadTrack(file);
      console.log(`[Deck ${deckNumber}] Track uploaded, ID:`, trackId);
      
      // Load the track into the deck
      await deckBridge.loadTrack(trackId);
      console.log(`[Deck ${deckNumber}] Track loaded into deck`);
      
      // Set the local audio file state
      setAudioFile(file);
      console.log(`[Deck ${deckNumber}] Audio file state set:`, file.name);
      
      // IMPORTANT: The server auto-plays tracks, so we need to pause it immediately
      // Wait a bit for the track to load, then pause it
      setTimeout(() => {
        if (deckBridge.connected && deckBridge.status) {
          setCurrentTime(0);
          setCuePoint(0);
        }
      }, 500); // Wait 500ms for track to load and start playing
      
    } catch (error) {
      console.error(`[Deck ${deckNumber}] Failed to load audio:`, error);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // IMPROVED: Handle play toggle with proper server sync and debugging
  const handlePlayToggle = () => {
    console.log(`[Deck ${deckNumber}] Play toggle clicked, current state:`, {
      isPlaying: deckBridge.status?.paused === false,
      bridgeConnected: deckBridge.connected,
      bridgeStatus: deckBridge.status,
      lastCommand: deckBridge.lastCommand,
      commandStatus: deckBridge.commandStatus
    });

    if (!deckBridge.connected) {
      console.error(`[Deck ${deckNumber}] Bridge not connected`);
      return;
    }
    
    // If no status available, just wait for it - server sends status automatically
    if (!deckBridge.status) {
      console.log(`[Deck ${deckNumber}] No status available yet, waiting for server...`);
      return;
    }
    
    if (deckBridge.status.paused) {
      console.log(`[Deck ${deckNumber}] Sending play command`);
      const success = deckBridge.play();
      if (success) {
        console.log(`[Deck ${deckNumber}] Play command sent successfully`);
      } else {
        console.error(`[Deck ${deckNumber}] Failed to send play command`);
      }
    } else {
      console.log(`[Deck ${deckNumber}] Sending pause command`);
      const success = deckBridge.pause();
      if (success) {
        console.log(`[Deck ${deckNumber}] Pause command sent successfully`);
      } else {
        console.error(`[Deck ${deckNumber}] Failed to send pause command`);
      }
    }
  };

  // IMPROVED: Handle cue with server sync
  const handleCue = (pressed: boolean) => {
    if (!deckBridge.connected || !deckBridge.status) return;
    
    if (pressed) {
      // Store current position as cue point if not playing
      if (deckBridge.status?.paused === true) {
        setCuePoint(currentTime);
      }
      setIsCued(true);
      // Play from current position
      deckBridge.play();
    } else {
      setIsCued(false);
      // If play button is not active, stop and return to cue point
      if (deckBridge.status?.paused === false) {
        deckBridge.pause();
        // Seek to cue point
        deckBridge.seekMs(cuePoint * 1000);
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

  // IMPROVED: Better bridge status handling with debugging
  useEffect(() => {
    if (deckBridge.connected && deckBridge.status) {
      console.log(`[Deck ${deckNumber}] Bridge status update:`, deckBridge.status);
      
      setCurrentTime(deckBridge.status.posMs / 1000);
      setDuration(deckBridge.status.durationMs / 1000);
      
      // Update BPM from server if available
      if (deckBridge.status.bpm !== undefined) {
        setBpm(deckBridge.status.bpm);
      }
    } else if (deckBridge.connected && !deckBridge.status) {
      console.log(`[Deck ${deckNumber}] Connected but waiting for server status...`);
      // Don't request status - server sends it automatically
    }
  }, [deckBridge.status, deckBridge.connected, deckNumber, baseBpm]);

  // Add debugging for command status changes
  useEffect(() => {
    if (deckBridge.commandStatus !== 'idle') {
      console.log(`[Deck ${deckNumber}] Command status:`, deckBridge.commandStatus, 'for command:', deckBridge.lastCommand);
    }
  }, [deckBridge.commandStatus, deckBridge.lastCommand, deckNumber]);

  // Add debugging for connection changes
  useEffect(() => {
    console.log(`[Deck ${deckNumber}] Connection state changed:`, deckBridge.connected);
    if (deckBridge.connected && !deckBridge.status) {
      console.log(`[Deck ${deckNumber}] Connected, waiting for server status...`);
    }
  }, [deckBridge.connected, deckNumber]);

  // Add real-time updates for smooth playback visualization
  useEffect(() => {
    if (!deckBridge.connected) return;

    const interval = setInterval(() => {
      if (deckBridge.status && !deckBridge.status.paused) {
        // Update current time for smooth canvas animation
        const newTime = deckBridge.status.posMs / 1000;
        setCurrentTime(newTime);
        
        // Update BPM in real-time if pitch changes
        if (deckBridge.status.bpm !== undefined) {
          setBpm(deckBridge.status.bpm);
        }
      }
    }, 50); // 20fps for smooth updates

    return () => clearInterval(interval);
  }, [deckBridge.connected, deckBridge.status, baseBpm]);

  // Sync deck state when track is loaded - IMPROVED
  useEffect(() => {
    if (deckBridge.lastLoaded) {
      console.log(`[Deck ${deckNumber}] Track loaded from bridge:`, deckBridge.lastLoaded);
      setDuration(deckBridge.lastLoaded.durationMs / 1000);
      setBpm(deckBridge.status?.bpm || 0);
      // Reset play state when new track is loaded
      setCurrentTime(0);
      setCuePoint(0);
    }
  }, [deckBridge.lastLoaded, deckNumber, audioFile, deckBridge]);

  // Add debugging for audioFile state changes
  useEffect(() => {
    console.log(`[Deck ${deckNumber}] Audio file state changed:`, audioFile?.name || 'null');
  }, [audioFile, deckNumber]);

  // Update scratch wheel to use bridge
  const handleScratchStart = () => {
    deckBridge.touchDown();
  };

  const handleScratchEnd = () => {
    deckBridge.touchUp();
  };

  const handleScratch = (delta: number) => {
    const angleDelta = (delta * 180) / Math.PI;
    const dt = 0.016; // Assume 60fps
    deckBridge.rotateTop(angleDelta, dt);
  };

    return (
    <div className="bg-dj-console border border-border rounded-sm p-2 space-y-2 flex flex-col h-full">
      {/* Waveform Panel */}
      <AudioWaveform
        deckNumber={deckNumber}
        audioFile={audioFile}
        isPlaying={deckBridge.status?.paused === false}
        currentTime={deckBridge.status?.posMs / 1000}
        duration={duration}
        onTimeUpdate={handleTimeUpdate}
        onLoad={handleAudioLoad}
        onDurationLoad={handleDurationLoad}
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
                {deckBridge.status?.paused === false ? '▶ PLAY' : isCued ? '⏸ CUE' : '⏹ STOP'}
              </span>
              {/* Add connection and status indicators */}
              {!deckBridge.connected && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded-sm">
                  🔌 DISCONNECTED
                </span>
              )}
              {deckBridge.connected && !deckBridge.status && (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded-sm">
                  ⏳ WAITING FOR STATUS
                </span>
              )}
              {deckBridge.commandStatus !== 'idle' && (
                <span className={`text-[10px] px-1 py-0.5 rounded-sm ${
                  deckBridge.commandStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  deckBridge.commandStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {deckBridge.commandStatus === 'pending' ? '⏳' :
                   deckBridge.commandStatus === 'success' ? '✓' : '✗'}
                </span>
              )}
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
              isPlaying={deckBridge.status?.paused === false}
              onScratch={handleScratch}
              onScratchStart={handleScratchStart}
              onScratchEnd={handleScratchEnd}
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
          <h3 className="text-[10px] font-bold text-dj-panel-foreground mb-1 text-center">CONTROLS</h3>
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
                active={deckBridge.status?.paused === false}
                onClick={handlePlayToggle}
                disabled={!audioFile || !deckBridge.connected}
                size="sm"
                className={deckBridge.commandStatus === 'pending' ? 'animate-pulse' : ''}
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
              <DJButton
                key="flanger"
                id={`deck${deckNumber}-fx1`}
                label="FX1"
                active={effectsActive.flanger}
                onClick={() => toggleEffect('flanger')}
                size="xs"
              />
              <DJButton
                key="filter"
                id={`deck${deckNumber}-fx2`}
                label="FX2"
                active={effectsActive.filter}
                onClick={() => toggleEffect('filter')}
                size="xs"
              />
              <DJButton
                key="echo"
                id={`deck${deckNumber}-fx3`}
                label="FX3"
                active={effectsActive.echo}
                onClick={() => toggleEffect('echo')}
                size="xs"
              />
              <DJButton
                key="reverb"
                id={`deck${deckNumber}-fx4`}
                label="FX4"
                active={effectsActive.reverb}
                onClick={() => toggleEffect('reverb')}
                size="xs"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden audio element for playback control */}
      <audio 
        ref={audioRef} 
        preload="metadata"
        onEnded={() => deckBridge.pause()}
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