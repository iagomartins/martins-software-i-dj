import { DJDeck } from "./DJDeck";
import { DJButton } from "./DJButton";
import { ConfigModal } from "./ConfigModal";
import { CrossFader } from "./CrossFader";
import { DJKnob } from "./DJKnob";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings, Maximize2, Minimize2 } from "lucide-react";
import { useDJ } from "@/contexts/DJContext";
import djLogo from "@/assets/iDJLogo.svg";
import { useState, useEffect } from "react";
import { useAudioEngine } from "@/hooks/useAudioEngine";

export const DJInterface = () => {
  const { dispatch } = useDJ();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crossfaderValue, setCrossfaderValue] = useState(0.5); // Start at center (0.5 = 50%)
  const [headphoneVolume, setHeadphoneVolume] = useState(0.7);
  const { applyCrossfader, updateHeadphoneVolume } = useAudioEngine();

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard shortcut for fullscreen (F11 or Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F11" || (event.ctrlKey && event.key === "f")) {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle crossfader changes
  const handleCrossfaderChange = (value: number) => {
    // Convert from -1..1 to 0..1 for state storage
    const normalizedValue = (value + 1) / 2;
    setCrossfaderValue(normalizedValue);
    // Apply the original -1..1 value to audio
    applyCrossfader(value);
  };

  // Handle headphone volume changes
  const handleHeadphoneVolumeChange = (value: number) => {
    setHeadphoneVolume(value);
    updateHeadphoneVolume(value);
  };

  // Reset functions for double-click
  const resetCrossfader = () => {
    setCrossfaderValue(0.5); // Center position (0)
    applyCrossfader(0);
  };

  const resetHeadphoneVolume = () => {
    setHeadphoneVolume(1.0); // 100%
    updateHeadphoneVolume(1.0);
  };

  return (
    <div className="h-screen bg-background p-2 overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <img src={djLogo} width={60} alt="DJ Logo" />
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="flex items-center gap-2"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle fullscreen (F11 or Ctrl+F)</p>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "TOGGLE_CONFIG_MODAL" })}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configurações
            </Button>
          </div>
        </div>

        {/* DJ Console */}
        <div className="bg-dj-console/50 rounded-lg p-4 border border-border backdrop-blur-sm flex-1 flex flex-col min-h-0">
          <div className="grid lg:grid-flow-col gap-8 flex-1 min-h-0">
            <DJDeck deckNumber={1} />
            {/* Center Controls */}
            <div className="mt-4 bg-dj-panel rounded-sm p-5 flex flex-col space-y-4 justify-center items-center gap-10">
              <CrossFader
                value={crossfaderValue * 2 - 1}
                onChange={handleCrossfaderChange}
                onDoubleClick={resetCrossfader}
              />

              <div className="w-20">
                <DJKnob
                  label="HEADPHONE"
                  value={headphoneVolume}
                  onChange={handleHeadphoneVolumeChange}
                  min={0}
                  max={1}
                  color="cyan"
                  onDoubleClick={resetHeadphoneVolume}
                />
              </div>
            </div>
            <DJDeck deckNumber={2} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-muted-foreground font-mono mt-2">
          A{" "}
          <a
            href="https://soundcloud.com/corvolive"
            className="text-neon-cyan"
            target="_blank"
            rel="noopener"
          >
            Corvo Live
          </a>{" "}
          Production © 2025. Todos os direitos reservados.
        </div>
      </div>

      <ConfigModal />
    </div>
  );
};
