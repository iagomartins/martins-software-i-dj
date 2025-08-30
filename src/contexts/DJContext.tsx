import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Your DJ state interface
interface DJState {
  activeHeadphoneDecks: Set<number>; // Fix: Replace 'any' with proper type
  connectedDevices: MediaDeviceInfo[]; // Add missing property
  audioConfig: { // Add missing property
    masterOutput: string;
    headphoneOutput: string;
    latency: number;
    sampleRate: number;
    inputChannels: string;
  };
  isConfigModalOpen: boolean; // Add missing property
  keyMappings: Record<string, string>; // Add this missing property
  deck1: {
    isPlaying: boolean;
    isCued: boolean;
    currentTime: number;
    duration: number;
    bpm: number;
    baseBpm: number;
    pitch: number;
    volume: number;
    lowEQ: number;
    midEQ: number;
    highEQ: number;
    effects: {
      flanger: boolean;
      filter: boolean;
      echo: boolean;
      reverb: boolean;
    };
  };
  deck2: {
    isPlaying: boolean;
    isCued: boolean;
    currentTime: number;
    duration: number;
    bpm: number;
    baseBpm: number;
    pitch: number;
    volume: number;
    lowEQ: number;
    midEQ: number;
    highEQ: number;
    effects: {
      flanger: boolean;
      filter: boolean;
      echo: boolean;
      reverb: boolean;
    };
  };
  crossfader: number;
  headphoneVolume: number;
}

// Your DJ actions
type DJAction = 
  | { type: 'SET_DECK_1_STATE'; payload: Partial<DJState['deck1']> }
  | { type: 'SET_DECK_2_STATE'; payload: Partial<DJState['deck2']> }
  | { type: 'SET_CROSSFADER'; payload: number }
  | { type: 'SET_HEADPHONE_VOLUME'; payload: number }
  | { type: 'RESET_DECK_1' }
  | { type: 'RESET_DECK_2' }
  | { type: 'UPDATE_AUDIO_CONFIG'; payload: Partial<DJState['audioConfig']> }
  | { type: 'TOGGLE_CONFIG_MODAL' }
  | { type: 'TOGGLE_HEADPHONE_DECK'; payload: number }
  | { type: 'SET_CONNECTED_DEVICES'; payload: MediaDeviceInfo[] }
  | { type: 'SET_KEY_MAPPING'; payload: { key: string; buttonId: string } } // Add this
  | { type: 'CLEAR_KEY_MAPPING'; payload: string }; // Add this

// Initial state
const initialState: DJState = {
  activeHeadphoneDecks: new Set<number>(), // Fix: Initialize properly
  connectedDevices: [], // Add missing property
  audioConfig: {
    masterOutput: 'default',
    headphoneOutput: 'default',
    latency: 128,
    sampleRate: 44100,
    inputChannels: 'default'
  },
  isConfigModalOpen: false, // Add missing property
  keyMappings: {}, // Add this missing property
  deck1: {
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
    effects: {
      flanger: false,
      filter: false,
      echo: false,
      reverb: false,
    },
  },
  deck2: {
    isPlaying: false,
    isCued: false,
    duration: 0,
    currentTime: 0,
    bpm: 120,
    baseBpm: 120,
    pitch: 0,
    volume: 1,
    lowEQ: 0,
    midEQ: 0,
    highEQ: 0,
    effects: {
      flanger: false,
      filter: false,
      echo: false,
      reverb: false,
    },
  },
  crossfader: 0.5,
  headphoneVolume: 1,
};

// Reducer function
function djReducer(state: DJState, action: DJAction): DJState {
  switch (action.type) {
    case 'SET_DECK_1_STATE':
      return {
        ...state,
        deck1: { ...state.deck1, ...action.payload }
      };
    case 'SET_DECK_2_STATE':
      return {
        ...state,
        deck2: { ...state.deck2, ...action.payload }
      };
    case 'SET_CROSSFADER':
      return {
        ...state,
        crossfader: action.payload
      };
    case 'SET_HEADPHONE_VOLUME':
      return {
        ...state,
        headphoneVolume: action.payload
      };
    case 'RESET_DECK_1':
      return {
        ...state,
        deck1: initialState.deck1
      };
    case 'RESET_DECK_2':
      return {
        ...state,
        deck2: initialState.deck2
      };
    case 'UPDATE_AUDIO_CONFIG':
      return {
        ...state,
        audioConfig: { ...state.audioConfig, ...action.payload }
      };
    case 'TOGGLE_CONFIG_MODAL':
      return {
        ...state,
        isConfigModalOpen: !state.isConfigModalOpen
      };
    case 'TOGGLE_HEADPHONE_DECK':
      { const newActiveHeadphoneDecks = new Set(state.activeHeadphoneDecks);
      if (newActiveHeadphoneDecks.has(action.payload)) {
        newActiveHeadphoneDecks.delete(action.payload);
      } else {
        newActiveHeadphoneDecks.add(action.payload);
      }
      return {
        ...state,
        activeHeadphoneDecks: newActiveHeadphoneDecks
      }; }
    case 'SET_CONNECTED_DEVICES':
      return {
        ...state,
        connectedDevices: action.payload
      };
    case 'SET_KEY_MAPPING':
      return {
        ...state,
        keyMappings: {
          ...state.keyMappings,
          [action.payload.key]: action.payload.buttonId
        }
      };
      
    case 'CLEAR_KEY_MAPPING':
      { const newKeyMappings = { ...state.keyMappings };
      delete newKeyMappings[action.payload];
      return {
        ...state,
        keyMappings: newKeyMappings
      }; }
    default:
      return state;
  }
}

// Create context
const DJContext = createContext<{
  state: DJState;
  dispatch: React.Dispatch<DJAction>;
} | undefined>(undefined);

// Provider component
export function DJProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(djReducer, initialState);

  return (
    <DJContext.Provider value={{ state, dispatch }}>
      {children}
    </DJContext.Provider>
  );
}

// Hook to use DJ context
export function useDJ() {
  const context = useContext(DJContext);
  if (context === undefined) {
    throw new Error('useDJ must be used within a DJProvider');
  }
  return context;
}