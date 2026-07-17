import { useEffect, useState } from 'react';
import { BarChart2, MessageSquare, Ticket, Users, TrendingUp, Lock, Zap } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getAnalyticsOverview, getTicketAnalytics, getConversationAnalytics } from '../api';
import { Link } from 'react-router-dom';
import StatCard from '../components/ui/StatCard';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [ticketStats, setTicketStats] = useState(null);
  const [convStats, setConvStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAnalyticsOverview(), getTicketAnalytics(), getConversationAnalytics()])
      .then(([ov, ts, cs]) => { setOverview(ov); setTicketStats(ts); setConvStats(cs); })
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const chartData = overview?.dailyStats?.map((d) => ({
    date: d._id?.slice(5),
    conversations: d.conversations,
  })) || [];

  const ticketPriorityData = ticketStats?.byPriority?.map((d) => ({ name: d._id, value: d.count })) || [];
  const ticketStatusData   = ticketStats?.byStatus?.map((d) => ({ name: d._id?.replace('_', ' '), value: d.count })) || [];
  const convStatusData     = convStats?.byStatus?.map((d) => ({ name: d._id || 'unknown', count: d.count })) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track performance across your support channels.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Conversations" value={overview?.overview?.conversations?.total?.toLocaleString()} icon={MessageSquare} color="primary" loading={loading} />
        <StatCard title="Open Tickets" value={overview?.overview?.tickets?.open?.toLocaleString()} icon={Ticket} color="yellow" loading={loading} />
        <StatCard title="Resolved Tickets" value={overview?.overview?.tickets?.resolved?.toLocaleString()} icon={TrendingUp} color="green" loading={loading} />
        <StatCard title="Total Leads" value={overview?.overview?.leads?.total?.toLocaleString()} icon={Users} color="purple" loading={loading} />
      </div>

      {/* Volume Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Conversation Volume</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
          </div>
        </div>
        {loading ? <div className="h-56 skeleton rounded-xl" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#3b82f6" strokeWidth={2.5} fill="url(#aGrad)" dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Ticket Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Priority */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-6">Tickets by Priority</h2>
          {loading ? <div className="h-48 skeleton rounded-xl" /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={ticketPriorityData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" stroke="none">
                    {ticketPriorityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {ticketPriorityData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm capitalize text-gray-600 dark:text-gray-300">{d.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{d.value}</span>
                  </div>
                ))}
                {ticketPriorityData.length === 0 && <p className="text-sm text-gray-400">No ticket data yet</p>}
              </div>
            </div>
          )}
        </div>

        {/* By Status */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-6">Tickets by Status</h2>
          {loading ? <div className="h-48 skeleton rounded-xl" /> : (
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={ticketStatusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-800" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Tickets" radius={[6, 6, 0, 0]}>
                  {ticketStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Conversation Status + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-6">Conversations by Status</h2>
          {loading ? <div className="h-48 skeleton rounded-xl" /> : (
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={convStatusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-800" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Conversations</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-2">
              {(convStats?.recentConversations || []).slice(0, 5).map((c) => (
                <div key={c._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.messageCount} messages</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{new Date(c.updatedAt).toLocaleDateString()}</span>
                </div>
              ))}
              {(convStats?.recentConversations || []).length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No conversations yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
