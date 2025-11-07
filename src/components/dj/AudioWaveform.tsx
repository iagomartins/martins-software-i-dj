import { useEffect, useRef, useState, useCallback } from "react";

interface AudioWaveformProps {
  deckNumber: 1 | 2;
  audioFile: File | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onLoad: (file: File) => void;
  onDurationLoad: (duration: number) => void;
  onSeek?: (time: number) => void;
}

export const AudioWaveform = ({
  deckNumber,
  audioFile,
  isPlaying,
  currentTime,
  duration,
  onTimeUpdate,
  onLoad,
  onDurationLoad,
  onSeek,
}: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [clickFeedback, setClickFeedback] = useState<number | null>(null);

  // Handle file input change
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      onLoad(file);
    }
  };

  // Handle file load button click - use Electron dialog if available
  const handleLoadClick = async () => {
    // Check if we're in Electron and use native dialog
    if (typeof window !== "undefined" && window.electronAPI?.dialog) {
      try {
        const result = await window.electronAPI.dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [
            {
              name: "Audio Files",
              extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"],
            },
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];

          // Read file using Electron fs API
          if (window.electronAPI?.fs) {
            const readResult = await window.electronAPI.fs.readFile(filePath);
            if (readResult.success && readResult.data) {
              // Convert number array to ArrayBuffer
              const arrayBuffer = new ArrayBuffer(readResult.data.length);
              const view = new Uint8Array(arrayBuffer);
              readResult.data.forEach((byte, index) => {
                view[index] = byte;
              });

              // Create File object from ArrayBuffer
              const fileName = filePath.split(/[/\\]/).pop() || "audio";
              const file = new File([arrayBuffer], fileName, {
                type: "audio/mpeg",
              });
              onLoad(file);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load file via Electron dialog:", error);
        // Fallback to HTML file input
        document.getElementById(`file-input-${deckNumber}`)?.click();
      }
    } else {
      // Fallback to HTML file input for web
      document.getElementById(`file-input-${deckNumber}`)?.click();
    }
  };

  // Generate waveform data from audio file (for visualization only)
  const generateWaveform = useCallback(
    async (file: File) => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const samples = 800; // Reduced for better performance
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];

        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          let sum = 0;
          let count = 0;

          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
            count++;
          }

          waveform.push(count > 0 ? sum / count : 0);
        }

        setWaveformData(waveform);
        onDurationLoad(audioBuffer.duration);
        audioContext.close();
      } catch (error) {
        console.error("Error generating waveform:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [onDurationLoad]
  );

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSizeRef.current;

    // Use requestAnimationFrame for smooth updates
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform with better performance
    const barWidth = width / waveformData.length;
    const maxAmplitude = Math.max(...waveformData);
    const progressX = duration > 0 ? (currentTime / duration) * width : 0;

    // Batch draw operations for better performance
    ctx.save();

    // Draw background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Draw waveform bars (blue)
    ctx.fillStyle = "hsl(217, 91%, 60%)";
    for (let i = 0; i < waveformData.length; i++) {
      const barHeight = (waveformData[i] / maxAmplitude) * height * 0.8;
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }

    // Draw progress overlay (red tint) - enhanced with gradient
    if (progressX > 0) {
      const gradient = ctx.createLinearGradient(0, 0, progressX, 0);
      gradient.addColorStop(0, "rgba(255, 0, 0, 0.15)");
      gradient.addColorStop(1, "rgba(255, 0, 0, 0.25)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, progressX, height);
    }

    // Draw hover preview line (if hovering)
    if (hoverX !== null && hoverX >= 0 && hoverX <= width) {
      ctx.strokeStyle = "rgba(100, 200, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw hover highlight area
      ctx.fillStyle = "rgba(100, 200, 255, 0.1)";
      ctx.fillRect(hoverX - 2, 0, 4, height);
    }

    // Draw click feedback (brief highlight)
    if (
      clickFeedback !== null &&
      clickFeedback >= 0 &&
      clickFeedback <= width
    ) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(clickFeedback - 3, 0, 6, height);
    }

    // Draw red playhead line - ENHANCED with thicker line, stronger glow, and indicators
    if (progressX > 0 && progressX <= width) {
      // Draw semi-transparent overlay behind playhead for better visibility
      ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
      ctx.fillRect(progressX - 3, 0, 6, height);

      // Draw playhead line with multiple passes for stronger glow
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 4; // Thicker line (was 2)

      // First pass: outer glow
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 12; // Stronger glow (was 8)
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();

      // Second pass: inner line
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();

      // Draw small circle indicators at top and bottom
      const circleRadius = 4;
      ctx.fillStyle = "#ff0000";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 8;

      // Top circle
      ctx.beginPath();
      ctx.arc(progressX, circleRadius, circleRadius, 0, Math.PI * 2);
      ctx.fill();

      // Bottom circle
      ctx.beginPath();
      ctx.arc(progressX, height - circleRadius, circleRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, [waveformData, currentTime, duration, hoverX, clickFeedback]);

  // Handle canvas mouse move for hover feedback
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const seekTime = (x / rect.width) * duration;
      const clampedTime = Math.max(0, Math.min(seekTime, duration));

      setHoverX(x);
      setHoverTime(clampedTime);
    },
    [duration]
  );

  // Handle canvas mouse leave
  const handleCanvasMouseLeave = useCallback(() => {
    setHoverX(null);
    setHoverTime(null);
  }, []);

  // Handle canvas click for seeking
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const seekTime = (x / rect.width) * duration;
      const clampedTime = Math.max(0, Math.min(seekTime, duration));

      // Visual feedback on click
      setClickFeedback(x);
      setTimeout(() => setClickFeedback(null), 200);

      // Notify parent component about the seek
      if (onSeek) {
        onSeek(clampedTime);
      } else {
        onTimeUpdate(clampedTime);
      }
    },
    [duration, onTimeUpdate, onSeek]
  );

  // Effects
  useEffect(() => {
    if (audioFile) {
      generateWaveform(audioFile);
    }
  }, [audioFile, generateWaveform]);

  // Continuous animation loop for smooth updates
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      drawWaveform();
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [drawWaveform]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      canvasSizeRef.current = { width: rect.width, height: rect.height };

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      drawWaveform();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [drawWaveform]);

  // Helper function to format time
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-dj-panel rounded-sm p-2 space-y-2 relative">
      {/* File input */}
      <div className="flex items-center gap-2 relative z-10">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          id={`file-input-${deckNumber}`}
          aria-label={`Load audio file for deck ${deckNumber}`}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLoadClick();
          }}
          className="px-3 py-1 bg-[hsl(var(--soft-dark))] border border-[hsl(var(--glow-blue)/0.3)] text-white rounded-sm text-xs font-semibold uppercase tracking-wide cursor-pointer hover:border-[hsl(var(--glow-blue)/0.6)] hover:shadow-[0_0_10px_hsl(var(--glow-blue)/0.3)] transition-all relative z-10"
        >
          {audioFile ? "Change Track" : "Load Track"}
        </button>
      </div>

      {/* Waveform canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="w-full h-16 bg-dj-panel border border-border rounded-sm cursor-pointer"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Hover tooltip */}
        {hoverX !== null && hoverTime !== null && duration > 0 && (
          <div
            className="absolute pointer-events-none z-20 bg-black/90 text-white text-xs px-2 py-1 rounded border border-[hsl(var(--glow-blue)/0.5)] shadow-lg"
            style={{
              left: `${hoverX}px`,
              top: "-30px",
              transform: "translateX(-50%)",
            }}
          >
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Progress bar overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-dj-panel rounded-b-sm overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-magenta transition-all duration-100 ease-out"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* Enhanced Time display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-neon-cyan tabular-nums">
            {formatTime(currentTime)}
          </span>
          {duration > 0 && (
            <span className="text-xs text-muted-foreground">
              ({Math.round((currentTime / duration) * 100)}%)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-border"></div>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};
