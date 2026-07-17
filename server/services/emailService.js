/**
 * services/emailService.js
 *
 * Nodemailer wrapper with reusable HTML layout and all transactional emails.
 *
 * Graceful degradation:
 *   - Transport is created lazily on first use.
 *   - When SMTP vars are absent every send returns { skipped: true } — never throws.
 *   - In development the email content is printed to the console instead.
 *   - All failures are logged with [email] prefix — never bubble up to callers.
 *
 * Adding a new email: add one exported async function that calls _send().
 */

const nodemailer = require('nodemailer');

// ── Transport (lazy singleton) ────────────────────────────────────────────────
let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  _transport = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transport;
}

// ── Shared HTML layout ────────────────────────────────────────────────────────
function _layout(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:28px 32px">
            <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-.3px">SupportAI</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px">${bodyHtml}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5">
              SupportAI &mdash; AI Customer Support Platform<br>
              You received this email because of activity on your account.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared button component ───────────────────────────────────────────────────
function _btn(url, label, color = '#2563eb') {
  return `<a href="${url}" style="display:inline-block;margin:20px 0 8px;padding:12px 28px;background:${color};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${label}</a>`;
}

// ── Heading + paragraph helpers ───────────────────────────────────────────────
const _h = (t) => `<h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:700">${t}</h2>`;
const _p = (t) => `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.6">${t}</p>`;
const _small = (t) => `<p style="margin:16px 0 0;color:#9ca3af;font-size:13px;line-height:1.5">${t}</p>`;

// ── Internal send helper ──────────────────────────────────────────────────────
async function _send({ to, subject, html, text }) {
  const transport = getTransport();

  if (!transport) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[email:dev] ─────────────────────────────────────────`);
      console.log(`  To:      ${to}`);
      console.log(`  Subject: ${subject}`);
      if (text) console.log(`  Body:\n${text.split('\n').map(l => '  ' + l).join('\n')}`);
      console.log(`[email:dev] ─────────────────────────────────────────\n`);
    } else {
      console.warn(`[email] SMTP not configured — skipped email to: ${to} | subject: ${subject}`);
    }
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM || 'SupportAI <noreply@supportai.app>';
  await transport.sendMail({ from, to, subject, html, text });
  return { sent: true };
}

// ── Fire-and-forget wrapper ───────────────────────────────────────────────────
// All public functions use this so a failed email NEVER rejects the caller.
function _fire(promise, label) {
  promise.catch((err) =>
    console.error(`[email] Failed to send "${label}": ${err.message}`)
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Password reset
// ═════════════════════════════════════════════════════════════════════════════
async function sendPasswordReset(email, resetUrl) {
  const subject = 'Reset your SupportAI password';
  const html = _layout(
    _h('Reset your password') +
    _p('You requested a password reset for your SupportAI account. Click the button below — this link expires in <strong>1 hour</strong>.') +
    _btn(resetUrl, 'Reset Password') +
    _small('If you did not request this, you can safely ignore this email.')
  );
  const text = [
    'Reset your SupportAI password',
    '',
    'You requested a password reset. Use the link below (expires in 1 hour):',
    resetUrl,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');

  return _send({ to: email, subject, html, text });
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Welcome email (sent after successful registration)
// ═════════════════════════════════════════════════════════════════════════════
function sendWelcome(email, name, companyName) {
  const dashboardUrl = `${process.env.CLIENT_URL}/app/dashboard`;
  const subject = `Welcome to SupportAI, ${name}!`;
  const html = _layout(
    _h(`Welcome, ${name}! 🎉`) +
    _p(`Your company <strong>${companyName}</strong> is all set on SupportAI. You can now upload documents, configure your chat widget, and start supporting your customers with AI.`) +
    _btn(dashboardUrl, 'Go to Dashboard') +
    _small('Need help? Reply to this email or visit our docs.')
  );
  const text = [
    `Welcome to SupportAI, ${name}!`,
    '',
    `Your company "${companyName}" is all set.`,
    `Open your dashboard: ${dashboardUrl}`,
  ].join('\n');

  _fire(_send({ to: email, subject, html, text }), 'welcome');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Team invitation
// ═════════════════════════════════════════════════════════════════════════════
function sendInvite(email, inviterName, companyName, inviteUrl) {
  const subject = `${inviterName} invited you to join ${companyName} on SupportAI`;
  const html = _layout(
    _h(`You've been invited!`) +
    _p(`<strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on SupportAI as a team member.`) +
    _btn(inviteUrl, 'Accept Invitation') +
    _small('This invitation link expires in <strong>48 hours</strong>. If you were not expecting this, you can ignore this email.')
  );
  const text = [
    `${inviterName} invited you to join ${companyName} on SupportAI.`,
    '',
    `Accept your invitation: ${inviteUrl}`,
    '',
    'This link expires in 48 hours.',
  ].join('\n');

  _fire(_send({ to: email, subject, html, text }), 'invite');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Payment failed
// ═════════════════════════════════════════════════════════════════════════════
function sendPaymentFailed(email, companyName, amount, billingUrl) {
  const subject = 'Action required: Payment failed for SupportAI';
  const amountStr = amount ? ` of $${amount.toFixed(2)}` : '';
  const html = _layout(
    _h('Payment failed') +
    _p(`We were unable to process your payment${amountStr} for <strong>${companyName}</strong>'s SupportAI subscription.`) +
    _p('Please update your payment method to avoid any interruption to your service.') +
    _btn(billingUrl, 'Update Payment Method', '#dc2626') +
    _small('If you believe this is an error, please contact your bank or reply to this email.')
  );
  const text = [
    'Payment failed for SupportAI',
    '',
    `We could not process your payment${amountStr} for ${companyName}.`,
    `Update your payment method: ${billingUrl}`,
  ].join('\n');

  _fire(_send({ to: email, subject, html, text }), 'payment_failed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Subscription cancelled
// ═════════════════════════════════════════════════════════════════════════════
function sendSubscriptionCancelled(email, companyName, endDate, billingUrl) {
  const dateStr = endDate ? new Date(endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'the end of your billing period';
  const subject = 'Your SupportAI subscription has been cancelled';
  const html = _layout(
    _h('Subscription cancelled') +
    _p(`Your SupportAI subscription for <strong>${companyName}</strong> has been cancelled. You will retain access to your current plan until <strong>${dateStr}</strong>, after which your account will revert to the Free plan.`) +
    _btn(billingUrl, 'Reactivate Subscription') +
    _small('Changed your mind? You can reactivate at any time before the cancellation date.')
  );
  const text = [
    'Your SupportAI subscription has been cancelled.',
    '',
    `Access continues until: ${dateStr}`,
    `Reactivate: ${billingUrl}`,
  ].join('\n');

  _fire(_send({ to: email, subject, html, text }), 'subscription_cancelled');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. Trial ending reminder (3 days before)
// ═════════════════════════════════════════════════════════════════════════════
function sendTrialEnding(email, companyName, trialEndDate, billingUrl) {
  const dateStr = new Date(trialEndDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const subject = 'Your SupportAI trial ends in 3 days';
  const html = _layout(
    _h('Your free trial is ending soon') +
    _p(`Your 7-day free trial for <strong>${companyName}</strong> ends on <strong>${dateStr}</strong>. Add a payment method now to keep your current plan and avoid any interruption.`) +
    _btn(billingUrl, 'Add Payment Method') +
    _small('If you choose not to upgrade, your account will automatically move to the Free plan.')
  );
  const text = [
    'Your SupportAI trial ends in 3 days.',
    '',
    `Trial end date: ${dateStr}`,
    `Add a payment method: ${billingUrl}`,
  ].join('\n');

  _fire(_send({ to: email, subject, html, text }), 'trial_ending');
}

module.exports = {
  sendPasswordReset,
  sendWelcome,
  sendInvite,
  sendPaymentFailed,
  sendSubscriptionCancelled,
  sendTrialEnding,
  verifyTransport,
};

// ── SMTP connectivity check (call at startup) ─────────────────────────────────
// Returns { ok: true } when SMTP is reachable, { skipped: true } when not
// configured, or { ok: false, error } when credentials are wrong.
async function verifyTransport() {
  const transport = getTransport();
  if (!transport) return { skipped: true };
  try {
    await transport.verify();
    console.log('[email] SMTP transport verified ✔');
    return { ok: true };
  } catch (err) {
    console.error('[email] SMTP verification failed:', err.message);
    return { ok: false, error: err.message };
  }
}
