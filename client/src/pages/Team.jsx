import { useEffect, useState } from 'react';
import { UserPlus, Mail, Shield, Trash2, ChevronDown, Users } from 'lucide-react';
import { getTeam, inviteMember, updateMemberRole, removeMember } from '../api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { Table, Thead, Th, Tbody, Tr, Td } from '../components/ui/Table';
import toast from 'react-hot-toast';

const ROLES = ['agent', 'admin', 'viewer'];

function InviteModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', role: 'agent' });
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!form.email) return toast.error('Email required');
    setLoading(true);
    try {
      await inviteMember(form);
      toast.success('Invite sent!');
      onSaved();
      onClose();
      setForm({ email: '', role: 'agent' });
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite Team Member" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={handleInvite}>Send Invite</Button></>}>
      <form onSubmit={handleInvite} className="space-y-4">
        <Input label="Email address" type="email" icon={Mail} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="colleague@company.com" />
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-2">
            {form.role === 'admin' ? 'Can manage team, tickets, and settings' :
             form.role === 'agent' ? 'Can handle tickets and conversations' :
             'Read-only access to all data'}
          </p>
        </div>
      </form>
    </Modal>
  );
}

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTeam();
      setMembers(res.members || []);
    } catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (id, role) => {
    setUpdatingId(id);
    try {
      await updateMemberRole(id, role);
      toast.success('Role updated');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setUpdatingId(null); }
  };

  const handleRemove = async (id, name) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      await removeMember(id);
      toast.success('Member removed');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const isOwnerOrAdmin = ['owner', 'admin'].includes(user?.role);
  const roleCounts = members.reduce((acc, m) => { acc[m.role] = (acc[m.role] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Team Members</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwnerOrAdmin && <Button icon={UserPlus} onClick={() => setShowInvite(true)}>Invite Member</Button>}
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { role: 'owner', label: 'Owners', color: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' },
          { role: 'admin', label: 'Admins', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
          { role: 'agent', label: 'Team Members', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
          { role: 'viewer', label: 'Viewers', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
        ].map((s) => (
          <div key={s.role} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <Users size={16} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{roleCounts[s.role] || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div className="card overflow-hidden">
        <Table>
          <Thead>
            <Th>Member</Th><Th>Role</Th><Th>Status</Th><Th>Joined</Th>{isOwnerOrAdmin && <Th />}
          </Thead>
          <Tbody>
            {loading ? (
              [...Array(4)].map((_, i) => <Tr key={i}><Td colSpan={5}><div className="skeleton h-12 rounded-lg" /></Td></Tr>)
            ) : members.map((m) => (
              <Tr key={m._id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{m.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        {m.name}
                        {m._id === user?.id && <span className="text-[10px] bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 px-1.5 py-0.5 rounded font-semibold">You</span>}
                      </p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  {isOwnerOrAdmin && m.role !== 'owner' && m._id !== user?.id ? (
                    <div className="relative">
                      <select
                        value={m.role}
                        disabled={updatingId === m._id}
                        onChange={(e) => handleRoleChange(m._id, e.target.value)}
                        className="input py-1.5 pl-3 pr-8 text-xs w-32 appearance-none cursor-pointer"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  ) : <Badge label={m.role} variant={m.role} />}
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${m.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{m.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </Td>
                <Td><span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</span></Td>
                {isOwnerOrAdmin && (
                  <Td>
                    {m.role !== 'owner' && m._id !== user?.id && (
                      <button onClick={() => handleRemove(m._id, m.name)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} onSaved={load} />
    </div>
  );
}
