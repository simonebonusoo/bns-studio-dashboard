import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema, type TaskForm } from '@/schemas';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { useCreate, useList } from '@/hooks/useEntities';
import type { Member, Project, Task } from '@/types';
import { toast } from 'sonner';

export function TaskFormModal({
  open,
  onClose,
  defaultProjectId,
  defaultStatus,
}: {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultStatus?: Task['status'];
}) {
  const create = useCreate<Task>('tasks');
  const { data: projects } = useList<Project>('projects');
  const { data: members } = useList<Member>('members');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: defaultStatus ?? 'todo',
      priority: 'medium',
      projectId: defaultProjectId ?? '',
    },
  });

  const onSubmit = async (values: TaskForm) => {
    await create.mutateAsync({
      title: values.title,
      projectId: values.projectId,
      status: values.status,
      priority: values.priority,
      assigneeIds: values.assigneeId ? [values.assigneeId] : [],
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
      estimatedHours: values.estimatedHours,
      clientVisible: false,
      order: Date.now(),
      tags: [],
    });
    toast.success('Task creato');
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuovo task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Crea</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Titolo" required error={errors.title?.message}>
          <Input {...register('title')} placeholder="Es. Wireframe homepage" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Progetto" required error={errors.projectId?.message} className="col-span-2">
            <Select {...register('projectId')}>
              <option value="">— seleziona —</option>
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Assegnatario">
            <Select {...register('assigneeId')}>
              <option value="">—</option>
              {(members ?? []).filter((m) => m.role !== 'client').map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Stato">
            <Select {...register('status')}>
              <option value="backlog">Backlog</option>
              <option value="todo">Da fare</option>
              <option value="in_progress">In corso</option>
              <option value="internal_review">Revisione interna</option>
              <option value="client_review">Revisione cliente</option>
              <option value="blocked">Bloccato</option>
              <option value="completed">Completato</option>
            </Select>
          </Field>
          <Field label="Priorità">
            <Select {...register('priority')}>
              <option value="low">Bassa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </Select>
          </Field>
          <Field label="Ore stimate">
            <Input type="number" {...register('estimatedHours')} />
          </Field>
          <Field label="Scadenza" className="col-span-2">
            <Input type="date" {...register('dueDate')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
