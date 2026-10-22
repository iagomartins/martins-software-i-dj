import { DJInterface } from "@/components/dj/DJInterface";
import { useKeyMapping } from "@/hooks/useKeyMapping";
import { useMIDI } from "@/hooks/useMIDI";

const Index = () => {
  // Initialize MIDI hardware listener & router
  useMIDI();
  // Initialize key mapping hook
  useKeyMapping();
  
  return <DJInterface />;
};

export default Index;
