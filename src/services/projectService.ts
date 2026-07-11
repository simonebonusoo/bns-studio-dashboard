import { db } from '@/data/db';
import { nowISO } from '@/lib/id';

/**
 * Ricalcola l'avanzamento di un progetto dalla percentuale di task completati.
 * Aggiorna anche la salute del progetto in base a scadenza e task bloccati.
 */
export async function recalcProjectProgress(projectId: string): Promise<void> {
  const tasks = (await db.tasks.where('projectId').equals(projectId).toArray()).filter(
    (t) => !t.deletedAt && t.status !== 'cancelled',
  );
  const project = await db.projects.get(projectId);
  if (!project) return;

  const progress =
    tasks.length === 0
      ? project.progress
      : Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100);

  const hasBlocked = tasks.some((t) => t.status === 'blocked');
  const overdue =
    project.dueDate && new Date(project.dueDate).getTime() < Date.now() && progress < 100;

  const health = hasBlocked ? 'blocked' : overdue ? 'at_risk' : progress === 100 ? 'on_track' : project.health;

  await db.projects.update(projectId, {
    progress,
    health,
    updatedAt: nowISO(),
    ...(progress === 100 && project.status !== 'completed'
      ? { status: 'review' as const }
      : {}),
  });
}
