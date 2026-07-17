import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Building2, Bot, ArrowRight } from 'lucide-react';
import { register } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Register() {
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.values(form).some((v) => !v.trim())) return toast.error('All fields required');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const { token, user } = await register(form);
      setAuth(user, token);
      toast.success('Account created!');
      navigate('/app/dashboard');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Hero */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-violet-600 via-primary-700 to-primary-800 p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `radial-gradient(circle at 25% 50%, white 1px, transparent 1px), radial-gradient(circle at 75% 80%, white 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <div className="relative z-10 text-white max-w-xl space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full text-sm font-medium">
              ✨ Free plan — No credit card required
            </div>
            <h2 className="text-4xl font-bold leading-tight">Join thousands of teams using SupportAI</h2>
            <p className="text-xl text-blue-100">Start automating your customer support today.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Companies', value: '10,000+' },
              { label: 'Messages/Month', value: '5M+' },
              { label: 'Avg Response Time', value: '<2s' },
              { label: 'Customer Satisfaction', value: '98%' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur rounded-2xl p-4">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-blue-200 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-900">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SupportAI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create your free account</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Get started free</h2>
            <p className="text-gray-500 dark:text-gray-400">No credit card required. Free forever.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Company name" icon={Building2} value={form.companyName} onChange={set('companyName')} placeholder="Acme Corp" />
            <Input label="Your name" icon={User} value={form.name} onChange={set('name')} placeholder="John Doe" />
            <Input label="Work email" type="email" icon={Mail} value={form.email} onChange={set('email')} placeholder="you@company.com" />
            <Input label="Password" type="password" icon={Lock} value={form.password} onChange={set('password')} placeholder="Min. 6 characters" />

            <p className="text-xs text-gray-500 dark:text-gray-400">
              By signing up, you agree to our{' '}
              <a href="#" className="text-primary-600 hover:underline">Terms of Service</a>{' '}and{' '}
              <a href="#" className="text-primary-600 hover:underline">Privacy Policy</a>.
            </p>

            <Button type="submit" loading={loading} className="w-full" icon={!loading && ArrowRight}>
              Create free account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
