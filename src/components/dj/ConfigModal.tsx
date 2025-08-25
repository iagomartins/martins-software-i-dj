import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDJ } from "@/contexts/DJContext";
import { KeyMappingSection } from "./KeyMappingSection";
import { Settings, Volume2, Headphones, Mic, Speaker } from "lucide-react";

export const ConfigModal = () => {
  const { state, dispatch } = useDJ();

  const handleAudioConfigChange = (key: string, value: any) => {
    dispatch({
      type: 'UPDATE_AUDIO_CONFIG',
      payload: { [key]: value },
    });
  };

  const audioInputDevices = state.connectedDevices.filter(
    device => device.kind === 'audioinput'
  );
  
  const audioOutputDevices = state.connectedDevices.filter(
    device => device.kind === 'audiooutput'
  );

  return (
    <Dialog 
      open={state.isConfigModalOpen} 
      onOpenChange={() => dispatch({ type: 'TOGGLE_CONFIG_MODAL' })}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações do DJ
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="audio" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Áudio
            </TabsTrigger>
            <TabsTrigger value="keymapping" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Mapeamento de Teclas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audio" className="space-y-6 mt-6">
            {/* Master Output Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Speaker className="w-4 h-4 text-neon-cyan" />
                <h3 className="text-lg font-semibold">Saída Master</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="master-output">Dispositivo Master</Label>
                  <Select
                    value={state.audioConfig.masterOutput}
                    onValueChange={(value) => handleAudioConfigChange('masterOutput', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar dispositivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão do Sistema</SelectItem>
                      {audioOutputDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headphone-output">Dispositivo Headphone</Label>
                  <Select
                    value={state.audioConfig.headphoneOutput}
                    onValueChange={(value) => handleAudioConfigChange('headphoneOutput', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar dispositivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão do Sistema</SelectItem>
                      {audioOutputDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Input Channels */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-neon-magenta" />
                <h3 className="text-lg font-semibold">Canais de Entrada</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deck1-input">Entrada Deck 1</Label>
                  <Select
                    value={state.audioConfig.inputChannels.deck1}
                    onValueChange={(value) => 
                      handleAudioConfigChange('inputChannels', {
                        ...state.audioConfig.inputChannels,
                        deck1: value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar entrada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão do Sistema</SelectItem>
                      {audioInputDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deck2-input">Entrada Deck 2</Label>
                  <Select
                    value={state.audioConfig.inputChannels.deck2}
                    onValueChange={(value) => 
                      handleAudioConfigChange('inputChannels', {
                        ...state.audioConfig.inputChannels,
                        deck2: value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar entrada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão do Sistema</SelectItem>
                      {audioInputDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Audio Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-neon-yellow" />
                <h3 className="text-lg font-semibold">Configurações de Áudio</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Latência: {state.audioConfig.latency}ms</Label>
                  <Slider
                    value={[state.audioConfig.latency]}
                    onValueChange={([value]) => handleAudioConfigChange('latency', value)}
                    min={64}
                    max={512}
                    step={64}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>64ms (Baixa)</span>
                    <span>512ms (Alta)</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Sample Rate</Label>
                  <Select
                    value={state.audioConfig.sampleRate.toString()}
                    onValueChange={(value) => handleAudioConfigChange('sampleRate', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="44100">44.1 kHz</SelectItem>
                      <SelectItem value="48000">48 kHz</SelectItem>
                      <SelectItem value="96000">96 kHz</SelectItem>
                      <SelectItem value="192000">192 kHz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  // Reset to defaults
                  dispatch({
                    type: 'UPDATE_AUDIO_CONFIG',
                    payload: {
                      masterOutput: 'default',
                      headphoneOutput: 'default',
                      inputChannels: { deck1: 'default', deck2: 'default' },
                      latency: 128,
                      sampleRate: 44100,
                    }
                  });
                }}
              >
                Restaurar Padrões
              </Button>
              <Button onClick={() => dispatch({ type: 'TOGGLE_CONFIG_MODAL' })}>
                Salvar Configurações
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="keymapping" className="mt-6">
            <KeyMappingSection />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};