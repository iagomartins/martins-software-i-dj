import React, { Suspense } from "react";
import { useDJ } from "../../contexts/DJContext";
import { CrossFader } from "./CrossFader";
import { DJKnob } from "./DJKnob";
import { DJDeck } from "./DJDeck";
import { ConfigModal } from "./ConfigModal";
// Import the logo directly
import iDJLogo from "../../assets/iDJLogo.svg";
import { useAudioEngine } from "@/hooks/useAudioEngine";

export function DJInterface() {
  const { state, dispatch } = useDJ();
  const { setCrossfader, updateHeadphoneVolume } = useAudioEngine(); // Add updateHeadphoneVolume

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 text-white">
        {/* Header */}
        <header className="bg-[#1C1D33]/20 backdrop-blur-sm border-b border-white/10 p-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Use imported logo or fallback text */}
              {iDJLogo ? (
                <img src={iDJLogo} alt="iDJ Logo" className="h-12 w-auto" />
              ) : (
                <div className="h-12 w-12 bg-gradient-to-r from-cyan-400 to-gr-400 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  iDJ
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="px-4 bg-primary bg-accent-hover rounded-sm text-sm transition-colors"
                onClick={() => dispatch({ type: "TOGGLE_CONFIG_MODAL" })}
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
            <div className="bg-[#1C1D33]/30 backdrop-blur-sm rounded-t-xl border border-white/10 p-4 mb-8">
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
            <div className="grid lg:grid-cols-12 gap-8">
              {/* Deck 1 */}
              <div className="lg:col-span-5">
                <DJDeck deckNumber={1} deckState={deck1.isPlaying} />
              </div>

              {/* Center Controls */}
              <div className="lg:col-span-2 flex flex-col items-center space-y-8">
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
                      setCrossfader(value); // Add this line
                    }}
                    onDoubleClick={() => {
                      // Reset crossfader to center
                      dispatch({ type: "SET_CROSSFADER", payload: 0.5 });
                      setCrossfader(0); // Add this line
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
              <div className="lg:col-span-5">
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
