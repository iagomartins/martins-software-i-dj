import React, { Suspense } from "react";
import { useDJ } from "../../contexts/DJContext";
import { CrossFader } from "./CrossFader";
import { DJKnob } from "./DJKnob";
import { DJDeck } from "./DJDeck";
import { ConfigModal } from "./ConfigModal";
// Import the logo directly
import iDJLogo from "../../assets/iDJLogo.svg";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useMIDI } from "@/hooks/useMIDI";

export function DJInterface() {
  const { state, dispatch } = useDJ();
  const { setCrossfader, updateHeadphoneVolume } = useAudioEngine();
  const { devices, isMidiAvailable } = useMIDI();

  // Add null checks and default values
  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading DJ Interface...</h2>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Ensure deck states exist with defaults
  const deck1 = state.deck1 || {
    isPlaying: false,
    isCued: false,
    currentTime: 0,
    duration: 0,
    bpm: 120,
    baseBpm: 120,
    pitch: 0,
    volume: 1,
    lowEQ: 0,
    midEQ: 0,
    highEQ: 0,
    effects: { flanger: false, filter: false, echo: false, reverb: false },
  };

  const deck2 = state.deck2 || {
    isPlaying: false,
    isCued: false,
    currentTime: 0,
    duration: 0,
    bpm: 120,
    baseBpm: 120,
    pitch: 0,
    volume: 1,
    lowEQ: 0,
    midEQ: 0,
    highEQ: 0,
    effects: { flanger: false, filter: false, echo: false, reverb: false },
  };

  const crossfader = state.crossfader ?? 0.5;
  const headphoneVolume = state.headphoneVolume ?? 1;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Loading DJ Interface...</h2>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-[#101010] text-[#F8FAFC] relative overflow-hidden">
        {/* Subtle radial glow background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 0%, #3B82F6 0%, transparent 45%),
                             radial-gradient(circle at 10% 90%, #1b1b1b 0%, transparent 40%),
                             radial-gradient(circle at 90% 90%, #1b1b1b 0%, transparent 40%)`,
          }}
        />
        {/* Header */}
        <header className="relative bg-[#1b1b1b]/90 backdrop-blur-md border-b border-[#2e2e2e] p-2.5 z-20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Use imported logo or fallback text */}
              {iDJLogo ? (
                <img src={iDJLogo} alt="iDJ Logo" className="h-10 w-auto" />
              ) : (
                <div className="h-10 px-3 bg-[#3B82F6] rounded-lg flex items-center justify-center text-white font-bold text-lg tracking-wider">
                  iDJ
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {/* MIDI Hardware Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#101010] border border-[#2e2e2e] text-xs">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    isMidiAvailable
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"
                      : "bg-zinc-600"
                  }`}
                />
                <span className="text-zinc-300 font-mono text-[11px]">
                  {devices.length > 0
                    ? `MIDI: ${devices[0].name}`
                    : "MIDI: Searching..."}
                </span>
              </div>

              <button
                type="button"
                className="px-4 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-[#F8FAFC] rounded-lg text-xs font-semibold tracking-wider uppercase transition-colors shadow-sm relative z-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch({ type: "TOGGLE_CONFIG_MODAL" });
                }}
              >
                SETTINGS
              </button>
            </div>
          </div>
        </header>

        {/* Main DJ Console */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* DJ Console Header */}
            <div className="bg-[#1b1b1b] rounded-lg border border-[#2e2e2e] p-3 mb-6 shadow-md">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div>
                  <h3 className="text-md font-semibold text-light">DECK 1</h3>
                  <p className="text-sm text-gray-300">
                    BPM: {deck1.bpm?.toFixed(2) || "120.00"}
                  </p>
                </div>
                <div>
                  <h3 className="text-md font-semibold text-primary">MASTER</h3>
                  <p className="text-sm text-gray-300">
                    CROSSFADER: {((crossfader - 0.5) * 200).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <h3 className="text-md font-semibold text-light">DECK 2</h3>
                  <p className="text-sm text-gray-300">
                    BPM: {deck2.bpm?.toFixed(2) || "120.00"}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Deck Area */}
            <div className="grid lg:grid-cols-12 gap-8 relative z-10">
              {/* Deck 1 */}
              <div className="lg:col-span-5 relative z-10">
                <DJDeck deckNumber={1} deckState={deck1.isPlaying} />
              </div>

              {/* Center Controls */}
              <div className="lg:col-span-2 flex flex-col items-center space-y-8 relative z-10">
                {/* Crossfader */}
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-center mb-4">
                    CROSSFADER
                  </h3>
                  <CrossFader
                    value={(crossfader - 0.5) * 2} // Convert from 0..1 to -1..1 range
                    onChange={(value) => {
                      // Convert from -1..1 to 0..1 range and dispatch
                      const newValue = (value + 1) / 2;
                      dispatch({ type: "SET_CROSSFADER", payload: newValue });
                      setCrossfader(newValue);
                    }}
                    onDoubleClick={() => {
                      // Reset crossfader to center
                      dispatch({ type: "SET_CROSSFADER", payload: 0.5 });
                      setCrossfader(0.5);
                    }}
                  />
                </div>

                {/* Headphone Volume */}
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-center mb-4">
                    HEADPHONES
                  </h3>
                  <DJKnob
                    value={headphoneVolume}
                    onChange={(value) => {
                      dispatch({
                        type: "SET_HEADPHONE_VOLUME",
                        payload: value,
                      });
                      updateHeadphoneVolume(value); // Add this line
                    }}
                    onDoubleClick={() => {
                      // Reset headphone volume to 100%
                      dispatch({ type: "SET_HEADPHONE_VOLUME", payload: 1.0 });
                      updateHeadphoneVolume(1.0); // Add this line
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    label="Volume"
                  />
                </div>
              </div>

              {/* Deck 2 */}
              <div className="lg:col-span-5 relative z-10">
                <DJDeck deckNumber={2} deckState={deck2.isPlaying} />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Config Modal */}
      <ConfigModal />
    </Suspense>
  );
}
