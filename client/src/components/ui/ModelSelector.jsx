import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Zap, Lock, BrainCircuit, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getModels } from '../../api';

// ── Client-side full model catalogue (mirrors modelRegistry.js) ───────────────
// Used only to show locked models — the server is the source of truth for access.
const ALL_MODELS = [
  { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'gemini', supportsStreaming: true, requiredPlan: 'free'       },
  { id: 'gpt-4.1-mini',     displayName: 'GPT-4.1 Mini',     provider: 'openai', supportsStreaming: true, requiredPlan: 'starter'    },
  { id: 'gpt-4.1',          displayName: 'GPT-4.1',          provider: 'openai', supportsStreaming: true, requiredPlan: 'pro'        },
  { id: 'claude-sonnet-4',  displayName: 'Claude Sonnet 4',  provider: 'claude', supportsStreaming: true, requiredPlan: 'pro'        },
];

// ── Provider meta ─────────────────────────────────────────────────────────────
const PROVIDER_META = {
  gemini: {
    label: 'Gemini',
    color: 'text-blue-600 dark:text-blue-400',
    headerBg: 'bg-blue-50 dark:bg-blue-900/20',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    // Simple SVG logo inline
    Logo: () => (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4"/>
        <path d="M12 6l1.5 4.5H18l-3.75 2.73 1.43 4.39L12 15.27l-3.68 2.35 1.43-4.39L6 10.5h4.5L12 6z" fill="white"/>
      </svg>
    ),
  },
  openai: {
    label: 'OpenAI',
    color: 'text-emerald-600 dark:text-emerald-400',
    headerBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Logo: () => (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M22.28 9.28a5.76 5.76 0 0 0-.49-4.73 5.82 5.82 0 0 0-6.27-2.79A5.76 5.76 0 0 0 11.17 0a5.82 5.82 0 0 0-5.55 4.03 5.76 5.76 0 0 0-3.84 2.79 5.82 5.82 0 0 0 .72 6.82 5.76 5.76 0 0 0 .49 4.73 5.82 5.82 0 0 0 6.27 2.79A5.76 5.76 0 0 0 12.83 24a5.82 5.82 0 0 0 5.55-4.04 5.76 5.76 0 0 0 3.84-2.78 5.82 5.82 0 0 0-.72-6.82l-.22-.08zM12.83 22.4a4.3 4.3 0 0 1-2.76-1c.04-.02.1-.05.14-.08l4.58-2.64a.74.74 0 0 0 .38-.65v-6.45l1.94 1.12a.07.07 0 0 1 .04.05v5.34a4.32 4.32 0 0 1-4.32 4.31zm-9.28-3.96a4.3 4.3 0 0 1-.52-2.89l.14.08 4.58 2.64a.74.74 0 0 0 .75 0l5.59-3.23v2.24a.07.07 0 0 1-.03.06L9.5 20.01a4.32 4.32 0 0 1-5.95-1.57zm-1.2-9.44a4.3 4.3 0 0 1 2.24-1.9v5.42a.74.74 0 0 0 .37.65l5.58 3.22-1.94 1.12a.07.07 0 0 1-.07 0L4.1 14.9a4.32 4.32 0 0 1-1.75-5.9zm15.94 3.7-5.59-3.23 1.94-1.12a.07.07 0 0 1 .07 0l4.43 2.56a4.32 4.32 0 0 1-.67 7.79v-5.42a.74.74 0 0 0-.18-.58zm1.93-2.9-.14-.08-4.57-2.65a.74.74 0 0 0-.75 0L9.17 10.3V8.06a.07.07 0 0 1 .03-.06l4.43-2.56a4.32 4.32 0 0 1 6.42 4.48l-.38-.12zM8.09 12.97l-1.94-1.12a.07.07 0 0 1-.04-.05V6.46a4.32 4.32 0 0 1 7.09-3.31l-.14.08-4.58 2.64a.74.74 0 0 0-.38.65l-.01 6.45zm1.05-2.27 2.49-1.44 2.49 1.43v2.87l-2.49 1.44-2.49-1.43v-2.87z"/>
      </svg>
    ),
  },
  claude: {
    label: 'Anthropic',
    color: 'text-violet-600 dark:text-violet-400',
    headerBg: 'bg-violet-50 dark:bg-violet-900/20',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    Logo: () => (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017L3.674 20H0L6.57 3.52zm4.132 9.959-1.977-5.24-1.977 5.24h3.954z"/>
      </svg>
    ),
  },
};

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

function groupByProvider(models) {
  const map = new Map();
  for (const m of models) {
    if (!map.has(m.provider)) map.set(m.provider, []);
    map.get(m.provider).push(m);
  }
  return map;
}

// ── Upgrade modal ─────────────────────────────────────────────────────────────
function UpgradeModal({ model, onClose }) {
  const navigate = useNavigate();
  const pm = PROVIDER_META[model.provider] ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-200 dark:border-gray-800">
        <button onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-primary-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/20">
          <Lock size={20} className="text-white" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Upgrade to use {model.displayName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          <span className={`inline-flex items-center gap-1 font-medium ${pm.color}`}>
            {pm.label}
          </span>
          {' '}{model.displayName} requires the{' '}
          <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">
            {model.requiredPlan}
          </span>{' '}
          plan or higher.
        </p>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="btn-secondary flex-1 justify-center">
            Maybe later
          </button>
          <button
            onClick={() => { onClose(); navigate('/billing'); }}
            className="btn-primary flex-1 justify-center gap-1.5">
            Upgrade <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModelSelector ─────────────────────────────────────────────────────────────
export default function ModelSelector({ value, onChange, onModelsLoaded }) {
  const [unlockedIds, setUnlockedIds] = useState(new Set());
  const [open,        setOpen]        = useState(false);
  const [upgradeFor,  setUpgradeFor]  = useState(null); // model to show upgrade modal for
  const ref = useRef(null);

  useEffect(() => {
    getModels().then(({ models, defaultModel }) => {
      const ids = new Set(models.map(m => m.id));
      setUnlockedIds(ids);
      onModelsLoaded?.(models);
      if (!value && defaultModel) onChange(defaultModel);
    }).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Merge ALL_MODELS with locked flag
  const models  = ALL_MODELS.map(m => ({ ...m, locked: !unlockedIds.has(m.id) }));
  const selected = models.find(m => m.id === value);
  const groups   = groupByProvider(models);

  // Don't render until we know which models are unlocked
  if (unlockedIds.size === 0) return null;

  const meta = PROVIDER_META[selected?.provider] ?? {};
  const ProviderLogo = meta.Logo;

  return (
    <>
      <div ref={ref} className="relative flex items-center gap-2">

        {/* AI icon */}
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-sm shadow-primary-500/30 shrink-0">
          <BrainCircuit size={13} className="text-white" />
        </div>

        {/* ── Trigger button ──────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium
            border transition-all duration-150 select-none
            ${open
              ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
            }
          `}
        >
          {/* Provider logo badge */}
          {ProviderLogo && (
            <span className={`flex items-center justify-center w-4 h-4 rounded ${meta.badge}`}>
              <ProviderLogo />
            </span>
          )}

          <span className="truncate max-w-[130px]">
            {selected ? selected.displayName : 'Select model'}
          </span>

          {/* Streaming badge on trigger */}
          {selected?.supportsStreaming && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
              <Zap size={9} className="fill-current" />
              Streaming
            </span>
          )}

          <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* ── Dropdown ────────────────────────────────────────────────────── */}
        {open && (
          <div className="
            absolute bottom-full mb-2 left-0 z-30
            w-72 rounded-2xl shadow-xl
            bg-white dark:bg-gray-900
            border border-gray-200 dark:border-gray-700
            overflow-hidden
          ">
            {/* Header */}
            <div className="px-3.5 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center">
                  <BrainCircuit size={11} className="text-white" />
                </div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Choose AI Model</p>
              </div>
            </div>

            <div className="py-1.5 max-h-80 overflow-y-auto">
              {[...groups.entries()].map(([provider, items]) => {
                const pm = PROVIDER_META[provider] ?? {};
                const Logo = pm.Logo;
                return (
                  <div key={provider} className="mb-1">
                    {/* Group header */}
                    <div className={`flex items-center gap-2 px-3.5 py-1.5 mx-1.5 rounded-lg ${pm.headerBg}`}>
                      {Logo && (
                        <span className={`${pm.color}`}>
                          <Logo />
                        </span>
                      )}
                      <span className={`text-[11px] font-semibold ${pm.color}`}>
                        {pm.label ?? provider}
                      </span>
                    </div>

                    {/* Models */}
                    {items.map(m => {
                      const isSelected = m.id === value;
                      const isLocked   = m.locked;

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (isLocked) { setOpen(false); setUpgradeFor(m); return; }
                            onChange(m.id);
                            setOpen(false);
                          }}
                          className={`
                            w-full flex items-center gap-2.5 px-3.5 py-2 text-left
                            transition-colors duration-100
                            ${isLocked
                              ? 'opacity-60 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60'
                              : isSelected
                                ? 'bg-primary-50 dark:bg-primary-900/20'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }
                          `}
                        >
                          {/* Indent */}
                          <span className="w-4 shrink-0" />

                          {/* Name */}
                          <span className={`flex-1 text-xs font-medium truncate ${
                            isLocked
                              ? 'text-gray-400 dark:text-gray-500'
                              : isSelected
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-gray-800 dark:text-gray-200'
                          }`}>
                            {m.displayName}
                          </span>

                          {/* Streaming badge */}
                          {m.supportsStreaming && !isLocked && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                              <Zap size={9} className="fill-current" />
                              Streaming
                            </span>
                          )}

                          {/* Right icon: lock / check / spacer */}
                          {isLocked ? (
                            <span className="flex items-center gap-1 text-[10px] text-amber-500 dark:text-amber-400 font-semibold shrink-0">
                              <Lock size={11} />
                              <span className="capitalize">{m.requiredPlan}</span>
                            </span>
                          ) : isSelected ? (
                            <Check size={13} className="text-primary-600 dark:text-primary-400 shrink-0" />
                          ) : (
                            <span className="w-[13px] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Upgrade modal */}
      {upgradeFor && <UpgradeModal model={upgradeFor} onClose={() => setUpgradeFor(null)} />}
    </>
  );
}
