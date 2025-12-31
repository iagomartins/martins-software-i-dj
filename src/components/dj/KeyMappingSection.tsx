import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKeyMapping } from "@/hooks/useKeyMapping";
import { Trash2, Plus, Keyboard, AlertCircle, CheckCircle2, Sliders } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AnalogMapping } from "@/contexts/DJContext";

const DJ_BUTTONS = [
  // Deck 1
  { id: 'deck1-play', label: 'Deck 1 - Play', category: 'Deck 1' },
  { id: 'deck1-cue', label: 'Deck 1 - Cue', category: 'Deck 1' },
  { id: 'deck1-sync', label: 'Deck 1 - Sync', category: 'Deck 1' },
  { id: 'deck1-phones', label: 'Deck 1 - Phones', category: 'Deck 1' },
  { id: 'deck1-load', label: 'Deck 1 - Load', category: 'Deck 1' },
  { id: 'deck1-fx1', label: 'Deck 1 - FX 1', category: 'Deck 1' },
  { id: 'deck1-fx2', label: 'Deck 1 - FX 2', category: 'Deck 1' },
  { id: 'deck1-fx3', label: 'Deck 1 - FX 3', category: 'Deck 1' },
  { id: 'deck1-fx4', label: 'Deck 1 - FX 4', category: 'Deck 1' },
  { id: 'deck1-pitch-plus', label: 'Deck 1 - Pitch +', category: 'Deck 1' },
  { id: 'deck1-pitch-minus', label: 'Deck 1 - Pitch -', category: 'Deck 1' },
  
  // Deck 2
  { id: 'deck2-play', label: 'Deck 2 - Play', category: 'Deck 2' },
  { id: 'deck2-cue', label: 'Deck 2 - Cue', category: 'Deck 2' },
  { id: 'deck2-sync', label: 'Deck 2 - Sync', category: 'Deck 2' },
  { id: 'deck2-phones', label: 'Deck 2 - Phones', category: 'Deck 2' },
  { id: 'deck2-load', label: 'Deck 2 - Load', category: 'Deck 2' },
  { id: 'deck2-fx1', label: 'Deck 2 - FX 1', category: 'Deck 2' },
  { id: 'deck2-fx2', label: 'Deck 2 - FX 2', category: 'Deck 2' },
  { id: 'deck2-fx3', label: 'Deck 2 - FX 3', category: 'Deck 2' },
  { id: 'deck2-fx4', label: 'Deck 2 - FX 4', category: 'Deck 2' },
  { id: 'deck2-pitch-plus', label: 'Deck 2 - Pitch +', category: 'Deck 2' },
  { id: 'deck2-pitch-minus', label: 'Deck 2 - Pitch -', category: 'Deck 2' },
];

const ANALOG_CONTROLS = [
  { id: 'deck1-volume', label: 'Deck 1 - Volume', type: 'absolute' as const, min: 0, max: 1, category: 'Deck 1' },
  { id: 'deck1-pitch', label: 'Deck 1 - Pitch', type: 'absolute' as const, min: -1, max: 1, category: 'Deck 1' },
  { id: 'deck1-jog', label: 'Deck 1 - Jog Wheel', type: 'relative' as const, min: 0, max: 0, category: 'Deck 1' },
  { id: 'deck2-volume', label: 'Deck 2 - Volume', type: 'absolute' as const, min: 0, max: 1, category: 'Deck 2' },
  { id: 'deck2-pitch', label: 'Deck 2 - Pitch', type: 'absolute' as const, min: -1, max: 1, category: 'Deck 2' },
  { id: 'deck2-jog', label: 'Deck 2 - Jog Wheel', type: 'relative' as const, min: 0, max: 0, category: 'Deck 2' },
  { id: 'crossfader', label: 'Crossfader', type: 'absolute' as const, min: 0, max: 1, category: 'Master' },
];

export const KeyMappingSection = () => {
  const { 
    startKeyMapping, 
    clearKeyMapping, 
    getKeyForButton,
    startAnalogMapping,
    clearAnalogMapping,
    getAnalogMapping,
    midiAvailable,
    midiPermissionError,
    requestMIDIPermission,
  } = useKeyMapping();
  const [mappingButton, setMappingButton] = useState<string | null>(null);
  const [mappingAnalogControl, setMappingAnalogControl] = useState<string | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const analogCleanupRef = useRef<(() => void) | null>(null);

  const handleStartMapping = (buttonId: string) => {
    // Clear any existing mapping session
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    setMappingButton(buttonId);
    
    // Start mapping with callback to clear state when done
    const cleanup = startKeyMapping(buttonId, () => {
      setMappingButton(null);
      cleanupRef.current = null;
    });
    
    cleanupRef.current = cleanup || null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (analogCleanupRef.current) {
        analogCleanupRef.current();
      }
    };
  }, []);

  const handleClearMapping = (buttonId: string) => {
    clearKeyMapping(buttonId);
  };

  const handleStartAnalogMapping = (controlId: string) => {
    // Clear any existing mapping session
    if (analogCleanupRef.current) {
      analogCleanupRef.current();
      analogCleanupRef.current = null;
    }

    const control = ANALOG_CONTROLS.find(c => c.id === controlId);
    if (!control) return;

    setMappingAnalogControl(controlId);
    
    const mapping: AnalogMapping = {
      controlId: control.id,
      type: control.type,
      min: control.min,
      max: control.max,
    };
    
    // Start mapping with callback to clear state when done
    const cleanup = startAnalogMapping(controlId, mapping, () => {
      setMappingAnalogControl(null);
      analogCleanupRef.current = null;
    });
    
    analogCleanupRef.current = cleanup || null;
  };

  const handleClearAnalogMapping = (controlId: string) => {
    clearAnalogMapping(controlId);
  };

  const groupedButtons = DJ_BUTTONS.reduce((acc, button) => {
    if (!acc[button.category]) {
      acc[button.category] = [];
    }
    acc[button.category].push(button);
    return acc;
  }, {} as Record<string, typeof DJ_BUTTONS>);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Keyboard className="w-5 h-5 text-neon-cyan" />
          <h2 className="text-xl font-bold">Mapeamento de Teclas</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure teclas do teclado ou controles USB/MIDI para cada função do DJ
        </p>
        
        {/* MIDI Permission Status */}
        {midiPermissionError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>MIDI Permission Required</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{midiPermissionError}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setIsRequestingPermission(true);
                  await requestMIDIPermission();
                  setIsRequestingPermission(false);
                }}
                disabled={isRequestingPermission}
                className="ml-4"
              >
                {isRequestingPermission ? 'Requesting...' : 'Request Permission'}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {midiAvailable && !midiPermissionError && (
          <Alert className="mt-4 border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-500">MIDI Ready</AlertTitle>
            <AlertDescription className="text-green-400">
              MIDI controllers are connected and ready to use
            </AlertDescription>
          </Alert>
        )}

        {mappingButton && (
          <div className="p-3 bg-neon-cyan/10 border border-neon-cyan/20 rounded-sm mt-4">
            <p className="text-sm font-medium text-neon-cyan">
              Pressione uma tecla ou botão MIDI para mapear "{DJ_BUTTONS.find(b => b.id === mappingButton)?.label}"
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pressione ESC para cancelar
            </p>
          </div>
        )}

        {mappingAnalogControl && (
          <div className="p-3 bg-neon-magenta/10 border border-neon-magenta/20 rounded-sm mt-4">
            <p className="text-sm font-medium text-neon-magenta">
              Mova um controle MIDI (fader/knob) para mapear "{ANALOG_CONTROLS.find(c => c.id === mappingAnalogControl)?.label}"
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Aguarde 10 segundos ou mapeie um controle para finalizar
            </p>
          </div>
        )}
      </div>

      {Object.entries(groupedButtons).map(([category, buttons]) => (
        <Card key={category} className="bg-dj-panel/30">
          <CardHeader>
            <CardTitle className="text-lg text-neon-cyan">{category}</CardTitle>
            <CardDescription>
              Configure as teclas para os controles do {category}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {buttons.map((button) => {
                const mappedKey = getKeyForButton(button.id);
                const isMapping = mappingButton === button.id;
                
                return (
                  <div
                    key={button.id}
                    className="flex items-center justify-between p-3 bg-dj-console/20 rounded-sm border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{button.label}</span>
                      {mappedKey && (
                        <Badge variant="secondary" className="bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30">
                          {mappedKey}
                        </Badge>
                      )}
                      {isMapping && (
                        <Badge variant="outline" className="animate-pulse border-neon-yellow text-neon-yellow">
                          Aguardando tecla...
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartMapping(button.id)}
                        disabled={isMapping}
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {mappedKey ? 'Remapear' : 'Mapear'}
                      </Button>
                      
                      {mappedKey && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClearMapping(button.id)}
                          className="text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Analog Controls Section */}
      <Card className="bg-dj-panel/30">
        <CardHeader>
          <CardTitle className="text-lg text-neon-magenta flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            Controles Analógicos
          </CardTitle>
          <CardDescription>
            Configure controles MIDI contínuos (faders, knobs, jog wheels)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {ANALOG_CONTROLS.map((control) => {
              const mappedCC = getAnalogMapping(control.id);
              const isMapping = mappingAnalogControl === control.id;
              
              return (
                <div
                  key={control.id}
                  className="flex items-center justify-between p-3 bg-dj-console/20 rounded-sm border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{control.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {control.type === 'absolute' ? 'Absoluto' : 'Relativo'}
                    </Badge>
                    {mappedCC && (
                      <Badge variant="secondary" className="bg-neon-magenta/20 text-neon-magenta border-neon-magenta/30">
                        {mappedCC}
                      </Badge>
                    )}
                    {isMapping && (
                      <Badge variant="outline" className="animate-pulse border-neon-yellow text-neon-yellow">
                        Aguardando controle...
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartAnalogMapping(control.id)}
                      disabled={isMapping}
                      className="text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {mappedCC ? 'Remapear' : 'Mapear'}
                    </Button>
                    
                    {mappedCC && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClearAnalogMapping(control.id)}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-muted-foreground">
        <p>Dica: Você pode mapear teclas do teclado ou botões de dispositivos USB/MIDI</p>
        <p className="mt-1">Controles analógicos (faders, knobs) devem ser mapeados usando MIDI CC</p>
      </div>
    </div>
  );
};