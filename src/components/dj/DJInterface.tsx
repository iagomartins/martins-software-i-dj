import { DJDeck } from "./DJDeck";
import { ConfigModal } from "./ConfigModal";
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

export const DJInterface = () => {
  const { dispatch } = useDJ();
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  return (
    <div className="max-h-screen bg-background p-6 pb-8 overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-6 h-full">
        {/* DJ Console */}
        <div className="bg-dj-console/50 rounded-2xl p-4 border border-border backdrop-blur-sm">
          {/* Header */}
          <div className="text-center space-y-2 relative">
            <div className="absolute right-0 top-0 flex items-center gap-2">
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

            <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-cyan to-neon-magenta bg-clip-text text-transparent">
              <img src={djLogo} width={100} alt="Be the DJ you want to be!" />
            </h1>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DJDeck deckNumber={1} />
            <DJDeck deckNumber={2} />
          </div>

          {/* Crossfader Section */}
          <div className="mt-6 bg-dj-panel rounded-sm p-4">
            <div className="flex justify-center items-center space-x-8">
              <span className="text-sm font-mono text-dj-panel-foreground">
                DECK A
              </span>

              <div className="relative w-64 h-4 bg-fader-track rounded-sm cursor-pointer">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-4 bg-fader-handle rounded-sm shadow-lg">
                  <div className="w-full h-full bg-gradient-to-b from-white/30 to-transparent rounded-sm" />
                </div>
              </div>

              <span className="text-sm font-mono text-dj-panel-foreground">
                DECK B
              </span>
            </div>

            <div className="text-center mt-2">
              <span className="text-xs font-mono text-neon-cyan uppercase tracking-wider">
                Crossfader
              </span>
            </div>
          </div>
          <div className="text-center text-xs text-muted-foreground font-mono pt-2">
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
      </div>

      <ConfigModal />
    </div>
  );
};
