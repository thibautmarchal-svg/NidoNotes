import { useState, useEffect, useCallback, useRef } from 'react';
import { db, upsertGrade } from '../../lib/db';
import { gradesApi, studentsApi, subjectsApi, evaluationsApi } from '../../lib/api';
import { queueGradeSave } from '../../lib/sync';
import { useToast } from '../../contexts/ToastContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import Modal from '../ui/Modal';
import type { Student, Subject, Evaluation, Grade, GradeMap } from '../../types';

function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '';
  if (score < 5) return 'score-red';
  if (score <= 7) return 'score-orange';
  return 'score-green';
}

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '';
  return score % 1 === 0 ? String(score) : score.toFixed(1);
}

function calcWeightedAvg(scores: Array<{ score: number | null; weight: number; is_absent: boolean }>): number | null {
  const valid = scores.filter(s => !s.is_absent && s.score !== null);
  if (!valid.length) return null;
  const sumWeighted = valid.reduce((acc, s) => acc + (s.score as number) * s.weight, 0);
  const sumWeights  = valid.reduce((acc, s) => acc + s.weight, 0);
  return sumWeights > 0 ? sumWeighted / sumWeights : null;
}

interface CommentModal {
  studentId: number;
  evaluationId: number;
  studentName: string;
  evalName: string;
  comment: string;
}

export default function GradesPage() {
  const toast  = useToast();
  const online = useOnlineStatus();

  const [students,    setStudents]    = useState<Student[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [gradeMap,    setGradeMap]    = useState<GradeMap>({});
  const [loading,     setLoading]     = useState(true);

  // Cellule en cours d'édition
  const [editCell, setEditCell] = useState<{ studentId: number; evalId: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Modal commentaire
  const [commentModal, setCommentModal] = useState<CommentModal | null>(null);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  // Filtre matière
  const [filterSubjectId, setFilterSubjectId] = useState<number | 'all'>('all');

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (editCell && inputRef.current) inputRef.current.focus();
  }, [editCell]);

  async function loadAll() {
    const [localStudents, localSubjects, localSubs, localEvals, localGrades] = await Promise.all([
      db.students.orderBy('last_name').toArray(),
      db.subjects.toArray(),
      db.sub_subjects.toArray(),
      db.evaluations.orderBy('date').toArray(),
      db.grades.toArray(),
    ]);
    const mergedSubjects = localSubjects.map(s => ({ ...s, sub_subjects: localSubs.filter(ss => ss.subject_id === s.id) }));
    setStudents(localStudents);
    setSubjects(mergedSubjects);
    setEvaluations(localEvals);
    setGradeMap(buildGradeMap(localGrades));
    setLoading(false);

    try {
      const [rs, rss, re, rg] = await Promise.all([
        studentsApi.list(), subjectsApi.list(), evaluationsApi.list(), gradesApi.list(),
      ]);
      setStudents(rs);
      setSubjects(rss);
      setEvaluations(re);
      setGradeMap(buildGradeMap(rg));
      await Promise.all([
        db.students.bulkPut(rs),
        db.evaluations.bulkPut(re),
        db.grades.bulkPut(rg),
      ]);
    } catch { /* offline */ }
  }

  function buildGradeMap(grades: Grade[]): GradeMap {
    const map: GradeMap = {};
    grades.forEach(g => { map[`${g.student_id}_${g.evaluation_id}`] = g; });
    return map;
  }

  function getGrade(studentId: number, evalId: number): Grade | undefined {
    return gradeMap[`${studentId}_${evalId}`];
  }

  // ── Sauvegarde d'une note ──────────────────────────────────
  const saveGrade = useCallback(async (studentId: number, evalId: number, score: number | null, isAbsent: boolean, comment?: string | null) => {
    const grade = { student_id: studentId, evaluation_id: evalId, score, is_absent: isAbsent, comment: comment ?? null };
    // Mise à jour locale immédiate
    await upsertGrade(grade);
    setGradeMap(prev => ({ ...prev, [`${studentId}_${evalId}`]: grade }));
    // Sync
    if (online) {
      try { await gradesApi.save(grade); }
      catch { await queueGradeSave(grade); }
    } else {
      await queueGradeSave(grade);
    }
  }, [online]);

  // ── Saisie inline ─────────────────────────────────────────
  function startEdit(studentId: number, evalId: number) {
    const g = getGrade(studentId, evalId);
    if (g?.is_absent) return; // Ne pas éditer une cellule ABS
    setEditCell({ studentId, evalId });
    setEditValue(g?.score !== null && g?.score !== undefined ? String(g.score) : '');
  }

  async function commitEdit() {
    if (!editCell) return;
    const raw = editValue.replace(',', '.');
    const parsed = raw === '' ? null : parseFloat(raw);
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 10)) {
      toast('Note entre 0 et 10', 'error');
      return;
    }
    const current = getGrade(editCell.studentId, editCell.evalId);
    await saveGrade(editCell.studentId, editCell.evalId, parsed, current?.is_absent ?? false, current?.comment ?? null);
    setEditCell(null);
  }

  async function toggleAbsent(studentId: number, evalId: number) {
    const current = getGrade(studentId, evalId);
    const nowAbsent = !current?.is_absent;
    await saveGrade(studentId, evalId, nowAbsent ? null : current?.score ?? null, nowAbsent, current?.comment ?? null);
  }

  // ── Commentaire ───────────────────────────────────────────
  function openComment(studentId: number, evalId: number) {
    const student = students.find(s => s.id === studentId);
    const ev      = evaluations.find(e => e.id === evalId);
    const g       = getGrade(studentId, evalId);
    setCommentModal({
      studentId, evaluationId: evalId,
      studentName: student ? `${student.last_name} ${student.first_name}` : '',
      evalName: ev?.name ?? '',
      comment: g?.comment ?? '',
    });
    setCommentText(g?.comment ?? '');
  }

  async function saveComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentModal) return;
    setSavingComment(true);
    const g = getGrade(commentModal.studentId, commentModal.evaluationId);
    await saveGrade(commentModal.studentId, commentModal.evaluationId, g?.score ?? null, g?.is_absent ?? false, commentText || null);
    setSavingComment(false);
    setCommentModal(null);
    toast('Commentaire enregistré');
  }

  // ── Calculs moyennes ──────────────────────────────────────
  function avgSubSubject(studentId: number, subSubjectId: number): number | null {
    const evals = evaluations.filter(e => e.sub_subject_id === subSubjectId);
    return calcWeightedAvg(evals.map(e => {
      const g = getGrade(studentId, e.id);
      return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
    }));
  }

  function avgSubjectDirect(studentId: number, subjectId: number): number | null {
    // Évaluations de cette matière sans sous-matière
    const evals = evaluations.filter(e => e.subject_id === subjectId && !e.sub_subject_id);
    return calcWeightedAvg(evals.map(e => {
      const g = getGrade(studentId, e.id);
      return { score: g?.score ?? null, weight: e.weight, is_absent: g?.is_absent ?? false };
    }));
  }

  function avgSubject(studentId: number, subject: Subject): number | null {
    const vals: number[] = [];
    // Sous-matières
    subject.sub_subjects.forEach(ss => {
      const avg = avgSubSubject(studentId, ss.id);
      if (avg !== null) vals.push(avg);
    });
    // Évaluations directes (sans sous-matière)
    const direct = avgSubjectDirect(studentId, subject.id);
    if (direct !== null) vals.push(direct);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function avgGeneral(studentId: number): number | null {
    const vals = subjects.map(s => avgSubject(studentId, s)).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // ── Organisation des colonnes ─────────────────────────────
  const visibleSubjects = filterSubjectId === 'all' ? subjects : subjects.filter(s => s.id === filterSubjectId);

  // Colonnes triées par date dans chaque groupe
  function evalsForSubSubject(subSubjectId: number) {
    return evaluations.filter(e => e.sub_subject_id === subSubjectId).sort((a, b) => a.date.localeCompare(b.date));
  }
  function evalsDirectForSubject(subjectId: number) {
    return evaluations.filter(e => e.subject_id === subjectId && !e.sub_subject_id).sort((a, b) => a.date.localeCompare(b.date));
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Chargement…</div>;
  if (!students.length) return <div className="text-center py-12 text-slate-400">Aucun élève — ajoutez des élèves d'abord</div>;
  if (!evaluations.length) return <div className="text-center py-12 text-slate-400">Aucune évaluation — créez des évaluations d'abord</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notes</h1>
        <div className="flex items-center gap-3">
          {!online && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
              Mode hors ligne — notes sauvegardées localement
            </span>
          )}
          <select
            value={filterSubjectId}
            onChange={e => setFilterSubjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Toutes les matières</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <table className="grades-table text-sm min-w-full bg-white dark:bg-slate-800">
          <thead>
            {/* Ligne 1 : groupes matières */}
            <tr className="bg-slate-100 dark:bg-slate-900">
              <th className="sticky-col px-4 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider min-w-[130px]" rowSpan={3}>
                Élève
              </th>
              {visibleSubjects.map(subject => {
                const subs = subject.sub_subjects;
                const directEvals = evalsDirectForSubject(subject.id);
                let totalCols = directEvals.length + 1; // +1 for subject avg
                subs.forEach(ss => { totalCols += evalsForSubSubject(ss.id).length + 1; }); // +1 for sub-subject avg each
                return (
                  <th key={subject.id} colSpan={totalCols} className="px-3 py-2 text-center text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border-l-2 border-primary-200 dark:border-primary-700 uppercase tracking-wider">
                    {subject.name}
                  </th>
                );
              })}
              <th className="px-3 py-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase bg-slate-200 dark:bg-slate-700">Moy. Gén.</th>
            </tr>

            {/* Ligne 2 : sous-matières */}
            <tr className="bg-slate-50 dark:bg-slate-800">
              {visibleSubjects.map(subject => {
                const subs = subject.sub_subjects;
                const directEvals = evalsDirectForSubject(subject.id);
                return (
                  <>
                    {subs.map(ss => {
                      const evs = evalsForSubSubject(ss.id);
                      return (
                        <th key={ss.id} colSpan={evs.length + 1} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700">
                          {ss.name}
                        </th>
                      );
                    })}
                    {directEvals.length > 0 && (
                      <th colSpan={directEvals.length} className="px-3 py-1.5 text-center text-xs text-slate-400 border-l border-slate-200 dark:border-slate-700">
                        Évals directes
                      </th>
                    )}
                    <th className="px-3 py-1.5 text-center text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20">
                      Moy.
                    </th>
                  </>
                );
              })}
              <th className="bg-slate-100 dark:bg-slate-700" />
            </tr>

            {/* Ligne 3 : noms des évaluations */}
            <tr className="bg-white dark:bg-slate-800">
              {visibleSubjects.map(subject => {
                const subs = subject.sub_subjects;
                const directEvals = evalsDirectForSubject(subject.id);
                return (
                  <>
                    {subs.map(ss => (
                      <>
                        {evalsForSubSubject(ss.id).map(ev => (
                          <th key={ev.id} className="px-2 py-2 text-center text-xs text-slate-600 dark:text-slate-400 font-normal min-w-[72px] max-w-[90px] border-l border-slate-100 dark:border-slate-700">
                            <div className="truncate" title={ev.name}>{ev.name}</div>
                            <div className="text-slate-400 mt-0.5">×{ev.weight}</div>
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[56px] bg-slate-50 dark:bg-slate-900/30">Moy.</th>
                      </>
                    ))}
                    {directEvals.map(ev => (
                      <th key={ev.id} className="px-2 py-2 text-center text-xs text-slate-600 dark:text-slate-400 font-normal min-w-[72px] max-w-[90px] border-l border-slate-100 dark:border-slate-700">
                        <div className="truncate" title={ev.name}>{ev.name}</div>
                        <div className="text-slate-400 mt-0.5">×{ev.weight}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-bold text-primary-600 dark:text-primary-400 min-w-[56px] bg-primary-50/50 dark:bg-primary-900/20">
                      Moy. {subject.name}
                    </th>
                  </>
                );
              })}
              <th className="px-2 py-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300 min-w-[56px] bg-slate-100 dark:bg-slate-700">Général</th>
            </tr>
          </thead>

          <tbody>
            {students.map((student, si) => {
              const genAvg = avgGeneral(student.id);
              return (
                <tr key={student.id} className={`${si % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'} hover:bg-blue-50/30 dark:hover:bg-primary-900/10 transition-colors`}>
                  {/* Nom élève */}
                  <td className="sticky-col px-4 py-2.5 font-medium text-slate-900 dark:text-white text-sm whitespace-nowrap border-r border-slate-200 dark:border-slate-700">
                    {student.last_name} {student.first_name}
                  </td>

                  {/* Cellules notes */}
                  {visibleSubjects.map(subject => {
                    const subs = subject.sub_subjects;
                    const directEvals = evalsDirectForSubject(subject.id);
                    const subjAvg = avgSubject(student.id, subject);
                    return (
                      <>
                        {subs.map(ss => {
                          const ssAvg = avgSubSubject(student.id, ss.id);
                          return (
                            <>
                              {evalsForSubSubject(ss.id).map(ev => (
                                <GradeCell
                                  key={ev.id}
                                  grade={getGrade(student.id, ev.id)}
                                  isEditing={editCell?.studentId === student.id && editCell?.evalId === ev.id}
                                  editValue={editValue}
                                  inputRef={inputRef}
                                  onStartEdit={() => startEdit(student.id, ev.id)}
                                  onEditChange={setEditValue}
                                  onCommit={commitEdit}
                                  onCancelEdit={() => setEditCell(null)}
                                  onToggleAbsent={() => toggleAbsent(student.id, ev.id)}
                                  onOpenComment={() => openComment(student.id, ev.id)}
                                />
                              ))}
                              {/* Moy sous-matière */}
                              <td className="px-2 py-2 text-center bg-slate-50 dark:bg-slate-900/30 text-xs font-semibold">
                                {ssAvg !== null ? <span className={scoreColor(ssAvg)}>{formatScore(ssAvg)}</span> : <span className="text-slate-300">—</span>}
                              </td>
                            </>
                          );
                        })}
                        {directEvals.map(ev => (
                          <GradeCell
                            key={ev.id}
                            grade={getGrade(student.id, ev.id)}
                            isEditing={editCell?.studentId === student.id && editCell?.evalId === ev.id}
                            editValue={editValue}
                            inputRef={inputRef}
                            onStartEdit={() => startEdit(student.id, ev.id)}
                            onEditChange={setEditValue}
                            onCommit={commitEdit}
                            onCancelEdit={() => setEditCell(null)}
                            onToggleAbsent={() => toggleAbsent(student.id, ev.id)}
                            onOpenComment={() => openComment(student.id, ev.id)}
                          />
                        ))}
                        {/* Moy matière */}
                        <td className="px-2 py-2 text-center bg-primary-50/50 dark:bg-primary-900/20 text-xs font-bold">
                          {subjAvg !== null ? <span className={scoreColor(subjAvg)}>{formatScore(subjAvg)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                      </>
                    );
                  })}

                  {/* Moy générale */}
                  <td className="px-2 py-2 text-center bg-slate-100 dark:bg-slate-700 text-sm font-bold">
                    {genAvg !== null ? <span className={scoreColor(genAvg)}>{formatScore(genAvg)}</span> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Légende couleurs */}
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 justify-end">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> &lt; 5</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400" /> 5–7</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> &gt; 7</span>
      </div>

      {/* Modal commentaire */}
      <Modal open={!!commentModal} onClose={() => setCommentModal(null)} title="Commentaire" size="sm">
        {commentModal && (
          <form onSubmit={saveComment} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <strong>{commentModal.studentName}</strong> — {commentModal.evalName}
            </p>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Observations sur cet élève pour cette évaluation…"
              autoFocus
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setCommentModal(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition">Annuler</button>
              <button type="submit" disabled={savingComment} className="flex-1 px-4 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-medium transition disabled:opacity-50">Enregistrer</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ── Cellule de note ───────────────────────────────────────────
interface GradeCellProps {
  grade: Grade | undefined;
  isEditing: boolean;
  editValue: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommit: () => void;
  onCancelEdit: () => void;
  onToggleAbsent: () => void;
  onOpenComment: () => void;
}

function GradeCell({ grade, isEditing, editValue, inputRef, onStartEdit, onEditChange, onCommit, onCancelEdit, onToggleAbsent, onOpenComment }: GradeCellProps) {
  const isAbsent = grade?.is_absent ?? false;
  const hasComment = !!(grade?.comment);

  return (
    <td
      className={`relative px-1 py-1 text-center min-w-[68px] border-l border-slate-100 dark:border-slate-700 ${isAbsent ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min="0" max="10" step="0.5"
          inputMode="decimal"
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommit();
            if (e.key === 'Escape') onCancelEdit();
          }}
          className="w-14 text-center py-1 px-1 rounded-lg border-2 border-primary-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none"
        />
      ) : (
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            {isAbsent ? (
              <button
                onClick={onToggleAbsent}
                className="text-xs font-semibold text-slate-400 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                title="Cliquer pour annuler l'absence"
              >
                ABS
              </button>
            ) : (
              <button
                onClick={onStartEdit}
                className={`text-sm font-semibold px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition min-w-[36px] ${scoreColor(grade?.score)}`}
                title="Cliquer pour modifier"
              >
                {grade?.score !== null && grade?.score !== undefined ? formatScore(grade.score) : <span className="text-slate-300 font-normal text-xs">—</span>}
              </button>
            )}
            {!isAbsent && (
              <button
                onClick={onToggleAbsent}
                className="text-slate-300 hover:text-slate-500 transition text-xs px-1"
                title="Marquer absent"
              >
                A
              </button>
            )}
          </div>
          <button
            onClick={onOpenComment}
            className={`text-xs transition ${hasComment ? 'text-primary-500 hover:text-primary-700' : 'text-slate-200 hover:text-slate-400'}`}
            title={hasComment ? 'Voir/modifier le commentaire' : 'Ajouter un commentaire'}
          >
            <svg className="w-3.5 h-3.5" fill={hasComment ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      )}
    </td>
  );
}
