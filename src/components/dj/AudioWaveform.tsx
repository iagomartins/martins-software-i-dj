import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioWaveformProps {
  deckNumber: 1 | 2;
  audioFile: File | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onLoad: (file: File) => void;
}

export const AudioWaveform = ({ 
  deckNumber, 
  audioFile, 
  isPlaying, 
  currentTime, 
  duration, 
  onTimeUpdate, 
  onLoad 
}: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onLoad(file);
    }
  };

  // Generate waveform data from audio file
  const generateWaveform = async (file: File) => {
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 1000; // Number of waveform points
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
      console.error('Error generating waveform:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Draw waveform on canvas
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    const barWidth = width / waveformData.length;
    const maxAmplitude = Math.max(...waveformData);
    const progressX = duration > 0 ? (currentTime / duration) * width : 0;
    
    waveformData.forEach((amplitude, index) => {
      const barHeight = (amplitude / maxAmplitude) * height * 0.6;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      // Color bars based on progress - played vs unplayed
      if (x < progressX) {
        // Already played - brighter color
        ctx.fillStyle = 'hsl(var(--neon-magenta))';
      } else {
        // Not yet played - dimmer color
        ctx.fillStyle = 'hsl(var(--neon-cyan) / 0.4)';
      }
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw progress line/cursor
    if (duration > 0) {
      ctx.strokeStyle = 'hsl(var(--neon-yellow))';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();

      // Draw progress indicator circle
      ctx.fillStyle = 'hsl(var(--neon-yellow))';
      ctx.beginPath();
      ctx.arc(progressX, height / 2, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Add glow effect to progress cursor
      ctx.shadowColor = 'hsl(var(--neon-yellow))';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(progressX, height / 2, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  // Update audio time
  const updateTime = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      onTimeUpdate(time);
    }
  };

  // Handle canvas click for seeking
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const seekTime = (x / canvas.width) * duration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      onTimeUpdate(seekTime);
    }
  };

  // Effects
  useEffect(() => {
    if (audioFile) {
      generateWaveform(audioFile);
    }
  }, [audioFile]);

  useEffect(() => {
    drawWaveform();
  }, [waveformData, currentTime, duration]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
        audioRef.current.addEventListener('timeupdate', updateTime);
      } else {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', updateTime);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', updateTime);
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
          <canvas
            ref={canvasRef}
            width={400}
            height={50}
            className="w-full h-12 bg-black/20 rounded-sm cursor-pointer border border-border/50 hover:border-neon-cyan/50 transition-colors"
            onClick={handleCanvasClick}
          />
          
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="text-neon-cyan font-medium">{formatTime(currentTime)}</span>
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
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
