import { useState, useCallback, useRef } from "react";

interface PitchFaderProps {
  value: number;
  onChange: (value: number) => void;
  deckNumber: number;
  onDoubleClick: () => void;
}

export function PitchFader({
  value,
  onChange,
  deckNumber,
  onDoubleClick,
}: PitchFaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = 1 - y / rect.height;
    const newValue = -1 + percentage * 2; // Map to -1 to +1

    handleChange(Math.max(-1, Math.min(1, newValue)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleChange = useCallback(
    (newValue: number) => {
      onChange(newValue);

      // Throttle Electron API calls to prevent overwhelming the child process
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }

      throttleTimeoutRef.current = setTimeout(async () => {
        // Call Electron API for JUCE processing
        if (window.electronAPI?.audio?.setPitchBend) {
          try {
            console.log(
              `🎵 [React] Calling setPitchBend - Deck: ${deckNumber}, Value: ${newValue}`
            );
            const result = await window.electronAPI.audio.setPitchBend(
              deckNumber,
              newValue
            );
            console.log(`✓ [React] setPitchBend result:`, result);
          } catch (error) {
            console.error(`✗ [React] setPitchBend error:`, error);
          }
        } else {
          console.warn(
            "⚠️ Electron API not available, using Web Audio fallback"
          );
        }
      }, 100); // Throttle to max 10 calls per second
    },
    [deckNumber, onChange]
  );

  const position = ((value + 1) / 2) * 100; // Convert -1,1 to 0,100%

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2 mb-2">
        <button
          id={`deck${deckNumber}-pitch-plus`}
          className="w-6 h-6 text-xs bg-button-off hover:bg-neon-green text-foreground rounded font-bold"
          onClick={() => handleChange(Math.min(1, value + 0.1))}
        >
          +
        </button>
        <button
          id={`deck${deckNumber}-pitch-minus`}
          className="w-6 h-6 text-xs bg-button-off hover:bg-neon-magenta text-foreground rounded font-bold"
          onClick={() => handleChange(Math.max(-1, value - 0.1))}
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
        onDoubleClick={onDoubleClick}
      >
        <div
          className="pitch-fader-handle"
          style={{
            bottom: `${position}%`,
            boxShadow: isDragging
              ? `0 0 15px hsl(var(--neon-yellow))`
              : undefined,
          }}
        />
        {/* Center line indicator */}
        <div className="absolute left-0 top-1/2 w-full h-px bg-white/50 transform -translate-y-1/2" />
      </div>

      <span className="text-xs font-mono text-dj-panel-foreground uppercase tracking-wider">
        Pitch
      </span>
      <span className="text-xs font-mono text-neon-yellow">
        {value > 0 ? "+" : ""}
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}
