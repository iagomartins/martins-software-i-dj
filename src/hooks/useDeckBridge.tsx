// useDeckBridge.ts
import { useEffect, useMemo, useRef, useState } from 'react';

type StatusMsg = {
  type: 'status';
  deckId: string;
  loadedTrackId: string | null;
  posMs: number;
  durationMs: number;
  speed: number;
  touched: boolean;
  paused: boolean;
  slip: boolean;
  scratchSPR: number;
  bendMax: number;
  bpm: number;
};

type LoadedMsg = {
  type: 'loaded';
  deckId: string;
  info: { trackId: string; durationMs: number; sampleRate: number; channels: number; name: string };
};

type ErrorMsg = { type: 'error'; error: string };

type BridgeMsg = StatusMsg | LoadedMsg | ErrorMsg;

export function useDeckBridge(wsUrl: string, deckId: string = 'A') {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [lastLoaded, setLastLoaded] = useState<LoadedMsg['info'] | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  // Use refs to avoid stale closures in the WebSocket message handler
  const lastCommandRef = useRef<string | null>(null);
  const commandStatusRef = useRef<'idle' | 'pending' | 'success' | 'error'>('idle');

  // Keep refs in sync with state
  useEffect(() => {
    lastCommandRef.current = lastCommand;
  }, [lastCommand]);

  useEffect(() => {
    commandStatusRef.current = commandStatus;
  }, [commandStatus]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[Deck ${deckId}] WebSocket connected`);
      setConnected(true);
      
      // Don't request status - server sends it automatically on connection
      console.log(`[Deck ${deckId}] Waiting for server status...`);
    };
    
    ws.onclose = () => {
      console.log(`[Deck ${deckId}] WebSocket disconnected`);
      setConnected(false);
      setStatus(null); // Clear status when disconnected
    };
    
    ws.onerror = (error) => {
      console.error(`[Deck ${deckId}] WebSocket error:`, error);
      setConnected(false);
      setStatus(null); // Clear status on error
    };
    
    ws.onmessage = (ev) => {
      try {
        const msg: BridgeMsg = JSON.parse(ev.data);
        console.log(`[Deck ${deckId}] Received:`, msg);
        
        if (msg.type === 'status') {
          console.log(`[Deck ${deckId}] Setting status:`, msg);
          setStatus(msg);
          
          // Use refs to avoid stale closure issues
          if (lastCommandRef.current && commandStatusRef.current === 'pending') {
            console.log(`[Deck ${deckId}] Command completed, marking as success`);
            setCommandStatus('success');
            setTimeout(() => setCommandStatus('idle'), 1000); // Reset after 1 second
          }
        }
        if (msg.type === 'loaded') {
          console.log(`[Deck ${deckId}] Track loaded:`, msg.info);
          setLastLoaded(msg.info);
        }
        if (msg.type === 'error') {
          console.error(`[Deck ${deckId}] Bridge error:`, msg.error);
          setCommandStatus('error');
          setTimeout(() => setCommandStatus('idle'), 2000); // Reset after 2 seconds
        }
      } catch (error) {
        console.error(`[Deck ${deckId}] Failed to parse message:`, error);
      }
    };

    return () => { 
      ws.close(); 
      wsRef.current = null; 
    };
  }, [wsUrl, deckId]); // Remove lastCommand and commandStatus from dependencies

  const send = useMemo(() => {
    return (obj: unknown) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error(`[Deck ${deckId}] WebSocket not connected`);
        return false;
      }
      
      try {
        const message = JSON.stringify(obj);
        console.log(`[Deck ${deckId}] Sending:`, message);
        wsRef.current.send(message);
        return true;
      } catch (error) {
        console.error(`[Deck ${deckId}] Failed to send message:`, error);
        return false;
      }
    };
  }, [deckId]);

  const api = useMemo(() => ({
    connected,
    status,
    lastLoaded,
    lastCommand,
    commandStatus,
    deckId,
    
    // Remove requestStatus method - server sends status automatically
    
    // transport - REMOVE deckId from messages since server doesn't support it
    play: () => {
      const success = send({ type: 'play' }); // Remove deckId
      if (success) {
        setLastCommand('play');
        setCommandStatus('pending');
      }
      return success;
    },
    
    pause: () => {
      const success = send({ type: 'pause' }); // Remove deckId
      if (success) {
        setLastCommand('pause');
        setCommandStatus('pending');
      }
      return success;
    },
    
    seekMs: (ms: number) => {
      const success = send({ type: 'seekMs', ms }); // Remove deckId
      if (success) {
        setLastCommand('seek');
        setCommandStatus('pending');
      }
      return success;
    },
    
    // jog - REMOVE deckId from messages
    touchDown: () => send({ type: 'touch', down: true }), // Remove deckId
    touchUp: () => send({ type: 'touch', down: false }), // Remove deckId
    rotateTop: (angleDeltaDeg: number, dtSec: number) => send({ type: 'rotateTop', angleDeltaDeg, dtSec }), // Remove deckId
    nudgeEdge: (angleDeltaDeg: number, dtSec: number) => send({ type: 'nudgeEdge', angleDeltaDeg, dtSec }), // Remove deckId
    
    // config - REMOVE deckId from messages
    setConfig: (patch: Partial<{ scratchSamplesPerRevolution: number; slipEnabled: boolean; bendMax: number }>) =>
      send({ type: 'setConfig', patch }), // Remove deckId
    
    // track - REMOVE deckId from messages
    loadTrack: (trackId: string) => send({ type: 'loadTrack', trackId }), // Remove deckId
    unload: () => send({ type: 'unload' }), // Remove deckId
    
    // uploadTrack remains the same
    uploadTrack: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:4000/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      return result.trackId;
    },
  }), [connected, status, lastLoaded, lastCommand, commandStatus, deckId, send]);

  return api;
}
