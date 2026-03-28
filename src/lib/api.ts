import type { Teacher, Class, Period, Student, Subject, SubSubject, Evaluation, Grade, Objective } from '../types';

const BASE = '/NidoNotes/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(body.error ?? `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  me: () => request<Teacher>('/auth.php?action=me'),
  login: (email: string, password: string) =>
    request<Teacher>('/auth.php?action=login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    request<Teacher>('/auth.php?action=register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  logout: () => request<{ ok: boolean }>('/auth.php?action=logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>('/auth.php?action=forgot_password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>('/auth.php?action=reset_password', { method: 'POST', body: JSON.stringify({ token, password }) }),
};

export const classesApi = {
  list: () => request<Class[]>('/classes.php'),
  create: (name: string, school_year?: string) =>
    request<Class>('/classes.php', { method: 'POST', body: JSON.stringify({ name, school_year }) }),
  update: (id: number, name: string, school_year?: string) =>
    request<Class>(`/classes.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ name, school_year }) }),
  delete: (id: number) => request<{ ok: boolean }>(`/classes.php?id=${id}`, { method: 'DELETE' }),
};

export const periodsApi = {
  list: (class_id: number) => request<Period[]>(`/periods.php?class_id=${class_id}`),
  create: (class_id: number, name: string) =>
    request<Period>('/periods.php', { method: 'POST', body: JSON.stringify({ class_id, name }) }),
  update: (id: number, name: string) =>
    request<Period>(`/periods.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id: number) => request<{ ok: boolean }>(`/periods.php?id=${id}`, { method: 'DELETE' }),
};

export const studentsApi = {
  list: (class_id: number) => request<Student[]>(`/students.php?class_id=${class_id}`),
  create: (class_id: number, first_name: string, last_name: string) =>
    request<Student>('/students.php', { method: 'POST', body: JSON.stringify({ class_id, first_name, last_name }) }),
  update: (id: number, first_name: string, last_name: string) =>
    request<Student>(`/students.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ first_name, last_name }) }),
  delete: (id: number) => request<{ ok: boolean }>(`/students.php?id=${id}`, { method: 'DELETE' }),
};

export const subjectsApi = {
  list: (class_id: number) => request<Subject[]>(`/subjects.php?class_id=${class_id}`),
  create: (class_id: number, name: string) =>
    request<Subject>('/subjects.php', { method: 'POST', body: JSON.stringify({ class_id, name }) }),
  update: (id: number, name: string) =>
    request<Subject>(`/subjects.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id: number) => request<{ ok: boolean }>(`/subjects.php?id=${id}`, { method: 'DELETE' }),
  createSub: (subject_id: number, name: string) =>
    request<SubSubject>('/subjects.php?action=sub_subject', { method: 'POST', body: JSON.stringify({ subject_id, name }) }),
  updateSub: (id: number, name: string) =>
    request<SubSubject>(`/subjects.php?action=sub_subject&id=${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteSub: (id: number) =>
    request<{ ok: boolean }>(`/subjects.php?action=sub_subject&id=${id}`, { method: 'DELETE' }),
};

export const evaluationsApi = {
  list: (class_id: number) => request<Evaluation[]>(`/evaluations.php?class_id=${class_id}`),
  create: (data: Omit<Evaluation, 'id' | 'created_at'>) =>
    request<Evaluation>('/evaluations.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Omit<Evaluation, 'id' | 'class_id' | 'created_at'>) =>
    request<Evaluation>(`/evaluations.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ ok: boolean }>(`/evaluations.php?id=${id}`, { method: 'DELETE' }),
};

export const objectivesApi = {
  listForEval: (evaluation_id: number) => request<Objective[]>(`/objectives.php?evaluation_id=${evaluation_id}`),
  listForClass: (class_id: number) => request<Objective[]>(`/objectives.php?class_id=${class_id}`),
  create: (evaluation_id: number, name: string) =>
    request<Objective>('/objectives.php', { method: 'POST', body: JSON.stringify({ evaluation_id, name }) }),
  deleteAllForEval: (evaluation_id: number) =>
    request<{ ok: boolean }>(`/objectives.php?evaluation_id=${evaluation_id}`, { method: 'DELETE' }),
  delete: (id: number) => request<{ ok: boolean }>(`/objectives.php?id=${id}`, { method: 'DELETE' }),
};

export const gradesApi = {
  list: (class_id: number) => request<Grade[]>(`/grades.php?class_id=${class_id}`),
  save: (grade: Grade) =>
    request<Grade>('/grades.php', { method: 'POST', body: JSON.stringify(grade) }),
};
