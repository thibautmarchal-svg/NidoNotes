import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Student, Subject, Evaluation, Grade } from '../../types';

function calcWeightedAvg(scores: Array<{ score: number | null; weight: number; is_absent: boolean }>): number | null {
  const valid = scores.filter(s => !s.is_absent && s.score !== null);
  if (!valid.length) return null;
  const sumW = valid.reduce((a, s) => a + (s.score as number) * s.weight, 0);
  const sumWt = valid.reduce((a, s) => a + s.weight, 0);
  return sumWt > 0 ? sumW / sumWt : null;
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score < 5) return 'text-red-600';
  if (score <= 7) return 'text-orange-500';
  return 'text-green-600';
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-slate-100 dark:bg-slate-700';
  if (score < 5) return 'bg-red-50 dark:bg-red-900/20';
  if (score <= 7) return 'bg-orange-50 dark:bg-orange-900/20';
  return 'bg-green-50 dark:bg-green-900/20';
}

function formatScore(score: number | null): string {
  if (score === null) return '—';
  return score % 1 === 0 ? String(score) : score.toFixed(2);
}

export default function Dashboard() {
  const [students,    setStudents]    = useState<Student[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [grades,      setGrades]      = useState<Grade[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      const [s, sj, ss, ev, g] = await Promise.all([
        db.students.orderBy('last_name').toArray(),
        db.subjects.toArray(),
        db.sub_subjects.toArray(),
        db.evaluations.toArray(),
        db.grades.toArray(),
      ]);
      setStudents(s);
      setSubjects(sj.map(x => ({ ...x, sub_subjects: ss.filter(sub => sub.subject_id === x.id) })));
      setEvaluations(ev);
      setGrades(g);
      setLoading(false);
    })();
  }, []);

  function gradeOf(studentId: number, evalId: number): Grade | undefined {
    return grades.find(g => g.student_id === studentId && g.evaluation_id === evalId);
  }

  function avgSubject(studentId: number, subject: Subject): number | null {
    const vals: number[] = [];
    // Par sous-matière
    subject.sub_subjects.forEach(ss => {
      const evs = evaluations.filter(e => e.sub_subject_id === ss.id);
      const avg = calcWeightedAvg(evs.map(e => {
        const g = gradeOf(studentId, e.id);
        return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
      }));
      if (avg !== null) vals.push(avg);
    });
    // Évals directes
    const directEvs = evaluations.filter(e => e.subject_id === subject.id && !e.sub_subject_id);
    const directAvg = calcWeightedAvg(directEvs.map(e => {
      const g = gradeOf(studentId, e.id);
      return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
    }));
    if (directAvg !== null) vals.push(directAvg);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function avgGeneral(studentId: number): number | null {
    const vals = subjects.map(s => avgSubject(studentId, s)).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // Stats globales
  const classAvg = (() => {
    const avgs = students.map(s => avgGeneral(s.id)).filter((v): v is number => v !== null);
    if (!avgs.length) return null;
    return avgs.reduce((a, b) => a + b, 0) / avgs.length;
  })();

  const countAbove = (threshold: number) =>
    students.filter(s => { const a = avgGeneral(s.id); return a !== null && a > threshold; }).length;
  const countBelow = (threshold: number) =>
    students.filter(s => { const a = avgGeneral(s.id); return a !== null && a < threshold; }).length;

  if (loading) return <div className="text-center py-12 text-slate-400">Chargement…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Tableau de bord</h1>

      {!students.length ? (
        <div className="text-center py-16 text-slate-400">
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
            <StatCard
              label="Moy. de classe"
              value={formatScore(classAvg)}
              icon="📊"
              valueClass={scoreColor(classAvg)}
            />
          </div>

          {/* Distribution */}
          {classAvg !== null && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{countAbove(7)}</div>
                <div className="text-xs text-green-700 dark:text-green-400 mt-1">Au-dessus de 7</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-500">{students.length - countAbove(7) - countBelow(5)}</div>
                <div className="text-xs text-orange-700 dark:text-orange-400 mt-1">Entre 5 et 7</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{countBelow(5)}</div>
                <div className="text-xs text-red-700 dark:text-red-400 mt-1">En dessous de 5</div>
              </div>
            </div>
          )}

          {/* Liste élèves */}
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Moyennes par élève</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {students.map((student, i) => {
              const gen = avgGeneral(student.id);
              return (
                <div
                  key={student.id}
                  className={`flex items-center px-5 py-3.5 gap-3 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm flex-shrink-0">
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white text-sm">
                      {student.last_name} {student.first_name}
                    </div>
                    {/* Moyennes par matière */}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {subjects.map(s => {
                        const avg = avgSubject(student.id, s);
                        return avg !== null ? (
                          <span key={s.id} className="text-xs text-slate-500">
                            {s.name}: <span className={`font-semibold ${scoreColor(avg)}`}>{formatScore(avg)}</span>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${scoreBg(gen)} ${scoreColor(gen)}`}>
                    {formatScore(gen)}
                  </div>
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${valueClass ?? 'text-slate-900 dark:text-white'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
