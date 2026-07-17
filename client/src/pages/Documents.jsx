import { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Upload, FileText, Trash2, Loader2, BookOpen,
  Search, Eye, X, FileSearch, ChevronRight,
  Hash, AlignLeft, BookMarked, AlertTriangle, ArrowRight,
} from 'lucide-react';
import {
  uploadDocument, getDocuments,
  deleteDocument, searchDocuments, getDocumentContent,
  getSubscription,
} from '../api';
import { useAsync } from '../hooks/useAsync';
import { SkeletonCard, Skeleton } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';

/* ─── helpers ─────────────────────────────────────────────────────────── */

function fmtSize(chars) {
  if (chars >= 1_000_000) return `${(chars / 1_000_000).toFixed(1)}M chars`;
  if (chars >= 1_000)     return `${(chars / 1_000).toFixed(1)}k chars`;
  return `${chars} chars`;
}

function HighlightText({ text, term }) {
  if (!term) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 text-gray-900 dark:text-yellow-100 rounded px-0.5">{p}</mark>
          : p
      )}
    </span>
  );
}

/* ─── sub-components ──────────────────────────────────────────────────── */

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <Icon size={12} className="shrink-0" />
      <span className="font-medium text-gray-700 dark:text-gray-300">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function DocCard({ doc, onPreview, onDelete }) {
  return (
    <div className="card p-4 flex items-start gap-4 hover:shadow-md transition-all group">
      <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 shrink-0">
        <FileText size={20} className="text-primary-600 dark:text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate mb-1.5">
          {doc.originalName}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {doc.pageCount > 0 && <StatPill icon={BookMarked} label="pages"  value={doc.pageCount} />}
          {doc.wordCount  > 0 && <StatPill icon={AlignLeft}  label="words"  value={doc.wordCount?.toLocaleString()} />}
          <StatPill icon={Hash} label="" value={fmtSize(doc.charCount)} />
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          {new Date(doc.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
          {doc.uploadedBy?.name && ` · ${doc.uploadedBy.name}`}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onPreview(doc)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          title="Preview content">
          <Eye size={15} />
        </button>
        <button onClick={() => onDelete(doc)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Delete document">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function SearchResultCard({ result, query, onPreview }) {
  return (
    <button onClick={() => onPreview({ _id: result._id, originalName: result.originalName })}
      className="card p-4 text-left hover:shadow-md transition-all hover:border-primary-200 dark:hover:border-primary-800 w-full group">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 shrink-0">
          <FileSearch size={16} className="text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {result.originalName}
            </p>
            <ChevronRight size={14} className="text-gray-400 group-hover:text-primary-500 shrink-0 transition-colors" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
            <HighlightText text={result.snippet} term={query} />
          </p>
          <div className="flex gap-3 mt-2">
            {result.pageCount > 0 && <StatPill icon={BookMarked} label="pages" value={result.pageCount} />}
            <StatPill icon={Hash} label="" value={fmtSize(result.charCount)} />
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─── limit banner ────────────────────────────────────────────────────── */

function LimitBanner({ used, limit, plan }) {
  const pct     = Math.round((used / limit) * 100);
  const atLimit = used >= limit;
  const nearLimit = pct >= 80 && !atLimit;

  if (!atLimit && !nearLimit) return null;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border animate-fade-in ${
      atLimit
        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'
        : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50'
    }`}>
      <AlertTriangle size={18} className={`shrink-0 mt-0.5 ${atLimit ? 'text-red-500' : 'text-amber-500'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${atLimit ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
          {atLimit
            ? `Document limit reached (${used}/${limit})`
            : `Approaching document limit (${used}/${limit})`}
        </p>
        <p className={`text-xs mt-0.5 ${atLimit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {atLimit
            ? `Your ${plan} plan allows ${limit} document${limit === 1 ? '' : 's'}. Delete a document or upgrade your plan to upload more.`
            : `You have ${limit - used} slot${limit - used === 1 ? '' : 's'} remaining on your ${plan} plan.`}
        </p>
      </div>
      {atLimit && (
        <Link to="/app/billing"
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">
          Upgrade <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

/* ─── upload zone ─────────────────────────────────────────────────────── */

function UploadZone({ onFile, uploading, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handle = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are allowed'); return; }
    onFile(file);
  };

  if (disabled) {
    return (
      <div className="border-2 border-dashed border-red-200 dark:border-red-800/50 rounded-2xl p-10 text-center bg-red-50/50 dark:bg-red-900/10">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
          <Upload size={22} className="text-red-400" />
        </div>
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Upload disabled</p>
        <p className="text-xs text-red-500 dark:text-red-500 mt-1">Document limit reached for your plan</p>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => !uploading && fileRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
        ${dragOver
          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10 scale-[1.01]'
          : 'border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-gray-900/40'
        }
        ${uploading ? 'pointer-events-none' : ''}`}
    >
      <input ref={fileRef} type="file" accept=".pdf" className="hidden"
        onChange={e => handle(e.target.files[0])} />

      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Loader2 size={22} className="text-primary-600 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Processing PDF…</p>
            <p className="text-xs text-gray-400 mt-0.5">Extracting text, please wait</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
            ${dragOver ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <Upload size={22} className={dragOver ? 'text-primary-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {dragOver ? 'Drop it!' : 'Drag & drop PDF here'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              or <span className="text-primary-600 dark:text-primary-400 font-medium">click to browse</span>
              {' '}· Max 10 MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── preview modal ───────────────────────────────────────────────────── */

function PreviewModal({ docMeta, searchTerm, onClose }) {
  const { data, loading } = useAsync(
    useCallback(() => getDocumentContent(docMeta._id), [docMeta._id])
  );
  const doc = data?.document;

  return (
    <Modal open title={docMeta.originalName} onClose={onClose} size="xl">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className={`h-4 ${i % 5 === 4 ? 'w-2/3' : 'w-full'}`} />
          ))}
        </div>
      ) : doc ? (
        <div>
          <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            {doc.pageCount > 0 && <StatPill icon={BookMarked} label="pages"      value={doc.pageCount} />}
            {doc.wordCount  > 0 && <StatPill icon={AlignLeft}  label="words"      value={doc.wordCount?.toLocaleString()} />}
            <StatPill icon={Hash} label="characters" value={doc.charCount?.toLocaleString()} />
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 max-h-[55vh] overflow-y-auto">
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
              {searchTerm
                ? <HighlightText text={doc.extractedText} term={searchTerm} />
                : doc.extractedText
              }
            </pre>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Could not load document content.</p>
      )}
    </Modal>
  );
}

/* ─── main page ───────────────────────────────────────────────────────── */

export default function Documents() {
  const { data, loading, refetch } = useAsync(getDocuments);
  const docs = data?.documents ?? [];

  // Fetch plan limits live from subscription endpoint
  const { data: subData } = useAsync(getSubscription);
  const docLimit   = subData?.subscription?.limits?.documents ?? null;   // null = unlimited
  const planName   = subData?.subscription?.plan ?? 'free';
  const atLimit    = docLimit !== null && docs.length >= docLimit;

  const [uploading,    setUploading]    = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [previewDoc,   setPreviewDoc]   = useState(null);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching,     setSearching]     = useState(false);
  const searchRef = useRef();

  /* upload */
  const handleFile = async (file) => {
    if (atLimit) {
      toast.error(`Document limit reached. Upgrade your plan to upload more.`);
      return;
    }
    const form = new FormData();
    form.append('pdf', file);
    setUploading(true);
    try {
      await uploadDocument(form);
      toast.success('Document uploaded and processed!');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  /* delete */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget._id);
      toast.success('Document deleted');
      refetch();
      if (searchResults) setSearchResults(r => r?.filter(x => x._id !== deleteTarget._id));
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  /* search */
  const handleSearch = async (e) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); return; }
    if (q.length < 2) { toast.error('Enter at least 2 characters'); return; }
    setSearching(true);
    try {
      const res = await searchDocuments(q);
      setSearchResults(res.results ?? []);
    } catch (err) {
      toast.error(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch  = () => { setSearchQuery(''); setSearchResults(null); };
  const isSearchMode = searchResults !== null;

  const totalWords = docs.reduce((s, d) => s + (d.wordCount || 0), 0);
  const totalPages = docs.reduce((s, d) => s + (d.pageCount || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload PDFs to train your chatbot's knowledge base
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Live doc count badge */}
          {docLimit !== null && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              atLimit
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : docs.length >= docLimit * 0.8
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {docs.length} / {docLimit} docs
            </span>
          )}
          <label className={`btn-primary cursor-pointer ${
            uploading || atLimit ? 'opacity-50 pointer-events-none' : ''
          }`}>
            <Upload size={15} />
            Upload PDF
            <input type="file" accept=".pdf" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </label>
        </div>
      </div>

      {/* Limit banner — shows near/at limit */}
      {docLimit !== null && (
        <LimitBanner used={docs.length} limit={docLimit} plan={planName} />
      )}

      {/* Aggregate stats */}
      {docs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Documents',   value: docLimit !== null ? `${docs.length} / ${docLimit}` : docs.length, icon: FileText   },
            { label: 'Total Pages', value: totalPages || '—',                                                 icon: BookMarked },
            { label: 'Total Words', value: totalWords.toLocaleString() || '—',                               icon: AlignLeft  },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0">
                <Icon size={15} className="text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone — disabled when at limit */}
      <UploadZone onFile={handleFile} uploading={uploading} disabled={atLimit} />

      {/* Search bar */}
      {docs.length > 0 && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) clearSearch(); }}
              placeholder="Search document content…"
              className="input pl-9 pr-9"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary px-5" disabled={searching || !searchQuery.trim()}>
            {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Search
          </button>
        </form>
      )}

      {/* Search results */}
      {isSearchMode && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {searchResults.length === 0
                ? 'No results found'
                : `${searchResults.length} result${searchResults.length > 1 ? 's' : ''} for `}
              {searchResults.length > 0 && (
                <span className="text-primary-600 dark:text-primary-400">"{searchQuery}"</span>
              )}
            </p>
            <button onClick={clearSearch} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1">
              <X size={12} /> Clear
            </button>
          </div>
          {searchResults.length === 0 ? (
            <div className="card">
              <EmptyState icon={FileSearch} title="No matches found"
                description={`No document content matches "${searchQuery}"`} />
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map(r => (
                <SearchResultCard key={r._id} result={r} query={searchQuery} onPreview={setPreviewDoc} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document list */}
      {!isSearchMode && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="card">
            <EmptyState icon={BookOpen} title="No documents yet"
              description="Upload your first PDF to start training your chatbot" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {docs.map(doc => (
              <DocCard key={doc._id} doc={doc}
                onPreview={setPreviewDoc}
                onDelete={setDeleteTarget} />
            ))}
          </div>
        )
      )}

      {/* Preview modal */}
      {previewDoc && (
        <PreviewModal
          docMeta={previewDoc}
          searchTerm={isSearchMode ? searchQuery : ''}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Document" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Delete{' '}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {deleteTarget?.originalName}
          </span>
          ? This removes it from your chatbot's knowledge base permanently.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 size={14} className="animate-spin" />}
            {deleting ? 'Deleting…' : 'Delete Document'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
