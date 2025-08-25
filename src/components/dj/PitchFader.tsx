import { useState } from "react";

interface PitchFaderProps {
  value: number;
  onChange: (value: number) => void;
}

export const PitchFader = ({ value, onChange }: PitchFaderProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = 1 - (y / rect.height);
    const newValue = -1 + percentage * 2; // Map to -1 to +1
    
    onChange(Math.max(-1, Math.min(1, newValue)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const position = ((value + 1) / 2) * 100; // Convert -1,1 to 0,100%

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2 mb-2">
        <button 
          className="w-6 h-6 text-xs bg-button-off hover:bg-neon-green text-foreground rounded font-bold"
          onClick={() => onChange(Math.min(1, value + 0.1))}
        >
          +
        </button>
        <button 
          className="w-6 h-6 text-xs bg-button-off hover:bg-neon-magenta text-foreground rounded font-bold"
          onClick={() => onChange(Math.max(-1, value - 0.1))}
        >
          -
        </button>
      </div>
      
      <div
        className="pitch-fader"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="pitch-fader-handle"
          style={{ 
            bottom: `${position}%`,
            boxShadow: isDragging ? `0 0 15px hsl(var(--neon-yellow))` : undefined
          }}
        />
        {/* Center line indicator */}
        <div className="absolute left-0 top-1/2 w-full h-px bg-white/50 transform -translate-y-1/2" />
      </div>
      
      <span className="text-xs font-mono text-dj-panel-foreground uppercase tracking-wider">
        Pitch
      </span>
      <span className="text-xs font-mono text-neon-yellow">
        {value > 0 ? '+' : ''}{(value * 100).toFixed(1)}%
      </span>
    </div>
  );
};