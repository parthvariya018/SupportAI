import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '../api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Email is required');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-900 relative overflow-hidden">
        <div className="orb w-96 h-96 bg-primary-200 dark:bg-primary-900/40 -top-32 -left-32 orb-slow" />
        <div className="orb w-72 h-72 bg-violet-200 dark:bg-violet-900/30 bottom-0 right-0 orb-delayed" />

        <div className="relative w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 animate-pop-in">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-glow animate-glow-pulse">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SupportAI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI Customer Support Platform</p>
            </div>
          </div>

          {sent ? (
            <div className="animate-fade-in-up space-y-6">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Check your email</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  We sent a password reset link to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
                </p>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium link-underline">
                  ← Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Forgot password?</h2>
                <p className="text-gray-500 dark:text-gray-400">Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="animate-fade-in-up" style={{ animationDelay: '140ms', animationFillMode: 'both' }}>
                  <Input
                    label="Email" type="email" icon={Mail}
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoFocus
                  />
                </div>
                <div className="animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                  <Button type="submit" loading={loading} className="w-full" icon={!loading && ArrowRight}>
                    Send reset link
                  </Button>
                </div>
              </form>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400 animate-fade-in-up"
                style={{ animationDelay: '260ms', animationFillMode: 'both' }}>
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium link-underline">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-violet-800 p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="orb w-80 h-80 bg-white/10 top-10 -right-20" style={{ animationDuration: '8s' }} />
        <div className="orb w-60 h-60 bg-violet-400/20 -bottom-10 left-10 orb-delayed" />

        <div className="relative z-10 text-white max-w-xl space-y-8">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-white/20 animate-fade-in-up"
            style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Secure password reset
          </div>
          <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
            <h2 className="text-4xl font-bold leading-tight">Regain access to your account</h2>
            <p className="text-xl text-primary-100">We'll send you a secure link to reset your password.</p>
          </div>
          <div className="space-y-3">
            {[
              { icon: '🔒', text: 'Reset links expire after 1 hour' },
              { icon: '📧', text: 'Check your spam folder if needed' },
              { icon: '⚡', text: 'Instant access after reset' },
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: `${400 + i * 80}ms`, animationFillMode: 'both' }}>
                <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 text-base">
                  {feat.icon}
                </div>
                <span className="text-primary-50 font-medium">{feat.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
