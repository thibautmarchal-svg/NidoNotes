import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentsApi, subjectsApi, evaluationsApi, gradesApi, periodsApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import type { Student, Subject, Evaluation, Grade, Period } from '../../types';

// ── Calculs ────────────────────────────────────────────────────
function calcWeightedAvg(scores: Array<{ score: number | null; weight: number; is_absent: boolean }>): number | null {
  const valid = scores.filter(s => !s.is_absent && s.score !== null);
  if (!valid.length) return null;
  const sumW  = valid.reduce((a, s) => a + (s.score as number) * s.weight, 0);
  const sumWt = valid.reduce((a, s) => a + s.weight, 0);
  return sumWt > 0 ? sumW / sumWt : null;
}

function fmt(score: number | null, decimals = 1): string {
  if (score === null) return '—';
  return score % 1 === 0 ? String(score) : score.toFixed(decimals);
}

function scoreColor(score: number | null, max = 10): string {
  if (score === null) return '';
  const pct = score / max;
  if (pct < 0.5) return 'text-red-600';
  if (pct < 0.7) return 'text-orange-500';
  return 'text-green-600';
}

function scoreBadge(score: number | null, max = 10): React.CSSProperties {
  if (score === null) return { background: 'var(--bg-raised)', color: 'var(--text-muted)' };
  const pct = score / max;
  if (pct < 0.5) return { background: '#fef2f2', color: '#dc2626' };
  if (pct < 0.7) return { background: '#fff7ed', color: '#ea580c' };
  return { background: '#f0fdf4', color: '#16a34a' };
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { currentClass } = useClass();

  const [student,     setStudent]     = useState<Student | null>(null);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [grades,      setGrades]      = useState<Grade[]>([]);
  const [periods,     setPeriods]     = useState<Period[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (currentClass && studentId) loadAll();
  }, [currentClass?.id, studentId]);

  async function loadAll() {
    if (!currentClass || !studentId) return;
    setLoading(true);
    try {
      const [sts, sjs, evs, gs, prs] = await Promise.all([
        studentsApi.list(currentClass.id),
        subjectsApi.list(currentClass.id),
        evaluationsApi.list(currentClass.id),
        gradesApi.list(currentClass.id),
        periodsApi.list(currentClass.id),
      ]);
      setStudent(sts.find(s => s.id === Number(studentId)) ?? null);
      setSubjects(sjs);
      setEvaluations(evs);
      setGrades(gs.filter(g => g.student_id === Number(studentId)));
      setPeriods(prs.sort((a, b) => a.order_num - b.order_num));
    } catch { /* offline */ }
    finally { setLoading(false); }
  }

  function gradeOf(evalId: number): Grade | undefined {
    return grades.find(g => g.evaluation_id === evalId);
  }

  function evalsForSubSubject(ssId: number, periodId: number) {
    return evaluations.filter(e => e.sub_subject_id === ssId && e.period_id === periodId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  function evalsDirectForSubject(subjectId: number, periodId: number) {
    return evaluations.filter(e => e.subject_id === subjectId && !e.sub_subject_id && e.period_id === periodId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function avgSubSubject(ssId: number, periodId: number): number | null {
    const evs = evalsForSubSubject(ssId, periodId);
    return calcWeightedAvg(evs.map(e => {
      const g = gradeOf(e.id);
      return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
    }));
  }

  function avgSubject(subject: Subject, periodId: number): number | null {
    const vals: number[] = [];
    subject.sub_subjects.forEach(ss => {
      const a = avgSubSubject(ss.id, periodId);
      if (a !== null) vals.push(a);
    });
    const directEvs = evalsDirectForSubject(subject.id, periodId);
    const da = calcWeightedAvg(directEvs.map(e => {
      const g = gradeOf(e.id);
      return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
    }));
    if (da !== null) vals.push(da);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function avgPeriod(periodId: number): number | null {
    const vals = subjects.map(s => avgSubject(s, periodId)).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function avgAnnual(): number | null {
    const vals = periods.map(p => avgPeriod(p.id)).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  if (loading) return (
    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  );

  if (!student) return (
    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
      Élève introuvable.{' '}
      <button onClick={() => navigate(-1)} className="underline" style={{ color: 'var(--ocre)' }}>Retour</button>
    </div>
  );

  const annual = avgAnnual();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0"
          style={{ background: 'var(--creme)', color: 'var(--ocre)' }}>
          {student.first_name.charAt(0)}{student.last_name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>
            {student.last_name} {student.first_name}
          </h1>
          {currentClass && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>
          )}
        </div>

        {/* Moyenne annuelle */}
        <div className="flex-shrink-0 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-bold"
            style={scoreBadge(annual)}
          >
            <span className="text-xl leading-none">{fmt(annual)}</span>
            <span className="text-xs font-normal mt-0.5" style={{ opacity: 0.7 }}>annuel</span>
          </div>
        </div>
      </div>

      {/* Résumé périodes */}
      {periods.length > 1 && (
        <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: `repeat(${Math.min(periods.length, 4)}, 1fr)` }}>
          {periods.map(p => {
            const avg = avgPeriod(p.id);
            return (
              <div key={p.id} className="rounded-2xl p-3 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                <div className={`text-lg font-bold ${scoreColor(avg)}`}>{fmt(avg)}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{p.name}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Détail par période */}
      <div className="space-y-6">
        {periods.map(period => {
          const periodHasData = subjects.some(s => {
            if (evalsDirectForSubject(s.id, period.id).length > 0) return true;
            return s.sub_subjects.some(ss => evalsForSubSubject(ss.id, period.id).length > 0);
          });
          if (!periodHasData) return null;

          const periodAvg = avgPeriod(period.id);

          return (
            <div key={period.id}>
              {/* Titre période */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold uppercase tracking-wider" style={{ color: 'var(--ocre)' }}>
                  {period.name}
                </h2>
                {periodAvg !== null && (
                  <div className="px-3 py-1 rounded-full text-sm font-bold" style={scoreBadge(periodAvg)}>
                    {fmt(periodAvg)}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {subjects.map(subject => {
                  const directEvs = evalsDirectForSubject(subject.id, period.id);
                  const hasSubs = subject.sub_subjects.some(ss => evalsForSubSubject(ss.id, period.id).length > 0);
                  if (!hasSubs && directEvs.length === 0) return null;

                  const subjAvg = avgSubject(subject, period.id);

                  return (
                    <div key={subject.id} className="rounded-2xl overflow-hidden"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                      {/* Header matière */}
                      <div className="flex items-center justify-between px-4 py-3"
                        style={{ background: 'var(--creme)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="font-semibold text-sm" style={{ color: 'var(--terre)' }}>{subject.name}</span>
                        {subjAvg !== null && (
                          <span className={`text-sm font-bold ${scoreColor(subjAvg)}`}>{fmt(subjAvg)}</span>
                        )}
                      </div>

                      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {/* Sous-matières */}
                        {subject.sub_subjects.map(ss => {
                          const evs = evalsForSubSubject(ss.id, period.id);
                          if (!evs.length) return null;
                          const ssAvg = avgSubSubject(ss.id, period.id);
                          return (
                            <div key={ss.id}>
                              {/* Nom sous-matière */}
                              <div className="flex items-center justify-between px-4 py-2"
                                style={{ background: 'var(--bg-raised)' }}>
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ocre)' }} />
                                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{ss.name}</span>
                                </div>
                                {ssAvg !== null && (
                                  <span className={`text-xs font-semibold ${scoreColor(ssAvg)}`}>{fmt(ssAvg)}</span>
                                )}
                              </div>
                              {/* Évals sous-matière */}
                              {evs.map(ev => <EvalRow key={ev.id} ev={ev} grade={gradeOf(ev.id)} />)}
                            </div>
                          );
                        })}

                        {/* Évals directes */}
                        {directEvs.map(ev => <EvalRow key={ev.id} ev={ev} grade={gradeOf(ev.id)} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {periods.length === 0 && (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          Aucune période ni évaluation pour cet élève.
        </div>
      )}
    </div>
  );
}

function EvalRow({ ev, grade }: { ev: Evaluation; grade: Grade | undefined }) {
  const isAbsent = grade?.is_absent ?? false;
  const score    = grade?.score ?? null;
  const max      = ev.max_score ?? 10;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{ev.name}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date(ev.date + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {ev.weight !== 1 && <span className="ml-2">×{ev.weight}</span>}
        </div>
      </div>

      {isAbsent ? (
        <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
          Absent
        </span>
      ) : score !== null ? (
        <div className="text-right flex-shrink-0">
          <span className={`text-sm font-bold ${scoreColor(score, max)}`}>{fmt(score)}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}> /{max}</span>
        </div>
      ) : (
        <span className="text-sm" style={{ color: 'var(--border-default)' }}>—</span>
      )}

      {grade?.comment && (
        <div title={grade.comment} className="flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ocre)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
      )}
    </div>
  );
}
