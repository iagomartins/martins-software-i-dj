import { useEffect, useCallback } from 'react';
import { useDJ } from '@/contexts/DJContext';

export const useKeyMapping = () => {
  const { state, dispatch } = useDJ();

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    const keyCode = event.code;
    const buttonId = state.keyMappings[keyCode];
    
    if (buttonId) {
      event.preventDefault();
      // Simulate button click
      const button = document.getElementById(buttonId);
      if (button) {
        button.click();
      }
    }
  }, [state.keyMappings]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const startKeyMapping = useCallback((buttonId: string) => {
    const handleKeyCapture = (event: KeyboardEvent) => {
      event.preventDefault();
      const keyCode = event.code;
      
      // Don't map escape key
      if (keyCode === 'Escape') {
        document.removeEventListener('keydown', handleKeyCapture);
        return;
      }
      
      dispatch({ 
        type: 'SET_KEY_MAPPING', 
        payload: { key: keyCode, buttonId } 
      });
      
      document.removeEventListener('keydown', handleKeyCapture);
    };

    document.addEventListener('keydown', handleKeyCapture);
    
    // Cleanup after 10 seconds
    setTimeout(() => {
      document.removeEventListener('keydown', handleKeyCapture);
    }, 10000);
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
      // Convert key code to readable format
      return keyCode.replace('Key', '').replace('Digit', '');
    }
    
    return null;
  }, [state.keyMappings]);

  return {
    startKeyMapping,
    clearKeyMapping,
    getKeyForButton,
    keyMappings: state.keyMappings,
  };
};