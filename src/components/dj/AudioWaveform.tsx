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
}: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      onLoad(file);
    }
  };

  // Generate waveform data from audio file (for visualization only)
  const generateWaveform = async (file: File) => {
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
  };

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSizeRef.current;

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

    // Draw waveform bars
    ctx.fillStyle = "#333";
    for (let i = 0; i < waveformData.length; i++) {
      const barHeight = (waveformData[i] / maxAmplitude) * height * 0.8;
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }

    // Draw progress overlay
    if (progressX > 0) {
      ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
      ctx.fillRect(0, 0, progressX, height);
    }

    // Draw progress line
    if (progressX > 0) {
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
    }

    ctx.restore();
  }, [waveformData, currentTime, duration]);

  // Handle canvas click for seeking
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const seekTime = (x / rect.width) * duration;
      const clampedTime = Math.max(0, Math.min(seekTime, duration));

      // Notify parent component about the seek
      onTimeUpdate(clampedTime);
    },
    [duration, onTimeUpdate]
  );

  // Effects
  useEffect(() => {
    if (audioFile) {
      generateWaveform(audioFile);
    }
  }, [audioFile]);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(drawWaveform);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
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
    <div className="bg-dj-panel rounded-sm p-2 space-y-2">
      {/* File input */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          id={`file-input-${deckNumber}`}
        />
        <label
          htmlFor={`file-input-${deckNumber}`}
          className="px-3 py-1 bg-dj-button text-dj-button-foreground rounded-sm text-xs font-medium cursor-pointer hover:bg-dj-button/80 transition-colors"
        >
          {audioFile ? "Change Track" : "Load Track"}
        </label>

        {isLoading && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </div>

      {/* Waveform canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-16 bg-dj-panel border border-border rounded-sm cursor-pointer"
          style={{ imageRendering: "pixelated" }}
        />

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

      {/* Time display */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="text-neon-cyan font-medium">
          {formatTime(currentTime)}
        </span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};
