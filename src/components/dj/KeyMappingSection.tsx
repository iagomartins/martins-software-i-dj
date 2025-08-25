import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKeyMapping } from "@/hooks/useKeyMapping";
import { Trash2, Plus, Keyboard } from "lucide-react";

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

export const KeyMappingSection = () => {
  const { startKeyMapping, clearKeyMapping, getKeyForButton } = useKeyMapping();
  const [mappingButton, setMappingButton] = useState<string | null>(null);

  const handleStartMapping = (buttonId: string) => {
    setMappingButton(buttonId);
    startKeyMapping(buttonId);
    
    // Auto-clear mapping state after timeout
    setTimeout(() => {
      setMappingButton(null);
    }, 10000);
  };

  const handleClearMapping = (buttonId: string) => {
    clearKeyMapping(buttonId);
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
          Configure teclas do teclado ou controles USB para cada função do DJ
        </p>
        {mappingButton && (
          <div className="p-3 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg">
            <p className="text-sm font-medium text-neon-cyan">
              Pressione uma tecla para mapear "{DJ_BUTTONS.find(b => b.id === mappingButton)?.label}"
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pressione ESC para cancelar
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
                    className="flex items-center justify-between p-3 bg-dj-console/20 rounded-lg border border-border/50"
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
      
      <div className="text-center text-sm text-muted-foreground">
        <p>Dica: Você pode mapear teclas do teclado ou botões de dispositivos USB/MIDI</p>
      </div>
    </div>
  );
};