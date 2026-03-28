import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { subjectsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Subject, SubSubject } from '../../types';

export default function SubjectsPage() {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Modal matière
  const [subjectModal, setSubjectModal] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');

  // Modal sous-matière
  const [subModal, setSubModal] = useState(false);
  const [parentSubjectId, setParentSubjectId] = useState(0);
  const [editSub, setEditSub] = useState<SubSubject | null>(null);
  const [subName, setSubName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSubjects(); }, []);

  async function loadSubjects() {
    const local = await db.subjects.toArray();
    const subs  = await db.sub_subjects.toArray();
    const merged = local.map(s => ({ ...s, sub_subjects: subs.filter(ss => ss.subject_id === s.id) }));
    setSubjects(merged);
    setLoading(false);
    try {
      const remote = await subjectsApi.list();
      // Mise à jour Dexie
      await db.subjects.bulkPut(remote.map(s => ({ ...s, sub_subjects: [] })));
      const allSubs = remote.flatMap(s => s.sub_subjects ?? []);
      await db.sub_subjects.bulkPut(allSubs);
      setSubjects(remote);
    } catch { /* offline */ }
  }

  // ── Matières ──────────────────────────────────────────────
  function openCreateSubject() { setEditSubject(null); setSubjectName(''); setSubjectModal(true); }
  function openEditSubject(s: Subject) { setEditSubject(s); setSubjectName(s.name); setSubjectModal(true); }

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      if (editSubject) {
        await subjectsApi.update(editSubject.id, subjectName);
        setSubjects(prev => prev.map(s => s.id === editSubject.id ? { ...s, name: subjectName } : s));
        toast('Matière modifiée');
      } else {
        const created = await subjectsApi.create(subjectName);
        await db.subjects.put({ ...created, sub_subjects: [] });
        setSubjects(prev => [...prev, { ...created, sub_subjects: [] }]);
        toast('Matière ajoutée');
      }
      setSubjectModal(false);
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteSubject(s: Subject) {
    if (!confirm(`Supprimer la matière "${s.name}" et toutes ses évaluations ?`)) return;
    try {
      await subjectsApi.delete(s.id);
      await db.subjects.delete(s.id);
      setSubjects(prev => prev.filter(x => x.id !== s.id));
      toast('Matière supprimée');
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  // ── Sous-matières ─────────────────────────────────────────
  function openCreateSub(subjectId: number) { setParentSubjectId(subjectId); setEditSub(null); setSubName(''); setSubModal(true); }
  function openEditSub(ss: SubSubject) { setParentSubjectId(ss.subject_id); setEditSub(ss); setSubName(ss.name); setSubModal(true); }

  async function handleSaveSub(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      if (editSub) {
        await subjectsApi.updateSub(editSub.id, subName);
        setSubjects(prev => prev.map(s => ({
          ...s,
          sub_subjects: s.sub_subjects.map(ss => ss.id === editSub.id ? { ...ss, name: subName } : ss),
        })));
        toast('Sous-matière modifiée');
      } else {
        const created = await subjectsApi.createSub(parentSubjectId, subName);
        await db.sub_subjects.put(created);
        setSubjects(prev => prev.map(s => s.id === parentSubjectId ? { ...s, sub_subjects: [...s.sub_subjects, created] } : s));
        toast('Sous-matière ajoutée');
      }
      setSubModal(false);
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteSub(ss: SubSubject) {
    if (!confirm(`Supprimer la sous-matière "${ss.name}" ?`)) return;
    try {
      await subjectsApi.deleteSub(ss.id);
      await db.sub_subjects.delete(ss.id);
      setSubjects(prev => prev.map(s => ({ ...s, sub_subjects: s.sub_subjects.filter(x => x.id !== ss.id) })));
      toast('Sous-matière supprimée');
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Matières</h1>
        <button onClick={openCreateSubject} className="flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Aucune matière — cliquez sur Ajouter pour commencer</div>
      ) : (
        <div className="space-y-3">
          {subjects.map(s => (
            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header matière */}
              <div className="flex items-center px-5 py-3.5">
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${expanded === s.id ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-semibold text-slate-900 dark:text-white">{s.name}</span>
                  <span className="text-xs text-slate-400 ml-1">{s.sub_subjects.length} sous-matière{s.sub_subjects.length !== 1 ? 's' : ''}</span>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditSubject(s)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => handleDeleteSubject(s)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              {/* Sous-matières */}
              {expanded === s.id && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-5 py-3 space-y-2">
                  {s.sub_subjects.map(ss => (
                    <div key={ss.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{ss.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditSub(ss)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSub(ss)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => openCreateSub(s.id)}
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium mt-2 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Ajouter une sous-matière
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal matière */}
      <Modal open={subjectModal} onClose={() => setSubjectModal(false)} title={editSubject ? 'Modifier la matière' : 'Nouvelle matière'}>
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de la matière</label>
            <input type="text" required autoFocus value={subjectName} onChange={e => setSubjectName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Français, Mathématiques…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setSubjectModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-medium transition disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal sous-matière */}
      <Modal open={subModal} onClose={() => setSubModal(false)} title={editSub ? 'Modifier la sous-matière' : 'Nouvelle sous-matière'}>
        <form onSubmit={handleSaveSub} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de la sous-matière</label>
            <input type="text" required autoFocus value={subName} onChange={e => setSubName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Lecture, Grammaire, Dictée…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setSubModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-medium transition disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
