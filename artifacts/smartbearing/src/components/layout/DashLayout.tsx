import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Settings as SettingsIcon,
  Menu,
  Bell,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashLayoutProps {
  children: ReactNode;
}

export default function DashLayout({ children }: DashLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [timeAgo, setTimeAgo] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setLocation('/login');
  };

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/machine/M003', icon: Activity, label: 'Machines' },
    { href: '/predictions', icon: BarChart3, label: 'Predictions' },
    { href: '/alerts', icon: AlertTriangle, label: 'Alerts', badge: 3 },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-navy flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-card border-r border-navy transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-200 ease-in-out`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-navy">
          <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer text-white hover:text-amber transition-colors">
            <Activity className="w-6 h-6 text-amber" />
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
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-[#141E35] text-amber' : 'text-slate-300 hover:bg-[#141E35] hover:text-white'}`}>
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
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
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full text-slate-300 hover:text-white hover:bg-[#141E35] rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-navy-card/80 backdrop-blur-md border-b border-navy flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
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
            <div className="relative cursor-pointer text-slate-300 hover:text-amber transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#EA580C] rounded-full border-2 border-navy-card"></span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
