import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from 'react-router-dom'
import { DJInterface } from './components/dj/DJInterface'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import { DJProvider } from './contexts/DJContext'
import { ErrorBoundary } from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DJProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/dj" replace />} />
              <Route path="/dj" element={<DJInterface />} />
              <Route path="/home" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DJProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App;
