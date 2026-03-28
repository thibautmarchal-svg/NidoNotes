import type { Student, Subject, SubSubject, Evaluation, Grade, Teacher } from '../types';

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

// ── Auth ──────────────────────────────────────────────────────
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

// ── Students ──────────────────────────────────────────────────
export const studentsApi = {
  list: () => request<Student[]>('/students.php'),
  create: (data: Pick<Student, 'first_name' | 'last_name'>) =>
    request<Student>('/students.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Pick<Student, 'first_name' | 'last_name'>) =>
    request<Student>(`/students.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ ok: boolean }>(`/students.php?id=${id}`, { method: 'DELETE' }),
};

// ── Subjects ──────────────────────────────────────────────────
export const subjectsApi = {
  list: () => request<Subject[]>('/subjects.php'),
  create: (name: string) =>
    request<Subject>('/subjects.php', { method: 'POST', body: JSON.stringify({ name }) }),
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

// ── Evaluations ───────────────────────────────────────────────
export const evaluationsApi = {
  list: () => request<Evaluation[]>('/evaluations.php'),
  create: (data: Omit<Evaluation, 'id' | 'created_at'>) =>
    request<Evaluation>('/evaluations.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Omit<Evaluation, 'id' | 'created_at'>) =>
    request<Evaluation>(`/evaluations.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ ok: boolean }>(`/evaluations.php?id=${id}`, { method: 'DELETE' }),
};

// ── Grades ────────────────────────────────────────────────────
export const gradesApi = {
  list: (since?: string) => request<Grade[]>(`/grades.php${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  save: (grade: Omit<Grade, 'id' | 'updated_at'>) =>
    request<Grade>('/grades.php', { method: 'POST', body: JSON.stringify(grade) }),
  bulkSave: (grades: Array<Omit<Grade, 'id' | 'updated_at'>>) =>
    request<{ saved: number }>('/grades.php', { method: 'PUT', body: JSON.stringify(grades) }),
};
