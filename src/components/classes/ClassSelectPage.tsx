import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classesApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Class } from '../../types';

export default function ClassSelectPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { classes, currentClass, setCurrentClass, loadClasses, loading } = useClass();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [name, setName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName('');
    setSchoolYear('');
    setModalOpen(true);
  }

  function openEdit(c: Class) {
    setEditing(c);
    setName(c.name);
    setSchoolYear(c.school_year ?? '');
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await classesApi.update(editing.id, name, schoolYear || undefined);
        toast('Classe modifiée');
      } else {
        await classesApi.create(name, schoolYear || undefined);
        toast('Classe créée');
      }
      await loadClasses();
      setModalOpen(false);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Class) {
    if (!confirm(`Supprimer la classe "${c.name}" et toutes ses données (élèves, notes, évaluations) ?`)) return;
    try {
      await classesApi.delete(c.id);
      if (currentClass?.id === c.id) setCurrentClass(null);
      await loadClasses();
      toast('Classe supprimée');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  function selectClass(c: Class) {
    setCurrentClass(c);
    navigate('/');
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Mes classes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Sélectionnez une classe pour commencer</p>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle classe
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--creme)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--ocre)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Aucune classe</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Créez votre première classe pour commencer</p>
          <button
            onClick={openCreate}
            className="btn-primary mt-4 px-6 py-2.5 rounded-xl font-medium"
          >
            Créer une classe
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map(c => (
            <div
              key={c.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: 'var(--bg-surface)',
                border: currentClass?.id === c.id
                  ? '2px solid var(--ocre)'
                  : '1px solid var(--border-default)',
              }}
            >
              <div className="flex items-center px-5 py-4">
                <button
                  onClick={() => selectClass(c)}
                  className="flex-1 flex items-center gap-4 text-left"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                    style={{ background: 'var(--creme)', color: 'var(--ocre)' }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                    {c.school_year && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.school_year}</div>
                    )}
                    {currentClass?.id === c.id && (
                      <div className="text-xs mt-0.5 font-medium" style={{ color: 'var(--ocre)' }}>Classe active</div>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => openEdit(c)}
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
                    onClick={() => handleDelete(c)}
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
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la classe' : 'Nouvelle classe'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom de la classe</label>
            <input
              type="text" required autoFocus
              value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="6A, CM2, Terminale…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Année scolaire (optionnel)</label>
            <input
              type="text"
              value={schoolYear} onChange={e => setSchoolYear(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="2025-2026"
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
