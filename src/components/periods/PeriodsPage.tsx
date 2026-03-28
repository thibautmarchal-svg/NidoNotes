import { useState, useEffect } from 'react';
import { periodsApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import type { Period } from '../../types';

export default function PeriodsPage() {
  const toast = useToast();
  const { currentClass } = useClass();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Period | null>(null);
  const [periodName, setPeriodName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentClass) loadPeriods();
  }, [currentClass?.id]);

  async function loadPeriods() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const list = await periodsApi.list(currentClass.id);
      setPeriods(list.sort((a, b) => a.order_num - b.order_num));
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setPeriodName('');
    setModalOpen(true);
  }

  function openEdit(p: Period) {
    setEditing(p);
    setPeriodName(p.name);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClass) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await periodsApi.update(editing.id, periodName);
        setPeriods(prev => prev.map(p => p.id === editing.id ? updated : p));
        toast('Période modifiée');
      } else {
        const created = await periodsApi.create(currentClass.id, periodName);
        setPeriods(prev => [...prev, created].sort((a, b) => a.order_num - b.order_num));
        toast('Période ajoutée');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Period) {
    if (!confirm(`Supprimer la période "${p.name}" ? Les évaluations liées doivent d'abord être supprimées.`)) return;
    try {
      await periodsApi.delete(p.id);
      setPeriods(prev => prev.filter(x => x.id !== p.id));
      toast('Période supprimée');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Périodes</h1>
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

      <div className="mb-4 rounded-2xl p-4 text-sm" style={{ background: 'var(--creme)', color: 'var(--bois)' }}>
        Les périodes représentent les trimestres ou semestres de l'année scolaire. La moyenne annuelle est calculée comme la moyenne des moyennes de chaque période.
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          Aucune période — créez votre premier trimestre ou semestre
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          {periods.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t' : ''}`}
              style={i > 0 ? { borderColor: 'var(--border-subtle)' } : undefined}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ background: 'var(--creme)', color: 'var(--ocre)' }}
                >
                  {p.order_num}
                </div>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(p)}
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
                  onClick={() => handleDelete(p)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la période' : 'Nouvelle période'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom de la période</label>
            <input
              type="text" required autoFocus
              value={periodName} onChange={e => setPeriodName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ocre)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              placeholder="Trimestre 1, Semestre 1…"
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
