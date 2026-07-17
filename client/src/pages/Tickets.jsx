import { useEffect, useState } from 'react';
import { Plus, Search, Filter, MoreVertical, RefreshCw, ChevronRight, Clock, User } from 'lucide-react';
import { getTickets, createTicket, updateTicket, deleteTicket, getTeam } from '../api';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { Table, Thead, Th, Tbody, Tr, Td } from '../components/ui/Table';
import toast from 'react-hot-toast';

const STATUSES  = ['', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];
const PRIORITIES = ['', 'low', 'medium', 'high', 'urgent'];

function TicketModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', reportedBy: { name: '', email: '' } });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setReporter = (k) => (e) => setForm((p) => ({ ...p, reportedBy: { ...p.reportedBy, [k]: e.target.value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) return toast.error('Title and description required');
    setLoading(true);
    try {
      await createTicket(form);
      toast.success('Ticket created');
      onSaved();
      onClose();
      setForm({ title: '', description: '', priority: 'medium', reportedBy: { name: '', email: '' } });
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Ticket" size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={handleSubmit}>Create Ticket</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Subject" value={form.title} onChange={set('title')} placeholder="Brief description of the issue" />
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[100px] resize-none" value={form.description} onChange={set('description')} placeholder="Detailed description..." />
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={form.priority} onChange={set('priority')}>
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Reporter name" value={form.reportedBy.name} onChange={setReporter('name')} placeholder="John Doe" />
          <Input label="Reporter email" type="email" value={form.reportedBy.email} onChange={setReporter('email')} placeholder="john@co.com" />
        </div>
      </form>
    </Modal>
  );
}

function TicketDetail({ ticket, onClose, onUpdate }) {
  const [status, setStatus] = useState(ticket.status);
  const [assignedTo, setAssignedTo] = useState(ticket.assignedTo?._id || '');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTeam().then((r) => setMembers(r.members || [])).catch(() => {});
  }, []);

  const handleStatus = async (s) => {
    setLoading(true);
    try {
      await updateTicket(ticket._id, { status: s });
      setStatus(s);
      onUpdate();
      toast.success('Status updated');
    } catch { toast.error('Failed to update'); }
    finally { setLoading(false); }
  };

  const handleAssign = async (userId) => {
    setLoading(true);
    try {
      await updateTicket(ticket._id, { assignedTo: userId || null });
      setAssignedTo(userId);
      onUpdate();
      toast.success(userId ? 'Ticket assigned' : 'Assignment removed');
    } catch { toast.error('Failed to assign'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={`#${ticket._id?.slice(-6).toUpperCase()} — ${ticket.title}`} size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge label={status.replace('_', ' ')} variant={status} dot />
          <Badge label={ticket.priority} variant={ticket.priority} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{ticket.description}</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reporter</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{ticket.reportedBy?.name || '—'}</p>
            <p className="text-gray-400 text-xs">{ticket.reportedBy?.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Assign To</p>
            <select
              className="input py-1.5 text-sm"
              value={assignedTo}
              disabled={loading}
              onChange={(e) => handleAssign(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
          {ticket.resolvedAt && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resolved</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{new Date(ticket.resolvedAt).toLocaleString()}</p>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {['open', 'in_progress', 'waiting', 'resolved', 'closed'].map((s) => (
              <button key={s} disabled={s === status || loading}
                onClick={() => handleStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                  s === status ? 'ring-2 ring-primary-500' : 'hover:scale-105'
                }`}>
                <Badge label={s.replace('_', ' ')} variant={s} />
              </button>
            ))}
          </div>
        </div>
        {ticket.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ticket.tags.map((t) => <span key={t} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-xs">{t}</span>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage]       = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTickets({ status: status || undefined, priority: priority || undefined, page, limit: 15 });
      setTickets(res.tickets || []);
      setTotal(res.total || 0);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status, priority, page]);

  const filtered = tickets.filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.reportedBy?.email?.includes(search)
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Tickets</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">{total} total tickets</p>
        </div>
        <Button icon={Plus} onClick={() => setShowCreate(true)}>New Ticket</Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." />
          </div>
          <select className="input sm:w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'All statuses'}</option>)}
          </select>
          <select className="input sm:w-36" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All priorities'}</option>)}
          </select>
          <Button variant="secondary" icon={RefreshCw} onClick={load} size="md" className="shrink-0" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table>
          <Thead>
            <Th>Ticket</Th><Th>Reporter</Th><Th>Priority</Th><Th>Status</Th><Th>Assigned</Th><Th>Created</Th><Th />
          </Thead>
          <Tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <Tr key={i}><Td colSpan={7}><div className="skeleton h-10 rounded-lg" /></Td></Tr>
              ))
            ) : filtered.length === 0 ? (
              <Tr><Td colSpan={7} className="text-center py-12 text-gray-400">No tickets found</Td></Tr>
            ) : filtered.map((t) => (
              <Tr key={t._id} onClick={() => setSelected(t)}>
                <Td>
                  <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{t.title}</div>
                  <div className="text-xs text-gray-400">#{t._id?.slice(-6).toUpperCase()}</div>
                </Td>
                <Td>
                  <div className="text-sm">{t.reportedBy?.name || '—'}</div>
                  <div className="text-xs text-gray-400">{t.reportedBy?.email}</div>
                </Td>
                <Td><Badge label={t.priority} variant={t.priority} /></Td>
                <Td><Badge label={t.status.replace('_', ' ')} variant={t.status} dot /></Td>
                <Td>
                  {t.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">{t.assignedTo.name?.[0]}</span>
                      </div>
                      <span className="text-sm">{t.assignedTo.name}</span>
                    </div>
                  ) : <span className="text-gray-400 text-sm">Unassigned</span>}
                </Td>
                <Td><span className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span></Td>
                <Td><ChevronRight size={16} className="text-gray-300 dark:text-gray-600" /></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / 15)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <TicketModal open={showCreate} onClose={() => setShowCreate(false)} onSaved={load} />
      {selected && <TicketDetail ticket={selected} onClose={() => setSelected(null)} onUpdate={load} />}
    </div>
  );
}
