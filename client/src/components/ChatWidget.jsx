import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, RefreshCw, AlertCircle } from 'lucide-react';
import axios from 'axios';

// ── Typing indicator — three bouncing dots ────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ message, primaryColor, onRetry }) {
  const isUser  = message.role === 'user';
  const isError = message.role === 'error';

  if (isError) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{message.content}</span>
          {onRetry && (
            <button
              onClick={() => onRetry(message.originalMessage)}
              className="shrink-0 p-1 rounded hover:bg-red-100 transition-colors"
              title="Retry"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-2xl leading-relaxed text-sm whitespace-pre-wrap ${
          isUser
            ? 'text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
        style={isUser ? { background: primaryColor } : {}}
      >
        {message.content}
      </div>
    </div>
  );
}

export default function ChatWidget({ apiKey, primaryColor = '#2563eb' }) {
  const [open,      setOpen]      = useState(false);
  const [messages,  setMessages]  = useState([
    { role: 'assistant', content: 'Hi! How can I help you today?' },
  ]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showLead,  setShowLead]  = useState(false);
  const [lead,      setLead]      = useState({ name: '', email: '', phone: '' });
  const [leadSent,  setLeadSent]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const { data } = await axios.post(
        '/api/chat/message',
        selectedModel ? { message: userMsg, sessionId, selectedModel } : { message: userMsg, sessionId },
        { headers: { 'x-api-key': apiKey }, timeout: 35_000 }
      );

      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);

      // Show lead form after 3 exchanges if not already shown/submitted
      if (!showLead && !leadSent && messages.length >= 4) setShowLead(true);

    } catch (err) {
      // FIX: extract the real error message from every possible error shape
      const apiMsg  = err.response?.data?.message;
      const status  = err.response?.status;

      let userFacingMsg = 'Something went wrong. Please try again.';
      if (status === 429)       userFacingMsg = 'You\'re sending messages too quickly. Please wait a moment.';
      else if (status === 402)  userFacingMsg = 'AI credits exhausted. Please contact support.';
      else if (status === 503)  userFacingMsg = 'AI service is temporarily unavailable. Please try again.';
      else if (status === 401)  userFacingMsg = 'Invalid API key. Please contact support.';
      else if (err.code === 'ECONNABORTED') userFacingMsg = 'Request timed out. Please try again.';
      else if (apiMsg)          userFacingMsg = apiMsg;

      setMessages((prev) => [...prev, {
        role:            'error',
        content:         userFacingMsg,
        originalMessage: userMsg, // stored for the retry button
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, apiKey, showLead, leadSent, messages.length]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Lead form submit ────────────────────────────────────────────────────────
  const submitLead = async () => {
    if (!lead.name.trim() || !lead.email.trim()) return;
    try {
      await axios.post(
        '/api/leads',
        { ...lead, sessionId },
        { headers: { 'x-api-key': apiKey } }
      );
      setShowLead(false);
      setLeadSent(true);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Thanks! We've got your details and we'll be in touch soon. 😊",
      }]);
    } catch {
      // Non-fatal — dismiss the form silently
      setShowLead(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div
            className="p-4 flex items-center justify-between text-white shrink-0"
            style={{ background: primaryColor }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              <span className="font-semibold text-sm">Support Chat</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                primaryColor={primaryColor}
                onRetry={m.role === 'error' ? sendMessage : null}
              />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Lead capture form */}
          {showLead && (
            <div className="p-3 border-t border-gray-100 bg-gray-50 space-y-2 shrink-0">
              <p className="text-xs text-gray-600 font-medium">
                Want us to follow up? Leave your details:
              </p>
              {['name', 'email', 'phone'].map((f) => (
                <input
                  key={f}
                  type={f === 'email' ? 'email' : 'text'}
                  placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                  value={lead[f]}
                  onChange={(e) => setLead((p) => ({ ...p, [f]: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
                />
              ))}
              <div className="flex gap-2">
                <button
                  onClick={submitLead}
                  className="flex-1 text-xs text-white rounded-lg py-1.5 font-medium"
                  style={{ background: primaryColor }}
                >
                  Submit
                </button>
                <button
                  onClick={() => setShowLead(false)}
                  className="text-xs text-gray-400 px-2 py-1.5 hover:text-gray-600"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              disabled={loading}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 disabled:bg-gray-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{ background: primaryColor }}
              className="p-2 rounded-lg text-white disabled:opacity-40 transition-opacity"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: primaryColor }}
        className="w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open
          ? <X size={22} />
          : <MessageCircle size={26} />
        }
      </button>
    </div>
  );
}
