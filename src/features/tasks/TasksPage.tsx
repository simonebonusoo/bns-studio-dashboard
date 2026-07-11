import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { TaskBoard } from './TaskBoard';
import { TaskFormModal } from './TaskFormModal';
import { useList } from '@/hooks/useEntities';
import type { Project, Task } from '@/types';

export default function TasksPage() {
  const { data: tasks, isLoading } = useList<Task>('tasks');
  const { data: projects } = useList<Project>('projects');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [projectId, setProjectId] = useState('all');

  const filtered = useMemo(
    () => (tasks ?? []).filter((t) => projectId === 'all' || t.projectId === projectId),
    [tasks, projectId],
  );

  const close = () => {
    setOpen(false);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Task"
        description={`${filtered.length} task · vista Kanban`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo task</Button>}
      />
      <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="sm:w-64">
        <option value="all">Tutti i progetti</option>
        {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>

      {filtered.length === 0 ? (
        <EmptyState title="Nessun task" description="Crea un task per iniziare a lavorare." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo task</Button>} />
      ) : (
        <TaskBoard tasks={filtered} />
      )}

      <TaskFormModal open={open} onClose={close} />
    </div>
  );
}
