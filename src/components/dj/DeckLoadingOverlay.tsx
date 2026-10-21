/**
 * DeckLoadingOverlay - Modern visual loading feedback during audio decoding
 * Location: src/components/dj/DeckLoadingOverlay.tsx
 */

import React from "react";
import { Loader2, AlertCircle, Music } from "lucide-react";

interface DeckLoadingOverlayProps {
  isLoading: boolean;
  progress?: number;
  trackName?: string | null;
  error?: string | null;
  onDismissError?: () => void;
}

export const DeckLoadingOverlay: React.FC<DeckLoadingOverlayProps> = ({
  isLoading,
  progress = 0,
  trackName,
  error,
  onDismissError,
}) => {
  if (!isLoading && !error) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#101010]/85 backdrop-blur-md rounded-sm p-4 transition-all duration-300">
      {isLoading ? (
        <div className="flex flex-col items-center max-w-xs text-center space-y-3">
          {/* Neon Animated Spinner */}
          <div className="relative flex items-center justify-center">
            <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <Music className="w-6 h-6 text-primary absolute animate-pulse" />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-[#F8FAFC] tracking-wide">
              Carregando e Decodificando Áudio
            </h4>
            {trackName && (
              <p className="text-xs text-zinc-400 truncate max-w-[220px]">
                {trackName}
              </p>
            )}
            <p className="text-[11px] text-zinc-500 font-mono">
              Processando buffer WAV de alta resolução...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#1b1b1b] h-1.5 rounded-full overflow-hidden border border-white/5">
            {progress > 0 ? (
              <div
                className="bg-primary h-full transition-all duration-200 shadow-[0_0_8px_#3b82f6]"
                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              />
            ) : (
              <div className="bg-gradient-to-r from-transparent via-primary to-transparent h-full w-1/2 animate-[shimmer_1.5s_infinite]" />
            )}
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center max-w-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-red-200">
              Falha ao Carregar Áudio
            </h4>
            <p className="text-xs text-red-300/80 leading-relaxed">{error}</p>
          </div>
          {onDismissError && (
            <button
              onClick={onDismissError}
              type="button"
              className="px-3 py-1 bg-[#1b1b1b] hover:bg-zinc-800 border border-white/10 text-xs text-[#F8FAFC] rounded transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};
