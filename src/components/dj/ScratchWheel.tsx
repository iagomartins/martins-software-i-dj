import { useState } from "react";

interface ScratchWheelProps {
  onScratch?: (delta: number) => void;
  isPlaying?: boolean;
}

export const ScratchWheel = ({ onScratch, isPlaying = false }: ScratchWheelProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastAngle, setLastAngle] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    setLastAngle(angle);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    
    let delta = angle - lastAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    
    setRotation(prev => prev + delta * (180 / Math.PI));
    setLastAngle(angle);
    
    onScratch?.(delta);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`scratch-wheel ${isPlaying ? 'animate-spin-slow' : ''}`}
        style={{ 
          transform: `rotate(${rotation}deg)`,
          boxShadow: isDragging 
            ? `0 0 30px hsl(var(--neon-cyan)), inset 0 0 20px rgba(0,0,0,0.4)`
            : isPlaying 
            ? `0 0 20px hsl(var(--neon-green)), inset 0 0 20px rgba(0,0,0,0.4)`
            : undefined,
          borderColor: isDragging 
            ? 'hsl(var(--neon-cyan))' 
            : isPlaying 
            ? 'hsl(var(--neon-green))' 
            : undefined
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute inset-4 rounded-full bg-black/50 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white/80 shadow-md" />
        </div>
      </div>
      <span className="text-xs font-mono text-dj-panel-foreground uppercase tracking-wider">
        Scratch Wheel
      </span>
    </div>
  );
};