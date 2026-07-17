import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ── Animated number counter ───────────────────────────────────────────────────
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (value === undefined || value === null || value === '—') return;
    const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
    if (isNaN(num)) return;

    const start   = prev.current;
    const end     = num;
    const diff    = end - start;
    const steps   = 40;
    const stepMs  = 600 / steps;
    let   current = 0;

    const timer = setInterval(() => {
      current++;
      const eased = 1 - Math.pow(1 - current / steps, 3); // ease-out cubic
      setDisplay(Math.round(start + diff * eased));
      if (current >= steps) {
        setDisplay(end);
        prev.current = end;
        clearInterval(timer);
      }
    }, stepMs);

    return () => clearInterval(timer);
  }, [value]);

  if (value === undefined || value === null || value === '—') return <span>—</span>;
  const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
  if (isNaN(num)) return <span>{value}</span>;

  return <span className="count-up">{display.toLocaleString()}</span>;
}

export default function StatCard({
  title, value, icon: Icon, trend, trendValue,
  subtitle, color = 'primary', loading, delay = 0,
}) {
  const colors = {
    primary: {
      bg:   'bg-primary-50 dark:bg-primary-900/20',
      icon: 'text-primary-600 dark:text-primary-400',
      glow: 'group-hover:shadow-glow',
    },
    green: {
      bg:   'bg-emerald-50 dark:bg-emerald-900/20',
      icon: 'text-emerald-600 dark:text-emerald-400',
      glow: 'group-hover:shadow-glow-green',
    },
    yellow: {
      bg:   'bg-amber-50 dark:bg-amber-900/20',
      icon: 'text-amber-600 dark:text-amber-400',
      glow: '',
    },
    red: {
      bg:   'bg-red-50 dark:bg-red-900/20',
      icon: 'text-red-600 dark:text-red-400',
      glow: '',
    },
    purple: {
      bg:   'bg-purple-50 dark:bg-purple-900/20',
      icon: 'text-purple-600 dark:text-purple-400',
      glow: 'group-hover:shadow-glow-violet',
    },
    cyan: {
      bg:   'bg-cyan-50 dark:bg-cyan-900/20',
      icon: 'text-cyan-600 dark:text-cyan-400',
      glow: '',
    },
  };

  const c = colors[color] || colors.primary;

  if (loading) return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="skeleton w-11 h-11 rounded-xl" />
        <div className="skeleton w-16 h-5 rounded-full" />
      </div>
      <div className="skeleton w-24 h-8 rounded-lg mb-2" />
      <div className="skeleton w-32 h-4 rounded" />
    </div>
  );

  return (
    <div
      className="card p-6 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 group cursor-default animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between mb-4">
        {/* Icon with subtle float on hover */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${c.bg}`}>
          {Icon && <Icon size={20} className={c.icon} />}
        </div>

        {/* Trend badge */}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
            trend > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
            trend < 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                        'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {trendValue || `${Math.abs(trend)}%`}
          </div>
        )}
      </div>

      {/* Animated value */}
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
