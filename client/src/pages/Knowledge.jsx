import { useEffect, useState } from 'react';
import { Plus, Search, BookOpen, Eye, ThumbsUp, ThumbsDown, Edit2, Trash2, FileText, Globe } from 'lucide-react';
import { getArticles, createArticle, updateArticle, deleteArticle } from '../api';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

function ArticleModal({ open, onClose, article, onSaved }) {
  const isEdit = !!article;
  const [form, setForm] = useState({ title: '', content: '', category: 'General', status: 'draft', tags: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (article) setForm({ title: article.title, content: article.content, category: article.category, status: article.status, tags: article.tags?.join(', ') || '' });
    else setForm({ title: '', content: '', category: 'General', status: 'draft', tags: '' });
  }, [article]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) return toast.error('Title and content required');
    setLoading(true);
    try {
      const payload = { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) };
      if (isEdit) await updateArticle(article._id, payload);
      else await createArticle(payload);
      toast.success(isEdit ? 'Article updated' : 'Article created');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Article' : 'New Article'} size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={handleSubmit}>{isEdit ? 'Save' : 'Create'}</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" value={form.title} onChange={set('title')} placeholder="How to reset your password..." />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')}>
              {['General', 'Getting Started', 'Account', 'Billing', 'Technical', 'FAQ'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Content</label>
          <textarea className="input font-mono text-sm min-h-[220px] resize-none" value={form.content} onChange={set('content')} placeholder="Write your article content here (Markdown supported)..." />
        </div>
        <Input label="Tags (comma-separated)" value={form.tags} onChange={set('tags')} placeholder="billing, account, reset" />
      </form>
    </Modal>
  );
}

export default function Knowledge() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [view, setView]           = useState('grid');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getArticles({ category: category || undefined, status: status || undefined, q: search || undefined });
      setArticles(res.articles || []);
    } catch { toast.error('Failed to load articles'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [category, status]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this article?')) return;
    try { await deleteArticle(id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  const handleEdit = (a) => { setEditing(a); setShowModal(true); };
  const handleNew  = () => { setEditing(null); setShowModal(true); };

  const categories = ['', ...new Set(articles.map((a) => a.category).filter(Boolean))];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Knowledge Base</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">{articles.length} articles</p>
        </div>
        <Button icon={Plus} onClick={handleNew}>New Article</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Articles', value: articles.length, icon: FileText, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400' },
          { label: 'Published', value: articles.filter((a) => a.status === 'published').length, icon: Globe, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' },
          { label: 'Total Views', value: articles.reduce((s, a) => s + (a.views || 0), 0).toLocaleString(), icon: Eye, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' },
          { label: 'Helpful Votes', value: articles.reduce((s, a) => s + (a.helpful || 0), 0).toLocaleString(), icon: ThumbsUp, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400' },
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

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..." className="flex-1" />
          <select className="input sm:w-44" value={category} onChange={(e) => { setCategory(e.target.value); }}>
            {categories.map((c) => <option key={c} value={c}>{c || 'All categories'}</option>)}
          </select>
          <select className="input sm:w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
        </div>
      ) : articles.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No articles yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Create your first article to build your knowledge base.</p>
          <Button icon={Plus} onClick={handleNew}>Create Article</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {articles.map((a) => (
            <div key={a._id} className="card p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{a.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{a.category}</p>
                </div>
                <Badge label={a.status} variant={a.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Eye size={12} /> {a.views || 0}</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ThumbsUp size={12} /> {a.helpful || 0}</span>
                <span className="flex items-center gap-1 text-red-500 dark:text-red-400"><ThumbsDown size={12} /> {a.notHelpful || 0}</span>
              </div>
              {a.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {a.tags.slice(0, 3).map((t) => <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-[10px]">{t}</span>)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400 flex-1">{new Date(a.updatedAt).toLocaleDateString()}</span>
                <button onClick={() => handleEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(a._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ArticleModal open={showModal} onClose={() => { setShowModal(false); setEditing(null); }} article={editing} onSaved={load} />
    </div>
  );
}
