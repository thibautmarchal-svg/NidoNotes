import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { evaluationsApi, subjectsApi, periodsApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Evaluation, Subject, Period } from '../../types';

const WEIGHTS = [0.5, 1, 1.5, 2, 3];

export default function EvaluationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { currentClass } = useClass();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterPeriodId, setFilterPeriodId] = useState<number | 'all'>('all');

  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    period_id: 0,
    subject_id: 0,
    sub_subject_id: null as number | null,
    weight: 1,
  });

  useEffect(() => {
    if (currentClass) loadAll();
  }, [currentClass?.id]);

  async function loadAll() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const [remoteEvals, remoteSubjects, remotePeriods] = await Promise.all([
        evaluationsApi.list(currentClass.id),
        subjectsApi.list(currentClass.id),
        periodsApi.list(currentClass.id),
      ]);
      setEvaluations(remoteEvals);
      setSubjects(remoteSubjects);
      setPeriods(remotePeriods.sort((a, b) => a.order_num - b.order_num));
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      date: new Date().toISOString().slice(0, 10),
      period_id: periods[0]?.id ?? 0,
      subject_id: subjects[0]?.id ?? 0,
      sub_subject_id: null,
      weight: 1,
    });
    setModalOpen(true);
  }

  function openEdit(ev: Evaluation) {
    setEditing(ev);
    setForm({
      name: ev.name,
      date: ev.date,
      period_id: ev.period_id,
      subject_id: ev.subject_id,
      sub_subject_id: ev.sub_subject_id,
      weight: ev.weight,
    });
    setModalOpen(true);
  }

  const currentSubject = subjects.find(s => s.id === form.subject_id);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClass) return;
    if (!form.period_id) { toast('Veuillez sélectionner une période', 'error'); return; }
    setSaving(true);
    try {
      const data = { ...form, class_id: currentClass.id };
      if (editing) {
        const updated = await evaluationsApi.update(editing.id, data);
        setEvaluations(prev => prev.map(ev => ev.id === updated.id ? updated : ev));
        toast('Évaluation modifiée');
      } else {
        const created = await evaluationsApi.create(data);
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
      setEvaluations(prev => prev.filter(x => x.id !== ev.id));
      toast('Évaluation supprimée');
    } catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  function subjectName(id: number) { return subjects.find(s => s.id === id)?.name ?? '—'; }
  function periodName(id: number) { return periods.find(p => p.id === id)?.name ?? '—'; }
  function subSubjectName(id: number | null) {
    if (!id) return null;
    for (const s of subjects) {
      const ss = s.sub_subjects.find(x => x.id === id);
      if (ss) return ss.name;
    }
    return null;
  }

  const visibleEvals = filterPeriodId === 'all'
    ? evaluations
    : evaluations.filter(ev => ev.period_id === filterPeriodId);

  // Group evaluations by period for display
  const evalsByPeriod: { period: Period; evals: Evaluation[] }[] = periods
    .map(p => ({ period: p, evals: visibleEvals.filter(ev => ev.period_id === p.id) }))
    .filter(g => g.evals.length > 0);

  const ungrouped = visibleEvals.filter(ev => !periods.find(p => p.id === ev.period_id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Évaluations</h1>
          {currentClass && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {periods.length > 0 && (
            <select
              value={filterPeriodId}
              onChange={e => setFilterPeriodId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
            >
              <option value="all">Toutes les périodes</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          {periods.length === 0 ? (
            <>
              Créez d'abord des périodes (trimestres).{' '}
              <button onClick={() => navigate('/periodes')} className="underline font-medium" style={{ color: 'var(--ocre)' }}>
                Aller aux périodes →
              </button>
            </>
          ) : 'Aucune évaluation — cliquez sur Ajouter pour commencer'}
        </div>
      ) : visibleEvals.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Aucune évaluation pour cette période</div>
      ) : (
        <div className="space-y-6">
          {evalsByPeriod.map(({ period, evals }) => (
            <div key={period.id}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--ocre)' }}>
                {period.name}
              </h2>
              <EvalList evals={evals} onEdit={openEdit} onDelete={handleDelete} subjectName={subjectName} subSubjectName={subSubjectName} periodName={periodName} showPeriod={false} />
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
                Sans période
              </h2>
              <EvalList evals={ungrouped} onEdit={openEdit} onDelete={handleDelete} subjectName={subjectName} subSubjectName={subSubjectName} periodName={periodName} showPeriod />
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'évaluation" : 'Nouvelle évaluation'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom</label>
            <input type="text" required autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="Contrôle chapitre 3"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
                style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Période</label>
              <select value={form.period_id} onChange={e => setForm(f => ({ ...f, period_id: Number(e.target.value) }))}
                className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
                style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                required
              >
                <option value={0}>Choisir…</option>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Matière</label>
            <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: Number(e.target.value), sub_subject_id: null }))}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              required
            >
              <option value={0}>Choisir une matière…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {currentSubject && currentSubject.sub_subjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sous-matière (optionnel)</label>
              <select value={form.sub_subject_id ?? ''} onChange={e => setForm(f => ({ ...f, sub_subject_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
                style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              >
                <option value="">Aucune</option>
                {currentSubject.sub_subjects.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Pondération</label>
            <div className="flex gap-2">
              {WEIGHTS.map(w => (
                <button key={w} type="button" onClick={() => setForm(f => ({ ...f, weight: w }))}
                  className="flex-1 py-2 rounded-xl text-sm font-medium transition"
                  style={form.weight === w
                    ? { background: 'var(--ocre)', color: '#fff', border: '1.5px solid var(--ocre)' }
                    : { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-default)' }
                  }
                >×{w}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl transition" style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 px-4 py-2.5 rounded-xl font-medium transition disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function EvalList({ evals, onEdit, onDelete, subjectName, subSubjectName, periodName, showPeriod }: {
  evals: Evaluation[];
  onEdit: (ev: Evaluation) => void;
  onDelete: (ev: Evaluation) => void;
  subjectName: (id: number) => string;
  subSubjectName: (id: number | null) => string | null;
  periodName: (id: number) => string;
  showPeriod: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      {evals.map((ev, i) => (
        <div key={ev.id} className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? 'border-t' : ''}`} style={i > 0 ? { borderColor: 'var(--border-subtle)' } : undefined}>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.name}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(ev.date + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              {showPeriod && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>{periodName(ev.period_id)}</span>}
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--creme)', color: 'var(--ocre)' }}>{subjectName(ev.subject_id)}</span>
              {ev.sub_subject_id && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
                  {subSubjectName(ev.sub_subject_id)}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×{ev.weight}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-3">
            <button onClick={() => onEdit(ev)} className="w-8 h-8 flex items-center justify-center rounded-lg transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={() => onDelete(ev)} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 transition" onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
