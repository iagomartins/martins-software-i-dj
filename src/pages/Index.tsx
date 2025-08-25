import { DJInterface } from "@/components/dj/DJInterface";
import { useKeyMapping } from "@/hooks/useKeyMapping";

const Index = () => {
  // Initialize key mapping hook
  useKeyMapping();
  
  return <DJInterface />;
};

export default Index;
