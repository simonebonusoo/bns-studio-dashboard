import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, type ClientForm } from '@/schemas';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { useCreate, useUpdate } from '@/hooks/useEntities';
import type { Client } from '@/types';
import { toast } from 'sonner';

function formValues(client: Client): ClientForm {
  return {
    type: client.type,
    displayName: client.displayName,
    companyName: client.companyName ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    website: client.website ?? '',
    vat: client.vat ?? '',
    city: client.city ?? '',
    sector: client.sector ?? '',
    source: client.source ?? '',
    status: client.status,
    priority: client.priority,
    notes: client.notes ?? '',
  };
}

export function ClientFormModal({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client;
}) {
  const create = useCreate<Client>('clients');
  const update = useUpdate<Client>('clients');
  const editing = !!client;
  const formId = 'client-form-modal';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? formValues(client) : { type: 'company', status: 'lead', priority: 'medium' },
  });

  useEffect(() => {
    if (!open) return;
    reset(client ? formValues(client) : { type: 'company', status: 'lead', priority: 'medium' });
  }, [client, open, reset]);

  const onSubmit = async (values: ClientForm) => {
    try {
      if (editing && client) {
        await update.mutateAsync({ id: client.id, patch: { ...values, tags: client.tags } });
        toast.success('Cliente aggiornato');
      } else {
        await create.mutateAsync({ ...values, tags: [] });
        toast.success('Cliente creato');
      }
      onClose();
    } catch (error) {
      console.error('[BnsStudio] Salvataggio cliente fallito', error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Modifica cliente' : 'Nuovo cliente'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" form={formId} loading={isSubmitting || create.isPending || update.isPending}>
            {editing ? 'Salva' : 'Crea cliente'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select {...register('type')}>
            <option value="company">Azienda</option>
            <option value="person">Persona</option>
          </Select>
        </Field>
        <Field label="Nome visualizzato" required error={errors.displayName?.message}>
          <Input {...register('displayName')} placeholder="Es. K9 Security Academy" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input {...register('email')} type="email" />
        </Field>
        <Field label="Telefono">
          <Input {...register('phone')} />
        </Field>
        <Field label="P. IVA">
          <Input {...register('vat')} />
        </Field>
        <Field label="Città">
          <Input {...register('city')} />
        </Field>
        <Field label="Settore">
          <Input {...register('sector')} />
        </Field>
        <Field label="Fonte">
          <Input {...register('source')} placeholder="Referral, Instagram…" />
        </Field>
        <Field label="Stato">
          <Select {...register('status')}>
            <option value="lead">Lead</option>
            <option value="prospect">Prospect</option>
            <option value="active">Attivo</option>
            <option value="inactive">Inattivo</option>
            <option value="past_client">Ex cliente</option>
            <option value="partner">Partner</option>
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
        <Field label="Note" className="sm:col-span-2">
          <Textarea {...register('notes')} />
        </Field>
      </form>
    </Modal>
  );
}
