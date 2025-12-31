import { useEffect, useCallback, useRef, useState } from 'react';
import { useDJ, AnalogMapping } from '@/contexts/DJContext';
import { useAudioEngine } from '@/hooks/useAudioEngine';

// MIDI message types
type MIDIMessageType = 'note' | 'cc' | 'program';

// Helper to create MIDI identifier
const createMIDIIdentifier = (type: MIDIMessageType, number: number, value?: number): string => {
  if (type === 'note') {
    return `midi:note:${number}`;
  } else if (type === 'cc') {
    return `midi:cc:${number}${value !== undefined ? `:${value}` : ''}`;
  } else {
    return `midi:program:${number}`;
  }
};

// Helper to parse MIDI identifier
const parseMIDIIdentifier = (identifier: string): { type: MIDIMessageType; number: number; value?: number } | null => {
  const parts = identifier.split(':');
  if (parts.length < 3 || parts[0] !== 'midi') return null;
  
  const type = parts[1] as MIDIMessageType;
  const number = parseInt(parts[2], 10);
  const value = parts[3] ? parseInt(parts[3], 10) : undefined;
  
  return { type, number, value };
};

export const useKeyMapping = () => {
  const { state, dispatch } = useDJ();
  const { updateVolume, updatePitch, scratch, setCrossfader } = useAudioEngine();
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

  // Handle analog control from MIDI CC
  const handleAnalogControl = useCallback((ccNumber: number, ccValue: number) => {
    const identifier = createMIDIIdentifier('cc', ccNumber);
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
        // Crossfader is stored as 0-1 in state, but setCrossfader expects -1 to +1
        const crossfaderValue = (targetValue - 0.5) * 2; // Convert 0-1 to -1 to +1
        setCrossfader(Math.max(-1, Math.min(1, crossfaderValue)));
        // Also update state (0-1 range)
        dispatch({ type: 'SET_CROSSFADER', payload: targetValue });
      } else if (controlId === 'deck1-pitch') {
        updatePitch(1, Math.max(-1, Math.min(1, targetValue)));
      } else if (controlId === 'deck2-pitch') {
        updatePitch(2, Math.max(-1, Math.min(1, targetValue)));
      }
    } else if (type === 'relative') {
      // Relative control for jog wheels
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
      }
      
      // Update previous value
      previousCCValuesRef.current[identifier] = ccValue;
    }
  }, [updateVolume, updatePitch, scratch, setCrossfader, dispatch]);

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

      // Handle Note On (0x90) and Note Off (0x80)
      if (command === 0x90 || command === 0x80) {
        const noteNumber = data1;
        const velocity = data2 || 0;
        
        // Only trigger on note on with velocity > 0
        if (command === 0x90 && velocity > 0) {
          const identifier = createMIDIIdentifier('note', noteNumber);
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
        const identifier = createMIDIIdentifier('cc', ccNumber);
        const analogMapping = analogMappingsRef.current[identifier];
        
        if (analogMapping) {
          // Handle as analog control
          handleAnalogControl(ccNumber, ccValue);
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
        }

        // Listen for new MIDI devices
        access.addEventListener('statechange', async (e) => {
          const port = e.port as WebMidi.MIDIInput;
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
      
      let identifier: string | null = null;

      // Handle Note On (0x90) and Note Off (0x80)
      if (command === 0x90 || command === 0x80) {
        const noteNumber = data1;
        const velocity = data2 || 0;
        
        // Only capture on note on with velocity > 0
        if (command === 0x90 && velocity > 0) {
          identifier = createMIDIIdentifier('note', noteNumber);
        }
      }
      // Handle Control Change (0xB0)
      else if (command === 0xb0) {
        const ccNumber = data1;
        const ccValue = data2 || 0;
        
        // Capture on button press (typically CC value > 64)
        if (ccValue > 64) {
          identifier = createMIDIIdentifier('cc', ccNumber);
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
        const port = e.port as WebMidi.MIDIInput;
        if (port.type === 'input' && port.state === 'connected') {
          midiInputsRef.current.set(port.id, port);
          await setupMIDIInput(port);
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
        const ccNumber = data1;
        const identifier = createMIDIIdentifier('cc', ccNumber);
        
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