import { useState, useEffect, useCallback } from 'react';
import {
  studentsApi, subjectsApi, evaluationsApi,
  gradesApi, periodsApi, objectivesApi, remarksApi,
} from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import type { Student, Subject, Evaluation, Grade, Period, Objective, Remark } from '../../types';

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
  const n = (Number(score) / Number(maxScore)) * 10;
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

// CSS injecté pour l'impression
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #bulletin-print-area, #bulletin-print-area * { visibility: visible !important; }
  #bulletin-print-area {
    position: fixed !important;
    inset: 0 !important;
    padding: 15mm !important;
    background: white !important;
    font-size: 11pt !important;
    color: black !important;
  }
  .bulletin-no-print { display: none !important; }
  .bulletin-subject-block { page-break-inside: avoid; break-inside: avoid; }
  .bulletin-table { border-collapse: collapse; width: 100%; margin-bottom: 6mm; }
  .bulletin-table th, .bulletin-table td {
    border: 1px solid #aaa;
    padding: 3mm 4mm;
    font-size: 10pt;
    vertical-align: middle;
  }
  .bulletin-table th { background: #f3ede3 !important; font-weight: 700; text-align: center; }
  .bulletin-table td.col-center { text-align: center; }
  .bulletin-subject-title {
    font-size: 13pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 5mm 0 2mm 0;
  }
  .bulletin-subsubject-row td { background: #f9f5ef !important; font-weight: 600; }
  .bulletin-print-header { margin-bottom: 8mm; }
  .bulletin-print-header h1 { font-size: 16pt; font-weight: 700; margin: 0 0 1mm 0; }
  .bulletin-print-header p { font-size: 11pt; margin: 0; color: #555; }
  .bulletin-remark-section { margin-top: 6mm; border: 1px solid #aaa; padding: 3mm 4mm; }
  .bulletin-remark-section p { font-size: 10pt; white-space: pre-wrap; }
  .bulletin-remark-label { font-weight: 700; font-size: 10pt; margin-bottom: 2mm; }
}
`;

export default function BulletinsPage() {
  const { currentClass } = useClass();

  const [students,    setStudents]    = useState<Student[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [allGrades,   setAllGrades]   = useState<Grade[]>([]);
  const [periods,     setPeriods]     = useState<Period[]>([]);
  const [objectives,  setObjectives]  = useState<Objective[]>([]);
  const [allRemarks,  setAllRemarks]  = useState<Remark[]>([]);
  const [loading,     setLoading]     = useState(true);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedPeriodId,  setSelectedPeriodId]  = useState<number | null>(null);
  const [remarkText,        setRemarkText]        = useState('');
  const [savingRemark,      setSavingRemark]      = useState(false);

  useEffect(() => {
    if (currentClass) loadAll();
  }, [currentClass?.id]);

  // Sync remark text when student/period changes
  useEffect(() => {
    if (selectedStudentId && selectedPeriodId) {
      const r = allRemarks.find(
        r => Number(r.student_id) === selectedStudentId && Number(r.period_id) === selectedPeriodId,
      );
      setRemarkText(r?.content ?? '');
    }
  }, [selectedStudentId, selectedPeriodId, allRemarks]);

  async function loadAll() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const [sts, sjs, evs, gs, prs, objs, rems] = await Promise.all([
        studentsApi.list(currentClass.id),
        subjectsApi.list(currentClass.id),
        evaluationsApi.list(currentClass.id),
        gradesApi.list(currentClass.id),
        periodsApi.list(currentClass.id),
        objectivesApi.listForClass(currentClass.id),
        remarksApi.listForClass(currentClass.id),
      ]);
      const sorted = prs.sort((a, b) => a.order_num - b.order_num);
      setStudents(sts);
      setSubjects(sjs);
      setEvaluations(evs);
      setAllGrades(gs);
      setPeriods(sorted);
      setObjectives(objs);
      setAllRemarks(rems);
      if (sts.length)    setSelectedStudentId(sts[0].id);
      if (sorted.length) setSelectedPeriodId(sorted[0].id);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }

  const saveRemark = useCallback(async () => {
    if (!currentClass || !selectedStudentId || !selectedPeriodId) return;
    setSavingRemark(true);
    try {
      const saved = await remarksApi.save({
        class_id: currentClass.id,
        student_id: selectedStudentId,
        period_id: selectedPeriodId,
        content: remarkText,
      });
      setAllRemarks(prev => {
        const filtered = prev.filter(
          r => !(Number(r.student_id) === selectedStudentId && Number(r.period_id) === selectedPeriodId),
        );
        return [...filtered, saved];
      });
    } catch { /* offline */ }
    finally { setSavingRemark(false); }
  }, [currentClass, selectedStudentId, selectedPeriodId, remarkText]);

  // Grades for the selected student only
  const studentGrades = allGrades.filter(g => Number(g.student_id) === selectedStudentId);
  function gradeOf(evalId: number): Grade | undefined {
    return studentGrades.find(g => Number(g.evaluation_id) === Number(evalId));
  }
  function evalById(id: number): Evaluation | undefined {
    return evaluations.find(e => Number(e.id) === Number(id));
  }

  // Objectives visible for the selected period
  const periodObjectives = objectives.filter(o => Number(o.period_id) === selectedPeriodId);

  // Build bulletin structure
  const bulletinData: SubjGroup[] = subjects.map(subject => {
    const sObjs = periodObjectives.filter(o => Number(o.subject_id) === subject.id);
    if (!sObjs.length) return null;

    const ssIds = Array.from(new Set(sObjs.map(o => o.sub_subject_id ?? null)));

    const subGroups: SubGroup[] = ssIds.map(ssId => {
      const ssObjs = sObjs.filter(o => (o.sub_subject_id ?? null) === ssId);
      const ssName = ssId
        ? (subject.sub_subjects.find(ss => ss.id === ssId)?.name ?? null)
        : null;

      // Average for this sub-subject in selected period
      const ssEvals = ssId !== null
        ? evaluations.filter(e => Number(e.sub_subject_id) === ssId && Number(e.period_id) === selectedPeriodId)
        : evaluations.filter(e => Number(e.subject_id) === subject.id && !e.sub_subject_id && Number(e.period_id) === selectedPeriodId);
      const avg = calcWeightedAvg(ssEvals.map(e => {
        const g = gradeOf(e.id);
        return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
      }));

      const entries: ObjEntry[] = ssObjs.map(obj => {
        const ev  = evalById(obj.evaluation_id);
        const g   = gradeOf(obj.evaluation_id);
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
  const selectedPeriod  = periods.find(p => p.id === selectedPeriodId);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Styles d'impression injectés */}
      <style>{PRINT_STYLES}</style>

      {/* Zone écran (sélecteurs + bouton imprimer) */}
      <div className="bulletin-no-print">
        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Bulletins</h1>
          {currentClass && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>
          )}
        </div>

        <div className="flex gap-3 mb-6 flex-wrap items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Élève</label>
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
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Période</label>
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
          {bulletinData.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--terre)', color: 'var(--creme)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimer
            </button>
          )}
        </div>
      </div>

      {/* Zone imprimable */}
      <div id="bulletin-print-area">

        {/* En-tête visible à l'impression seulement */}
        <div className="bulletin-print-header bulletin-no-print" style={{ display: 'none' }}>
          <h1>{selectedStudent ? `${selectedStudent.last_name} ${selectedStudent.first_name}` : ''}</h1>
          <p>{currentClass?.name}{selectedPeriod ? ` — ${selectedPeriod.name}` : ''}</p>
        </div>
        {/* En-tête visible seulement à l'impression (via CSS print) */}
        <style>{`
          @media print {
            .bulletin-print-header { display: block !important; }
          }
        `}</style>
        <div className="bulletin-print-header" style={{ display: 'none' }}>
          <h1>{selectedStudent ? `${selectedStudent.last_name} ${selectedStudent.first_name}` : ''}</h1>
          <p>{currentClass?.name}{selectedPeriod ? ` — ${selectedPeriod.name}` : ''}</p>
        </div>

        {/* Pas de données */}
        {!students.length || !periods.length ? (
          <div className="bulletin-no-print text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p>Ajoutez des élèves et des périodes pour générer un bulletin.</p>
          </div>
        ) : !bulletinData.length ? (
          <div className="bulletin-no-print text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-base">Aucun objectif pour cette période.</p>
            <p className="text-sm mt-2">Ajoutez des objectifs aux évaluations de cette période.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {bulletinData.map(({ subject, subGroups }) => (
              <div key={subject.id} className="bulletin-subject-block">

                {/* Titre matière — version écran */}
                <h2
                  className="bulletin-no-print text-base font-bold mb-3 uppercase tracking-wide"
                  style={{ color: 'var(--terre)' }}
                >
                  {subject.name}
                </h2>
                {/* Titre matière — version impression */}
                <div className="bulletin-subject-title" style={{ display: 'none' }}>
                  {subject.name}
                </div>
                <style>{`@media print { .bulletin-subject-title { display: block !important; } }`}</style>

                {/* Tableau version écran */}
                <div
                  className="bulletin-no-print rounded-2xl overflow-hidden"
                  style={{ border: '1px solid var(--border-default)' }}
                >
                  {/* En-tête colonnes */}
                  <div
                    className="grid text-center"
                    style={{
                      gridTemplateColumns: '1fr repeat(4, minmax(70px, 90px))',
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
                        style={{
                          color: 'var(--terre)',
                          borderLeft: '1px solid var(--border-default)',
                        }}
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
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ocre)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{ssName}</span>
                          </>
                        ) : (
                          <span className="text-xs font-semibold italic" style={{ color: 'var(--text-muted)' }}>Général</span>
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
                            gridTemplateColumns: '1fr repeat(4, minmax(70px, 90px))',
                            borderTop: '1px solid var(--border-subtle)',
                            background: 'var(--bg-surface)',
                          }}
                        >
                          <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                            {obj.name}
                          </div>
                          {([1, 2, 3, 4] as const).map(c => (
                            <div
                              key={c}
                              className="flex items-center justify-center py-3"
                              style={{ borderLeft: '1px solid var(--border-subtle)' }}
                            >
                              {col === c && <CrossIcon />}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Tableau version impression */}
                <table className="bulletin-table" style={{ display: 'none' }}>
                  <style>{`@media print { .bulletin-table { display: table !important; } }`}</style>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: '40%' }}>Objectif</th>
                      {COL_LABELS.map((label, i) => (
                        <th key={i} style={{ width: '15%', fontSize: '9pt' }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subGroups.map(({ ssId, ssName, avg, entries }) => (
                      <>
                        <tr key={`ss-${ssId}`} className="bulletin-subsubject-row">
                          <td colSpan={5}>
                            {ssName ?? 'Général'}
                            {avg !== null ? `  —  Moyenne : ${fmt(avg)}/10` : ''}
                          </td>
                        </tr>
                        {entries.map(({ obj, col }) => (
                          <tr key={obj.id}>
                            <td>{obj.name}</td>
                            {([1, 2, 3, 4] as const).map(c => (
                              <td key={c} className="col-center">{col === c ? '✕' : ''}</td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>

              </div>
            ))}

            {/* Remarque — version écran */}
            <div className="bulletin-no-print rounded-2xl p-4" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Remarque
              </label>
              <textarea
                value={remarkText}
                onChange={e => setRemarkText(e.target.value)}
                onBlur={saveRemark}
                rows={3}
                placeholder="Remarque pour cette période…"
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sauvegardé automatiquement en quittant le champ
                </span>
                <button
                  onClick={saveRemark}
                  disabled={savingRemark}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'var(--creme)', color: 'var(--terre)' }}
                >
                  {savingRemark ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </div>

            {/* Remarque — version impression */}
            {remarkText && (
              <div className="bulletin-remark-section" style={{ display: 'none' }}>
                <style>{`@media print { .bulletin-remark-section { display: block !important; } }`}</style>
                <div className="bulletin-remark-label">Remarque</div>
                <p>{remarkText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
