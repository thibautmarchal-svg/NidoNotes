import { useState, useEffect, useCallback } from 'react';
import {
  studentsApi, subjectsApi, evaluationsApi,
  gradesApi, periodsApi, objectivesApi, remarksApi,
} from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import type { Student, Subject, Evaluation, Grade, Period, Objective, Remark } from '../../types';

// ── Constantes ─────────────────────────────────────────────────
const COL_LABELS = [
  'Je sais très bien le faire',
  'Je sais bien le faire',
  'Je sais le faire avec aide',
  'Non évalué',
];

// ── Calculs ────────────────────────────────────────────────────

/** Moyenne pondérée normalisée sur 10 (tient compte du max_score de chaque éval) */
function calcNormalizedAvg(
  evals: Evaluation[],
  gradeOf: (id: number) => Grade | undefined,
): number | null {
  const valid = evals
    .map(e => {
      const g = gradeOf(e.id);
      if (!g || g.is_absent || g.score === null) return null;
      const max = Number(e.max_score) || 10;
      return { n: (Number(g.score) / max) * 10, w: e.weight };
    })
    .filter((x): x is { n: number; w: number } => x !== null);

  if (!valid.length) return null;
  const sumWn = valid.reduce((a, x) => a + x.n * x.w, 0);
  const sumW  = valid.reduce((a, x) => a + x.w, 0);
  return sumW > 0 ? sumWn / sumW : null;
}

function avgToColumn(avg: number | null): 1 | 2 | 3 | 4 {
  if (avg === null) return 4;
  if (avg >= 8) return 1;
  if (avg >= 6) return 2;
  if (avg >= 5) return 3;
  return 4;
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── CSS impression ─────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .print-table { display: table !important; }

  @page { margin: 12mm; size: A4 portrait; }

  body { font-size: 11pt; color: #000; background: #fff; }

  .print-area { padding: 0 !important; }
  .print-header h1 { font-size: 15pt; font-weight: 700; margin: 0 0 2mm; }
  .print-header p  { font-size: 11pt; margin: 0 0 6mm; color: #555; }

  .print-subject-title {
    font-size: 13pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    margin: 5mm 0 2mm; border-bottom: 1.5pt solid #000;
    padding-bottom: 1mm;
  }

  .print-subject-block { page-break-inside: avoid; break-inside: avoid; }

  .print-table {
    border-collapse: collapse; width: 100%; margin-bottom: 3mm;
    border: 0.5pt solid #555;
  }
  .print-table th, .print-table td {
    border: 0.5pt solid #555; padding: 1.5mm 2.5mm;
    font-size: 10pt; vertical-align: middle;
  }
  .print-table th:last-child, .print-table td:last-child {
    border-right: 0.5pt solid #555 !important;
  }
  .print-table th {
    background: #ede8e0 !important;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
    font-weight: 700; text-align: center;
  }
  .print-table th:first-child { text-align: left; }
  .print-table td.center { text-align: center; font-size: 12pt; }
  .print-ss-row td {
    background: #f5f2ed !important;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
    font-weight: 600;
  }

  .print-remark {
    margin-top: 5mm; border: 0.5pt solid #555; padding: 2.5mm 3mm;
    page-break-inside: avoid; break-inside: avoid;
  }
  .print-remark strong { display: block; font-size: 10pt; margin-bottom: 1.5mm; }
  .print-remark p { font-size: 10pt; margin: 0; white-space: pre-wrap; }

  .print-signatures {
    margin-top: 8mm; display: flex !important; gap: 6mm;
    page-break-inside: avoid; break-inside: avoid;
  }
  .print-signature-box {
    flex: 1; border: 0.5pt solid #555; padding: 2.5mm 3mm; min-height: 20mm;
  }
  .print-signature-box strong { display: block; font-size: 9pt; margin-bottom: 1mm; }
}
`;

// ── Types internes ─────────────────────────────────────────────
type ObjEntry  = { obj: Objective; col: 1 | 2 | 3 | 4 };
type SubGroup  = { ssId: number | null; ssName: string | null; avg: number | null; col: 1|2|3|4; entries: ObjEntry[] };
type SubjGroup = { subject: Subject; subGroups: SubGroup[] };

// ── Composant ──────────────────────────────────────────────────
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

  useEffect(() => { if (currentClass) loadAll(); }, [currentClass?.id]);

  useEffect(() => {
    if (!selectedStudentId || !selectedPeriodId) return;
    const r = allRemarks.find(
      r => Number(r.student_id) === selectedStudentId && Number(r.period_id) === selectedPeriodId,
    );
    setRemarkText(r?.content ?? '');
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
      setStudents(sts); setSubjects(sjs); setEvaluations(evs);
      setAllGrades(gs); setPeriods(sorted);
      setObjectives(objs); setAllRemarks(rems);
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
      setAllRemarks(prev => [
        ...prev.filter(r => !(Number(r.student_id) === selectedStudentId && Number(r.period_id) === selectedPeriodId)),
        saved,
      ]);
    } catch { /* offline */ }
    finally { setSavingRemark(false); }
  }, [currentClass, selectedStudentId, selectedPeriodId, remarkText]);

  function gradeOf(evalId: number): Grade | undefined {
    return allGrades.find(
      g => Number(g.student_id) === selectedStudentId && Number(g.evaluation_id) === Number(evalId),
    );
  }

  // Objectifs pour la période sélectionnée
  const periodObjectives = objectives.filter(o => Number(o.period_id) === selectedPeriodId);

  // Construction du bulletin
  const bulletinData: SubjGroup[] = subjects.map(subject => {
    const sObjs = periodObjectives.filter(o => Number(o.subject_id) === subject.id);
    if (!sObjs.length) return null;

    const ssIds = Array.from(new Set(sObjs.map(o => o.sub_subject_id ?? null)));

    const subGroups: SubGroup[] = ssIds.map(ssId => {
      const ssObjs = sObjs.filter(o => (o.sub_subject_id ?? null) === ssId);
      const ssName = ssId ? (subject.sub_subjects.find(ss => ss.id === ssId)?.name ?? null) : null;

      // Évals de cette sous-matière dans la période
      const ssEvals = ssId !== null
        ? evaluations.filter(e => Number(e.sub_subject_id) === ssId && Number(e.period_id) === selectedPeriodId)
        : evaluations.filter(e => Number(e.subject_id) === subject.id && !e.sub_subject_id && Number(e.period_id) === selectedPeriodId);

      // Moyenne normalisée sur 10 → colonne
      const avg = calcNormalizedAvg(ssEvals, gradeOf);
      const col = avgToColumn(avg);

      // Tous les objectifs de cette sous-matière partagent la même colonne
      const entries: ObjEntry[] = ssObjs.map(obj => ({ obj, col }));

      return { ssId, ssName, avg, col, entries };
    });

    return { subject, subGroups };
  }).filter((g): g is SubjGroup => g !== null);

  if (loading) return (
    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  );

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedPeriod  = periods.find(p => p.id === selectedPeriodId);
  const printTitle      = selectedStudent
    ? `${selectedStudent.last_name} ${selectedStudent.first_name}`
    : '';
  const printSubtitle   = [currentClass?.name, selectedPeriod?.name].filter(Boolean).join(' — ');

  return (
    <>
      <style>{PRINT_CSS}</style>

      {/* ── Sélecteurs + bouton (masqués à l'impression) ── */}
      <div className="no-print">
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
              onClick={() => window.print()}
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

      {/* ── Zone imprimable ── */}
      <div className="print-area">

        {/* En-tête impression seulement */}
        <div className="print-only print-header" style={{ display: 'none' }}>
          <h1>{printTitle}</h1>
          <p>{printSubtitle}</p>
        </div>

        {/* Pas de données */}
        {!students.length || !periods.length ? (
          <div className="no-print text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p>Ajoutez des élèves et des périodes pour générer un bulletin.</p>
          </div>
        ) : !bulletinData.length ? (
          <div className="no-print text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-base">Aucun objectif pour cette période.</p>
            <p className="text-sm mt-2">Ajoutez des objectifs aux évaluations de cette période.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {bulletinData.map(({ subject, subGroups }) => (
              <div key={subject.id} className="print-subject-block">

                {/* Titre matière — écran */}
                <h2 className="no-print text-base font-bold mb-3 uppercase tracking-wide"
                  style={{ color: 'var(--terre)' }}>
                  {subject.name}
                </h2>
                {/* Titre matière — impression */}
                <div className="print-only print-subject-title" style={{ display: 'none' }}>
                  {subject.name}
                </div>

                {/* ── Tableau ÉCRAN ── */}
                <div className="no-print rounded-2xl overflow-hidden"
                  style={{ border: '1px solid var(--border-default)' }}>
                  {/* En-tête colonnes */}
                  <div className="grid text-center"
                    style={{
                      gridTemplateColumns: '1fr repeat(4, minmax(70px, 90px))',
                      background: 'var(--creme)',
                      borderBottom: '1px solid var(--border-default)',
                    }}>
                    <div className="px-4 py-2.5 text-left text-xs font-semibold"
                      style={{ color: 'var(--terre)' }}>
                      Objectif
                    </div>
                    {COL_LABELS.map((label, i) => (
                      <div key={i} className="px-1 py-2.5 text-xs font-semibold leading-tight"
                        style={{ color: 'var(--terre)', borderLeft: '1px solid var(--border-default)' }}>
                        {label}
                      </div>
                    ))}
                  </div>

                  {subGroups.map(({ ssId, ssName, avg, col, entries }) => (
                    <div key={ssId ?? '__direct__'}>
                      {/* Ligne sous-matière */}
                      <div className="flex items-center gap-3 px-4 py-2"
                        style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border-subtle)' }}>
                        {ssName ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ocre)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{ssName}</span>
                          </>
                        ) : (
                          <span className="text-xs font-semibold italic" style={{ color: 'var(--text-muted)' }}>Général</span>
                        )}
                        {avg !== null && (
                          <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--creme)', color: 'var(--ocre)' }}>
                            Moy. {fmt(avg)}/10
                          </span>
                        )}
                      </div>

                      {/* Lignes objectifs */}
                      {entries.map(({ obj, col: c }) => (
                        <div key={obj.id} className="grid items-center"
                          style={{
                            gridTemplateColumns: '1fr repeat(4, minmax(70px, 90px))',
                            borderTop: '1px solid var(--border-subtle)',
                            background: 'var(--bg-surface)',
                          }}>
                          <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                            {obj.name}
                          </div>
                          {([1, 2, 3, 4] as const).map(n => (
                            <div key={n} className="flex items-center justify-center py-3"
                              style={{ borderLeft: '1px solid var(--border-subtle)' }}>
                              {c === n && (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                                  style={{ color: 'var(--terre)' }}>
                                  <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* ── Tableau IMPRESSION ── */}
                <table className="print-table" style={{ display: 'none' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%', textAlign: 'left' }}>Objectif</th>
                      {COL_LABELS.map((label, i) => (
                        <th key={i} style={{ width: '15%', fontSize: '9pt' }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subGroups.map(({ ssId, ssName, avg, entries }) => (
                      <>
                        <tr key={`ss-${ssId}`} className="print-ss-row">
                          <td colSpan={5}>
                            {ssName ?? 'Général'}
                            {avg !== null ? `\u2002—\u2002Moyenne : ${fmt(avg)}/10` : ''}
                          </td>
                        </tr>
                        {entries.map(({ obj, col: c }) => (
                          <tr key={obj.id}>
                            <td>{obj.name}</td>
                            {([1, 2, 3, 4] as const).map(n => (
                              <td key={n} className="center">{c === n ? '✕' : ''}</td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>

              </div>
            ))}

            {/* ── Remarque ── */}
            {/* Écran */}
            <div className="no-print rounded-2xl p-4"
              style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
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

            {/* Impression — remarque */}
            {remarkText && (
              <div className="print-only print-remark" style={{ display: 'none' }}>
                <strong>Remarque</strong>
                <p>{remarkText}</p>
              </div>
            )}

            {/* Écran — signatures */}
            <div className="no-print rounded-2xl p-4"
              style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                Signatures
              </p>
              <div className="grid grid-cols-3 gap-3">
                {['Direction', 'Enseignant(e)', 'Parents'].map(label => (
                  <div key={label} className="rounded-xl p-3" style={{ border: '1px solid var(--border-subtle)', minHeight: '64px' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Impression — signatures */}
            <div className="print-only print-signatures" style={{ display: 'none' }}>
              {['Direction', 'Enseignant(e)', 'Parents'].map(label => (
                <div key={label} className="print-signature-box">
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
