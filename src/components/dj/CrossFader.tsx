import { useState } from "react";

interface CrossFaderProps {
  value: number; // -1 to 1, -1 = deck 1 only, 0 = both equal, 1 = deck 2 only
  onChange: (value: number) => void;
}

export const CrossFader = ({ value, onChange }: CrossFaderProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newValue = (percentage - 0.5) * 2; // Convert to -1 to 1 range
    
    onChange(Math.max(-1, Math.min(1, newValue)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const position = ((value + 1) / 2) * 100; // Convert from -1..1 to 0..100%

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-mono text-dj-panel-foreground uppercase tracking-wider">
        CROSSFADER
      </span>
      <div
        className="dj-fader-horizontal"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="dj-fader-handle-horizontal"
          style={{ 
            left: `${position}%`,
            boxShadow: isDragging ? `0 0 15px hsl(var(--neon-cyan))` : undefined
          }}
        />
      </div>
      <div className="flex justify-between w-full text-[10px] font-mono text-neon-cyan">
        <span>DECK 1</span>
        <span>DECK 2</span>
      </div>
    </div>
  );
};