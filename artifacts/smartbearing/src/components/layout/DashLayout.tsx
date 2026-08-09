import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Settings as SettingsIcon,
  Boxes,
  Workflow,
  Menu,
  LogOut,
  LogIn,
  ChevronDown,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/layout/NotificationBell';
import { getSocket } from '@/lib/socket';

interface DashLayoutProps {
  children: ReactNode;
}

export default function DashLayout({ children }: DashLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [timeAgo, setTimeAgo] = useState(0);
  const [loggedIn, setLoggedIn] = useState(
    () => localStorage.getItem('isLoggedIn') === 'true'
  );
  const [mlOnline, setMlOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for real ML model status from the backend — no fake predictions
  useEffect(() => {
    // Initial probe so the banner resolves immediately even before any socket event
    (async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/health/ml`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        });
        const json = await res.json();
        if (json?.data && typeof json.data.online === 'boolean') setMlOnline(json.data.online);
      } catch (e) {
        // API unreachable — leave banner state unresolved
      }
    })();

    const socket = getSocket();
    const onMlStatus = (data: { online?: boolean }) => {
      if (data && typeof data.online === 'boolean') setMlOnline(data.online);
    };
    const onFleetSummary = (data: any) => {
      if (data && typeof data.mlOnline === 'boolean') setMlOnline(data.mlOnline);
    };
    socket.on('ml:status', onMlStatus);
    socket.on('fleet:summary', onFleetSummary);
    return () => {
      socket.off('ml:status', onMlStatus);
      socket.off('fleet:summary', onFleetSummary);
    };
  }, []);

  const handleLogout = () => {
    // Real sign-out: drop the session (token + profile + app flag).
    // Then HARD full-page navigate to the LANDING page (the 3D bearing hero
    // at /). It is a public route, so it renders for anyone — and unlike
    // wouter's SPA setLocation (a no-op when already on the same path), a
    // full window.location navigation always produces a visible page change
    // from ANY page, so Sign Out can never look 'dead'.
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    setLoggedIn(false);
    window.location.assign('/');
  };

  const handleAuthAction = () => {
    if (loggedIn) {
      handleLogout();
    } else {
      setLocation('/login');
    }
  };

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/machine/M003', icon: Activity, label: 'Machines' },
    { href: '/predictions', icon: BarChart3, label: 'Predictions' },
    { href: '/alerts', icon: AlertTriangle, label: 'Alerts', badge: 3 },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/twin', icon: Boxes, label: 'Digital Twin' },
    { href: '/workflow', icon: Workflow, label: 'Pipeline' },
    { href: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-navy flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-card border-r border-navy transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-200 ease-in-out`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-navy">
          <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer text-white hover:text-amber transition-colors group">
            <span className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-amber/20 to-[#EA580C]/10 border border-amber/30 shadow-[0_0_14px_rgba(245,158,11,0.25)] group-hover:shadow-[0_0_22px_rgba(245,158,11,0.4)] transition-shadow">
              <Activity className="w-5 h-5 text-amber" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10B981] border border-navy" />
            </span>
            <span className="font-display font-bold text-lg tracking-wide">
              Smart<span className="text-amber">Bearing</span>
            </span>
          </Link>
          <button className="md:hidden text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (location.startsWith('/machine') && item.href.startsWith('/machine'));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div className={`relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${isActive ? 'bg-[#141E35] text-amber shadow-[inset_0_0_0_1px_rgba(245,158,11,0.15)]' : 'text-slate-300 hover:bg-[#141E35] hover:text-white'}`}>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-amber to-[#EA580C] shadow-[0_0_10px_rgba(245,158,11,0.7)]" />
                  )}
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-amber' : ''}`} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-[#EA580C] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-navy">
          <button
            onClick={handleAuthAction}
            className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors ${loggedIn ? 'text-slate-300 hover:text-white hover:bg-[#141E35]' : 'text-amber hover:bg-amber/10'}`}
          >
            {loggedIn ? <LogOut className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            <span className="font-medium text-sm">{loggedIn ? 'Sign Out' : 'Sign In'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen relative">
        {/* Ambient background — aurora + grid + noise for every dashboard page */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute inset-0 grid-bg opacity-[0.12]" />
          <div className="aurora aurora-animate w-[560px] h-[560px] bg-amber/[0.07] -top-56 -left-40" />
          <div className="aurora aurora-animate w-[480px] h-[480px] bg-[#3B82F6]/[0.06] top-1/3 -right-48" style={{ animationDelay: '-5s' }} />
          <div className="aurora aurora-animate w-[420px] h-[420px] bg-[#EA580C]/[0.04] bottom-0 left-1/4" style={{ animationDelay: '-10s' }} />
          <div className="absolute inset-0 overflow-hidden">
            <div className="w-full h-full noise opacity-40" />
          </div>
        </div>
        {/* Top Header */}
        <header className="relative h-16 bg-navy-card/80 backdrop-blur-md border-b border-navy flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber/50 to-transparent" />
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-300 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-[#141E35] border border-navy rounded-md px-3 py-1.5 cursor-pointer hover:border-amber/50 transition-colors">
              <span className="text-sm font-medium text-slate-200">Factory Unit A (Sircilla)</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              Last updated: {timeAgo}s ago
            </span>
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <div className="relative flex-1 p-4 sm:p-6 lg:p-8">
          {mlOnline === false && (
            <div className="mb-6 flex items-center gap-3 bg-[#2B0D0A] border border-[#EA580C]/40 text-[#EA580C] px-4 py-3 rounded-xl text-sm font-medium">
              <Cpu className="w-5 h-5 flex-shrink-0 animate-pulse" />
              <div>
                <span className="font-bold">ML model offline</span>
                <span className="text-[#f0b28a]"> — predictions are paused. Start the ML server (start-ml.bat, port 8000) to resume real model inference.</span>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
