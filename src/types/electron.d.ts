declare global {
  interface Window {
    electronAPI: {
      audio: {
        setPitchBend: (
          deckNumber: number,
          semitones: number
        ) => Promise<unknown>;
        setFlanger: (
          deckNumber: number,
          enabled: boolean,
          rate: number,
          depth: number
        ) => Promise<unknown>;
        setFilter: (
          deckNumber: number,
          cutoff: number,
          resonance: number
        ) => Promise<unknown>;
        setJogWheel: (deckNumber: number, position: number) => Promise<unknown>;
      };
    };
  }
}

export {};
