import { useState } from 'react';
import { User, Lock, Palette, Key, Copy, RefreshCw, Eye, EyeOff, Check } from 'lucide-react';
import { updateProfile, updateCompany, updatePassword, updateWidget, regenerateApiKey } from '../api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'profile',   label: 'Profile',        icon: User },
  { id: 'security',  label: 'Security',        icon: Lock },
  { id: 'widget',    label: 'Widget',          icon: Palette },
  { id: 'api',       label: 'API & Keys',      icon: Key },
];

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', companyName: user?.company?.name || '' });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({ name: form.name });
      if (form.companyName !== user?.company?.name) {
        await updateCompany({ name: form.companyName });
      }
      updateUser({ name: form.name });
      toast.success('Profile updated');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
              <span className="inline-flex mt-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-medium rounded capitalize">{user?.role}</span>
            </div>
          </div>
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Company Name" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
          <div>
            <label className="label">Email Address</label>
            <input className="input opacity-60 cursor-not-allowed" value={user?.email} disabled />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>
        </div>
      </div>
      <Button loading={loading} onClick={handleSave}>Save Changes</Button>
    </div>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState({ cur: false, new: false, conf: false });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.currentPassword || !form.newPassword) return toast.error('All fields required');
    if (form.newPassword !== form.confirm) return toast.error('Passwords do not match');
    if (form.newPassword.length < 6) return toast.error('Min 6 characters');
    setLoading(true);
    try {
      await updatePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const ToggleBtn = ({ field }) => (
    <button type="button" onClick={() => setShowPass((p) => ({ ...p, [field]: !p[field] }))}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
      {showPass[field] ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="font-semibold text-gray-900 dark:text-white">Change Password</h3>
      <div className="space-y-4">
        <div>
          <label className="label">Current Password</label>
          <div className="relative">
            <input type={showPass.cur ? 'text' : 'password'} className="input pr-10" value={form.currentPassword} onChange={set('currentPassword')} placeholder="••••••••" />
            <ToggleBtn field="cur" />
          </div>
        </div>
        <div>
          <label className="label">New Password</label>
          <div className="relative">
            <input type={showPass.new ? 'text' : 'password'} className="input pr-10" value={form.newPassword} onChange={set('newPassword')} placeholder="Min. 6 characters" />
            <ToggleBtn field="new" />
          </div>
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <div className="relative">
            <input type={showPass.conf ? 'text' : 'password'} className="input pr-10" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" />
            <ToggleBtn field="conf" />
          </div>
        </div>
      </div>
      <Button loading={loading} onClick={handleSave}>Update Password</Button>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Two-Factor Authentication</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Add an extra layer of security to your account</p>
        <Button variant="secondary" onClick={() => toast('2FA is coming soon! We\'ll notify you when it\'s available.', { icon: '🔐' })}>Enable 2FA</Button>
      </div>
    </div>
  );
}

function WidgetTab() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    primaryColor:   user?.company?.widgetConfig?.primaryColor   || '#2563eb',
    welcomeMessage: user?.company?.widgetConfig?.welcomeMessage || 'Hi! How can I help you today?',
    position:       user?.company?.widgetConfig?.position       || 'bottom-right',
    showLeadForm:   user?.company?.widgetConfig?.showLeadForm   ?? true,
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateWidget(form);
      toast.success('Widget settings saved');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="font-semibold text-gray-900 dark:text-white">Widget Customization</h3>
      <div className="space-y-4">
        <div>
          <label className="label">Primary Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.primaryColor} onChange={(e) => set('primaryColor')(e.target.value)}
              className="h-10 w-20 rounded-xl border border-gray-300 dark:border-gray-700 cursor-pointer p-1 bg-white dark:bg-gray-800" />
            <span className="input flex-1 font-mono text-sm">{form.primaryColor}</span>
          </div>
        </div>
        <div>
          <label className="label">Welcome Message</label>
          <textarea className="input resize-none" rows={2} value={form.welcomeMessage} onChange={(e) => set('welcomeMessage')(e.target.value)} />
        </div>
        <div>
          <label className="label">Widget Position</label>
          <select className="input" value={form.position} onChange={(e) => set('position')(e.target.value)}>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
          </select>
        </div>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
          <input type="checkbox" className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500" checked={form.showLeadForm} onChange={(e) => set('showLeadForm')(e.target.checked)} />
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200">Show lead capture form</p>
            <p className="text-xs text-gray-400">Ask for name and email before starting chat</p>
          </div>
        </label>
      </div>

      <Button loading={loading} onClick={handleSave}>Save Widget Settings</Button>

      {/* Embed Code */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Embed Code</p>
        <pre className="text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
{`<script>
  window.SUPPORTAI_KEY = "${user?.company?.apiKey || 'your-api-key'}";
</script>
<script src="https://your-domain.com/widget.js"></script>`}
        </pre>
        <Button variant="secondary" size="sm" icon={Copy} onClick={() => { navigator.clipboard.writeText(`window.SUPPORTAI_KEY = "${user?.company?.apiKey}"`); toast.success('Copied!'); }}>
          Copy
        </Button>
      </div>
    </div>
  );
}

function ApiTab() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState(user?.company?.apiKey || '');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = async () => {
    if (!confirm('Rotate API key? This will invalidate your current key.')) return;
    setLoading(true);
    try {
      const res = await regenerateApiKey();
      setApiKey(res.apiKey);
      toast.success('API key rotated');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${'•'.repeat(24)}${apiKey.slice(-4)}` : '—';

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">API Key</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Use this key to authenticate widget and API requests.</p>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <code className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-700 dark:text-gray-300 overflow-hidden text-ellipsis">
            {show ? apiKey : maskedKey}
          </code>
          <button onClick={() => setShow(!show)} className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={handleCopy} className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
        </div>
        <Button variant="danger" icon={RefreshCw} loading={loading} onClick={handleRotate} size="sm">
          Rotate Key
        </Button>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">API Endpoints</h3>
        <div className="space-y-2">
          {[
            { method: 'POST', path: '/api/chat/message', desc: 'Send chat message' },
            { method: 'POST', path: '/api/leads', desc: 'Capture lead' },
            { method: 'GET', path: '/api/chat/history', desc: 'Get conversations' },
          ].map((e) => (
            <div key={e.path} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${e.method === 'GET' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{e.method}</span>
              <code className="text-xs font-mono text-gray-600 dark:text-gray-300 flex-1">{e.path}</code>
              <span className="text-xs text-gray-400">{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-0.5">Manage your account and preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab Nav */}
        <div className="lg:w-52 shrink-0">
          <nav className="card p-2 flex lg:flex-col gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all ${
                  activeTab === id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 card p-6">
          {activeTab === 'profile'  && <ProfileTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'widget'   && <WidgetTab />}
          {activeTab === 'api'      && <ApiTab />}
        </div>
      </div>
    </div>
  );
}
