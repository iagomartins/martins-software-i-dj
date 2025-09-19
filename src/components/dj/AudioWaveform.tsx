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
  const audioRef = useRef<HTMLAudioElement>(null);
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

  // Generate waveform data from audio file
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
        const start = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[start + j]);
        }
        waveform.push(sum / blockSize);
      }

      setWaveformData(waveform);
      audioContext.close();
    } catch (error) {
      console.error("Error generating waveform:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Optimized draw function with proper canvas scaling
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get actual display size
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // Set canvas internal size to match display size (fixes scaling issues)
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      canvasSizeRef.current = { width: displayWidth, height: displayHeight };
    }

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw waveform with better performance
    const barWidth = width / waveformData.length;
    const maxAmplitude = Math.max(...waveformData);
    const progressX = duration > 0 ? (currentTime / duration) * width : 0;

    // Batch draw operations for better performance
    ctx.save();

    // Draw unplayed bars first (background)
    ctx.fillStyle = "hsl(var(--soft-darker))";
    waveformData.forEach((amplitude, index) => {
      const barHeight = (amplitude / maxAmplitude) * height * 0.6;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      if (x >= progressX) {
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
    });

    // Draw played bars (foreground)
    ctx.fillStyle = "#DEDEDE";
    waveformData.forEach((amplitude, index) => {
      const barHeight = (amplitude / maxAmplitude) * height * 0.6;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      if (x < progressX) {
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
    });

    ctx.restore();

    // Draw progress line with better precision
    if (duration > 0) {
      ctx.save();
      ctx.strokeStyle = "#3C3C3C";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      // Anti-aliased line
      ctx.beginPath();
      ctx.moveTo(progressX + 0.5, 0);
      ctx.lineTo(progressX + 0.5, height);
      ctx.stroke();

      // Progress indicator circle
      ctx.fillStyle = "#6C6C91";
      ctx.beginPath();
      ctx.arc(progressX, height / 2, 4, 0, 2 * Math.PI);
      ctx.fill();

      ctx.restore();
    }
  }, [waveformData, currentTime, duration]);

  // Update audio time
  const updateTime = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      onTimeUpdate(time);
    }
  };

  // High-precision click handling with proper coordinate mapping
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!duration) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Get precise click coordinates relative to canvas
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      // Ensure click is within canvas bounds
      if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;

      // Calculate precise seek time
      const seekTime = (x / canvas.width) * duration;

      // Clamp seek time to valid range
      const clampedTime = Math.max(0, Math.min(seekTime, duration));

      if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
        onTimeUpdate(clampedTime);
      }
    },
    [duration, onTimeUpdate]
  );

  // Effects
  useEffect(() => {
    if (audioFile) {
      generateWaveform(audioFile);
    }
  }, [audioFile]);

  // Optimized redraw with requestAnimationFrame
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

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
        audioRef.current.addEventListener("timeupdate", updateTime);
      } else {
        audioRef.current.pause();
        audioRef.current.removeEventListener("timeupdate", updateTime);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("timeupdate", updateTime);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current && audioFile) {
      const url = URL.createObjectURL(audioFile);
      audioRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile]);

  useEffect(() => {
    if (audioRef.current && audioFile) {
      const handleLoadedMetadata = () => {
        if (audioRef.current) {
          const audioDuration = audioRef.current.duration;
          if (!isNaN(audioDuration) && audioDuration > 0) {
            onDurationLoad(audioDuration);
          }
        }
      };

      audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener(
            "loadedmetadata",
            handleLoadedMetadata
          );
        }
      };
    }
  }, [audioFile, onDurationLoad]);

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="waveform-panel bg-dj-panel rounded-sm p-2 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-bold text-dj-panel-foreground">
            DECK {deckNumber} WAVEFORM
          </h3>
          {audioFile && (
            <span className="text-[10px] text-neon-cyan/80 truncate max-w-[100px]">
              {audioFile.name.replace(/\.[^/.]+$/, "")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id={`audio-file-${deckNumber}`}
          />
          <label
            htmlFor={`audio-file-${deckNumber}`}
            className="px-2 py-1 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 rounded-sm text-[10px] font-medium cursor-pointer hover:bg-neon-cyan/30 transition-colors"
          >
            LOAD
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-12 text-neon-cyan">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neon-cyan"></div>
          <span className="ml-1 text-[10px]">Loading...</span>
        </div>
      )}

      {!isLoading && waveformData.length === 0 && (
        <div className="flex items-center justify-center h-12 text-muted-foreground border-2 border-dashed border-border rounded-sm">
          <span className="text-[10px]">No audio loaded</span>
        </div>
      )}

      {waveformData.length > 0 && (
        <>
          {/* Progress bar above canvas */}
          <div className="w-full h-1 rounded-sm overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-cyan to-neon-magenta transition-all duration-100 ease-out"
              style={{
                width:
                  duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
              }}
            />
          </div>

          <canvas
            ref={canvasRef}
            className="w-full h-12 rounded-sm cursor-pointer border border-border/50 hover:border-neon-cyan/50 transition-colors"
            onClick={handleCanvasClick}
          />

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="text-neon-cyan font-medium">
              {formatTime(currentTime)}
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </>
      )}

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
