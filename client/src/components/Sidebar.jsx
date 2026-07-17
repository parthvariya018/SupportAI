import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, MessageSquare, Users,
  Settings, LogOut, Bot, X, Ticket, Library,
  BarChart2, UserCog, CreditCard, UserCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { group: 'Overview' },
  { to: '/app/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/analytics',  icon: BarChart2,        label: 'Analytics' },
  { group: 'Support' },
  { to: '/app/chatbot',    icon: MessageSquare,   label: 'Live Chat' },
  { to: '/app/tickets',    icon: Ticket,          label: 'Tickets' },
  { to: '/app/leads',      icon: UserCircle,      label: 'Customers' },
  { group: 'Knowledge' },
  { to: '/app/knowledge',  icon: Library,         label: 'Knowledge Base' },
  { to: '/app/documents',  icon: BookOpen,        label: 'AI Training' },
  { group: 'Settings' },
  { to: '/app/team',       icon: UserCog,         label: 'Team' },
  { to: '/app/billing',    icon: CreditCard,      label: 'Billing' },
  { to: '/app/settings',   icon: Settings,        label: 'Settings' },
];

// Assign a sequential index to each link (skip group headers) for stagger delay
let linkIndex = 0;
const linksWithIndex = links.map((item) => {
  if (item.group) return item;
  return { ...item, idx: linkIndex++ };
});

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const navContent = (
    <>
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm shadow-primary-600/30 animate-glow-pulse">
          <Bot size={18} className="text-white" />
        </div>
        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
          SupportAI
        </span>
        <button
          onClick={onClose}
          className="ml-auto lg:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors hover:rotate-90 transition-transform duration-150"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Nav links ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {linksWithIndex.map((item, i) => {
          if (item.group) return (
            <p
              key={i}
              className="px-3 pt-5 pb-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest first:pt-1 animate-fade-in"
              style={{ animationDelay: `${i * 20}ms`, animationFillMode: 'both' }}
            >
              {item.group}
            </p>
          );

          const { to, icon: Icon, label, idx } = item;
          // Stagger: each link delays by 40ms × its index
          const delay = idx * 40;

          return (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                 transition-all duration-200 group relative
                 animate-slide-right
                 ${isActive
                   ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                   : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
                 }`
              }
              style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
            >
              {({ isActive }) => (
                <>
                  {/* Icon — scale on active, translate on hover */}
                  <Icon
                    size={17}
                    className={`transition-transform duration-200 ${
                      isActive ? '' : 'group-hover:scale-110 group-hover:translate-x-0.5'
                    }`}
                  />
                  {label}

                  {/* Active ping dot */}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse-slow" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── User section ─────────────────────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 mb-1.5 group transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
          {/* Avatar with glow on hover */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0 shadow-sm transition-shadow duration-200 group-hover:shadow-glow-sm">
            <span className="text-xs font-bold text-white">
              {user?.name?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate capitalize">
              {user?.role} · {user?.company?.name}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all duration-150 group"
        >
          <LogOut size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 min-h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
          />
          <aside className="relative flex flex-col w-64 h-full bg-white dark:bg-gray-900 shadow-float animate-slide-right">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
