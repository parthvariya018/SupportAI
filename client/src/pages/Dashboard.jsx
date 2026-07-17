import { useEffect, useState } from 'react';
import {
  MessageSquare, Ticket, Users, BookOpen,
  TrendingUp, ArrowRight, Activity, Zap,
  BarChart2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { getAnalyticsOverview, getDashboardStats } from '../api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import toast from 'react-hot-toast';

/* ── custom bar chart tooltip ─────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-xl text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2 text-sm">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5" style={{ color: p.fill }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-bold text-gray-800 dark:text-gray-100">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ── build last-7-days skeleton so zero days still appear ─────────────── */
function buildWeek(dailyStats) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d    = new Date();
    d.setDate(d.getDate() - i);
    const key  = d.toISOString().slice(5, 10);          // "MM-DD"
    const label = d.toLocaleDateString('en', { weekday: 'short', month: 'numeric', day: 'numeric' });
    const found = dailyStats?.find((s) => s._id?.slice(5) === key);
    days.push({ date: key, label, conversations: found?.conversations ?? 0 });
  }
  return days;
}

export default function Dashboard() {
  const { user }  = useAuth();
  const [stats,         setStats]        = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [recentLeads,   setRecentLeads]  = useState([]);
  const [loading,       setLoading]      = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then((res) => {
        setStats(res);
        setRecentTickets(res.recentTickets || []);
        setRecentLeads(res.recentLeads || []);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const chartData     = buildWeek(stats?.dailyStats);
  const totalThisWeek = chartData.reduce((s, d) => s + d.conversations, 0);
  const hasAnyData    = totalThisWeek > 0;

  const tickets  = stats?.overview?.tickets || {};
  const getCount = (status) => tickets[status] ?? 0;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">
            Here's what's happening at {user?.company?.name} today.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">All systems operational</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Conversations" value={stats?.overview?.conversations?.total?.toLocaleString()} icon={MessageSquare} color="primary" loading={loading} subtitle={`${stats?.overview?.conversations?.thisMonth || 0} this month`} />
        <StatCard title="Open Tickets"        value={stats?.overview?.tickets?.open?.toLocaleString()}         icon={Ticket}        color="yellow" loading={loading} subtitle={`${stats?.overview?.tickets?.resolved || 0} resolved`} />
        <StatCard title="Total Leads"         value={stats?.overview?.leads?.total?.toLocaleString()}          icon={Users}         color="green"  loading={loading} subtitle="total captured" />
        <StatCard title="Documents"           value={stats?.overview?.documents?.count?.toLocaleString()}      icon={BookOpen}      color="purple"            loading={loading} subtitle={`${stats?.overview?.documents?.totalWords?.toLocaleString() || 0} words`} />
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Grouped Bar Chart ─────────────────────────────────────────── */}
        <div className="card p-6 col-span-2 flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart2 size={16} className="text-primary-500" />
                Activity — Last 7 Days
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Daily conversations, tickets open/resolved</p>
            </div>
            {hasAnyData && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
                <TrendingUp size={12} /> {totalThisWeek} total
              </span>
            )}
          </div>

          {/* Mini summary pills */}
          <div className="flex flex-wrap gap-2 mb-5 mt-3">
            {[
              { label: 'Conversations', value: totalThisWeek,      color: 'bg-primary-500', text: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
              { label: 'Open',          value: getCount('open'),    color: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: 'Resolved',      value: getCount('resolved'),color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400',bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'In Progress',   value: getCount('in_progress'), color: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${item.bg}`}>
                <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                <span className={`text-xs font-bold ${item.text}`}>{item.value ?? 0}</span>
              </div>
            ))}
          </div>

          {/* Chart */}
          {loading ? (
            <div className="h-48 skeleton rounded-xl" />
          ) : !hasAnyData ? (
            /* ── Empty state: show what the chart WILL look like ── */
            <div className="h-[280px] flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
              <BarChart2 size={32} className="text-gray-300 dark:text-gray-700" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No activity yet this week</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                  Start a chat or create a ticket — bars will appear here daily
                </p>
              </div>
              <div className="flex items-end gap-1 opacity-20 mt-1">
                {[3,6,4,8,5,7,9].map((h, i) => (
                  <div key={i} className="w-5 bg-primary-400 rounded-t-sm" style={{ height: h * 4 }} />
                ))}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                barCategoryGap="35%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }} />
                <Bar dataKey="conversations" name="Conversations" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="space-y-2.5">
            {[
              { label: 'Upload a document', desc: 'Train your AI',    to: '/app/documents', color: 'primary', icon: BookOpen      },
              { label: 'View conversations',desc: 'Review chats',     to: '/app/chatbot',   color: 'green',   icon: MessageSquare },
              { label: 'Manage tickets',    desc: 'Open issues',      to: '/app/tickets',   color: 'yellow',  icon: Ticket        },
              { label: 'Invite teammates',  desc: 'Grow your team',   to: '/app/team',      color: 'purple',  icon: Users         },
            ].map((a) => (
              <Link key={a.to} to={a.to}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  a.color === 'primary' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' :
                  a.color === 'green'   ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                  a.color === 'yellow'  ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                  'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                }`}>
                  <a.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                </div>
                <ArrowRight size={14} className="text-gray-300 dark:text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" />
              </Link>
            ))}
          </div>

          {/* Ticket health mini-summary */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ticket Health</p>
            {[
              { label: 'Open',        count: getCount('open'),        icon: AlertCircle,  cls: 'text-amber-500'   },
              { label: 'In Progress', count: getCount('in_progress'), icon: Activity,     cls: 'text-violet-500'  },
              { label: 'Resolved',    count: getCount('resolved'),    icon: CheckCircle2, cls: 'text-emerald-500' },
            ].map(({ label, count, icon: Icon, cls }) => (
              <div key={label} className="flex items-center justify-between">
                <span className={`flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400`}>
                  <Icon size={13} className={cls} /> {label}
                </span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Tickets + Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Tickets</h2>
            <Link to="/app/tickets" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : recentTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No tickets yet</div>
          ) : (
            <div className="space-y-2">
              {recentTickets.map((t) => (
                <div key={t._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.reportedBy?.name || 'Unknown'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge label={t.priority} variant={t.priority} />
                    <Badge label={t.status?.replace('_', ' ')} variant={t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Leads</h2>
            <Link to="/app/leads" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : recentLeads.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No leads yet</div>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((l) => (
                <div key={l._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{l.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{l.name}</p>
                    <p className="text-xs text-gray-400 truncate">{l.email}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(l.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Status Banner */}
      <div className="card p-5 bg-gradient-to-r from-primary-50 to-violet-50 dark:from-primary-900/20 dark:to-violet-900/20 border-primary-100 dark:border-primary-800/50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">AI is ready</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stats?.overview?.documents?.count > 0
                  ? `Trained on ${stats.overview.documents.count} document${stats.overview.documents.count > 1 ? 's' : ''}`
                  : 'Upload documents to train your AI assistant'}
              </p>
            </div>
          </div>
          <Link to="/app/documents" className="btn-primary text-sm">
            <Activity size={15} />
            Manage Training
          </Link>
        </div>
      </div>

    </div>
  );
}
