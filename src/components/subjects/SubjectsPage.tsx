import { useState, useEffect } from 'react';
import { subjectsApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Subject, SubSubject } from '../../types';

export default function SubjectsPage() {
  const toast = useToast();
  const { currentClass } = useClass();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [subjectModal, setSubjectModal] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');

  const [subModal, setSubModal] = useState(false);
  const [parentSubjectId, setParentSubjectId] = useState(0);
  const [editSub, setEditSub] = useState<SubSubject | null>(null);
  const [subName, setSubName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentClass) loadSubjects();
  }, [currentClass?.id]);

  async function loadSubjects() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const remote = await subjectsApi.list(currentClass.id);
      setSubjects(remote);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }

  function openCreateSubject() { setEditSubject(null); setSubjectName(''); setSubjectModal(true); }
  function openEditSubject(s: Subject) { setEditSubject(s); setSubjectName(s.name); setSubjectModal(true); }

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClass) return;
    setSaving(true);
    try {
      if (editSubject) {
        await subjectsApi.update(editSubject.id, subjectName);
        setSubjects(prev => prev.map(s => s.id === editSubject.id ? { ...s, name: subjectName } : s));
        toast('Matière modifiée');
      } else {
        const created = await subjectsApi.create(currentClass.id, subjectName);
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
      setSubjects(prev => prev.filter(x => x.id !== s.id));
      toast('Matière supprimée');
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

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
      setSubjects(prev => prev.map(s => ({ ...s, sub_subjects: s.sub_subjects.filter(x => x.id !== ss.id) })));
      toast('Sous-matière supprimée');
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Matières</h1>
          {currentClass && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>
          )}
        </div>
        <button
          onClick={openCreateSubject}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Aucune matière — cliquez sur Ajouter pour commencer</div>
      ) : (
        <div className="space-y-3">
          {subjects.map(s => (
            <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center px-5 py-3.5">
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${expanded === s.id ? 'rotate-90' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{s.sub_subjects.length} sous-matière{s.sub_subjects.length !== 1 ? 's' : ''}</span>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditSubject(s)} className="w-8 h-8 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => handleDeleteSubject(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 transition" onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              {expanded === s.id && (
                <div className="border-t px-5 py-3 space-y-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
                  {s.sub_subjects.map(ss => (
                    <div key={ss.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ocre)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ss.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditSub(ss)} className="w-7 h-7 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSub(ss)} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 transition" onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => openCreateSub(s.id)} className="flex items-center gap-2 text-sm font-medium mt-2 transition" style={{ color: 'var(--ocre)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Ajouter une sous-matière
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={subjectModal} onClose={() => setSubjectModal(false)} title={editSubject ? 'Modifier la matière' : 'Nouvelle matière'}>
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom de la matière</label>
            <input type="text" required autoFocus value={subjectName} onChange={e => setSubjectName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="Français, Mathématiques…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setSubjectModal(false)} className="flex-1 px-4 py-2.5 rounded-xl transition" style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 px-4 py-2.5 rounded-xl font-medium transition disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={subModal} onClose={() => setSubModal(false)} title={editSub ? 'Modifier la sous-matière' : 'Nouvelle sous-matière'}>
        <form onSubmit={handleSaveSub} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom de la sous-matière</label>
            <input type="text" required autoFocus value={subName} onChange={e => setSubName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="Lecture, Grammaire, Dictée…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setSubModal(false)} className="flex-1 px-4 py-2.5 rounded-xl transition" style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 px-4 py-2.5 rounded-xl font-medium transition disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
