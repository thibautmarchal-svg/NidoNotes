import Dexie, { type Table } from 'dexie';
import type { Student, Subject, SubSubject, Evaluation, Grade, SyncQueueItem } from '../types';

export class NidoNotesDB extends Dexie {
  students!:    Table<Student, number>;
  subjects!:    Table<Subject, number>;
  sub_subjects!:Table<SubSubject, number>;
  evaluations!: Table<Evaluation, number>;
  grades!:      Table<Grade, [number, number]>;
  sync_queue!:  Table<SyncQueueItem, number>;

  constructor() {
    super('NidoNotes');
    this.version(2).stores({
      students:     'id, class_id, last_name',
      subjects:     'id, class_id, name',
      sub_subjects: 'id, subject_id',
      evaluations:  'id, class_id, period_id, date, subject_id',
      grades:       '[student_id+evaluation_id], student_id, evaluation_id, updated_at',
      sync_queue:   '++id, entity, action, timestamp',
    });
  }
}

export const db = new NidoNotesDB();

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

export async function getGrade(student_id: number, evaluation_id: number): Promise<Grade | undefined> {
  return db.grades.get([student_id, evaluation_id]);
}

export async function upsertGrade(grade: Grade): Promise<void> {
  await db.grades.put(grade);
}
