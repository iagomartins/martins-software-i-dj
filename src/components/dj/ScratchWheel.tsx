import { useState, useEffect, useRef } from "react";

const VinylSVG = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <radialGradient id="vinylGradient" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#1a1a1a" />
        <stop offset="30%" stopColor="#2a2a2a" />
        <stop offset="60%" stopColor="#1a1a1a" />
        <stop offset="100%" stopColor="#0a0a0a" />
      </radialGradient>
    </defs>
    {/* Vinyl record circles */}
    {Array.from({length: 15}, (_, i) => (
      <circle
        key={i}
        cx="100"
        cy="100"
        r={10 + i * 6}
        fill="none"
        stroke="#333"
        strokeWidth="0.5"
      />
    ))}
    {/* Main vinyl body */}
    <circle cx="100" cy="100" r="95" fill="url(#vinylGradient)" />
    {/* Center label */}
    <circle cx="100" cy="100" r="25" fill="#f0f0f0" />
    {/* iDJ text */}
    <text x="100" y="100" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1C1D33">
      iDJ
    </text>
  </svg>
);

interface ScratchWheelProps {
  onScratch?: (delta: number) => void;
  isPlaying?: boolean;
}

export const ScratchWheel = ({ onScratch, isPlaying = false }: ScratchWheelProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastAngle, setLastAngle] = useState(0);
  const animationRef = useRef<number>();

  // Auto-rotation when playing
  useEffect(() => {
    if (isPlaying && !isDragging) {
      const animate = () => {
        setRotation(prev => prev + 2); // Rotate 2 degrees per frame
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, isDragging]);

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
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative w-32 h-32 cursor-pointer select-none"
        style={{ 
          transform: `rotate(${rotation}deg)`,
          filter: isDragging 
            ? `drop-shadow(0 0 25px hsl(var(--neon-cyan)))`
            : isPlaying 
            ? `drop-shadow(0 0 20px hsl(var(--neon-green)))`
            : undefined,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <VinylSVG />
      </div>
      <span className="text-[12px] font-mono text-dj-panel-foreground uppercase tracking-wider">
        SCRATCH
      </span>
    </div>
  );
};