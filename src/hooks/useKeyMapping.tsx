import { useEffect, useCallback, useRef, useState } from 'react';
import { useDJ, AnalogMapping } from '@/contexts/DJContext';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { findPresetForDevice } from '@/services/ControllerPresetService';

// MIDI message types
type MIDIMessageType = 'note' | 'cc' | 'program';

// Helper to create MIDI identifier (channel-aware)
const createMIDIIdentifier = (type: MIDIMessageType, channel: number, number: number, value?: number): string => {
  if (type === 'note') {
    return `midi:note:${channel}:${number}`;
  } else if (type === 'cc') {
    return `midi:cc:${channel}:${number}${value !== undefined ? `:${value}` : ''}`;
  } else {
    return `midi:program:${channel}:${number}`;
  }
};

// Helper to parse MIDI identifier
const parseMIDIIdentifier = (identifier: string): { type: MIDIMessageType; channel: number; number: number; value?: number } | null => {
  const parts = identifier.split(':');
  if (parts.length < 4 || parts[0] !== 'midi') return null;

  const type = parts[1] as MIDIMessageType;
  const channel = parseInt(parts[2], 10);
  const number = parseInt(parts[3], 10);
  const value = parts[4] ? parseInt(parts[4], 10) : undefined;

  return { type, channel, number, value };
};

export const useKeyMapping = () => {
  const { state, dispatch } = useDJ();
  const { updateVolume, updatePitch, updateEQ, updateFilter, scratch, setCrossfader, setMasterVolume, setHeadphoneVolume, setBrowsePosition } = useAudioEngine();
  const isCapturingRef = useRef(false);
  const midiAccessRef = useRef<WebMidi.MIDIAccess | null>(null);
  const midiInputsRef = useRef<Map<string, WebMidi.MIDIInput>>(new Map());
  const [midiAvailable, setMidiAvailable] = useState(false);
  const [midiPermissionError, setMidiPermissionError] = useState<string | null>(null);
  
  // Track previous CC values for relative controls (jog wheels)
  const previousCCValuesRef = useRef<Record<string, number>>({});

  // Helper function to trigger button actions
  const triggerButton = useCallback((buttonId: string) => {
    const button = document.getElementById(buttonId) as HTMLElement;
    if (!button) {
      console.warn(`Button not found: ${buttonId}`);
      return;
    }

    // Check if button has React event handlers by looking at data attributes or trying to trigger events
    // For buttons with onMouseDown/onMouseUp (like CUE), we need to simulate both
    const isCueButton = buttonId.includes('-cue');
    
    if (isCueButton) {
      // Simulate mousedown and mouseup for CUE buttons
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1,
      });
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 0,
      });
      
      button.dispatchEvent(mouseDownEvent);
      // Small delay to simulate a press
      setTimeout(() => {
        button.dispatchEvent(mouseUpEvent);
      }, 100);
    } else {
      // For other buttons, use click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1,
      });
      button.dispatchEvent(clickEvent);
    }
  }, []);

  // Use a ref to always have the latest keyMappings, analogMappings and triggerButton
  const keyMappingsRef = useRef(state.keyMappings);
  const analogMappingsRef = useRef(state.analogMappings);
  const triggerButtonRef = useRef(triggerButton);

  // Update refs when they change
  useEffect(() => {
    keyMappingsRef.current = state.keyMappings;
  }, [state.keyMappings]);

  useEffect(() => {
    analogMappingsRef.current = state.analogMappings;
  }, [state.analogMappings]);

  useEffect(() => {
    triggerButtonRef.current = triggerButton;
  }, [triggerButton]);

  // Apply a controller preset if no preset is currently selected and no custom mappings exist
  const maybeApplyPreset = useCallback((deviceName: string) => {
    if (state.selectedControllerPreset) return;
    if (Object.keys(state.keyMappings).length > 0 || Object.keys(state.analogMappings).length > 0) {
      // User has saved custom mappings; do not overwrite them.
      return;
    }
    const preset = findPresetForDevice(deviceName);
    if (!preset) return;

    console.log(`🎛️ Applying controller preset: ${preset.name}`);
    dispatch({ type: 'SELECT_CONTROLLER_PRESET', payload: preset.name });
    Object.entries(preset.keyMappings).forEach(([key, buttonId]) => {
      dispatch({ type: 'SET_KEY_MAPPING', payload: { key, buttonId } });
    });
    Object.entries(preset.analogMappings).forEach(([key, mapping]) => {
      dispatch({ type: 'SET_ANALOG_MAPPING', payload: { key, mapping } });
    });
  }, [state.selectedControllerPreset, state.keyMappings, state.analogMappings, dispatch]);

  // Handle analog control from MIDI CC
  const handleAnalogControl = useCallback((channel: number, ccNumber: number, ccValue: number) => {
    const identifier = createMIDIIdentifier('cc', channel, ccNumber);
    const mapping = analogMappingsRef.current[identifier];
    
    if (!mapping) {
      return; // No analog mapping for this CC
    }

    const { controlId, type, min, max, inverted } = mapping;

    if (type === 'absolute') {
      // Convert MIDI CC 0-127 to target range
      let normalizedValue = ccValue / 127; // 0 to 1
      if (inverted) {
        normalizedValue = 1 - normalizedValue;
      }
      const targetValue = min + normalizedValue * (max - min);

      // Apply to appropriate control
      if (controlId === 'deck1-volume') {
        updateVolume(1, Math.max(0, Math.min(1, targetValue)));
      } else if (controlId === 'deck2-volume') {
        updateVolume(2, Math.max(0, Math.min(1, targetValue)));
      } else if (controlId === 'crossfader') {
        const normValue = Math.max(0, Math.min(1, targetValue));
        setCrossfader(normValue);
        // Also update state (0-1 range)
        dispatch({ type: 'SET_CROSSFADER', payload: normValue });
      } else if (controlId === 'deck1-pitch') {
        updatePitch(1, Math.max(-1, Math.min(1, targetValue)));
      } else if (controlId === 'deck2-pitch') {
        updatePitch(2, Math.max(-1, Math.min(1, targetValue)));
      } else if (controlId === 'deck1-eq-high') {
        updateEQ(1, { low: state.deck1.lowEQ, mid: state.deck1.midEQ, high: targetValue });
        dispatch({ type: 'SET_DECK_1_STATE', payload: { highEQ: targetValue } });
      } else if (controlId === 'deck1-eq-mid') {
        updateEQ(1, { low: state.deck1.lowEQ, mid: targetValue, high: state.deck1.highEQ });
        dispatch({ type: 'SET_DECK_1_STATE', payload: { midEQ: targetValue } });
      } else if (controlId === 'deck1-eq-low') {
        updateEQ(1, { low: targetValue, mid: state.deck1.midEQ, high: state.deck1.highEQ });
        dispatch({ type: 'SET_DECK_1_STATE', payload: { lowEQ: targetValue } });
      } else if (controlId === 'deck2-eq-high') {
        updateEQ(2, { low: state.deck2.lowEQ, mid: state.deck2.midEQ, high: targetValue });
        dispatch({ type: 'SET_DECK_2_STATE', payload: { highEQ: targetValue } });
      } else if (controlId === 'deck2-eq-mid') {
        updateEQ(2, { low: state.deck2.lowEQ, mid: targetValue, high: state.deck2.highEQ });
        dispatch({ type: 'SET_DECK_2_STATE', payload: { midEQ: targetValue } });
      } else if (controlId === 'deck2-eq-low') {
        updateEQ(2, { low: targetValue, mid: state.deck2.midEQ, high: state.deck2.highEQ });
        dispatch({ type: 'SET_DECK_2_STATE', payload: { lowEQ: targetValue } });
      } else if (controlId === 'deck1-filter') {
        updateFilter(1, targetValue);
        dispatch({ type: 'SET_DECK_FILTER', payload: { deck: 1, value: targetValue } });
      } else if (controlId === 'deck2-filter') {
        updateFilter(2, targetValue);
        dispatch({ type: 'SET_DECK_FILTER', payload: { deck: 2, value: targetValue } });
      } else if (controlId === 'master-volume') {
        setMasterVolume(Math.max(0, Math.min(1, targetValue)));
      } else if (controlId === 'headphones-volume') {
        setHeadphoneVolume(Math.max(0, Math.min(1, targetValue)));
        dispatch({ type: 'SET_HEADPHONE_VOLUME', payload: targetValue });
      }
    } else if (type === 'relative') {
      // Relative control for jog wheels and encoders
      const previousValue = previousCCValuesRef.current[identifier] ?? 64; // Default to center
      let delta = ccValue - previousValue;
      
      // Handle wrap-around (127 -> 0 or 0 -> 127)
      if (delta > 64) delta -= 127;
      if (delta < -64) delta += 127;
      
      // Convert delta to radians (sensitivity adjustment)
      const sensitivity = 0.1; // Adjust this for jog wheel sensitivity
      const deltaRadians = (delta / 127) * Math.PI * sensitivity;
      
      // Apply to appropriate deck
      if (controlId === 'deck1-jog') {
        scratch(1, deltaRadians);
      } else if (controlId === 'deck2-jog') {
        scratch(2, deltaRadians);
      } else if (controlId === 'browse-encoder') {
        setBrowsePosition(delta);
      }
      
      // Update previous value
      previousCCValuesRef.current[identifier] = ccValue;
    }
  }, [updateVolume, updatePitch, updateEQ, updateFilter, scratch, setCrossfader, setMasterVolume, setHeadphoneVolume, setBrowsePosition, dispatch, state.deck1, state.deck2]);

  // Set up MIDI input handler
  const setupMIDIInput = useCallback(async (input: WebMidi.MIDIInput) => {
    // Ensure the port is open
    try {
      if (input.connection === 'closed') {
        await input.open();
        console.log(`✅ Opened MIDI input: ${input.name} (${input.id})`);
      }
    } catch (error) {
      console.error(`❌ Failed to open MIDI input ${input.name}:`, error);
      return;
    }

    input.onmidimessage = (event: WebMidi.MIDIMessageEvent) => {
      // Skip if we're in capture mode (handled separately)
      if (isCapturingRef.current) {
        return;
      }

      const [status, data1, data2] = event.data;
      const command = status & 0xf0;
      const channel = status & 0x0f;

      // Handle Note On (0x90) and Note Off (0x80)
      if (command === 0x90 || command === 0x80) {
        const noteNumber = data1;
        const velocity = data2 || 0;
        
        // Only trigger on note on with velocity > 0
        if (command === 0x90 && velocity > 0) {
          const identifier = createMIDIIdentifier('note', channel, noteNumber);
          const buttonId = keyMappingsRef.current[identifier];
          
          if (buttonId) {
            triggerButtonRef.current(buttonId);
          }
        }
      }
      // Handle Control Change (0xB0)
      else if (command === 0xb0) {
        const ccNumber = data1;
        const ccValue = data2 || 0;
        
        // Check for analog mapping first
        const identifier = createMIDIIdentifier('cc', channel, ccNumber);
        const analogMapping = analogMappingsRef.current[identifier];
        
        if (analogMapping) {
          // Handle as analog control
          handleAnalogControl(channel, ccNumber, ccValue);
        } else {
          // Check for button mapping (threshold-based)
          if (ccValue > 64) {
            const buttonId = keyMappingsRef.current[identifier];
            
            if (buttonId) {
              triggerButtonRef.current(buttonId);
            }
          }
        }
      }
    };
  }, []);

  // Initialize MIDI
  useEffect(() => {
    const initMIDI = async () => {
      if (!navigator.requestMIDIAccess) {
        console.warn('⚠️ Web MIDI API not supported');
        setMidiPermissionError('Web MIDI API not supported in this browser');
        return;
      }

      try {
        console.log('🔍 Requesting MIDI access...');
        const access = await navigator.requestMIDIAccess({ sysex: false });
        midiAccessRef.current = access;
        setMidiAvailable(true);
        setMidiPermissionError(null);

        console.log(`✅ MIDI access granted. Inputs: ${access.inputs.size}, Outputs: ${access.outputs.size}`);

        // Log all available inputs
        if (access.inputs.size === 0) {
          console.warn('⚠️ No MIDI input devices found');
        } else {
          console.log('📥 Available MIDI inputs:');
          access.inputs.forEach((input, key) => {
            console.log(`  - ${input.name} (${input.id}) - State: ${input.state}, Connection: ${input.connection}`);
          });
        }

        // Set up existing inputs
        for (const [id, input] of access.inputs) {
          midiInputsRef.current.set(id, input);
          await setupMIDIInput(input);
          // Apply default controller preset if this is a known device and no preset is active
          maybeApplyPreset(input.name);
        }

        // Listen for new MIDI devices
        access.addEventListener('statechange', async (e) => {
          const event = e as WebMidi.MIDIConnectionEvent;
          const port = event.port as WebMidi.MIDIInput;
          console.log(`🔄 MIDI port state changed: ${port.name} (${port.type}) - ${port.state}`);
          
          if (port.type === 'input' && port.state === 'connected') {
            midiInputsRef.current.set(port.id, port);
            await setupMIDIInput(port);
            console.log(`✅ MIDI input connected: ${port.name}`);
          } else if (port.type === 'input' && port.state === 'disconnected') {
            midiInputsRef.current.delete(port.id);
            console.log(`❌ MIDI input disconnected: ${port.name}`);
          }
        });

        console.log('✅ MIDI initialization complete');
      } catch (error: any) {
        console.error('❌ Failed to initialize MIDI:', error);
        
        if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
          setMidiPermissionError('MIDI permission denied. Please allow MIDI access in your browser settings.');
        } else if (error.name === 'NotSupportedError') {
          setMidiPermissionError('MIDI is not supported in this environment.');
        } else {
          setMidiPermissionError(`MIDI error: ${error.message || 'Unknown error'}`);
        }
        setMidiAvailable(false);
      }
    };

    initMIDI();

    return () => {
      // Cleanup MIDI inputs
      midiInputsRef.current.forEach((input) => {
        input.onmidimessage = null;
        if (input.connection === 'open') {
          input.close().catch(console.error);
        }
      });
      midiInputsRef.current.clear();
    };
  }, [setupMIDIInput]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Skip if we're in capture mode
    if (isCapturingRef.current) {
      return;
    }

    const keyCode = event.code;
    // Use ref to get latest mappings
    const buttonId = keyMappingsRef.current[keyCode];
    
    if (buttonId) {
      event.preventDefault();
      event.stopPropagation();
      console.log(`Triggering button ${buttonId} for key ${keyCode}`);
      triggerButtonRef.current(buttonId);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const startKeyMapping = useCallback((buttonId: string, onComplete?: () => void) => {
    // Set capture mode flag
    isCapturingRef.current = true;

    const handleKeyCapture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const keyCode = event.code;
      
      // Don't map escape key
      if (keyCode === 'Escape') {
        isCapturingRef.current = false;
        document.removeEventListener('keydown', handleKeyCapture);
        if (onComplete) {
          onComplete();
        }
        return;
      }
      
      dispatch({ 
        type: 'SET_KEY_MAPPING', 
        payload: { key: keyCode, buttonId } 
      });
      
      // Clear capture mode
      isCapturingRef.current = false;
      document.removeEventListener('keydown', handleKeyCapture);
      
      // Notify completion
      if (onComplete) {
        onComplete();
      }
    };

    // MIDI capture handler
    const handleMIDICapture = (event: WebMidi.MIDIMessageEvent) => {
      const [status, data1, data2] = event.data;
      const command = status & 0xf0;
      const channel = status & 0x0f;
      
      let identifier: string | null = null;

      // Handle Note On (0x90) and Note Off (0x80)
      if (command === 0x90 || command === 0x80) {
        const noteNumber = data1;
        const velocity = data2 || 0;
        
        // Only capture on note on with velocity > 0
        if (command === 0x90 && velocity > 0) {
          identifier = createMIDIIdentifier('note', channel, noteNumber);
        }
      }
      // Handle Control Change (0xB0)
      else if (command === 0xb0) {
        const ccNumber = data1;
        const ccValue = data2 || 0;
        
        // Capture on button press (typically CC value > 64)
        if (ccValue > 64) {
          identifier = createMIDIIdentifier('cc', channel, ccNumber);
        }
      }

      if (identifier) {
        dispatch({ 
          type: 'SET_KEY_MAPPING', 
          payload: { key: identifier, buttonId } 
        });
        
        // Clear capture mode
        isCapturingRef.current = false;
        removeMIDICaptureHandlers();
        
        // Notify completion
        if (onComplete) {
          onComplete();
        }
      }
    };

    // Set up MIDI capture on all inputs
    const setupMIDICapture = () => {
      midiInputsRef.current.forEach((input) => {
        const originalHandler = input.onmidimessage;
        input.onmidimessage = handleMIDICapture;
        // Store original handler for cleanup
        (input as any)._originalHandler = originalHandler;
      });
    };

    const removeMIDICaptureHandlers = () => {
      midiInputsRef.current.forEach((input) => {
        const originalHandler = (input as any)._originalHandler;
        if (originalHandler) {
          input.onmidimessage = originalHandler;
          delete (input as any)._originalHandler;
        } else {
          input.onmidimessage = null;
        }
      });
    };

    document.addEventListener('keydown', handleKeyCapture, true); // Use capture phase
    setupMIDICapture();
    
    // Cleanup after 10 seconds
    const timeoutId = setTimeout(() => {
      isCapturingRef.current = false;
      document.removeEventListener('keydown', handleKeyCapture, true);
      removeMIDICaptureHandlers();
      if (onComplete) {
        onComplete();
      }
    }, 10000);

    // Return cleanup function
    return () => {
      clearTimeout(timeoutId);
      isCapturingRef.current = false;
      document.removeEventListener('keydown', handleKeyCapture, true);
      removeMIDICaptureHandlers();
    };
  }, [dispatch]);

  const clearKeyMapping = useCallback((buttonId: string) => {
    // Find and remove the key mapping for this button
    const keyToRemove = Object.keys(state.keyMappings).find(
      key => state.keyMappings[key] === buttonId
    );
    
    if (keyToRemove) {
      dispatch({ type: 'CLEAR_KEY_MAPPING', payload: keyToRemove });
    }
  }, [state.keyMappings, dispatch]);

  const getKeyForButton = useCallback((buttonId: string) => {
    const keyCode = Object.keys(state.keyMappings).find(
      key => state.keyMappings[key] === buttonId
    );
    
    if (keyCode) {
      // Check if it's a MIDI identifier
      if (keyCode.startsWith('midi:')) {
        const parsed = parseMIDIIdentifier(keyCode);
        if (parsed) {
          if (parsed.type === 'note') {
            // Convert MIDI note number to note name (C4 = 60)
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = Math.floor(parsed.number / 12) - 1;
            const noteName = noteNames[parsed.number % 12];
            return `MIDI ${noteName}${octave}`;
          } else if (parsed.type === 'cc') {
            return `MIDI CC${parsed.number}`;
          } else {
            return `MIDI Program ${parsed.number}`;
          }
        }
        return keyCode;
      }
      
      // Convert key code to readable format
      return keyCode.replace('Key', '').replace('Digit', '');
    }
    
    return null;
  }, [state.keyMappings]);

  // Manual MIDI permission request function
  const requestMIDIPermission = useCallback(async () => {
    if (!navigator.requestMIDIAccess) {
      setMidiPermissionError('Web MIDI API not supported');
      return false;
    }

    try {
      setMidiPermissionError(null);
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      setMidiAvailable(true);

      // Set up existing inputs
      for (const [id, input] of access.inputs) {
        midiInputsRef.current.set(id, input);
        await setupMIDIInput(input);
      }

      // Listen for new MIDI devices
      access.addEventListener('statechange', async (e) => {
        const event = e as WebMidi.MIDIConnectionEvent;
        const port = event.port as WebMidi.MIDIInput;
        if (port.type === 'input' && port.state === 'connected') {
          midiInputsRef.current.set(port.id, port);
          await setupMIDIInput(port);
          // Apply default controller preset if this is a known device and no preset is active
          maybeApplyPreset(port.name);
        } else if (port.type === 'input' && port.state === 'disconnected') {
          midiInputsRef.current.delete(port.id);
        }
      });

      return true;
    } catch (error: any) {
      console.error('Failed to request MIDI permission:', error);
      if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        setMidiPermissionError('MIDI permission denied. Please allow MIDI access.');
      } else {
        setMidiPermissionError(`MIDI error: ${error.message || 'Unknown error'}`);
      }
      return false;
    }
  }, [setupMIDIInput]);

  // Start analog mapping
  const startAnalogMapping = useCallback((controlId: string, mapping: AnalogMapping, onComplete?: () => void) => {
    // Set capture mode flag
    isCapturingRef.current = true;

    const handleMIDICapture = (event: WebMidi.MIDIMessageEvent) => {
      const [status, data1, data2] = event.data;
      const command = status & 0xf0;
      
      // Only capture CC messages for analog controls
      if (command === 0xb0) {
        const channel = status & 0x0f;
        const ccNumber = data1;
        const identifier = createMIDIIdentifier('cc', channel, ccNumber);
        
        dispatch({ 
          type: 'SET_ANALOG_MAPPING', 
          payload: { key: identifier, mapping } 
        });
        
        // Clear capture mode
        isCapturingRef.current = false;
        removeMIDICaptureHandlers();
        
        // Notify completion
        if (onComplete) {
          onComplete();
        }
      }
    };

    // Set up MIDI capture on all inputs
    const setupMIDICapture = () => {
      midiInputsRef.current.forEach((input) => {
        const originalHandler = input.onmidimessage;
        input.onmidimessage = handleMIDICapture;
        // Store original handler for cleanup
        (input as any)._originalHandler = originalHandler;
      });
    };

    const removeMIDICaptureHandlers = () => {
      midiInputsRef.current.forEach((input) => {
        const originalHandler = (input as any)._originalHandler;
        if (originalHandler) {
          input.onmidimessage = originalHandler;
          delete (input as any)._originalHandler;
        } else {
          input.onmidimessage = null;
        }
      });
    };

    setupMIDICapture();
    
    // Cleanup after 10 seconds
    const timeoutId = setTimeout(() => {
      isCapturingRef.current = false;
      removeMIDICaptureHandlers();
      if (onComplete) {
        onComplete();
      }
    }, 10000);

    // Return cleanup function
    return () => {
      clearTimeout(timeoutId);
      isCapturingRef.current = false;
      removeMIDICaptureHandlers();
    };
  }, [dispatch]);

  // Clear analog mapping
  const clearAnalogMapping = useCallback((controlId: string) => {
    // Find and remove the analog mapping for this control
    const keyToRemove = Object.keys(state.analogMappings).find(
      key => state.analogMappings[key].controlId === controlId
    );
    
    if (keyToRemove) {
      dispatch({ type: 'CLEAR_ANALOG_MAPPING', payload: keyToRemove });
    }
  }, [state.analogMappings, dispatch]);

  // Get analog mapping for control
  const getAnalogMapping = useCallback((controlId: string) => {
    const mappingEntry = Object.entries(state.analogMappings).find(
      ([_, mapping]) => mapping.controlId === controlId
    );
    
    if (mappingEntry) {
      const [key] = mappingEntry;
      // Parse MIDI identifier to get CC number
      if (key.startsWith('midi:cc:')) {
        const ccNumber = parseInt(key.split(':')[2], 10);
        return `MIDI CC${ccNumber}`;
      }
      return key;
    }
    
    return null;
  }, [state.analogMappings]);

  return {
    startKeyMapping,
    clearKeyMapping,
    getKeyForButton,
    startAnalogMapping,
    clearAnalogMapping,
    getAnalogMapping,
    keyMappings: state.keyMappings,
    midiAvailable,
    midiPermissionError,
    requestMIDIPermission,
  };
};