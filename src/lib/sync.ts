import { db } from './db';
import { gradesApi } from './api';
import type { SyncQueueItem } from '../types';

export async function processSyncQueue(): Promise<void> {
  const items = await db.sync_queue.orderBy('timestamp').toArray();
  for (const item of items) {
    try {
      await processSyncItem(item);
      await db.sync_queue.delete(item.id!);
    } catch {
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
}

export async function queueGradeSave(grade: {
  student_id: number;
  evaluation_id: number;
  score: number | null;
  is_absent: boolean;
  comment?: string | null;
}): Promise<void> {
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
