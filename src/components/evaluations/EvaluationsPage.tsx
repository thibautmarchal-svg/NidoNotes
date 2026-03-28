import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { evaluationsApi, subjectsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Evaluation, Subject } from '../../types';

const WEIGHTS = [0.5, 1, 1.5, 2, 3];

export default function EvaluationsPage() {
  const toast = useToast();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    subject_id: 0,
    sub_subject_id: null as number | null,
    weight: 1,
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [localEvals, localSubjects, localSubs] = await Promise.all([
      db.evaluations.orderBy('date').toArray(),
      db.subjects.toArray(),
      db.sub_subjects.toArray(),
    ]);
    const mergedSubjects = localSubjects.map(s => ({ ...s, sub_subjects: localSubs.filter(ss => ss.subject_id === s.id) }));
    setEvaluations(localEvals);
    setSubjects(mergedSubjects);
    setLoading(false);
    try {
      const [remoteEvals, remoteSubjects] = await Promise.all([evaluationsApi.list(), subjectsApi.list()]);
      await db.evaluations.bulkPut(remoteEvals);
      setEvaluations(remoteEvals);
      setSubjects(remoteSubjects);
    } catch { /* offline */ }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', date: new Date().toISOString().slice(0, 10), subject_id: subjects[0]?.id ?? 0, sub_subject_id: null, weight: 1 });
    setModalOpen(true);
  }

  function openEdit(ev: Evaluation) {
    setEditing(ev);
    setForm({ name: ev.name, date: ev.date, subject_id: ev.subject_id, sub_subject_id: ev.sub_subject_id, weight: ev.weight });
    setModalOpen(true);
  }

  const currentSubject = subjects.find(s => s.id === form.subject_id);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) {
        const updated = await evaluationsApi.update(editing.id, form);
        await db.evaluations.put(updated);
        setEvaluations(prev => prev.map(ev => ev.id === updated.id ? updated : ev));
        toast('Évaluation modifiée');
      } else {
        const created = await evaluationsApi.create(form);
        await db.evaluations.put(created);
        setEvaluations(prev => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
        toast('Évaluation ajoutée');
      }
      setModalOpen(false);
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(ev: Evaluation) {
    if (!confirm(`Supprimer l'évaluation "${ev.name}" et toutes ses notes ?`)) return;
    try {
      await evaluationsApi.delete(ev.id);
      await db.evaluations.delete(ev.id);
      setEvaluations(prev => prev.filter(x => x.id !== ev.id));
      toast('Évaluation supprimée');
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  function subjectName(id: number) { return subjects.find(s => s.id === id)?.name ?? '—'; }
  function subSubjectName(id: number | null) {
    if (!id) return null;
    for (const s of subjects) {
      const ss = s.sub_subjects.find(x => x.id === id);
      if (ss) return ss.name;
    }
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Évaluations</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Aucune évaluation</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {evaluations.map((ev, i) => (
            <div key={ev.id} className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 dark:text-white truncate">{ev.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-slate-500">{new Date(ev.date + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">{subjectName(ev.subject_id)}</span>
                  {ev.sub_subject_id && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{subSubjectName(ev.sub_subject_id)}</span>}
                  <span className="text-xs text-slate-400">×{ev.weight}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <button onClick={() => openEdit(ev)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button onClick={() => handleDelete(ev)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier l\'évaluation' : 'Nouvelle évaluation'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom</label>
            <input type="text" required autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Contrôle chapitre 3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
            <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Matière</label>
            <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: Number(e.target.value), sub_subject_id: null }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value={0}>Choisir une matière…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {currentSubject && currentSubject.sub_subjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sous-matière (optionnel)</label>
              <select value={form.sub_subject_id ?? ''} onChange={e => setForm(f => ({ ...f, sub_subject_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Aucune</option>
                {currentSubject.sub_subjects.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pondération</label>
            <div className="flex gap-2">
              {WEIGHTS.map(w => (
                <button
                  key={w} type="button"
                  onClick={() => setForm(f => ({ ...f, weight: w }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${form.weight === w ? 'bg-primary-700 text-white border-primary-700' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  ×{w}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-medium transition disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
