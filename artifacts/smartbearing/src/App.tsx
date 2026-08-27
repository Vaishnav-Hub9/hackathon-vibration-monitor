import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CommandPalette from "@/components/layout/CommandPalette";
import Landing from "@/pages/Landing";
import BearingExploded from "@/pages/BearingExploded";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import MachineDetail from "@/pages/MachineDetail";
import Predictions from "@/pages/Predictions";
import Alerts from "@/pages/Alerts";
import Analytics from "@/pages/Analytics";
import MlAnalysis from "@/pages/MlAnalysis";
import HardwareLab from "@/pages/HardwareLab";
import Settings from "@/pages/Settings";
import DigitalTwin from "@/pages/DigitalTwin";
import DigitalTwinBench from "@/pages/DigitalTwinBench";
import Workflow from "@/pages/Workflow";
import NotFound from "@/pages/not-found";
import { useEffect, type ComponentType } from "react";
import CursorGlow from "@/components/ui/CursorGlow";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) return <Redirect to="/login" />;
  return <Component />;
}

function ScrollToTopOnNavigate() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/bearing/exploded" component={BearingExploded} />
      <Route path="/twin" component={DigitalTwin} />
      <Route path="/twin/bench" component={DigitalTwinBench} />
      <Route path="/workflow" component={Workflow} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/machine/:id" component={() => <ProtectedRoute component={MachineDetail} />} />
      <Route path="/predictions" component={() => <ProtectedRoute component={Predictions} />} />
      <Route path="/alerts" component={() => <ProtectedRoute component={Alerts} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
      <Route path="/ml-analysis" component={() => <ProtectedRoute component={MlAnalysis} />} />
      <Route path="/hardware" component={() => <ProtectedRoute component={HardwareLab} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <CursorGlow />
          <ScrollToTopOnNavigate />
          <Router />
          <CommandPalette />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
