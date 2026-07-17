import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Bot, ArrowRight } from 'lucide-react';
import { login } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { setAuth } = useAuth();
  const navigate    = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('All fields required');
    setLoading(true);
    try {
      const { token, user } = await login({ email, password });
      setAuth(user, token);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/app/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left — Form ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-900 relative overflow-hidden">

        {/* Subtle background orbs */}
        <div className="orb w-96 h-96 bg-primary-200 dark:bg-primary-900/40 -top-32 -left-32 orb-slow" />
        <div className="orb w-72 h-72 bg-violet-200 dark:bg-violet-900/30 bottom-0 right-0 orb-delayed" />

        <div className="relative w-full max-w-md space-y-8">

          {/* Logo — pop-in entrance */}
          <div className="flex items-center gap-3 animate-pop-in">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-glow animate-glow-pulse">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SupportAI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI Customer Support Platform</p>
            </div>
          </div>

          {/* Heading — fade up */}
          <div
            className="space-y-2 animate-fade-in-up"
            style={{ animationDelay: '80ms', animationFillMode: 'both' }}
          >
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
            <p className="text-gray-500 dark:text-gray-400">Sign in to your account to continue</p>
          </div>

          {/* Form — staggered fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className="animate-fade-in-up"
              style={{ animationDelay: '140ms', animationFillMode: 'both' }}
            >
              <Input
                label="Email" type="email" icon={Mail}
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div
              className="animate-fade-in-up"
              style={{ animationDelay: '200ms', animationFillMode: 'both' }}
            >
              <Input
                label="Password" type="password" icon={Lock}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div
              className="flex items-center justify-between text-sm animate-fade-in-up"
              style={{ animationDelay: '240ms', animationFillMode: 'both' }}
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium link-underline">
                Forgot password?
              </Link>
            </div>

            <div
              className="animate-fade-in-up"
              style={{ animationDelay: '300ms', animationFillMode: 'both' }}
            >
              <Button type="submit" loading={loading} className="w-full" icon={!loading && ArrowRight}>
                Sign in
              </Button>
            </div>
          </form>

          <p
            className="text-center text-sm text-gray-500 dark:text-gray-400 animate-fade-in-up"
            style={{ animationDelay: '360ms', animationFillMode: 'both' }}
          >
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium link-underline">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right — Hero ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-violet-800 p-12 items-center justify-center relative overflow-hidden">

        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Floating orbs */}
        <div className="orb w-80 h-80 bg-white/10 top-10 -right-20" style={{ animationDuration: '8s' }} />
        <div className="orb w-60 h-60 bg-violet-400/20 -bottom-10 left-10 orb-delayed" />

        <div className="relative z-10 text-white max-w-xl space-y-8">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-white/20 animate-fade-in-up"
            style={{ animationDelay: '200ms', animationFillMode: 'both' }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Trusted by 10,000+ companies
          </div>

          {/* Headline */}
          <div
            className="space-y-4 animate-fade-in-up"
            style={{ animationDelay: '300ms', animationFillMode: 'both' }}
          >
            <h2 className="text-4xl font-bold leading-tight">
              Transform your customer support with AI
            </h2>
            <p className="text-xl text-primary-100">
              Automate responses, reduce tickets, and delight your customers 24/7.
            </p>
          </div>

          {/* Feature list — staggered */}
          <div className="space-y-3 stagger-children">
            {[
              { icon: '⚡', text: 'Setup in 5 minutes — no coding required' },
              { icon: '🤖', text: 'AI-powered responses from your own docs' },
              { icon: '📊', text: 'Real-time analytics and lead capture' },
            ].map((feat, i) => (
              <div
                key={i}
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: `${400 + i * 80}ms`, animationFillMode: 'both' }}
              >
                <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 text-base">
                  {feat.icon}
                </div>
                <span className="text-primary-50 font-medium">{feat.text}</span>
              </div>
            ))}
          </div>

          {/* Floating stat cards */}
          <div
            className="grid grid-cols-3 gap-3 animate-fade-in-up"
            style={{ animationDelay: '700ms', animationFillMode: 'both' }}
          >
            {[
              { label: 'Avg Response', value: '< 2s' },
              { label: 'Satisfaction', value: '98%' },
              { label: 'Tickets Saved', value: '73%' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center animate-float"
                style={{ animationDelay: `${i * 0.5}s` }}
              >
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-primary-200 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
