import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentsApi, subjectsApi, evaluationsApi, gradesApi, periodsApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import type { Student, Subject, Evaluation, Grade, Period } from '../../types';

function calcWeightedAvg(scores: Array<{ score: number | null; weight: number; is_absent: boolean }>): number | null {
  const valid = scores.filter(s => !s.is_absent && s.score !== null);
  if (!valid.length) return null;
  const sumW  = valid.reduce((a, s) => a + (s.score as number) * s.weight, 0);
  const sumWt = valid.reduce((a, s) => a + s.weight, 0);
  return sumWt > 0 ? sumW / sumWt : null;
}

function scoreColor(score: number | null): string {
  if (score === null) return '';
  if (score < 5) return 'text-red-600';
  if (score <= 7) return 'text-orange-500';
  return 'text-green-600';
}

function scoreBg(score: number | null): { background: string } {
  if (score === null) return { background: 'var(--bg-raised)' };
  if (score < 5) return { background: '#fef2f2' };
  if (score <= 7) return { background: '#fff7ed' };
  return { background: '#f0fdf4' };
}

function formatScore(score: number | null, decimals = 2): string {
  if (score === null) return '—';
  return score % 1 === 0 ? String(score) : score.toFixed(decimals);
}

export default function Dashboard() {
  const { currentClass } = useClass();
  const navigate = useNavigate();
  const [students,    setStudents]    = useState<Student[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [grades,      setGrades]      = useState<Grade[]>([]);
  const [periods,     setPeriods]     = useState<Period[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (currentClass) loadAll();
  }, [currentClass?.id]);

  async function loadAll() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const [s, sj, ev, g, p] = await Promise.all([
        studentsApi.list(currentClass.id),
        subjectsApi.list(currentClass.id),
        evaluationsApi.list(currentClass.id),
        gradesApi.list(currentClass.id),
        periodsApi.list(currentClass.id),
      ]);
      setStudents(s);
      setSubjects(sj);
      setEvaluations(ev);
      setGrades(g);
      setPeriods(p.sort((a, b) => a.order_num - b.order_num));
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }

  function gradeOf(studentId: number, evalId: number): Grade | undefined {
    return grades.find(g => g.student_id === studentId && g.evaluation_id === evalId);
  }

  function avgSubjectInPeriod(studentId: number, subject: Subject, periodId: number): number | null {
    const vals: number[] = [];
    subject.sub_subjects.forEach(ss => {
      const evs = evaluations.filter(e => e.sub_subject_id === ss.id && e.period_id === periodId);
      const avg = calcWeightedAvg(evs.map(e => {
        const g = gradeOf(studentId, e.id);
        return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
      }));
      if (avg !== null) vals.push(avg);
    });
    const directEvs = evaluations.filter(e => e.subject_id === subject.id && !e.sub_subject_id && e.period_id === periodId);
    const directAvg = calcWeightedAvg(directEvs.map(e => {
      const g = gradeOf(studentId, e.id);
      return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
    }));
    if (directAvg !== null) vals.push(directAvg);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function avgGeneralInPeriod(studentId: number, periodId: number): number | null {
    const vals = subjects.map(s => avgSubjectInPeriod(studentId, s, periodId)).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function avgAnnual(studentId: number): number | null {
    const periodAvgs = periods.map(p => avgGeneralInPeriod(studentId, p.id)).filter((v): v is number => v !== null);
    if (!periodAvgs.length) return null;
    return periodAvgs.reduce((a, b) => a + b, 0) / periodAvgs.length;
  }

  const classAvg = (() => {
    const avgs = students.map(s => avgAnnual(s.id)).filter((v): v is number => v !== null);
    if (!avgs.length) return null;
    return avgs.reduce((a, b) => a + b, 0) / avgs.length;
  })();

  const countAbove = (threshold: number) =>
    students.filter(s => { const a = avgAnnual(s.id); return a !== null && a > threshold; }).length;
  const countBelow = (threshold: number) =>
    students.filter(s => { const a = avgAnnual(s.id); return a !== null && a < threshold; }).length;

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Tableau de bord</h1>
        {currentClass && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {currentClass.name}{currentClass.school_year ? ` · ${currentClass.school_year}` : ''}
          </p>
        )}
      </div>

      {!students.length ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p className="text-lg">Bienvenue dans Nido Notes !</p>
          <p className="text-sm mt-2">Commencez par ajouter des élèves et des matières.</p>
        </div>
      ) : (
        <>
          {/* Stats résumées */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Élèves" value={String(students.length)} icon="👥" />
            <StatCard label="Matières" value={String(subjects.length)} icon="📚" />
            <StatCard label="Évaluations" value={String(evaluations.length)} icon="📝" />
            <StatCard label="Moy. annuelle" value={formatScore(classAvg)} icon="📊" valueClass={scoreColor(classAvg)} />
          </div>

          {/* Distribution */}
          {classAvg !== null && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl p-4 text-center" style={{ background: '#f0fdf4' }}>
                <div className="text-2xl font-bold text-green-600">{countAbove(7)}</div>
                <div className="text-xs text-green-700 mt-1">Au-dessus de 7</div>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: '#fff7ed' }}>
                <div className="text-2xl font-bold text-orange-500">{students.length - countAbove(7) - countBelow(5)}</div>
                <div className="text-xs text-orange-700 mt-1">Entre 5 et 7</div>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: '#fef2f2' }}>
                <div className="text-2xl font-bold text-red-600">{countBelow(5)}</div>
                <div className="text-xs text-red-700 mt-1">En dessous de 5</div>
              </div>
            </div>
          )}

          {/* Liste élèves avec moyennes par période */}
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Moyennes par élève</h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
            {/* Header périodes */}
            {periods.length > 0 && (
              <div className="flex items-center px-5 py-2 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
                <div className="flex-1" />
                {periods.map(p => (
                  <div key={p.id} className="w-20 text-center text-xs font-semibold" style={{ color: 'var(--ocre)' }}>{p.name}</div>
                ))}
                <div className="w-16 text-center text-xs font-bold" style={{ color: 'var(--terre)' }}>Annuel</div>
              </div>
            )}
            {students.map((student, i) => {
              const annual = avgAnnual(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => navigate(`/eleves/${student.id}`)}
                  className={`flex items-center px-5 py-3.5 gap-3 cursor-pointer transition-colors ${i > 0 ? 'border-t' : ''}`}
                  style={i > 0 ? { borderColor: 'var(--border-subtle)' } : undefined}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--creme)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                    style={{ background: 'var(--creme)', color: 'var(--ocre)' }}
                  >
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {student.last_name} {student.first_name}
                    </div>
                    {subjects.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {subjects.map(s => {
                          const periodAvgs = periods.map(p => avgSubjectInPeriod(student.id, s, p.id));
                          const hasAny = periodAvgs.some(v => v !== null);
                          if (!hasAny) return null;
                          return (
                            <span key={s.id} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {s.name}: {periodAvgs.map((avg, pi) => avg !== null ? (
                                <span key={pi} className={`font-semibold ${scoreColor(avg)}`}>{formatScore(avg, 1)}</span>
                              ) : null).filter(Boolean).map((el, idx, arr) => idx < arr.length - 1 ? [el, <span key={`sep-${idx}`} style={{ color: 'var(--border-default)' }}> · </span>] : el)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Moyennes par période */}
                  {periods.map(p => {
                    const avg = avgGeneralInPeriod(student.id, p.id);
                    return (
                      <div key={p.id} className="w-20 text-center flex-shrink-0">
                        {avg !== null ? (
                          <span className={`text-sm font-semibold ${scoreColor(avg)}`}>{formatScore(avg, 1)}</span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--border-default)' }}>—</span>
                        )}
                      </div>
                    );
                  })}
                  {/* Moyenne annuelle */}
                  <div
                    className={`w-16 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${scoreColor(annual)}`}
                    style={scoreBg(annual)}
                  >
                    {formatScore(annual, 1)}
                  </div>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--border-default)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, valueClass }: { label: string; value: string; icon: string; valueClass?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${valueClass ?? ''}`} style={!valueClass ? { color: 'var(--text-primary)' } : undefined}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
