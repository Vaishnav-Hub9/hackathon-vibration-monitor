import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Activity, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';

const DEMO_USERS = [
  { email: 'maintenance@smartbearing.com', password: 'Maintenance@123', name: 'Maintenance Engineer', role: 'maintenance_engineer', factoryUnits: ['unit-a', 'unit-b'], customerName: undefined },
  { email: 'admin@smartbearing.com', password: 'Admin@123', name: 'Platform Admin', role: 'admin', factoryUnits: ['unit-a', 'unit-b'], customerName: undefined },
  { email: 'manager@smartbearing.com', password: 'Manager@123', name: 'Factory Manager', role: 'factory_manager', factoryUnits: ['unit-a'], customerName: undefined },
  { email: 'worker@smartbearing.com', password: 'Worker@123', name: 'Line Worker', role: 'worker', factoryUnits: ['unit-a'], customerName: undefined },
  { email: 'customer@mangalyanarayana.com', password: 'Customer@123', name: 'Mangalya Narayana', role: 'customer', factoryUnits: ['unit-a'], customerName: 'Mangalya Narayana' },
  { email: 'operator@smartbearing.com', password: 'Operator@123', name: 'Line Operator', role: 'operator', factoryUnits: ['unit-a'], customerName: undefined },
];

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
      setError(err?.response?.data?.error || 'Unable to sign in. Start the API server and verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex justify-center items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl">SmartBearing</span>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold mb-2">Welcome back</h1>
            <p className="text-white/40 text-sm">Enter your credentials to access the dashboard</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-white/25" />
                <Input type="email" placeholder="admin@smartbearing.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 bg-white/[0.04] border-white/[0.08] focus-visible:ring-blue-500 text-white placeholder:text-white/20 h-11 rounded-xl" required />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-white/60">Password</label>
                <button type="button" onClick={() => setError('Password reset is managed by your factory administrator.')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">Forgot password?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-white/25" />
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 bg-white/[0.04] border-white/[0.08] focus-visible:ring-blue-500 text-white placeholder:text-white/20 h-11 rounded-xl" required />
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-white hover:bg-white/90 text-black font-semibold text-sm rounded-xl transition-all">
              {loading ? 'Signing in…' : 'Sign In'} {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/30 font-mono">
            <div className="font-semibold text-white/50 mb-1.5">Try a role (click to autofill):</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => { setEmail(demo.email); setPassword(demo.password); setError(''); }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-left transition hover:border-blue-400/40 hover:bg-blue-400/10"
                >
                  <div className="text-[10px] font-semibold text-white/65">{demo.name}</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-wider text-blue-300/70">{demo.role.replace('_', ' ')}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-white/25">Demo password is filled automatically. Real accounts receive access from an administrator.</div>
          </div>

          <div className="mt-6 text-center text-sm text-white/35 border-t border-white/[0.06] pt-6">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">Register your factory</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
