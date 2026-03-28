export interface Teacher {
  id: number;
  name: string;
  email: string;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  created_at?: string;
}

export interface Subject {
  id: number;
  name: string;
  created_at?: string;
  sub_subjects: SubSubject[];
}

export interface SubSubject {
  id: number;
  subject_id: number;
  name: string;
  created_at?: string;
}

export interface Evaluation {
  id: number;
  name: string;
  date: string;
  subject_id: number;
  sub_subject_id: number | null;
  weight: number;
  created_at?: string;
}

export interface Grade {
  id?: number;
  student_id: number;
  evaluation_id: number;
  score: number | null;
  is_absent: boolean;
  comment?: string | null;
  updated_at?: string;
}

// Clé pour la map des notes : `${student_id}_${evaluation_id}`
export type GradeMap = Record<string, Grade>;

export interface SyncQueueItem {
  id?: number;
  entity: 'students' | 'subjects' | 'sub_subjects' | 'evaluations' | 'grades';
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  attempts: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'error';
