import { db, seedFromServer } from './db';
import { studentsApi, subjectsApi, evaluationsApi, gradesApi } from './api';
import type { SyncQueueItem } from '../types';

let isSyncing = false;

export async function syncAll(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;
  try {
    // 1. Pull depuis le serveur
    const [students, subjects, evaluations, grades] = await Promise.all([
      studentsApi.list(),
      subjectsApi.list(),
      evaluationsApi.list(),
      gradesApi.list(),
    ]);
    await seedFromServer({ students, subjects, evaluations, grades });

    // 2. Push la queue en attente
    await processSyncQueue();
  } finally {
    isSyncing = false;
  }
}

export async function processSyncQueue(): Promise<void> {
  const items = await db.sync_queue.orderBy('timestamp').toArray();
  for (const item of items) {
    try {
      await processSyncItem(item);
      await db.sync_queue.delete(item.id!);
    } catch (e) {
      // Incrémenter les tentatives, abandonner après 5
      if (item.attempts >= 5) {
        await db.sync_queue.delete(item.id!);
      } else {
        await db.sync_queue.update(item.id!, { attempts: item.attempts + 1 });
      }
    }
  }
}

async function processSyncItem(item: SyncQueueItem): Promise<void> {
  const d = item.data;
  if (item.entity === 'grades' && item.action === 'update') {
    await gradesApi.save({
      student_id:    d.student_id    as number,
      evaluation_id: d.evaluation_id as number,
      score:         d.score         as number | null,
      is_absent:     d.is_absent     as boolean,
      comment:       d.comment       as string | null,
    });
  }
  // Les autres entités nécessitent une connexion pour être créées/modifiées
  // (gestion simplifiée — la queue sert principalement pour les notes)
}

export async function queueGradeSave(grade: {
  student_id: number;
  evaluation_id: number;
  score: number | null;
  is_absent: boolean;
  comment?: string | null;
}): Promise<void> {
  // Supprimer l'entrée existante pour ce couple student/eval si elle existe
  const existing = await db.sync_queue
    .where('entity').equals('grades')
    .and(item => item.data.student_id === grade.student_id && item.data.evaluation_id === grade.evaluation_id)
    .first();
  if (existing?.id) await db.sync_queue.delete(existing.id);

  await db.sync_queue.add({
    entity:    'grades',
    action:    'update',
    data:      grade as Record<string, unknown>,
    timestamp: Date.now(),
    attempts:  0,
  });
}
