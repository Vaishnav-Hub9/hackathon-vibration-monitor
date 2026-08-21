import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Activity, User, Mail, Lock, Factory, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';

export default function Register() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({ name: '', email: '', factory: '', alertEmail: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await authApi.register({ name: formData.name, email: formData.email, password: formData.password, role: 'operator', alertEmail: formData.alertEmail });
      const { token, user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isLoggedIn', 'true');
      setLocation('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative flex items-center justify-center p-4 py-12 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex justify-center items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl">SmartBearing</span>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold mb-2">Register Factory</h1>
            <p className="text-white/40 text-sm">Create an account to monitor your MSME setup</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 h-4 w-4 text-white/25" />
                  <Input name="name" onChange={handleChange} className="pl-10 bg-white/[0.04] border-white/[0.08] text-white focus-visible:ring-blue-500 h-10 rounded-xl" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-white/25" />
                  <Input type="email" name="email" onChange={handleChange} className="pl-10 bg-white/[0.04] border-white/[0.08] text-white focus-visible:ring-blue-500 h-10 rounded-xl" required />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50">Factory Name</label>
              <div className="relative">
                <Factory className="absolute left-3.5 top-2.5 h-4 w-4 text-white/25" />
                <Input name="factory" onChange={handleChange} className="pl-10 bg-white/[0.04] border-white/[0.08] text-white focus-visible:ring-blue-500 h-10 rounded-xl" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50">Alert Email (optional)</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-white/25" />
                <Input type="email" name="alertEmail" onChange={handleChange} className="pl-10 bg-white/[0.04] border-white/[0.08] text-white focus-visible:ring-blue-500 h-10 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-white/25" />
                  <Input type="password" name="password" onChange={handleChange} className="pl-10 bg-white/[0.04] border-white/[0.08] text-white focus-visible:ring-blue-500 h-10 rounded-xl" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-white/25" />
                  <Input type="password" name="confirm" onChange={handleChange} className="pl-10 bg-white/[0.04] border-white/[0.08] text-white focus-visible:ring-blue-500 h-10 rounded-xl" required />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-6 bg-white hover:bg-white/90 text-black font-semibold h-11 rounded-xl transition-all">
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-white/35">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
