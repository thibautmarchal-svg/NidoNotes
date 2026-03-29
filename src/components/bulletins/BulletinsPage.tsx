import { useState, useEffect } from 'react';
import {
  studentsApi, subjectsApi, evaluationsApi,
  gradesApi, periodsApi, objectivesApi,
} from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import type { Student, Subject, Evaluation, Grade, Period, Objective } from '../../types';

const COL_LABELS = [
  'Je sais très bien le faire',
  'Je sais bien le faire',
  'Je sais le faire avec aide',
  'Non évalué',
];

function scoreToColumn(
  score: number | null,
  maxScore: number,
  isAbsent: boolean,
): 1 | 2 | 3 | 4 {
  if (isAbsent || score === null) return 4;
  const n = (score / maxScore) * 10;
  if (n >= 8) return 1;
  if (n >= 6) return 2;
  if (n >= 5) return 3;
  return 4;
}

function calcWeightedAvg(
  scores: Array<{ score: number | null; weight: number; is_absent: boolean }>,
): number | null {
  const valid = scores.filter(s => !s.is_absent && s.score !== null);
  if (!valid.length) return null;
  const sumW  = valid.reduce((a, s) => a + (s.score as number) * s.weight, 0);
  const sumWt = valid.reduce((a, s) => a + s.weight, 0);
  return sumWt > 0 ? sumW / sumWt : null;
}

function fmt(score: number | null): string {
  if (score === null) return '—';
  return score % 1 === 0 ? String(score) : score.toFixed(1);
}

function CrossIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      style={{ color: 'var(--terre)' }}
    >
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

type ObjEntry  = { obj: Objective; col: 1 | 2 | 3 | 4 };
type SubGroup  = { ssId: number | null; ssName: string | null; avg: number | null; entries: ObjEntry[] };
type SubjGroup = { subject: Subject; subGroups: SubGroup[] };

export default function BulletinsPage() {
  const { currentClass } = useClass();

  const [students,    setStudents]    = useState<Student[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [allGrades,   setAllGrades]   = useState<Grade[]>([]);
  const [periods,     setPeriods]     = useState<Period[]>([]);
  const [objectives,  setObjectives]  = useState<Objective[]>([]);
  const [loading,     setLoading]     = useState(true);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedPeriodId,  setSelectedPeriodId]  = useState<number | null>(null);

  useEffect(() => {
    if (currentClass) loadAll();
  }, [currentClass?.id]);

  async function loadAll() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const [sts, sjs, evs, gs, prs, objs] = await Promise.all([
        studentsApi.list(currentClass.id),
        subjectsApi.list(currentClass.id),
        evaluationsApi.list(currentClass.id),
        gradesApi.list(currentClass.id),
        periodsApi.list(currentClass.id),
        objectivesApi.listForClass(currentClass.id),
      ]);
      const sorted = prs.sort((a, b) => a.order_num - b.order_num);
      setStudents(sts);
      setSubjects(sjs);
      setEvaluations(evs);
      setAllGrades(gs);
      setPeriods(sorted);
      setObjectives(objs);
      if (sts.length)    setSelectedStudentId(sts[0].id);
      if (sorted.length) setSelectedPeriodId(sorted[0].id);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }

  // Grades for the selected student only
  const studentGrades = allGrades.filter(g => g.student_id === selectedStudentId);
  function gradeOf(evalId: number): Grade | undefined {
    return studentGrades.find(g => g.evaluation_id === evalId);
  }
  function evalById(id: number): Evaluation | undefined {
    return evaluations.find(e => e.id === id);
  }

  // Objectives visible for the selected period
  const periodObjectives = objectives.filter(o => o.period_id === selectedPeriodId);

  // Build bulletin structure
  const bulletinData: SubjGroup[] = subjects.map(subject => {
    const sObjs = periodObjectives.filter(o => o.subject_id === subject.id);
    if (!sObjs.length) return null;

    const ssIds = Array.from(new Set(sObjs.map(o => o.sub_subject_id ?? null)));

    const subGroups: SubGroup[] = ssIds.map(ssId => {
      const ssObjs = sObjs.filter(o => (o.sub_subject_id ?? null) === ssId);
      const ssName = ssId
        ? (subject.sub_subjects.find(ss => ss.id === ssId)?.name ?? null)
        : null;

      // Average of this sub-subject (or direct) in selected period
      const ssEvals = ssId
        ? evaluations.filter(e => e.sub_subject_id === ssId && e.period_id === selectedPeriodId)
        : evaluations.filter(e => e.subject_id === subject.id && !e.sub_subject_id && e.period_id === selectedPeriodId);
      const avg = calcWeightedAvg(ssEvals.map(e => {
        const g = gradeOf(e.id);
        return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
      }));

      const entries: ObjEntry[] = ssObjs.map(obj => {
        const ev = evalById(obj.evaluation_id);
        const g  = gradeOf(obj.evaluation_id);
        const col = scoreToColumn(g?.score ?? null, ev?.max_score ?? 10, g?.is_absent ?? false);
        return { obj, col };
      });

      return { ssId, ssName, avg, entries };
    });

    return { subject, subGroups };
  }).filter((g): g is SubjGroup => g !== null);

  if (loading) return (
    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  );

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div>
      {/* Titre */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Bulletins</h1>
        {currentClass && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>
        )}
      </div>

      {/* Sélecteurs */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
            Élève
          </label>
          <select
            value={selectedStudentId ?? ''}
            onChange={e => setSelectedStudentId(Number(e.target.value))}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
            Période
          </label>
          <select
            value={selectedPeriodId ?? ''}
            onChange={e => setSelectedPeriodId(Number(e.target.value))}
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pas de données */}
      {!students.length || !periods.length ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p>Ajoutez des élèves et des périodes pour générer un bulletin.</p>
        </div>
      ) : !bulletinData.length ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p className="text-base">Aucun objectif pour cette période.</p>
          <p className="text-sm mt-2">Ajoutez des objectifs aux évaluations de cette période.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {bulletinData.map(({ subject, subGroups }) => (
            <div key={subject.id}>
              {/* Titre matière */}
              <h2
                className="text-base font-bold mb-3 uppercase tracking-wide"
                style={{ color: 'var(--terre)' }}
              >
                {subject.name}
              </h2>

              {/* Tableau */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--border-default)' }}
              >
                {/* En-tête colonnes */}
                <div
                  className="grid text-center"
                  style={{
                    gridTemplateColumns: '1fr repeat(4, minmax(60px, 80px))',
                    background: 'var(--creme)',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <div
                    className="px-4 py-2.5 text-left text-xs font-semibold"
                    style={{ color: 'var(--terre)' }}
                  >
                    Objectif
                  </div>
                  {COL_LABELS.map((label, i) => (
                    <div
                      key={i}
                      className="px-1 py-2.5 text-xs font-semibold leading-tight"
                      style={{ color: 'var(--terre)' }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Groupes sous-matière */}
                {subGroups.map(({ ssId, ssName, avg, entries }) => (
                  <div key={ssId ?? '__direct__'}>
                    {/* Ligne sous-matière */}
                    <div
                      className="flex items-center gap-3 px-4 py-2"
                      style={{
                        background: 'var(--bg-raised)',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      {ssName ? (
                        <>
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: 'var(--ocre)' }}
                          />
                          <span
                            className="text-xs font-semibold"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {ssName}
                          </span>
                        </>
                      ) : (
                        <span
                          className="text-xs font-semibold italic"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Général
                        </span>
                      )}
                      {avg !== null && (
                        <span
                          className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--creme)', color: 'var(--ocre)' }}
                        >
                          Moy. {fmt(avg)}/10
                        </span>
                      )}
                    </div>

                    {/* Lignes objectifs */}
                    {entries.map(({ obj, col }) => (
                      <div
                        key={obj.id}
                        className="grid items-center"
                        style={{
                          gridTemplateColumns: '1fr repeat(4, minmax(60px, 80px))',
                          borderTop: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface)',
                        }}
                      >
                        <div
                          className="px-4 py-3 text-sm"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {obj.name}
                        </div>
                        {([1, 2, 3, 4] as const).map(c => (
                          <div key={c} className="flex items-center justify-center py-3">
                            {col === c && <CrossIcon />}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
