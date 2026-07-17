/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      // ── Animations ────────────────────────────────────────────────────────
      animation: {
        // Entrance
        'fade-in':        'fadeIn 0.25s ease-out both',
        'fade-in-up':     'fadeInUp 0.35s ease-out both',
        'fade-in-down':   'fadeInDown 0.3s ease-out both',
        'slide-in':       'slideIn 0.28s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up':       'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
        'slide-right':    'slideRight 0.3s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in':       'scaleIn 0.22s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in-spring':'scaleInSpring 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'pop-in':         'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',

        // Continuous
        'pulse-slow':     'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-fast':     'pulse 1s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':      'spin 3s linear infinite',
        'float':          'float 4s ease-in-out infinite',
        'float-delayed':  'float 4s ease-in-out 1.5s infinite',
        'glow-pulse':     'glowPulse 2.5s ease-in-out infinite',
        'shimmer':        'shimmer 2s linear infinite',
        'shimmer-fast':   'shimmer 1.2s linear infinite',
        'bounce-sm':      'bounceSm 1.2s cubic-bezier(0.28,0.84,0.42,1) infinite',

        // Stagger helpers (add delay via style prop)
        'stagger-fade':   'fadeInUp 0.4s ease-out both',

        // Attention / feedback
        'wiggle':         'wiggle 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both',
        'ring-ping':      'ringPing 1.5s cubic-bezier(0,0,0.2,1) infinite',
        'success-pop':    'successPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
      },

      keyframes: {
        // Entrance
        fadeIn:        { from: { opacity: 0 }, to: { opacity: 1 } },
        fadeInUp:      { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeInDown:    { from: { opacity: 0, transform: 'translateY(-12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:       { from: { opacity: 0, transform: 'translateY(12px) scale(0.98)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
        slideUp:       { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideRight:    { from: { opacity: 0, transform: 'translateX(-16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        scaleIn:       { from: { opacity: 0, transform: 'scale(0.94)' }, to: { opacity: 1, transform: 'scale(1)' } },
        scaleInSpring: { from: { opacity: 0, transform: 'scale(0.8)' }, to: { opacity: 1, transform: 'scale(1)' } },
        popIn:         { '0%': { opacity: 0, transform: 'scale(0.85)' }, '60%': { transform: 'scale(1.04)' }, '100%': { opacity: 1, transform: 'scale(1)' } },

        // Continuous
        float:    { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        glowPulse:{ '0%,100%': { boxShadow: '0 0 12px rgba(37,99,235,0.25)' }, '50%': { boxShadow: '0 0 28px rgba(37,99,235,0.55)' } },
        shimmer:  {
          from: { backgroundPosition: '-200% center' },
          to:   { backgroundPosition:  '200% center' },
        },
        bounceSm: { '0%,100%': { transform: 'translateY(-4px)' }, '50%': { transform: 'translateY(0)' } },

        // Attention
        wiggle:     { '0%,100%': { transform: 'rotate(0deg)' }, '20%': { transform: 'rotate(-6deg)' }, '60%': { transform: 'rotate(6deg)' } },
        ringPing:   { '75%,100%': { transform: 'scale(1.8)', opacity: 0 } },
        successPop: { '0%': { transform: 'scale(0)', opacity: 0 }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
      },

      // ── Stagger delay utilities ────────────────────────────────────────────
      transitionDelay: {
        50:  '50ms',
        75:  '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        300: '300ms',
        400: '400ms',
        500: '500ms',
        600: '600ms',
        700: '700ms',
      },

      // ── Shadows ───────────────────────────────────────────────────────────
      boxShadow: {
        'glow':       '0 0 20px rgba(37,99,235,0.18)',
        'glow-sm':    '0 0 10px rgba(37,99,235,0.12)',
        'glow-lg':    '0 0 40px rgba(37,99,235,0.25)',
        'glow-green': '0 0 20px rgba(16,185,129,0.2)',
        'glow-violet':'0 0 20px rgba(139,92,246,0.2)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.10)',
        'float':      '0 20px 60px rgba(0,0,0,0.12)',
        'inner-glow': 'inset 0 0 20px rgba(37,99,235,0.08)',
      },

      // ── Backdrop blur extras ──────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
