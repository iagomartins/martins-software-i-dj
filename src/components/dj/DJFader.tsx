import { useState } from "react";

interface DJFaderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const DJFader = ({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 1 
}: DJFaderProps) => {
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
    const newValue = min + percentage * (max - min);
    
    onChange(Math.max(min, Math.min(max, newValue)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const position = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-mono text-dj-panel-foreground uppercase tracking-wider">
        {label}
      </span>
      <div
        className="dj-fader"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="dj-fader-handle"
          style={{ 
            bottom: `${position}%`,
            boxShadow: isDragging ? `0 0 15px hsl(var(--neon-cyan))` : undefined
          }}
        />
      </div>
      <span className="text-xs font-mono text-neon-cyan">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
};