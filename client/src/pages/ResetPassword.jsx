import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Bot, Lock, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { resetPassword } from '../api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

// ── Password strength ─────────────────────────────────────────────────────────
const RULES = [
  { label: 'At least 8 characters',       test: (p) => p.length >= 8 },
  { label: 'One uppercase letter',         test: (p) => /[A-Z]/.test(p) },
  { label: 'One number',                   test: (p) => /\d/.test(p) },
];

function StrengthMeter({ password }) {
  if (!password) return null;
  const passed = RULES.filter((r) => r.test(password)).length;
  const colors = ['bg-red-500', 'bg-amber-500', 'bg-emerald-500'];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {RULES.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < passed ? colors[passed - 1] : 'bg-gray-200 dark:bg-gray-700'}`} />
        ))}
      </div>
      <ul className="space-y-0.5">
        {RULES.map((r) => (
          <li key={r.label} className={`flex items-center gap-1.5 text-[11px] transition-colors ${r.test(password) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.test(password) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResetPassword() {
  const { token }  = useParams();
  const navigate   = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  const allRulesPassed = RULES.every((r) => r.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allRulesPassed)        return toast.error('Password does not meet requirements');
    if (password !== confirm)   return toast.error('Passwords do not match');

    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left — Form ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-900 relative overflow-hidden">

        <div className="orb w-96 h-96 bg-primary-200 dark:bg-primary-900/40 -top-32 -left-32 orb-slow" />
        <div className="orb w-72 h-72 bg-violet-200 dark:bg-violet-900/30 bottom-0 right-0 orb-delayed" />

        <div className="relative w-full max-w-md space-y-8">

          {/* Logo */}
          <div className="flex items-center gap-3 animate-pop-in">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-glow animate-glow-pulse">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SupportAI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI Customer Support Platform</p>
            </div>
          </div>

          {/* ── Success state ── */}
          {done ? (
            <div className="animate-fade-in-up space-y-6">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Password updated!</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Your password has been reset. Sign in with your new password.
                </p>
              </div>
              <Button className="w-full" icon={ArrowRight} onClick={() => navigate('/login')}>
                Go to Sign In
              </Button>
            </div>

          ) : error ? (
            /* ── Error state (invalid / expired token) ── */
            <div className="animate-fade-in-up space-y-6">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle size={32} className="text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Link expired</h2>
                <p className="text-gray-500 dark:text-gray-400">{error}</p>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium link-underline">
                  Back to sign in
                </Link>
              </p>
            </div>

          ) : (
            /* ── Form ── */
            <>
              <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Set new password</h2>
                <p className="text-gray-500 dark:text-gray-400">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="animate-fade-in-up" style={{ animationDelay: '140ms', animationFillMode: 'both' }}>
                  <Input
                    label="New password" type="password" icon={Lock}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoFocus
                  />
                  <StrengthMeter password={password} />
                </div>

                <div className="animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                  <Input
                    label="Confirm password" type="password" icon={Lock}
                    value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                  />
                  {confirm && password !== confirm && (
                    <p className="mt-1.5 text-[11px] text-red-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      Passwords do not match
                    </p>
                  )}
                </div>

                <div className="animate-fade-in-up" style={{ animationDelay: '260ms', animationFillMode: 'both' }}>
                  <Button
                    type="submit" loading={loading} className="w-full"
                    icon={!loading && ArrowRight}
                    disabled={!allRulesPassed || (confirm.length > 0 && password !== confirm)}
                  >
                    Reset password
                  </Button>
                </div>
              </form>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400 animate-fade-in-up"
                style={{ animationDelay: '320ms', animationFillMode: 'both' }}>
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium link-underline">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Right — Hero ────────────────────────────────────────────────── */}
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
            <p className="text-xl text-primary-100">Create a new strong password to keep your account secure.</p>
          </div>

          <div className="space-y-3">
            {[
              { icon: '🔒', text: 'Your data is always encrypted and safe' },
              { icon: '⚡', text: 'Instant access after reset' },
              { icon: '🛡️', text: 'Reset links expire after 1 hour' },
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
