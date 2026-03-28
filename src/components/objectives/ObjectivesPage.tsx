import { useState, useEffect } from 'react';
import { objectivesApi, subjectsApi } from '../../lib/api';
import { useClass } from '../../contexts/ClassContext';
import type { Objective, Subject } from '../../types';

export default function ObjectivesPage() {
  const { currentClass } = useClass();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [subjects,   setSubjects]   = useState<Subject[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (currentClass) loadAll();
  }, [currentClass?.id]);

  async function loadAll() {
    if (!currentClass) return;
    setLoading(true);
    try {
      const [objs, sjs] = await Promise.all([
        objectivesApi.listForClass(currentClass.id),
        subjectsApi.list(currentClass.id),
      ]);
      setObjectives(objs);
      setSubjects(sjs);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }

  function subjectById(id: number | undefined): Subject | undefined {
    return subjects.find(s => s.id === id);
  }
  function subSubjectName(subjectId: number | undefined, ssId: number | null | undefined): string | null {
    if (!ssId || !subjectId) return null;
    const s = subjectById(subjectId);
    return s?.sub_subjects.find(ss => ss.id === ssId)?.name ?? null;
  }

  // Group: subject → sub_subject (null = direct)
  type Group = {
    subject: Subject;
    subGroups: { subSubjectName: string | null; objectives: Objective[] }[];
  };

  const groups: Group[] = subjects.map(subject => {
    const subjectObjs = objectives.filter(o => o.subject_id === subject.id);
    if (!subjectObjs.length) return null;

    // Gather unique sub_subject_ids
    const ssIds = Array.from(new Set(subjectObjs.map(o => o.sub_subject_id ?? null)));
    const subGroups = ssIds.map(ssId => ({
      subSubjectName: subSubjectName(subject.id, ssId),
      objectives: subjectObjs.filter(o => (o.sub_subject_id ?? null) === ssId),
    }));

    return { subject, subGroups };
  }).filter((g): g is Group => g !== null);

  if (loading) return (
    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--terre)' }}>Objectifs</h1>
        {currentClass && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{currentClass.name}</p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p className="text-lg">Aucun objectif</p>
          <p className="text-sm mt-2">Ajoutez des objectifs lors de la création d'une évaluation.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ subject, subGroups }) => (
            <div key={subject.id}>
              {/* En-tête matière */}
              <div className="flex items-center gap-3 mb-2">
                <div className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ background: 'var(--creme)', color: 'var(--terre)' }}>
                  {subject.name}
                </div>
                <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              </div>

              <div className="space-y-3">
                {subGroups.map(({ subSubjectName: ssName, objectives: objs }) => (
                  <div key={ssName ?? '__direct__'} className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                    {ssName && (
                      <div className="flex items-center gap-2 px-4 py-2"
                        style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ocre)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{ssName}</span>
                      </div>
                    )}
                    <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                      {objs.map(obj => (
                        <li key={obj.id} className="flex items-start gap-3 px-4 py-3">
                          <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                            style={{ background: 'var(--ocre)' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{obj.name}</div>
                            {obj.eval_name && (
                              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {obj.eval_name}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
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
