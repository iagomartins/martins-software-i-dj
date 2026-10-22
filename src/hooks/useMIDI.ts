/**
 * useMIDI - Custom React Hook for MIDI Controller Integration
 * Location: src/hooks/useMIDI.ts
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDJ } from '@/contexts/DJContext';
import { MidiService } from '@/services/MidiService';
import { MidiRouter } from '@/services/MidiRouter';
import { MidiDeviceState, RawMidiEvent } from '@/types/midi';

export const useMIDI = () => {
  const { state, dispatch } = useDJ();
  const [devices, setDevices] = useState<MidiDeviceState[]>([]);
  const [isMidiAvailable, setIsMidiAvailable] = useState(false);
  const [lastEvent, setLastEvent] = useState<RawMidiEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const midiServiceRef = useRef<MidiService>(MidiService.getInstance());
  const midiRouterRef = useRef<MidiRouter>(new MidiRouter());

  // Ref to always hold latest state without re-creating subscriptions
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Keep router dependencies in sync
  useEffect(() => {
    midiRouterRef.current.setDependencies({
      getState: () => stateRef.current,
      dispatch,
    });
  }, [dispatch]);

  const initMidi = useCallback(async () => {
    const service = midiServiceRef.current;
    const ok = await service.initialize();

    if (ok) {
      setIsMidiAvailable(true);
      setErrorMessage(null);
      setDevices(service.getConnectedDevices());
      console.log('🎹 [useMIDI] MIDI Controller system ready!');
    } else {
      setIsMidiAvailable(false);
      setErrorMessage(service.getLastError());
    }
  }, []);

  useEffect(() => {
    const service = midiServiceRef.current;
    const router = midiRouterRef.current;

    // Connect router to service message stream
    const unsubscribeMessages = service.onMessage((event: RawMidiEvent) => {
      setLastEvent(event);
      router.route(event);
    });

    // Track device state changes
    const unsubscribeState = service.onStateChange((devList: MidiDeviceState[]) => {
      setDevices(devList);
      setIsMidiAvailable(devList.length > 0 && devList.some(d => d.state === 'connected'));
    });

    // Trigger initialization
    initMidi();

    return () => {
      unsubscribeMessages();
      unsubscribeState();
    };
  }, [initMidi]);

  return {
    devices,
    isMidiAvailable,
    lastEvent,
    errorMessage,
    reconnect: initMidi,
  };
};
