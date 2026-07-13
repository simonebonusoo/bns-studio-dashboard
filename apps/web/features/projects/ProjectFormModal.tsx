import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isValid, parseISO } from 'date-fns';
import { projectSchema, type ProjectForm } from '@/schemas';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { useCreate, useUpdate, useList } from '@/hooks/useEntities';
import { useAuth } from '@/stores/auth';
import { nextProjectCode } from '@/services/documentNumbers';
import type { Client, Project, Service } from '@/types';
import { toast } from 'sonner';

export function ProjectFormModal({
  open,
  onClose,
  project,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project;
  defaults?: Partial<ProjectForm>;
}) {
  const create = useCreate<Project>('projects');
  const update = useUpdate<Project>('projects');
  const { data: clients } = useList<Client>('clients');
  const { data: services } = useList<Service>('services');
  const memberId = useAuth((s) => s.memberId);
  const editing = !!project;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: project
      ? {
          name: project.name,
          clientId: project.clientId,
          serviceId: project.serviceId,
          status: project.status,
          priority: project.priority,
          contractValue: project.contractValue,
          budget: project.budget,
          estimatedHours: project.estimatedHours,
          dueDate: dateInputValue(project.dueDate),
          websiteUrl: project.websiteUrl ?? '',
          description: project.description,
        }
      : { status: 'planned', priority: 'medium', contractValue: 0, budget: 0, estimatedHours: 0, ...defaults },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      project
        ? {
            name: project.name,
            clientId: project.clientId,
            serviceId: project.serviceId,
            status: project.status,
            priority: project.priority,
            contractValue: project.contractValue,
            budget: project.budget,
            estimatedHours: project.estimatedHours,
            dueDate: dateInputValue(project.dueDate),
            websiteUrl: project.websiteUrl ?? '',
            description: project.description,
          }
        : { status: 'planned', priority: 'medium', contractValue: 0, budget: 0, estimatedHours: 0, ...defaults },
    );
  }, [defaults, open, project, reset]);

  const onSubmit = async (values: ProjectForm) => {
    const payload = {
      ...values,
      dueDate: dateInputToIso(values.dueDate),
    };
    if (editing && project) {
      await update.mutateAsync({ id: project.id, patch: payload });
      toast.success('Progetto aggiornato');
    } else {
      await create.mutateAsync({
        ...payload,
        code: await nextProjectCode(),
        managerId: memberId ?? undefined,
        memberIds: memberId ? [memberId] : [],
        health: 'on_track',
        progress: 0,
        color: '#b0d62e',
        tags: [],
        startDate: new Date().toISOString(),
      });
      toast.success('Progetto creato');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Modifica progetto' : 'Nuovo progetto'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || create.isPending || update.isPending}>{editing ? 'Salva' : 'Crea'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome progetto" required error={errors.name?.message} className="sm:col-span-2">
          <Input {...register('name')} placeholder="Es. Sito web React — Cliente" />
        </Field>
        <Field label="Cliente">
          <Select {...register('clientId')}>
            <option value="">—</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </Select>
        </Field>
        <Field label="Servizio">
          <Select {...register('serviceId')}>
            <option value="">—</option>
            {(services ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Stato">
          <Select {...register('status')}>
            <option value="planned">Pianificato</option>
            <option value="active">Attivo</option>
            <option value="waiting_client">Attesa cliente</option>
            <option value="review">In revisione</option>
            <option value="paused">In pausa</option>
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
        <Field label="Valore contrattuale (€)" error={errors.contractValue?.message}>
          <Input type="number" step="100" {...register('contractValue')} />
        </Field>
        <Field label="Budget costi (€)" error={errors.budget?.message}>
          <Input type="number" step="100" {...register('budget')} />
        </Field>
        <Field label="Ore stimate">
          <Input type="number" {...register('estimatedHours')} />
        </Field>
        <Field label="Scadenza">
          <Input type="date" {...register('dueDate')} />
        </Field>
        <Field label="Sito web" error={errors.websiteUrl?.message} className="sm:col-span-2">
          <Input type="text" inputMode="url" {...register('websiteUrl')} placeholder="k9securityacademy.it" />
        </Field>
        <Field label="Descrizione" className="sm:col-span-2">
          <Textarea {...register('description')} />
        </Field>
      </form>
    </Modal>
  );
}

function dateInputValue(value?: string | null) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? format(date, 'yyyy-MM-dd') : value.slice(0, 10);
}

function dateInputToIso(value?: string | null) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toISOString();
}
