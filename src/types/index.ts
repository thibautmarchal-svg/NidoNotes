export interface Teacher {
  id: number;
  name: string;
  email: string;
}

export interface Class {
  id: number;
  name: string;
  school_year: string | null;
  created_at?: string;
}

export interface Period {
  id: number;
  class_id: number;
  name: string;
  order_num: number;
  created_at?: string;
}

export interface Student {
  id: number;
  class_id: number;
  first_name: string;
  last_name: string;
  created_at?: string;
}

export interface Subject {
  id: number;
  class_id: number;
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
  class_id: number;
  period_id: number;
  name: string;
  date: string;
  subject_id: number;
  sub_subject_id: number | null;
  weight: number;
  created_at?: string;
}

export interface Grade {
  student_id: number;
  evaluation_id: number;
  score: number | null;
  is_absent: boolean;
  comment?: string | null;
  updated_at?: string;
}

export type GradeMap = Record<string, Grade>;

export interface SyncQueueItem {
  id?: number;
  entity: string;
  action: string;
  data: Record<string, unknown>;
  timestamp: number;
  attempts: number;
}
