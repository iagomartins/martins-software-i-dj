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
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    
    ctx.fillStyle = 'hsl(var(--neon-cyan))';
    waveformData.forEach((amplitude, index) => {
      const barHeight = (amplitude / maxAmplitude) * height * 0.6;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw progress line
    if (duration > 0) {
      const progressX = (currentTime / duration) * width;
      ctx.strokeStyle = 'hsl(var(--neon-magenta))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();

      // Draw progress indicator
      ctx.fillStyle = 'hsl(var(--neon-magenta))';
      ctx.beginPath();
      ctx.arc(progressX, height / 2, 4, 0, 2 * Math.PI);
      ctx.fill();
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
    <div className="waveform-panel bg-dj-panel rounded-sm p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-sm font-bold text-dj-panel-foreground">
            DECK {deckNumber} - WAVEFORM
          </h3>
          {audioFile && (
            <span className="text-xs text-neon-cyan/80">
              {audioFile.name.replace(/\.[^/.]+$/, "")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id={`audio-file-${deckNumber}`}
          />
          <label
            htmlFor={`audio-file-${deckNumber}`}
            className="waveform-load-button"
          >
            LOAD AUDIO
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-20 text-neon-cyan">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neon-cyan"></div>
          <span className="ml-2 text-sm">Generating waveform...</span>
        </div>
      )}

      {!isLoading && waveformData.length === 0 && (
        <div className="flex items-center justify-center h-20 text-muted-foreground border-2 border-dashed border-border rounded-sm">
          <span className="text-sm">No audio loaded</span>
        </div>
      )}

      {waveformData.length > 0 && (
        <>
          <canvas
            ref={canvasRef}
            width={400}
            height={80}
            className="waveform-canvas"
            onClick={handleCanvasClick}
          />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="text-neon-cyan font-medium">{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          
          {/* Progress bar */}
          <div className="waveform-progress-bar">
            <div 
              className="waveform-progress-fill"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
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
