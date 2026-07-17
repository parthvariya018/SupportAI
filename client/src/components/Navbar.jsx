import { Menu, Sun, Moon, Bell, Search } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';

const titles = {
  '/app/dashboard':  'Dashboard',
  '/app/analytics':  'Analytics',
  '/app/chatbot':    'Live Chat',
  '/app/tickets':    'Tickets',
  '/app/leads':      'Customers',
  '/app/knowledge':  'Knowledge Base',
  '/app/documents':  'AI Training',
  '/app/team':       'Team',
  '/app/billing':    'Billing',
  '/app/settings':   'Settings',
};

export default function Navbar({ onMenuClick }) {
  const { dark, toggle } = useTheme();
  const { pathname }     = useLocation();
  const title            = titles[pathname] || 'SupportAI';
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-16 shrink-0 flex items-center gap-4 px-5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30">
      <button onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <Menu size={20} />
      </button>

      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>

      <div className="ml-auto flex items-center gap-1">
        {/* Dark mode toggle */}
        <button onClick={toggle}
          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          title="Toggle dark mode">
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
            <Bell size={19} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 card shadow-xl z-50 animate-slide-in overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</span>
                <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium">3 new</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-72 overflow-y-auto">
                {[
                  { icon: '🎫', title: 'New ticket opened', desc: 'Login issue from john@acme.com', time: '2m ago' },
                  { icon: '👤', title: 'New lead captured', desc: 'Sarah Miller via chat widget', time: '15m ago' },
                  { icon: '✅', title: 'Ticket resolved', desc: '#A1B2C3 marked as resolved', time: '1h ago' },
                ].map((n, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <span className="text-xl shrink-0">{n.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{n.title}</p>
                      <p className="text-xs text-gray-400 truncate">{n.desc}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{n.time}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => setNotifOpen(false)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Mark all as read</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
