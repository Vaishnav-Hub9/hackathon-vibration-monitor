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
import RoleDashboard from "@/pages/RoleDashboard";
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
import Operations from "@/pages/Operations";
import NotFound from "@/pages/not-found";
import { useEffect, type ComponentType } from "react";
import CursorGlow from "@/components/ui/CursorGlow";
import { getCurrentRole, type AppRole } from "@/lib/roles";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) return <Redirect to="/login" />;
  return <Component />;
}

function RoleProtectedRoute({ component: Component, roles }: { component: ComponentType; roles: AppRole[] }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) return <Redirect to="/login" />;
  if (!roles.includes(getCurrentRole())) return <Redirect to="/dashboard" />;
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
       <Route path="/twin" component={() => <RoleProtectedRoute component={DigitalTwin} roles={['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator']} />} />
       <Route path="/twin/bench" component={() => <RoleProtectedRoute component={DigitalTwinBench} roles={['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator']} />} />
       <Route path="/workflow" component={() => <RoleProtectedRoute component={Workflow} roles={['maintenance_engineer', 'admin', 'factory_manager']} />} />
       <Route path="/operations" component={() => <RoleProtectedRoute component={Operations} roles={['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator', 'customer']} />} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
       <Route path="/dashboard" component={() => <ProtectedRoute component={RoleDashboard} />} />
       <Route path="/fleet" component={() => <RoleProtectedRoute component={Dashboard} roles={['maintenance_engineer', 'admin']} />} />
       <Route path="/machine/:id" component={() => <RoleProtectedRoute component={MachineDetail} roles={['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator']} />} />
       <Route path="/predictions" component={() => <RoleProtectedRoute component={Predictions} roles={['maintenance_engineer', 'admin', 'factory_manager', 'customer']} />} />
       <Route path="/alerts" component={() => <RoleProtectedRoute component={Alerts} roles={['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator', 'customer']} />} />
       <Route path="/analytics" component={() => <RoleProtectedRoute component={Analytics} roles={['maintenance_engineer', 'admin', 'factory_manager', 'customer']} />} />
       <Route path="/ml-analysis" component={() => <RoleProtectedRoute component={MlAnalysis} roles={['maintenance_engineer', 'admin', 'factory_manager']} />} />
       <Route path="/hardware" component={() => <RoleProtectedRoute component={HardwareLab} roles={['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator']} />} />
       <Route path="/settings" component={() => <RoleProtectedRoute component={Settings} roles={['maintenance_engineer', 'admin']} />} />
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
