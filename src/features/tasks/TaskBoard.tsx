import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Card } from '@/components/ui/Card';
import { StatusBadge, statusLabel } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useUpdate, useList } from '@/hooks/useEntities';
import { recalcProjectProgress } from '@/services/projectService';
import { TASK_COLUMNS } from '@/types/enums';
import type { Task, TaskStatus, Member } from '@/types';
import { formatDate } from '@/lib/format';
import { ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { TaskDetailDrawer } from './TaskDetailDrawer';

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const update = useUpdate<Task>('tasks');
  const { data: members } = useList<Member>('members');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // I sottotask non compaiono come card di primo livello nel board
  const topTasks = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks]);

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    TASK_COLUMNS.forEach((s) => map.set(s, []));
    topTasks.forEach((t) => {
      if (!map.has(t.status)) map.set(t.status, []);
      map.get(t.status)!.push(t);
    });
    map.forEach((l) => l.sort((a, b) => a.order - b.order));
    return map;
  }, [topTasks]);

  const active = tasks.find((t) => t.id === activeId) ?? null;
  const memberName = (id?: string) => {
    const m = (members ?? []).find((x) => x.id === id);
    return m ? `${m.firstName} ${m.lastName}` : '';
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const taskId = e.active.id as string;
    const newStatus = e.over?.id as TaskStatus | undefined;
    if (!newStatus) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    await update.mutateAsync({
      id: taskId,
      patch: { status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : null },
    });
    if (task.projectId) await recalcProjectProgress(task.projectId);
    toast.success(`Task → ${statusLabel(newStatus)}`);
  };

  return (
    <>
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {TASK_COLUMNS.map((status) => {
            const items = byStatus.get(status) ?? [];
            return (
              <Col key={status} status={status} count={items.length}>
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} assignee={memberName(t.assigneeIds[0])} color={memberColor(members, t.assigneeIds[0])} onOpen={() => setOpenId(t.id)} />
                ))}
              </Col>
            );
          })}
        </div>
        <DragOverlay>{active && <TaskCardView task={active} dragging />}</DragOverlay>
      </DndContext>

      <TaskDetailDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function memberColor(members: Member[] | undefined, id?: string): string {
  return (members ?? []).find((m) => m.id === id)?.avatarColor ?? '#71717a';
}

function Col({ status, count, children }: { status: TaskStatus; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-sm font-semibold">{statusLabel(status)}</span>
        <span className="rounded-full bg-surface-2 px-1.5 text-xs text-fg-subtle">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-card border border-dashed p-2 transition-colors ${
          isOver ? 'border-accent bg-accent/5' : 'border-border bg-surface-2/50'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function TaskCard({ task, assignee, color, onOpen }: { task: Task; assignee: string; color: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={`cursor-pointer active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <TaskCardView task={task} assignee={assignee} color={color} />
    </div>
  );
}

function TaskCardView({ task, assignee, color, dragging }: { task: Task; assignee?: string; color?: string; dragging?: boolean }) {
  const checks = task.checklist ?? [];
  const done = checks.filter((c) => c.done).length;
  return (
    <Card className={`p-3 transition-shadow hover:border-border-strong ${dragging ? 'shadow-pop rotate-2' : ''}`}>
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <StatusBadge status={task.priority} />
        {assignee && <Avatar name={assignee} size="xs" color={color} />}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-2xs text-fg-faint">
        {task.dueDate && <span>Scad. {formatDate(task.dueDate)}</span>}
        {checks.length > 0 && (
          <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{done}/{checks.length}</span>
        )}
      </div>
    </Card>
  );
}
