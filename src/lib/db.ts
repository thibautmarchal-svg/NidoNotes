import Dexie, { type Table } from 'dexie';
import type { Student, Subject, SubSubject, Evaluation, Grade, SyncQueueItem } from '../types';

export class NidoNotesDB extends Dexie {
  students!: Table<Student, number>;
  subjects!: Table<Subject, number>;
  sub_subjects!: Table<SubSubject, number>;
  evaluations!: Table<Evaluation, number>;
  grades!: Table<Grade, string>; // PK = `${student_id}_${evaluation_id}`
  sync_queue!: Table<SyncQueueItem, number>;

  constructor() {
    super('NidoNotes');
    this.version(1).stores({
      students:     'id, last_name, first_name',
      subjects:     'id, name',
      sub_subjects: 'id, subject_id',
      evaluations:  'id, date, subject_id, sub_subject_id',
      grades:       '[student_id+evaluation_id], student_id, evaluation_id, updated_at',
      sync_queue:   '++id, entity, action, timestamp',
    });
  }
}

export const db = new NidoNotesDB();

// ── Helpers ───────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  await Promise.all([
    db.students.clear(),
    db.subjects.clear(),
    db.sub_subjects.clear(),
    db.evaluations.clear(),
    db.grades.clear(),
    db.sync_queue.clear(),
  ]);
}

export async function seedFromServer(data: {
  students: Student[];
  subjects: Subject[];
  evaluations: Evaluation[];
  grades: Grade[];
}): Promise<void> {
  // Sépare les sous-matières des matières
  const subSubjects: SubSubject[] = [];
  const subjects: Omit<Subject, 'sub_subjects'>[] = data.subjects.map(s => {
    if (s.sub_subjects) {
      s.sub_subjects.forEach(ss => subSubjects.push(ss));
    }
    return { id: s.id, name: s.name, created_at: s.created_at, sub_subjects: [] };
  });

  await db.transaction('rw', [db.students, db.subjects, db.sub_subjects, db.evaluations, db.grades], async () => {
    await db.students.bulkPut(data.students);
    await db.subjects.bulkPut(subjects as Subject[]);
    await db.sub_subjects.bulkPut(subSubjects);
    await db.evaluations.bulkPut(data.evaluations);
    await db.grades.bulkPut(data.grades);
  });
}

export async function getGradeKey(student_id: number, evaluation_id: number): Promise<Grade | undefined> {
  return db.grades.get([student_id, evaluation_id]);
}

export async function upsertGrade(grade: Omit<Grade, 'id'>): Promise<void> {
  await db.grades.put({ ...grade });
}
