import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentsApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Student } from '../../types';

export default function StudentsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { currentClass } = useClass();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentClass) loadStudents();
  }, [currentClass?.id]);

  async function loadStudents() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const remote = await studentsApi.list(currentClass.id);
      setStudents(remote);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return !q || s.last_name.toLowerCase().includes(q) || s.first_name.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setFirstName(''); setLastName('');
    setModalOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setFirstName(s.first_name); setLastName(s.last_name);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClass) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await studentsApi.update(editing.id, firstName, lastName);
        setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
        toast('Élève modifié');
      } else {
        const created = await studentsApi.create(currentClass.id, firstName, lastName);
        setStudents(prev => [...prev, created].sort((a, b) => a.last_name.localeCompare(b.last_name)));
        toast('Élève ajouté');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Student) {
    if (!confirm(`Supprimer ${s.first_name} ${s.last_name} et toutes ses notes ?`)) return;
    try {
      await studentsApi.delete(s.id);
      setStudents(prev => prev.filter(x => x.id !== s.id));
      toast('Élève supprimé');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Élèves</h1>
          {currentClass && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>
          )}
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter
        </button>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text" placeholder="Rechercher un élève…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
          style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
        />
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          {search ? 'Aucun résultat' : 'Aucun élève — cliquez sur Ajouter pour commencer'}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          {filtered.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors ${i > 0 ? 'border-t' : ''}`}
              style={i > 0 ? { borderColor: 'var(--border-subtle)' } : undefined}
              onClick={() => navigate(`/eleves/${s.id}`)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--creme)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
                  style={{ background: 'var(--creme)', color: 'var(--ocre)' }}
                >
                  {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                </div>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {s.last_name} {s.first_name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => { e.stopPropagation(); openEdit(s); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(s); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 transition"
                  onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'élève" : 'Ajouter un élève'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Prénom</label>
            <input
              type="text" required autoFocus
              value={firstName} onChange={e => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="Marie"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom</label>
            <input
              type="text" required
              value={lastName} onChange={e => setLastName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="Dupont"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl transition"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 px-4 py-2.5 rounded-xl font-medium transition disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
