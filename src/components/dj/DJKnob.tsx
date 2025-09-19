import { useState } from "react";

interface DJKnobProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  color?: "cyan" | "magenta" | "yellow" | "green";
  onDoubleClick?: () => void;
}

export const DJKnob = ({
  label,
  value,
  onChange,
  min = -1,
  max = 1,
  step = 0.01,
  color = "cyan",
  onDoubleClick,
}: DJKnobProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const normalizedAngle = (angle + Math.PI) / (2 * Math.PI);
    const newValue = min + normalizedAngle * (max - min);

    onChange(Math.max(min, Math.min(max, newValue)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="dj-knob"
        style={{
          transform: `rotate(${rotation}deg)`,
          boxShadow: isDragging
            ? `0 0 20px hsl(var(--neon-${color}))`
            : undefined,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={onDoubleClick}
      />
      <span className="text-xs font-mono text-dj-panel-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-xs font-mono text-neon-cyan">
        {value.toFixed(2)}
      </span>
    </div>
  );
};
