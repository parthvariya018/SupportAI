import axios from 'axios';

const STORAGE_KEY = 'supportai_auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const { token } = JSON.parse(raw);
      if (token && token !== 'null') config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status  = err.response?.status;
    const message = err.response?.data?.message || err.message || 'Network error';
    if (status === 401) {
      const current = window.location.pathname;
      if (current !== '/login' && current !== '/register') {
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = '/login';
      }
    }
    return Promise.reject({ message, status });
  }
);

// ── Auth ────────────────────────────────────────────────────────────────────
export const register       = (data)  => api.post('/auth/register', data);
export const login          = (data)  => api.post('/auth/login', data);
export const getMe          = ()      => api.get('/auth/me');
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword  = (token, password) => api.post(`/auth/reset-password/${token}`, { password });

// ── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard/stats');

// ── Analytics ──────────────────────────────────────────────────────────────
export const getAnalyticsOverview     = ()       => api.get('/analytics/overview');
export const getConversationAnalytics = ()       => api.get('/analytics/conversations');
export const getTicketAnalytics       = ()       => api.get('/analytics/tickets');
export const getVolumeAnalytics       = (days)   => api.get('/analytics/volume', { params: { days } });
export const getAgentAnalytics        = ()       => api.get('/analytics/agents');
export const getCSATAnalytics         = (days)   => api.get('/analytics/csat', { params: { days } });
export const getLeadAnalytics         = (days)   => api.get('/analytics/leads', { params: { days } });

// ── Documents ──────────────────────────────────────────────────────────────
export const uploadDocument = (form) => api.post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getDocuments         = ()     => api.get('/documents');
export const getDocumentContent   = (id)   => api.get(`/documents/${id}`);
export const searchDocuments      = (q)    => api.get('/documents/search', { params: { q } });
export const deleteDocument = (id)   => api.delete(`/documents/${id}`);
export const getModels = () => api.get('/models');

// ── Chat ────────────────────────────────────────────────────────────────────
export const sendChatMessage        = ({ selectedModel, ...rest }) =>
  api.post('/chat/message', selectedModel ? { ...rest, modelId: selectedModel } : rest);

/**
 * sendChatMessageStream — SSE streaming variant.
 * Calls onToken(chunk) for each token, then resolves with { sessionId, sources, model }.
 * Falls back to sendChatMessage if the model doesn't support streaming.
 */
export function sendChatMessageStream({ message, sessionId, modelId, onToken }) {
  return new Promise(async (resolve, reject) => {
    let raw;
    try {
      const headers = { 'Content-Type': 'application/json' };
      try {
        const stored = localStorage.getItem('supportai_auth');
        if (stored) {
          const { token } = JSON.parse(stored);
          if (token && token !== 'null') headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {}

      raw = await fetch('/api/chat/stream', {
        method:  'POST',
        headers,
        body:    JSON.stringify({ message, sessionId, modelId }),
      });
    } catch (err) {
      return reject({ message: err.message || 'Network error' });
    }

    if (!raw.ok) {
      try {
        const json = await raw.json();
        return reject({ message: json.message || `HTTP ${raw.status}`, status: raw.status });
      } catch {
        return reject({ message: `HTTP ${raw.status}`, status: raw.status });
      }
    }

    const reader  = raw.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    const processLine = (line) => {
      if (!line.startsWith('data:')) return;
      try {
        return JSON.parse(line.slice(5).trim());
      } catch { return null; }
    };

    let   eventType = '';
    const result    = {};

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event:')) { eventType = trimmed.slice(6).trim(); continue; }
        if (!trimmed) { eventType = ''; continue; }

        const data = processLine(trimmed);
        if (!data) continue;

        if (eventType === 'token') {
          onToken(data.token);
        } else if (eventType === 'done') {
          Object.assign(result, data);
        } else if (eventType === 'error') {
          return reject({ message: data.message || 'Stream error' });
        }
      }
    }

    resolve(result);
  });
}
export const getChatHistory          = (params)     => api.get('/chat/history', { params });
export const searchConversations     = (q, params)  => api.get('/chat/search', { params: { q, ...params } });
export const pinConversation         = (id, pinned) => api.patch(`/chat/${id}/pin`, { pinned });
export const getChatById             = (id)         => api.get(`/chat/history/${id}`);
export const deleteChatConversation  = (id)         => api.delete(`/chat/history/${id}`);
export const renameChatConversation  = (id, title)  => api.patch(`/chat/history/${id}`, { title });
export const renameConversationTitle = (id, title)  => api.patch(`/chat/${id}/title`, { title });

// ── Leads ───────────────────────────────────────────────────────────────────
export const getLeads   = (params) => api.get('/leads', { params });
export const createLead = (data)   => api.post('/leads', data);

// ── Tickets ─────────────────────────────────────────────────────────────────
export const getTickets    = (params)     => api.get('/tickets', { params });
export const createTicket  = (data)       => api.post('/tickets', data);
export const getTicket     = (id)         => api.get(`/tickets/${id}`);
export const updateTicket  = (id, data)   => api.patch(`/tickets/${id}`, data);
export const deleteTicket  = (id)         => api.delete(`/tickets/${id}`);
export const addTicketNote = (id, data)   => api.post(`/tickets/${id}/notes`, data);

// ── Knowledge Base ──────────────────────────────────────────────────────────
export const getArticles   = (params)     => api.get('/knowledge', { params });
export const createArticle = (data)       => api.post('/knowledge', data);
export const getArticle    = (id)         => api.get(`/knowledge/${id}`);
export const updateArticle = (id, data)   => api.patch(`/knowledge/${id}`, data);
export const deleteArticle = (id)         => api.delete(`/knowledge/${id}`);
export const voteArticle   = (id, helpful) => api.post(`/knowledge/${id}/vote`, { helpful });

// ── Team ─────────────────────────────────────────────────────────────────────
export const getTeam          = ()           => api.get('/team');
export const inviteMember     = (data)       => api.post('/team/invite', data);
export const acceptInvite     = (token, data) => api.post(`/team/invite/accept/${token}`, data);
export const updateMemberRole = (id, role)   => api.patch(`/team/${id}/role`, { role });
export const removeMember     = (id)         => api.delete(`/team/${id}`);
export const getTeamGroups    = ()           => api.get('/team/groups');
export const createTeamGroup  = (data)       => api.post('/team/groups', data);
export const updateTeamGroup  = (id, data)   => api.patch(`/team/groups/${id}`, data);
export const deleteTeamGroup  = (id)         => api.delete(`/team/groups/${id}`);

// ── Billing ──────────────────────────────────────────────────────────────────
export const getBillingPlans          = ()      => api.get('/billing/plans');
export const getSubscription          = ()      => api.get('/billing/subscription');
export const getBillingUsage          = (days)  => api.get('/billing/usage', { params: { days } });
export const createCheckoutSession    = (data)  => api.post('/billing/subscribe', data);
export const upgradeSubscription      = (data)  => api.post('/billing/upgrade', data);
export const createPortalSession      = ()      => api.post('/billing/portal');
export const cancelSubscription       = (data)  => api.post('/billing/cancel', data);
export const reactivateSubscription   = ()      => api.post('/billing/reactivate');
export const getInvoices              = ()      => api.get('/billing/invoices');

// ── Settings ─────────────────────────────────────────────────────────────────
export const getSettings       = ()     => api.get('/settings');
export const updateProfile     = (data) => api.patch('/settings/profile', data);
export const updateCompany     = (data) => api.patch('/settings/company', data);
export const updatePassword    = (data) => api.patch('/settings/password', data);
export const updateWidget      = (data) => api.patch('/settings/widget', data);
export const updateDefaultModel = (modelId) => api.patch('/settings/default-model', { modelId });
export const getApiKey         = ()     => api.get('/settings/api-key');
export const regenerateApiKey  = ()     => api.post('/settings/api-key/rotate');

export default api;
