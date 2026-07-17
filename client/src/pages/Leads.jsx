import { useEffect, useState } from 'react';
import { Search, Users, Mail, Phone, MessageSquare, Download, Filter } from 'lucide-react';
import { getLeads } from '../api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Table, Thead, Th, Tbody, Tr, Td } from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

function LeadDetail({ lead, onClose }) {
  return (
    <Modal open onClose={onClose} title="Customer Details" size="sm"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-white">{lead.name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{lead.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Lead #{lead._id?.slice(-6).toUpperCase()}</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { icon: Mail, label: 'Email', value: lead.email },
            { icon: Phone, label: 'Phone', value: lead.phone || 'Not provided' },
            { icon: MessageSquare, label: 'Message', value: lead.message || 'No message' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <Icon size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="text-gray-400 mt-0.5 shrink-0 text-xs font-bold">📅</div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Captured</p>
              <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{new Date(lead.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Leads() {
  const [leads, setLeads]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getLeads({ page, limit: 20 });
      setLeads(res.leads || []);
      setTotal(res.total || 0);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  };

  const handleExportCSV = async () => {
    try {
      const res = await getLeads({ limit: 10000 });
      const all = res.leads || [];
      if (!all.length) return toast.error('No leads to export');
      const headers = ['Name', 'Email', 'Phone', 'Message', 'Date'];
      const rows = all.map((l) => [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.message || '').replace(/"/g, '""')}"`,
        `"${new Date(l.createdAt).toLocaleString()}"`,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} leads`);
    } catch { toast.error('Export failed'); }
  };

  useEffect(() => { load(); }, [page]);

  const filtered = leads.filter((l) =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">{total} total leads captured</p>
        </div>
        <Button variant="secondary" icon={Download} onClick={handleExportCSV}>Export CSV</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Customers', value: total.toLocaleString(), color: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400', icon: Users },
          { label: 'This Week', value: leads.filter((l) => new Date(l.createdAt) > new Date(Date.now() - 7 * 86400000)).length, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', icon: Users },
          { label: 'With Phone', value: leads.filter((l) => l.phone).length, color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', icon: Phone },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4">
        <Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table>
          <Thead>
            <Th>Customer</Th><Th>Email</Th><Th>Phone</Th><Th>Message</Th><Th>Date</Th>
          </Thead>
          <Tbody>
            {loading ? (
              [...Array(6)].map((_, i) => <Tr key={i}><Td colSpan={5}><div className="skeleton h-10 rounded-lg" /></Td></Tr>)
            ) : filtered.length === 0 ? (
              <Tr><Td colSpan={5} className="text-center py-12 text-gray-400">
                {search ? 'No results found' : 'No customers yet — they appear here when captured by the widget'}
              </Td></Tr>
            ) : filtered.map((l) => (
              <Tr key={l._id} onClick={() => setSelected(l)}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">{l.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{l.name}</span>
                  </div>
                </Td>
                <Td><span className="text-sm">{l.email}</span></Td>
                <Td><span className="text-sm text-gray-500">{l.phone || '—'}</span></Td>
                <Td><span className="text-sm text-gray-500 truncate max-w-[180px] block">{l.message || '—'}</span></Td>
                <Td><span className="text-xs text-gray-400">{new Date(l.createdAt).toLocaleDateString()}</span></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {selected && <LeadDetail lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
