import { DJDeck } from "./DJDeck";

export const DJInterface = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-cyan to-neon-magenta bg-clip-text text-transparent">
            VIRTUAL DJ CONSOLE
          </h1>
          <p className="text-dj-console-foreground font-mono">
            Professional DJ Mixing Interface
          </p>
        </div>

        {/* DJ Console */}
        <div className="bg-dj-console/50 rounded-2xl p-8 border border-border backdrop-blur-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DJDeck deckNumber={1} />
            <DJDeck deckNumber={2} />
          </div>
          
          {/* Crossfader Section */}
          <div className="mt-8 bg-dj-panel rounded-lg p-6">
            <div className="flex justify-center items-center space-x-8">
              <span className="text-sm font-mono text-dj-panel-foreground">DECK A</span>
              
              <div className="relative w-64 h-4 bg-fader-track rounded-full cursor-pointer">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-4 bg-fader-handle rounded-full shadow-lg">
                  <div className="w-full h-full bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              </div>
              
              <span className="text-sm font-mono text-dj-panel-foreground">DECK B</span>
            </div>
            
            <div className="text-center mt-2">
              <span className="text-xs font-mono text-neon-cyan uppercase tracking-wider">
                Crossfader
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground font-mono">
          Use mouse to interact with controls • Click and drag knobs and faders
        </div>
      </div>
    </div>
  );
};