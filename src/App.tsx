// Notifications supprimées: Toaster/Sonner retirés
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAutoSync } from "./hooks/useAutoSync";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import PaymentMethod from "./pages/PaymentMethod";
import PaymentConfirm from "./pages/PaymentConfirm";
import PaymentResult from "./pages/PaymentResult";
// Page Historique et Notifications retirées
// import History from "./pages/History";
// import Notifications from "./pages/Notifications";
import AdminSync from "./pages/AdminSync";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useAutoSync();
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/payment-method" element={<PaymentMethod />} />
        <Route path="/payment-confirm" element={<PaymentConfirm />} />
        <Route path="/payment-result" element={<PaymentResult />} />
        {/* Route /history retirée */}
        {/* <Route path="/history" element={<History />} /> */}
        {/* Route /notifications retirée */}
        {/* <Route path="/notifications" element={<Notifications />} /> */}
        <Route path="/admin/sync" element={<AdminSync />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Toaster/Sonner retirés pour supprimer les notifications visuelles */}
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
