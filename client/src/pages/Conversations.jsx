import { useEffect, useState } from 'react';
import { getChatHistory, getChatById } from '../api';
import { MessageSquare } from 'lucide-react';

export default function Conversations() {
  const [list, setList]         = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getChatHistory().then(setList).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id) => {
    const conv = await getChatById(id);
    setSelected(conv);
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
      <div className="flex gap-4 h-[calc(100vh-160px)]">
        {/* List */}
        <div className="w-72 bg-white rounded-xl border border-gray-200 overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No conversations yet.</div>
          ) : list.map(c => (
            <button key={c._id} onClick={() => handleSelect(c._id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected?._id === c._id ? 'bg-primary-50' : ''}`}>
              <p className="text-sm font-medium text-gray-700 font-mono">{c.sessionId.slice(0, 12)}…</p>
              <div className="flex items-center gap-2 mt-0.5">
                {c.leadCaptured && <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded-full">Lead</span>}
                <span className="text-xs text-gray-400">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-y-auto p-5">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={36} className="mb-2 opacity-30" />
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selected.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-lg text-sm px-4 py-2 rounded-2xl ${
                    m.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
