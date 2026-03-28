import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { studentsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Student } from '../../types';

export default function StudentsPage() {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    const local = await db.students.orderBy('last_name').toArray();
    setStudents(local);
    setLoading(false);
    try {
      const remote = await studentsApi.list();
      await db.students.bulkPut(remote);
      setStudents(remote);
    } catch {
      // offline — données locales utilisées
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
    setSaving(true);
    try {
      if (editing) {
        const updated = await studentsApi.update(editing.id, { first_name: firstName, last_name: lastName });
        await db.students.put(updated);
        setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
        toast('Élève modifié');
      } else {
        const created = await studentsApi.create({ first_name: firstName, last_name: lastName });
        await db.students.put(created);
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
      await db.students.delete(s.id);
      setStudents(prev => prev.filter(x => x.id !== s.id));
      toast('Élève supprimé');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Élèves</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter
        </button>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text" placeholder="Rechercher un élève…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {search ? 'Aucun résultat' : 'Aucun élève — cliquez sur Ajouter pour commencer'}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {filtered.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm">
                  {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                </div>
                <span className="font-medium text-slate-900 dark:text-white">
                  {s.last_name} {s.first_name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(s)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier l\'élève' : 'Ajouter un élève'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prénom</label>
            <input
              type="text" required autoFocus
              value={firstName} onChange={e => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Marie"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom</label>
            <input
              type="text" required
              value={lastName} onChange={e => setLastName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Dupont"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-medium transition disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
