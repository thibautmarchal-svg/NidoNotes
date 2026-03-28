import { useState, useEffect, useRef, useCallback } from 'react';
import { gradesApi, studentsApi, evaluationsApi, subjectsApi, periodsApi } from '../../lib/api';
import { db, upsertGrade } from '../../lib/db';
import { queueGradeSave } from '../../lib/sync';
import { useClass } from '../../contexts/ClassContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { Student, Evaluation, Grade, Subject, Period } from '../../types';

function scoreColor(score: number | null): string {
  if (score === null) return '';
  if (score < 5) return 'score-red';
  if (score <= 7) return 'score-orange';
  return 'score-green';
}

export default function QuickEntryPage() {
  const { currentClass } = useClass();
  const online = useOnlineStatus();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [periods,     setPeriods]     = useState<Period[]>([]);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [grades,      setGrades]      = useState<Record<number, Grade>>({});  // keyed by student_id
  const [selectedEvalId, setSelectedEvalId] = useState<number>(0);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<Record<number, boolean>>({});
  const [saved,    setSaved]    = useState<Record<number, boolean>>({});

  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (currentClass) loadBase();
  }, [currentClass?.id]);

  useEffect(() => {
    if (selectedEvalId) loadGrades(selectedEvalId);
  }, [selectedEvalId]);

  async function loadBase() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const [evs, sjs, sts, prs] = await Promise.all([
        evaluationsApi.list(currentClass.id),
        subjectsApi.list(currentClass.id),
        studentsApi.list(currentClass.id),
        periodsApi.list(currentClass.id),
      ]);
      setEvaluations(evs.sort((a, b) => b.date.localeCompare(a.date)));
      setSubjects(sjs);
      setStudents(sts);
      setPeriods(prs.sort((a, b) => a.order_num - b.order_num));
      if (evs.length > 0) setSelectedEvalId(evs[0].id);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }

  async function loadGrades(evalId: number) {
    if (!currentClass) return;
    // Load local first
    const local = await db.grades.where('evaluation_id').equals(evalId).toArray();
    const map: Record<number, Grade> = {};
    local.forEach(g => { map[g.student_id] = g; });
    setGrades(map);
    // Then server
    try {
      const remote = await gradesApi.list(currentClass.id);
      const filtered = remote.filter(g => g.evaluation_id === evalId);
      const remoteMap: Record<number, Grade> = {};
      filtered.forEach(g => { remoteMap[g.student_id] = g; });
      setGrades(remoteMap);
      await db.grades.bulkPut(filtered);
    } catch { /* offline */ }
  }

  const saveGrade = useCallback(async (studentId: number, score: number | null, isAbsent: boolean) => {
    if (!selectedEvalId) return;
    const grade: Grade = {
      student_id: studentId,
      evaluation_id: selectedEvalId,
      score,
      is_absent: isAbsent,
      comment: grades[studentId]?.comment ?? null,
    };
    setSaving(prev => ({ ...prev, [studentId]: true }));
    await upsertGrade(grade);
    setGrades(prev => ({ ...prev, [studentId]: grade }));
    try {
      if (online) {
        await gradesApi.save(grade);
      } else {
        await queueGradeSave(grade);
      }
      setSaved(prev => ({ ...prev, [studentId]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [studentId]: false })), 1500);
    } catch {
      await queueGradeSave(grade);
    } finally {
      setSaving(prev => ({ ...prev, [studentId]: false }));
    }
  }, [selectedEvalId, grades, online]);

  const maxScore = selectedEval?.max_score ?? 10;

  async function handleScoreCommit(studentId: number, raw: string) {
    const cleaned = raw.replace(',', '.');
    const score = cleaned === '' ? null : parseFloat(cleaned);
    if (score !== null && (isNaN(score) || score < 0 || score > maxScore)) return;
    const current = grades[studentId];
    if (score === (current?.score ?? null) && !current?.is_absent) return; // no change
    await saveGrade(studentId, score, false);
  }

  async function toggleAbsent(studentId: number) {
    const current = grades[studentId];
    const nowAbsent = !(current?.is_absent ?? false);
    await saveGrade(studentId, nowAbsent ? null : current?.score ?? null, nowAbsent);
    if (!nowAbsent) {
      // Focus the input when un-marking absent
      setTimeout(() => inputRefs.current[studentId]?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const next = students[idx + 1];
      if (next) inputRefs.current[next.id]?.focus();
    }
  }

  const selectedEval = evaluations.find(e => e.id === selectedEvalId);
  const subjectName  = selectedEval ? (subjects.find(s => s.id === selectedEval.subject_id)?.name ?? '—') : '';
  const subSubName   = selectedEval?.sub_subject_id
    ? subjects.flatMap(s => s.sub_subjects).find(ss => ss.id === selectedEval.sub_subject_id)?.name ?? null
    : null;
  const periodName = selectedEval
    ? (periods.find(p => p.id === selectedEval.period_id)?.name ?? '')
    : '';

  // Stats
  const entered   = students.filter(s => grades[s.id]?.score !== null && !grades[s.id]?.is_absent).length;
  const absents   = students.filter(s => grades[s.id]?.is_absent).length;
  const remaining = students.length - entered - absents;
  const avg = (() => {
    const vals = students.map(s => grades[s.id]).filter(g => g && !g.is_absent && g.score !== null).map(g => g!.score as number);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>;

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Saisie rapide</h1>
        {currentClass && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>}
      </div>

      {/* Sélecteur d'évaluation */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Contrôle
        </label>
        <select
          value={selectedEvalId}
          onChange={e => setSelectedEvalId(Number(e.target.value))}
          className="w-full px-4 py-3 rounded-xl focus:outline-none text-sm"
          style={{ background: 'var(--bg-surface)', border: '2px solid var(--ocre)', color: 'var(--text-primary)' }}
        >
          <option value={0}>Choisir un contrôle…</option>
          {periods.map(p => {
            const pEvals = evaluations.filter(e => e.period_id === p.id);
            if (!pEvals.length) return null;
            return (
              <optgroup key={p.id} label={p.name}>
                {pEvals.map(ev => {
                  const sj = subjects.find(s => s.id === ev.subject_id)?.name ?? '';
                  const ss = ev.sub_subject_id ? subjects.flatMap(s => s.sub_subjects).find(x => x.id === ev.sub_subject_id)?.name : null;
                  return (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {ss ? `${sj} / ${ss}` : sj} ({new Date(ev.date + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' })})
                    </option>
                  );
                })}
              </optgroup>
            );
          })}
        </select>
      </div>

      {selectedEval && (
        <>
          {/* Info contrôle */}
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl" style={{ background: 'var(--creme)' }}>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate" style={{ color: 'var(--terre)' }}>{selectedEval.name}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--bois)' }}>
                {periodName && <span className="mr-2">{periodName}</span>}
                {subjectName}{subSubName ? ` › ${subSubName}` : ''}
                <span className="mx-1">·</span>
                {new Date(selectedEval.date + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })}
                <span className="mx-1">·</span>
                ×{selectedEval.weight}
              </div>
            </div>
          </div>

          {/* Compteurs */}
          <div className="flex gap-3 mb-4 text-xs">
            <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: '#f0fdf4' }}>
              <div className="font-bold text-green-600 text-lg">{entered}</div>
              <div className="text-green-700">Notés</div>
            </div>
            <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: 'var(--bg-raised)' }}>
              <div className="font-bold text-lg" style={{ color: 'var(--text-muted)' }}>{absents}</div>
              <div style={{ color: 'var(--text-muted)' }}>Absents</div>
            </div>
            <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: remaining > 0 ? '#fff7ed' : 'var(--bg-raised)' }}>
              <div className={`font-bold text-lg ${remaining > 0 ? 'text-orange-500' : ''}`} style={remaining === 0 ? { color: 'var(--text-muted)' } : undefined}>{remaining}</div>
              <div className={remaining > 0 ? 'text-orange-700' : ''} style={remaining === 0 ? { color: 'var(--text-muted)' } : undefined}>Restants</div>
            </div>
            {avg !== null && (
              <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: 'var(--creme)' }}>
                <div className={`font-bold text-lg ${scoreColor(avg)}`}>{avg % 1 === 0 ? avg : avg.toFixed(1)}</div>
                <div style={{ color: 'var(--bois)' }}>Moyenne</div>
              </div>
            )}
          </div>

          {/* Liste élèves */}
          {students.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun élève dans cette classe</div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
              {students.map((student, idx) => {
                const grade = grades[student.id];
                const isAbsent = grade?.is_absent ?? false;
                const isSaving = saving[student.id] ?? false;
                const isSaved  = saved[student.id] ?? false;

                return (
                  <div
                    key={student.id}
                    className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t' : ''}`}
                    style={{ borderColor: 'var(--border-subtle)', background: isAbsent ? 'var(--bg-raised)' : undefined }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                      style={{ background: isAbsent ? 'var(--border-default)' : 'var(--creme)', color: isAbsent ? 'var(--bg-surface)' : 'var(--ocre)' }}
                    >
                      {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                    </div>

                    {/* Nom */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: isAbsent ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {student.last_name} {student.first_name}
                      </div>
                    </div>

                    {/* Input note */}
                    {isAbsent ? (
                      <div className="w-20 text-center text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>ABS</div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          ref={el => { inputRefs.current[student.id] = el; }}
                          type="number"
                          min="0" max={maxScore} step="0.5"
                          inputMode="decimal"
                          defaultValue={grade?.score !== null && grade?.score !== undefined ? String(grade.score) : ''}
                          key={`${selectedEvalId}-${student.id}-${grade?.score ?? 'empty'}`}
                          onBlur={e => handleScoreCommit(student.id, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          className={`w-16 text-center py-2 rounded-xl text-sm font-bold focus:outline-none ${scoreColor(grade?.score ?? null)}`}
                          style={{
                            border: '2px solid var(--border-default)',
                            background: 'var(--bg-raised)',
                          }}
                          onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--ocre)';
                            e.currentTarget.select();
                          }}
                          onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                          placeholder="—"
                        />
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>/{maxScore}</span>
                      </div>
                    )}

                    {/* Bouton ABS */}
                    <button
                      onClick={() => toggleAbsent(student.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0"
                      style={isAbsent
                        ? { background: 'var(--text-muted)', color: 'var(--bg-surface)' }
                        : { background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }
                      }
                    >
                      ABS
                    </button>

                    {/* Indicateur sauvegarde */}
                    <div className="w-5 flex-shrink-0 flex items-center justify-center">
                      {isSaving ? (
                        <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ocre)', borderTopColor: 'transparent' }} />
                      ) : isSaved ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Raccourcis clavier */}
          <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
            Entrée ou Tab pour passer à l'élève suivant
          </p>
        </>
      )}

      {!selectedEvalId && !loading && evaluations.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          Aucun contrôle — créez des évaluations d'abord
        </div>
      )}
    </div>
  );
}
