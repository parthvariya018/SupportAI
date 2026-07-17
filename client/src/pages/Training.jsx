import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDocuments, uploadDocument, deleteDocument } from '../api';

export default function Training() {
  const [docs, setDocs]         = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const loadDocs = () =>
    getDocuments()
      .then(res => setDocs(res.documents ?? []))
      .catch(() => toast.error('Failed to load documents'));

  useEffect(() => { loadDocs(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('pdf', file);
    setUploading(true);
    try {
      await uploadDocument(form);
      toast.success('Document uploaded and processed');
      loadDocs();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    await deleteDocument(id);
    toast.success('Deleted');
    setDocs(d => d.filter(x => x._id !== id));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chatbot Training</h1>
        <label className={`flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload size={16} />
          {uploading ? 'Processing…' : 'Upload PDF'}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <FileText className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500">No documents yet. Upload a PDF to train your chatbot.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {docs.map(doc => (
            <div key={doc._id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <FileText className="text-primary-500 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{doc.originalName}</p>
                  <p className="text-xs text-gray-400">
                    {doc.pageCount ?? '--'} pages · {doc.wordCount?.toLocaleString() ?? 0} words · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(doc._id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
