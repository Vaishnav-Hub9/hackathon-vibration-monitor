import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Activity, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';

// Demo accounts. When the backend is offline / unauthenticated (tunneled API
// returns 401), these are accepted client-side so login ALWAYS redirects to
// the dashboard — the demo must never dead-end on a failed request.
const DEMO_USERS = [
  { email: 'admin@smartbearing.com', password: 'Admin@123', name: 'Admin', role: 'admin' },
  { email: 'operator@smartbearing.com', password: 'Operator@123', name: 'Operator', role: 'operator' },
];

function enterDashboard() {
  localStorage.setItem('isLoggedIn', 'true');
  // useLocation hook can't be called here — this helper runs inside handlers.
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const { token, user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isLoggedIn', 'true');
      setLocation('/dashboard');
    } catch (err: any) {
      // Backend down / 401 — fall back to the known demo credentials so the
      // admin can always get into the dashboard.
      const demo = DEMO_USERS.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
      );
      if (demo) {
        localStorage.setItem('token', `demo-${demo.role}-token`);
        localStorage.setItem(
          'user',
          JSON.stringify({ email: demo.email, name: demo.name, role: demo.role })
        );
        enterDashboard();
        setLocation('/dashboard');
      } else {
        setError(err?.response?.data?.error || 'Invalid email or password. Try admin@smartbearing.com / Admin@123');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy relative flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy via-navy/60 to-navy" />
      <div className="aurora aurora-animate w-[520px] h-[520px] bg-amber/10 -top-48 -left-24" />
      <div className="aurora aurora-animate w-[440px] h-[440px] bg-[#3B82F6]/10 -bottom-48 -right-24" style={{ animationDelay: '-6s' }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#0F1629]/80 backdrop-blur-xl border border-amber/15 rounded-2xl p-8 shadow-[0_0_60px_rgba(245,158,11,0.08)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber/20 via-amber to-amber/20"></div>
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-amber/10 blur-[70px] pointer-events-none" />

          <div className="flex justify-center items-center gap-2 mb-8">
            <span className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber/25 to-[#EA580C]/10 border border-amber/30 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Activity className="w-6 h-6 text-amber" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] border border-navy" />
            </span>
            <span className="font-display font-bold text-2xl text-white">Smart<span className="text-amber">Bearing</span></span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-slate-400 text-sm">Enter your credentials to access the dashboard</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-[#2B0D0A] border border-[#EA580C]/30 text-[#EA580C] text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <Input
                  type="email"
                  placeholder="admin@smartbearing.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-[#0A0E1A] border-navy focus-visible:ring-amber text-white placeholder:text-slate-600 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setError('Password reset is managed by your factory administrator. Contact them to reset your password.')}
                  className="text-xs text-amber hover:text-amber/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-[#0A0E1A] border-navy focus-visible:ring-amber text-white placeholder:text-slate-600 h-11"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-amber hover:bg-amber/90 text-navy font-bold text-base transition-all shadow-[0_0_24px_rgba(245,158,11,0.25)] hover:shadow-[0_0_32px_rgba(245,158,11,0.4)]"
            >
              {loading ? 'Signing in…' : 'Sign In'} {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-[#0A0E1A] border border-navy rounded-lg text-xs text-slate-500 font-mono-data">
            <div className="font-semibold text-slate-400 mb-1">Demo credentials:</div>
            <div>admin@smartbearing.com / Admin@123</div>
            <div>operator@smartbearing.com / Operator@123</div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-400 border-t border-navy pt-6">
            Don't have an account? <Link href="/register" className="text-amber font-medium hover:underline">Register your factory</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
