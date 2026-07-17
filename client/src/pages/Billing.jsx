import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard, Check, Zap, Star, ArrowRight, Receipt,
  ExternalLink, RefreshCw, TrendingUp, MessageSquare,
  FileText, Users, BookOpen, Coins, AlertTriangle, X, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import toast from 'react-hot-toast';
import {
  getBillingPlans, getSubscription, getInvoices,
  createCheckoutSession, createPortalSession,
  cancelSubscription, reactivateSubscription,
} from '../api';
import api from '../api';

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

const PLAN_META = {
  free:       { gradient: 'from-gray-500 to-gray-600' },
  starter:    { gradient: 'from-blue-500 to-blue-700' },
  pro:        { gradient: 'from-violet-500 to-violet-700', popular: true },
  enterprise: { gradient: 'from-amber-500 to-orange-600' },
};

// ── UsageMeter ────────────────────────────────────────────────────────────────
// limit === null means Unlimited (Enterprise). Never show a bar in that case.
function UsageMeter({ label, icon: Icon, used = 0, limit }) {
  const isUnlimited = limit === null;
  const pct         = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const danger      = pct >= 90;
  const warn        = pct >= 70;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium">
          {Icon && <Icon size={12} />} {label}
        </span>
        <span className={`font-semibold tabular-nums ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
          {isUnlimited
            ? <span className="text-emerald-600 dark:text-emerald-400">Unlimited</span>
            : `${used.toLocaleString()} / ${limit.toLocaleString()}`
          }
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-primary-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── PlanCard ──────────────────────────────────────────────────────────────────
function PlanCard({ plan, currentPlan, interval, onSelect, loadingId }) {
  const meta        = PLAN_META[plan.id] || {};
  const isCurrent   = plan.id === currentPlan;
  const currentRank = PLAN_ORDER.indexOf(currentPlan);
  const planRank    = PLAN_ORDER.indexOf(plan.id);
  const isDowngrade = planRank < currentRank;
  const price       = plan.price?.[interval] ?? plan.price?.monthly ?? 0;
  const yearlyPrice = plan.price?.yearly;

  return (
    <div className={`card p-6 flex flex-col relative transition-all duration-200
      ${isCurrent ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow-md hover:-translate-y-0.5'}
      ${meta.popular && !isCurrent ? 'ring-2 ring-violet-400' : ''}
    `}>
      {meta.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <Star size={10} fill="currentColor" /> Most Popular
          </span>
        </div>
      )}
      <div className="mb-5">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center mb-3`}>
          <Zap size={18} className="text-white" />
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white text-xl">{plan.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          {price === null ? (
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Custom</span>
          ) : (
            <>
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                ${interval === 'yearly' && yearlyPrice ? Math.round(yearlyPrice / 12) : price}
              </span>
              {price > 0 && <span className="text-sm text-gray-400">/mo</span>}
            </>
          )}
        </div>
        {interval === 'yearly' && yearlyPrice && price > 0 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            Billed ${yearlyPrice}/year — save ${(price * 12 - yearlyPrice)}/yr
          </p>
        )}
        {isCurrent && (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-semibold px-3 py-1 rounded-full border border-primary-200 dark:border-primary-800">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
              Current Plan
            </span>
          </div>
        )}
      </div>

      {/* Limits — all keyed as { messages, credits, agents, documents } */}
      <div className="space-y-1.5 mb-5 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        {[
          { label: 'Messages/mo', value: plan.limits?.messages },
          { label: 'AI Credits',  value: plan.limits?.credits },
          { label: 'Team Members', value: plan.limits?.agents },
          { label: 'Documents',   value: plan.limits?.documents },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {value === null
                ? <span className="text-emerald-600 dark:text-emerald-400">Unlimited</span>
                : value?.toLocaleString() ?? '—'}
            </span>
          </div>
        ))}
      </div>

      <ul className="space-y-2 flex-1 mb-6">
        {(plan.features || []).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
            <span className="capitalize">{f.replace(/_/g, ' ')}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={isCurrent ? 'secondary' : meta.popular ? 'primary' : 'secondary'}
        className="w-full"
        disabled={isCurrent}
        loading={loadingId === plan.id}
        onClick={() => onSelect(plan.id)}
        icon={!isCurrent && !loadingId ? (isDowngrade ? ChevronDown : ArrowRight) : undefined}
      >
        {isCurrent             ? 'Current Plan'
          : plan.id === 'enterprise' ? 'Contact Sales'
          : isDowngrade        ? 'Downgrade'
          : 'Upgrade'}
      </Button>
    </div>
  );
}

// ── Billing page ──────────────────────────────────────────────────────────────
export default function Billing() {
  const { user, updateUser }             = useAuth();
  const [searchParams, setSearchParams]  = useSearchParams();

  const [plans,       setPlans]       = useState([]);
  const [sub,         setSub]         = useState(null);
  const [invoices,    setInvoices]    = useState([]);
  const [loadingId,   setLoadingId]   = useState(null);
  const [loadingSub,  setLoadingSub]  = useState(true);
  const [interval,    setInterval]    = useState('monthly');
  const [showCancel,  setShowCancel]  = useState(false);

  const loadSubscription = useCallback(async () => {
    setLoadingSub(true);
    try {
      const res = await getSubscription();
      setSub(res.subscription);
      // Keep auth context in sync so sidebar plan badge stays current
      if (res.subscription?.plan !== user?.companyId?.plan) {
        updateUser({ companyId: { ...user?.companyId, plan: res.subscription.plan } });
      }
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => {
    getBillingPlans().then((r) => setPlans(r.plans || [])).catch(() => {});
    loadSubscription();
    getInvoices().then((r) => setInvoices(r.invoices || [])).catch(() => {});

    // Re-fetch when tab regains focus (usage may have changed)
    window.addEventListener('focus', loadSubscription);
    return () => window.removeEventListener('focus', loadSubscription);
  }, [loadSubscription]);

  // Handle Stripe redirect query params
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (!checkout) return;
    if (checkout === 'success') {
      toast.success(`🎉 Plan updated successfully!`);
      loadSubscription();
    } else if (checkout === 'canceled') {
      toast('Upgrade canceled.', { icon: 'ℹ️' });
    } else if (checkout === 'credits') {
      toast.success('AI credits added successfully!');
      loadSubscription();
    }
    setSearchParams({}, { replace: true });
  }, [searchParams]);

  const currentPlan = sub?.plan || user?.company?.plan || 'free';
  const isPaid      = currentPlan !== 'free';
  const isCanceling = sub?.cancelAtPeriodEnd;

  // Normalized from backend — null means Unlimited
  const limits  = sub?.limits  || {};
  const usage   = sub?.usage   || {};
  const credits = sub?.credits || {};

  const getErrMsg = (err) => err?.message || 'Something went wrong. Please try again.';

  const handleSelect = async (planId) => {
    if (planId === 'enterprise') {
      toast('Contact us at sales@supportai.com', { icon: '📧' });
      return;
    }
    if (planId === currentPlan) return;
    setLoadingId(planId);
    try {
      const res = await createCheckoutSession({ planId, interval });
      if (res?.url) window.location.href = res.url;
      else { toast.success('Plan updated!'); await loadSubscription(); }
    } catch (err) {
      toast.error(getErrMsg(err));
    } finally {
      setLoadingId(null);
    }
  };

  const handlePortal = async () => {
    try {
      const res = await createPortalSession();
      if (res?.url) window.location.href = res.url;
    } catch (err) { toast.error(getErrMsg(err)); }
  };

  const handleCancel = async (immediately) => {
    setShowCancel(false);
    try {
      const res = await cancelSubscription({ immediately });
      toast.success(res.message);
      await loadSubscription();
    } catch (err) { toast.error(getErrMsg(err)); }
  };

  const handleReactivate = async () => {
    try {
      const res = await (await import('../api')).reactivateSubscription();
      toast.success(res.message);
      await loadSubscription();
    } catch (err) { toast.error(getErrMsg(err)); }
  };

  const handleCreditTopUp = async (pack) => {
    try {
      const res = await api.post('/billing/credits/topup', { pack });
      if (res?.url) window.location.href = res.url;
    } catch (err) { toast.error(getErrMsg(err)); }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Billing & Plans</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your subscription, usage, and billing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={loadSubscription} size="sm" loading={loadingSub} />
          {isPaid && <Button variant="secondary" icon={CreditCard} onClick={handlePortal}>Billing Portal</Button>}
        </div>
      </div>

      {/* Current Plan + Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Plan status + credits */}
        <div className="card p-5 col-span-1">
          {loadingSub ? (
            <div className="space-y-3">
              <div className="skeleton h-12 rounded-xl" />
              <div className="skeleton h-4 rounded" />
              <div className="skeleton h-4 rounded w-2/3" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Current Plan</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{currentPlan}</h2>
                    <Badge
                      label={sub?.subscriptionStatus || 'active'}
                      variant={sub?.subscriptionStatus === 'past_due' ? 'danger' : 'success'}
                      dot
                    />
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${PLAN_META[currentPlan]?.gradient || 'from-gray-400 to-gray-600'} flex items-center justify-center`}>
                  <Zap size={20} className="text-white" />
                </div>
              </div>

              {isCanceling && sub?.currentPeriodEnd && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">Cancels on {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
                    <button onClick={handleReactivate} className="underline mt-0.5">Reactivate</button>
                  </div>
                </div>
              )}

              {sub?.currentPeriodEnd && !isCanceling && (
                <p className="text-xs text-gray-400">
                  Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}

              {/* AI Credits balance */}
              <div className="p-3 bg-gradient-to-r from-primary-50 to-violet-50 dark:from-primary-900/20 dark:to-violet-900/20 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <Coins size={14} className="text-primary-500" /> AI Credits
                  </div>
                  <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                    {limits.credits === null
                      ? <span className="text-emerald-600 dark:text-emerald-400">Unlimited</span>
                      : `${(credits.balance ?? 0).toLocaleString()} left`}
                  </span>
                </div>
                {limits.credits !== null && (
                  <div className="h-1.5 bg-white/60 dark:bg-gray-800/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((credits.balance || 0) / limits.credits) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Buy credits */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Buy Credits</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { pack: 'small',  label: '500',   price: '$5'  },
                    { pack: 'medium', label: '2,000', price: '$15' },
                    { pack: 'large',  label: '10K',   price: '$50' },
                  ].map((c) => (
                    <button key={c.pack} onClick={() => handleCreditTopUp(c.pack)}
                      className="p-2 text-center border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{c.label}</p>
                      <p className="text-[10px] text-gray-400">{c.price}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Usage meters — all driven by live API data */}
        <div className="card p-5 col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-400" /> Usage This Month
          </h3>
          {loadingSub ? (
            <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <UsageMeter label="Messages"   icon={MessageSquare} used={usage.messages}  limit={limits.messages}  />
              <UsageMeter label="AI Credits" icon={Coins}         used={usage.credits}   limit={limits.credits}   />
              <UsageMeter label="Team Members" icon={Users}         used={usage.agents}    limit={limits.agents}    />
              <UsageMeter label="Documents"  icon={BookOpen}      used={usage.documents} limit={limits.documents} />
            </div>
          )}
        </div>
      </div>

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
          {['monthly', 'yearly'].map((iv) => (
            <button key={iv} onClick={() => setInterval(iv)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                interval === iv
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              {iv}
              {iv === 'yearly' && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">–17%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            interval={interval}
            onSelect={handleSelect}
            loadingId={loadingId}
          />
        ))}
      </div>

      {/* Cancel subscription */}
      {isPaid && !isCanceling && (
        <div className="card p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200">Cancel Subscription</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                You will be downgraded to Free at the end of your billing period.
              </p>
            </div>
            <Button variant="danger" onClick={() => setShowCancel(true)}>Cancel Plan</Button>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCancel(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-800 animate-slide-in">
            <button onClick={() => setShowCancel(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={16} />
            </button>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Cancel subscription?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Cancel at period end to keep access until{' '}
              <strong>{sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'billing end'}</strong>,
              or cancel immediately and lose access now.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" className="w-full justify-center" onClick={() => handleCancel(false)}>
                Cancel at period end
              </Button>
              <Button variant="danger" className="w-full justify-center" onClick={() => handleCancel(true)}>
                Cancel immediately
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice history */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Receipt size={18} className="text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Invoice History</h2>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {invoices.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <FileText size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-gray-400 text-sm">No invoices yet. They'll appear here after your first payment.</p>
            </div>
          ) : invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">{inv.number}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {inv.periodStart && inv.periodEnd
                    ? `${new Date(inv.periodStart).toLocaleDateString()} – ${new Date(inv.periodEnd).toLocaleDateString()}`
                    : new Date(inv.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {inv.currency} {inv.amount.toFixed(2)}
                </span>
                <Badge
                  label={inv.status}
                  variant={inv.status === 'paid' ? 'success' : inv.status === 'open' ? 'warning' : 'danger'}
                  dot
                />
                {inv.pdfUrl && (
                  <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    title="Download PDF">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
