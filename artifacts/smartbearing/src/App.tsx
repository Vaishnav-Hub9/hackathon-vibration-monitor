import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CommandPalette from "@/components/layout/CommandPalette";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import MachineDetail from "@/pages/MachineDetail";
import Predictions from "@/pages/Predictions";
import Alerts from "@/pages/Alerts";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import type { ComponentType } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/machine/:id" component={() => <ProtectedRoute component={MachineDetail} />} />
      <Route path="/predictions" component={() => <ProtectedRoute component={Predictions} />} />
      <Route path="/alerts" component={() => <ProtectedRoute component={Alerts} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
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
          <div className="bg-yellow-500 text-black text-center text-xs py-1.5 font-bold tracking-wide z-50 relative">
            ⚠️ SAFETY DISCLAIMER: Fault predictions are probabilistic. All risk alerts require human engineer confirmation. This system monitors only and does not issue direct machinery shutdown commands.
          </div>
          <Router />
          <CommandPalette />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
