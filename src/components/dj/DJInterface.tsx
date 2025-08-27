import React, { Suspense } from 'react';
import { useDJ } from '../../contexts/DJContext';
import { CrossFader } from './CrossFader';
import { DJKnob } from './DJKnob';
import { DJDeck } from './DJDeck';
// Import the logo directly
import iDJLogo from '../../assets/iDJLogo.svg';

export function DJInterface() {
  const { state } = useDJ();

  // Add null checks and default values
  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading DJ Interface...</h2>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
    effects: { flanger: false, filter: false, echo: false, reverb: false }
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
    effects: { flanger: false, filter: false, echo: false, reverb: false }
  };

  const crossfader = state.crossfader ?? 0.5;
  const headphoneVolume = state.headphoneVolume ?? 1;

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading DJ Interface...</h2>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
        {/* Header */}
        <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Use imported logo or fallback text */}
              {iDJLogo ? (
                <img src={iDJLogo} alt="iDJ Logo" className="h-12 w-auto" />
              ) : (
                <div className="h-12 w-12 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  iDJ
                </div>
              )}
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                iDJ Professional
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Settings
              </button>
            </div>
          </div>
        </header>

        {/* Main DJ Console */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* DJ Console Header */}
            <div className="bg-black/30 backdrop-blur-sm rounded-t-xl border border-white/10 p-6 mb-8">
              <h2 className="text-2xl font-bold text-center mb-4">DJ Console</h2>
              <div className="grid grid-cols-3 gap-8 text-center">
                <div>
                  <h3 className="text-lg font-semibold text-cyan-400">Deck 1</h3>
                  <p className="text-sm text-gray-300">BPM: {deck1.bpm?.toFixed(2) || '120.00'}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-purple-400">Master</h3>
                  <p className="text-sm text-gray-300">Crossfader: {((crossfader - 0.5) * 200).toFixed(0)}%</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-cyan-400">Deck 2</h3>
                  <p className="text-sm text-gray-300">BPM: {deck2.bpm?.toFixed(2) || '120.00'}</p>
                </div>
              </div>
            </div>

            {/* Main Deck Area */}
            <div className="grid lg:grid-cols-12 gap-8">
              {/* Deck 1 */}
              <div className="lg:col-span-5">
                <DJDeck 
                  deckNumber={1} 
                  deckState={deck1.isPlaying}
                />
              </div>

              {/* Center Controls */}
              <div className="lg:col-span-2 flex flex-col items-center space-y-8">
                {/* Crossfader */}
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-center mb-4">Crossfader</h3>
                  <CrossFader 
                    value={crossfader}
                    onChange={(value) => {
                      // Handle crossfader change
                    }}
                    onDoubleClick={() => {
                      // Reset crossfader
                    }}
                  />
                </div>

                {/* Headphone Volume */}
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-center mb-4">Headphones</h3>
                  <DJKnob 
                    value={headphoneVolume}
                    onChange={(value) => {
                      // Handle headphone volume change
                    }}
                    onDoubleClick={() => {
                      // Reset headphone volume
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
                <DJDeck 
                  deckNumber={2} 
                  deckState={deck2.isPlaying}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </Suspense>
  );
}
