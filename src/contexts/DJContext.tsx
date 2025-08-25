import React, { createContext, useContext, useReducer, useEffect } from 'react';

export interface KeyMapping {
  [key: string]: string; // key code -> button id
}

export interface AudioConfig {
  masterOutput: string;
  headphoneOutput: string;
  inputChannels: {
    deck1: string;
    deck2: string;
  };
  outputChannels: {
    master: string;
    headphone: string;
  };
  latency: number;
  sampleRate: number;
}

export interface DJState {
  keyMappings: KeyMapping;
  audioConfig: AudioConfig;
  connectedDevices: MediaDeviceInfo[];
  isConfigModalOpen: boolean;
  activeHeadphoneDecks: Set<number>;
}

type DJAction =
  | { type: 'SET_KEY_MAPPING'; payload: { key: string; buttonId: string } }
  | { type: 'UPDATE_AUDIO_CONFIG'; payload: Partial<AudioConfig> }
  | { type: 'SET_CONNECTED_DEVICES'; payload: MediaDeviceInfo[] }
  | { type: 'TOGGLE_CONFIG_MODAL' }
  | { type: 'TOGGLE_HEADPHONE_DECK'; payload: number }
  | { type: 'CLEAR_KEY_MAPPING'; payload: string };

const initialState: DJState = {
  keyMappings: {},
  audioConfig: {
    masterOutput: 'default',
    headphoneOutput: 'default',
    inputChannels: {
      deck1: 'default',
      deck2: 'default',
    },
    outputChannels: {
      master: 'default',
      headphone: 'default',
    },
    latency: 128,
    sampleRate: 44100,
  },
  connectedDevices: [],
  isConfigModalOpen: false,
  activeHeadphoneDecks: new Set(),
};

function djReducer(state: DJState, action: DJAction): DJState {
  switch (action.type) {
    case 'SET_KEY_MAPPING':
      return {
        ...state,
        keyMappings: {
          ...state.keyMappings,
          [action.payload.key]: action.payload.buttonId,
        },
      };
    case 'CLEAR_KEY_MAPPING':
      const newMappings = { ...state.keyMappings };
      delete newMappings[action.payload];
      return {
        ...state,
        keyMappings: newMappings,
      };
    case 'UPDATE_AUDIO_CONFIG':
      return {
        ...state,
        audioConfig: {
          ...state.audioConfig,
          ...action.payload,
        },
      };
    case 'SET_CONNECTED_DEVICES':
      return {
        ...state,
        connectedDevices: action.payload,
      };
    case 'TOGGLE_CONFIG_MODAL':
      return {
        ...state,
        isConfigModalOpen: !state.isConfigModalOpen,
      };
    case 'TOGGLE_HEADPHONE_DECK':
      const newActiveDecks = new Set(state.activeHeadphoneDecks);
      if (newActiveDecks.has(action.payload)) {
        newActiveDecks.delete(action.payload);
      } else {
        newActiveDecks.add(action.payload);
      }
      return {
        ...state,
        activeHeadphoneDecks: newActiveDecks,
      };
    default:
      return state;
  }
}

const DJContext = createContext<{
  state: DJState;
  dispatch: React.Dispatch<DJAction>;
} | null>(null);

export const DJProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(djReducer, initialState);

  // Load audio devices on mount
  useEffect(() => {
    const loadDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => 
          device.kind === 'audioinput' || device.kind === 'audiooutput'
        );
        dispatch({ type: 'SET_CONNECTED_DEVICES', payload: audioDevices });
      } catch (error) {
        console.warn('Could not access audio devices:', error);
      }
    };

    loadDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, []);

  return (
    <DJContext.Provider value={{ state, dispatch }}>
      {children}
    </DJContext.Provider>
  );
};

export const useDJ = () => {
  const context = useContext(DJContext);
  if (!context) {
    throw new Error('useDJ must be used within a DJProvider');
  }
  return context;
};