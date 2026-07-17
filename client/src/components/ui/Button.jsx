import { Loader2 } from 'lucide-react';
import { useRef } from 'react';

const variants = {
  primary:   'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-600/20 hover:shadow-glow-sm focus:ring-primary-500/40',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 focus:ring-gray-400/30',
  danger:    'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 focus:ring-red-400/30',
  ghost:     'hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-400 focus:ring-gray-400/30',
  success:   'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 hover:shadow-glow-green focus:ring-emerald-500/40',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
};

export default function Button({
  children, variant = 'primary', size = 'md',
  loading, disabled, className = '', icon: Icon, ...props
}) {
  const btnRef = useRef(null);

  // Ripple effect on click
  const handleRipple = (e) => {
    const btn  = btnRef.current;
    if (!btn) return;
    const circle = document.createElement('span');
    const rect   = btn.getBoundingClientRect();
    const d      = Math.max(rect.width, rect.height);
    circle.style.cssText = `
      position:absolute; border-radius:50%; pointer-events:none;
      width:${d}px; height:${d}px;
      left:${e.clientX - rect.left - d / 2}px;
      top:${e.clientY - rect.top  - d / 2}px;
      background:rgba(255,255,255,0.25);
      transform:scale(0); animation:ripple 0.5s linear;
    `;
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 500);
  };

  return (
    <button
      ref={btnRef}
      disabled={disabled || loading}
      onClick={handleRipple}
      className={`
        relative overflow-hidden
        inline-flex items-center justify-center font-medium rounded-xl
        transition-all duration-150
        active:scale-[0.97]
        focus:outline-none focus:ring-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {/* Loading spinner — spring entrance */}
      {loading && (
        <Loader2
          size={size === 'sm' ? 12 : 15}
          className="animate-spin"
          style={{ animation: 'spin 0.7s linear infinite' }}
        />
      )}

      {/* Icon with micro hover scale */}
      {!loading && Icon && (
        <Icon
          size={size === 'sm' ? 12 : 15}
          className="transition-transform duration-200 group-hover:scale-110"
        />
      )}

      {children}
    </button>
  );
}
