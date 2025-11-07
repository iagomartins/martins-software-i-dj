import { useState, useEffect, useRef } from "react";

const VinylSVG = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <radialGradient id="vinylGradient" cx="50%" cy="50%">
        <stop offset="0%" stopColor="hsl(240, 30%, 18%)" />
        <stop offset="30%" stopColor="hsl(240, 35%, 12%)" />
        <stop offset="60%" stopColor="hsl(240, 30%, 18%)" />
        <stop offset="100%" stopColor="hsl(240, 35%, 10%)" />
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Vinyl record circles */}
    {Array.from({length: 15}, (_, i) => (
      <circle
        key={i}
        cx="100"
        cy="100"
        r={10 + i * 6}
        fill="none"
        stroke="hsl(217, 91%, 60%)"
        strokeWidth="0.5"
        opacity="0.3"
      />
    ))}
    {/* Main vinyl body */}
    <circle cx="100" cy="100" r="95" fill="url(#vinylGradient)" />
    {/* Center label */}
    <circle cx="100" cy="100" r="25" fill="hsl(0, 0%, 95%)" filter="url(#glow)" />
    {/* IDJ text */}
    <text x="100" y="105" textAnchor="middle" fontSize="18" fontWeight="bold" fill="hsl(240, 35%, 12%)">
      IDJ
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
        className="scratch-wheel"
        style={{ 
          transform: `rotate(${rotation}deg)`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <VinylSVG />
        </div>
      </div>
    </div>
  );
};