import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { opportunitySchema, type OpportunityForm } from '@/schemas';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { useCreate, useList } from '@/hooks/useEntities';
import { PIPELINE_STAGES, STAGE_LABELS, STAGE_PROBABILITY } from '@/types/enums';
import type { Client, Opportunity } from '@/types';
import { toast } from 'sonner';

export function OpportunityFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreate<Opportunity>('opportunities');
  const { data: clients } = useList<Client>('clients');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OpportunityForm>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: { stage: 'new', priority: 'medium', value: 0 },
  });

  const onSubmit = async (values: OpportunityForm) => {
    await create.mutateAsync({
      ...values,
      probability: STAGE_PROBABILITY[values.stage],
      tags: [],
      order: Date.now(),
    });
    toast.success('Opportunità creata');
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuova opportunità"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Crea</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Titolo" required error={errors.title?.message}>
          <Input {...register('title')} placeholder="Es. Sito web — Nuovo cliente" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliente">
            <Select {...register('clientId')}>
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valore stimato (€)">
            <Input type="number" step="100" {...register('value')} />
          </Field>
          <Field label="Fase">
            <Select {...register('stage')}>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
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
          <Field label="Fonte" className="col-span-2">
            <Input {...register('source')} placeholder="Referral, Instagram…" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
