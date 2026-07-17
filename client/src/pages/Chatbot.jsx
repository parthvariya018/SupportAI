import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Send, Loader2, Bot, User, RefreshCw,
  MessageSquare, Trash2, Pencil, Check, X,
  ChevronDown, FileText, Clock, Sparkles,
} from 'lucide-react';
import {
  sendChatMessage, sendChatMessageStream, getChatHistory, getChatById,
  deleteChatConversation, renameChatConversation,
} from '../api';
import { useAuth }  from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import Badge        from '../components/ui/Badge';
import Modal        from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import ModelSelector from '../components/ui/ModelSelector';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(date) {
  const d = new Date(date);
  const today = new Date();
  const diff  = today.setHours(0,0,0,0) - d.setHours(0,0,0,0);
  if (diff === 0) return 'Today';
  if (diff === 86400000) return 'Yesterday';
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Very lightweight markdown renderer — handles **bold**, `code`, and newlines.
 * No external dependency required.
 */
function FormattedMessage({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="px-1 py-0.5 rounded text-[11px] bg-black/10 dark:bg-white/10 font-mono">{p.slice(1, -1)}</code>;
        if (p === '\n')
          return <br key={i} />;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3.5">
        <div className="flex gap-1.5 items-center">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
              style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SourceDocs({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
        <FileText size={11} />
        {sources.length} source{sources.length > 1 ? 's' : ''}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 pl-1">
          {sources.map((s, i) => (
            <div key={i} className="text-[11px] bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2.5 py-1.5 border border-gray-100 dark:border-gray-700">
              <p className="font-medium text-gray-600 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                <FileText size={10} /> {s.originalName}
              </p>
              <p className="text-gray-400 dark:text-gray-500 line-clamp-2 leading-relaxed">{s.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatMessage({ role, content, sources, timestamp }) {
  const isBot = role === 'assistant';
  return (
    <div className={`flex gap-2.5 group ${isBot ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-1 ${
        isBot ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
      }`}>
        {isBot ? <Bot size={14} /> : <User size={14} />}
      </div>

      <div className={`flex flex-col max-w-[78%] ${isBot ? '' : 'items-end'}`}>
        {/* Bubble */}
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isBot
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
            : 'bg-primary-600 text-white rounded-tr-sm'
        }`}>
          <FormattedMessage text={content} />
        </div>

        {/* Sources — only for bot messages */}
        {isBot && <SourceDocs sources={sources} />}

        {/* Timestamp */}
        {timestamp && (
          <span className="text-[10px] text-gray-300 dark:text-gray-600 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {fmtTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

// Inline-editable title for history items
function EditableTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const inputRef = useRef();

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (!editing) return (
    <span className="flex items-center gap-1 min-w-0">
      <span className="truncate">{value}</span>
      <button onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
        className="shrink-0 text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil size={11} />
      </button>
    </span>
  );

  return (
    <span className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
      <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary-400 outline-none text-gray-800 dark:text-gray-200" />
      <button onClick={save}   className="text-green-500 shrink-0"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="text-gray-400 shrink-0"><X size={12} /></button>
    </span>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Chatbot() {
  const { user } = useAuth();
  const companyName = user?.company?.name || 'AI';

  const { data: historyData, loading: historyLoading, refetch: refetchHistory }
    = useAsync(getChatHistory);
  const historyList = historyData?.conversations ?? [];

  // Active conversation shown in the history thread pane
  const [activeConv,    setActiveConv]    = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);

  // Live chat panel state
  const WELCOME = { role: 'assistant', content: `Hi! I'm ${companyName}'s AI assistant. Ask me anything about our products or services.`, timestamp: new Date() };
  const [messages,   setMessages]   = useState([WELCOME]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [sessionId,  setSessionId]  = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelList,     setModelList]     = useState([]);
  const [showHistory, setShowHistory] = useState(false); // mobile toggle

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ── send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setMessages(p => [...p, { role: 'user', content: text, timestamp: new Date() }]);
    setSending(true);

    const canStream = modelList.find(m => m.id === selectedModel)?.supportsStreaming ?? false;

    try {
      if (canStream) {
        const streamKey = Date.now();
        setMessages(p => [...p, { role: 'assistant', content: '', sources: [], timestamp: new Date(), _streamKey: streamKey }]);
        setSending(false); // hide typing indicator — bubble is already visible

        const res = await sendChatMessageStream({
          message:  text,
          sessionId,
          modelId:  selectedModel,
          onToken:  (token) => setMessages(p =>
            p.map(m => m._streamKey === streamKey ? { ...m, content: m.content + token } : m)
          ),
        });

        setSessionId(res.sessionId);
        setMessages(p => p.map(m =>
          m._streamKey === streamKey ? { ...m, sources: res.sources ?? [] } : m
        ));
        refetchHistory();
      } else {
        const res = await sendChatMessage({ message: text, sessionId, selectedModel });
        setSessionId(res.sessionId);
        setMessages(p => [...p, {
          role: 'assistant', content: res.reply, sources: res.sources, timestamp: new Date(),
        }]);
        refetchHistory();
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to get AI response');
      setMessages(p => [...p, {
        role: 'assistant',
        content: err?.message || 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // ── reset chat ──────────────────────────────────────────────────────────────
  const resetChat = () => {
    setMessages([{ ...WELCOME, timestamp: new Date() }]);
    setSessionId(null);
    setInput('');
    inputRef.current?.focus();
  };

  // ── load history thread ─────────────────────────────────────────────────────
  const loadThread = async (conv) => {
    setActiveConv(conv);
    setThreadLoading(true);
    setShowHistory(true);
    try {
      const res = await getChatById(conv._id);
      setActiveConv(res.conversation);
    } catch {
      toast.error('Could not load conversation');
    } finally {
      setThreadLoading(false);
    }
  };

  // ── rename ──────────────────────────────────────────────────────────────────
  const handleRename = async (id, title) => {
    try {
      await renameChatConversation(id, title);
      refetchHistory();
      if (activeConv?._id === id) setActiveConv(p => ({ ...p, title }));
    } catch {
      toast.error('Rename failed');
    }
  };

  // ── delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteChatConversation(deleteTarget._id);
      toast.success('Conversation deleted');
      refetchHistory();
      if (activeConv?._id === deleteTarget._id) setActiveConv(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-5 h-[calc(100vh-7rem)] max-w-7xl mx-auto">

      {/* ── LEFT: Live chat ─────────────────────────────────────────────────── */}
      <div className="flex flex-col card overflow-hidden flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm shadow-primary-500/30">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-none">
                {companyName} AI
              </p>
              <p className="text-[11px] text-green-500 font-medium mt-0.5">Online</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile: toggle history */}
            <button onClick={() => setShowHistory(s => !s)}
              className="xl:hidden btn-secondary text-xs py-1.5 px-3 gap-1.5">
              <MessageSquare size={13} />
              History
            </button>
            <button onClick={resetChat} className="btn-secondary text-xs py-1.5 px-3 gap-1.5">
              <RefreshCw size={13} /> New chat
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {messages.map((m, i) => <ChatMessage key={m._streamKey ?? i} {...m} />)}
          {sending && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Session info bar */}
        {sessionId && (
          <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex items-center gap-2">
            <Clock size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400 font-mono">
              Session: {sessionId.slice(0, 8)}…
            </span>
            <Badge variant="blue" className="ml-auto">
              {messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0).length} messages
            </Badge>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          {/* Model selector — above the textarea */}
          <div className="flex items-center justify-between mb-2">
            <ModelSelector value={selectedModel} onChange={setSelectedModel} onModelsLoaded={setModelList} />
            <p className="text-[10px] text-gray-300 dark:text-gray-700">
              Answers based on your uploaded documents
            </p>
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
              rows={1}
              disabled={sending}
              className="input flex-1 py-2.5 resize-none leading-relaxed min-h-[42px] max-h-32 overflow-y-auto"
              style={{ height: 'auto' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            />
            <button onClick={handleSend}
              disabled={sending || !input.trim()}
              className="btn-primary px-3.5 py-2.5 shrink-0 self-end">
              {sending
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: History panel ─────────────────────────────────────────────── */}
      <div className={`
        ${showHistory ? 'flex' : 'hidden'} xl:flex
        flex-col w-72 shrink-0 card overflow-hidden
        xl:relative fixed inset-y-0 right-0 z-30
        xl:z-auto xl:top-auto xl:h-auto
        bg-white dark:bg-gray-900
      `}>
        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare size={14} className="text-primary-500" />
              Chat History
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {historyData?.total ?? 0} conversations
            </p>
          </div>
          <button onClick={() => setShowHistory(false)}
            className="xl:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* History list */}
        <div className={`overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 ${activeConv ? 'flex-none max-h-[45%]' : 'flex-1'}`}>
          {historyLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              ))}
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare size={28} className="text-gray-200 dark:text-gray-700 mb-2" />
              <p className="text-xs text-gray-400">No conversations yet</p>
            </div>
          ) : historyList.map(c => (
            <div key={c._id}
              onClick={() => loadThread(c)}
              className={`group flex items-start gap-2.5 px-4 py-3 cursor-pointer transition-colors
                hover:bg-gray-50 dark:hover:bg-gray-800/40
                ${activeConv?._id === c._id ? 'bg-primary-50 dark:bg-primary-900/10 border-l-2 border-primary-500' : ''}`}>

              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare size={13} className="text-gray-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  <EditableTitle value={c.title || 'Conversation'} onSave={t => handleRename(c._id, t)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{fmtDate(c.updatedAt)}</span>
                  {c.leadCaptured && <Badge variant="green">Lead</Badge>}
                  {c.messageCount > 0 && (
                    <span className="text-[10px] text-gray-300 dark:text-gray-600 ml-auto">
                      {c.messageCount} msg
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Thread view */}
        {activeConv && (
          <div className="flex-1 flex flex-col border-t border-gray-100 dark:border-gray-800 min-h-0">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
              <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 truncate flex-1">
                {activeConv.title || 'Conversation'}
              </p>
              <button onClick={() => setActiveConv(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 ml-2">
                <X size={13} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {threadLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className={`h-8 ${i % 2 === 0 ? 'w-4/5' : 'w-3/5 ml-auto'}`} />
                  ))}
                </div>
              ) : activeConv.messages?.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`text-[11px] px-2.5 py-1.5 rounded-xl max-w-[90%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}>
                    {m.content}
                    {m.sources?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 opacity-60">
                        <FileText size={9} />
                        <span>{m.sources.length} source{m.sources.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile backdrop */}
      {showHistory && (
        <div className="xl:hidden fixed inset-0 bg-black/40 z-20" onClick={() => setShowHistory(false)} />
      )}

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Conversation" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Delete{' '}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            "{deleteTarget?.title}"
          </span>
          ? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 size={14} className="animate-spin" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
