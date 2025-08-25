import { useState } from "react";
import { DJKnob } from "./DJKnob";
import { DJButton } from "./DJButton";
import { DJFader } from "./DJFader";
import { ScratchWheel } from "./ScratchWheel";
import { PitchFader } from "./PitchFader";

interface DJDeckProps {
  deckNumber: 1 | 2;
}

export const DJDeck = ({ deckNumber }: DJDeckProps) => {
  // Deck state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCued, setIsCued] = useState(false);
  const [isHeadphone, setIsHeadphone] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [effectsActive, setEffectsActive] = useState([false, false, false, false]);
  
  // Control values
  const [lowEQ, setLowEQ] = useState(0);
  const [midEQ, setMidEQ] = useState(0);
  const [highEQ, setHighEQ] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [pitch, setPitch] = useState(0);

  const toggleEffect = (index: number) => {
    setEffectsActive(prev => 
      prev.map((active, i) => i === index ? !active : active)
    );
  };

  return (
    <div className="bg-dj-console border border-border rounded-lg p-6 space-y-6">
      {/* Deck Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-neon-cyan">DECK {deckNumber}</h2>
        <DJButton
          label="LOAD"
          onClick={() => console.log(`Load track to deck ${deckNumber}`)}
          size="sm"
        />
      </div>

      {/* Top Row - Scratch Wheel and Controls */}
      <div className="flex justify-between items-start">
        {/* Left Side - EQ and Controls */}
        <div className="space-y-6">
          {/* EQ Section */}
          <div className="bg-dj-panel rounded-lg p-4">
            <h3 className="text-sm font-bold text-dj-panel-foreground mb-4 text-center">EQ</h3>
            <div className="flex gap-4">
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
          <div className="bg-dj-panel rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DJButton
                label="CUE"
                variant="cue"
                active={isCued}
                onClick={() => setIsCued(!isCued)}
              />
              <DJButton
                label="PLAY"
                variant="play"
                active={isPlaying}
                onClick={() => setIsPlaying(!isPlaying)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <DJButton
                label="SYNC"
                variant="sync"
                active={isSynced}
                onClick={() => setIsSynced(!isSynced)}
              />
              <DJButton
                label="PHONES"
                active={isHeadphone}
                onClick={() => setIsHeadphone(!isHeadphone)}
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
          />
          
          <DJFader
            label="VOLUME"
            value={volume}
            onChange={setVolume}
          />
        </div>
      </div>

      {/* Effects Section */}
      <div className="bg-dj-panel rounded-lg p-4">
        <h3 className="text-sm font-bold text-dj-panel-foreground mb-4 text-center">EFFECTS</h3>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((fx) => (
            <DJButton
              key={fx}
              label={`FX ${fx}`}
              active={effectsActive[fx - 1]}
              onClick={() => toggleEffect(fx - 1)}
              size="sm"
            />
          ))}
        </div>
      </div>
    </div>
  );
};