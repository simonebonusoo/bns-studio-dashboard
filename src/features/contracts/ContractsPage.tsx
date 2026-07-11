import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Archive } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/tables/DataTable';
import type { MenuItem } from '@/components/ui/ContextMenu';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { useList, useRemove, useUpdate } from '@/hooks/useEntities';
import { ContractFormModal } from './ContractFormModal';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';
import type { Contract, Client } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  single_project: 'Progetto', maintenance: 'Manutenzione', collaboration: 'Collaborazione',
  consulting: 'Consulenza', retainer: 'Retainer', software: 'Software', license: 'Licenza', custom: 'Personalizzato',
};

export default function ContractsPage() {
  const { data: contracts, isLoading } = useList<Contract>('contracts');
  const { data: clients } = useList<Client>('clients');
  const remove = useRemove('contracts');
  const update = useUpdate<Contract>('contracts');
  const can = useAuth((s) => s.can);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<Contract | null>(null);

  const clientName = (id?: string) => (clients ?? []).find((c) => c.id === id)?.displayName ?? '—';
  const canManage = can('estimates.manage');

  const closeModal = () => {
    setOpen(false); setEditing(null);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };
  const openEdit = (c: Contract) => { setEditing(c); setOpen(true); };

  const rowMenu = (c: Contract): MenuItem[] => [
    { label: 'Modifica', icon: Pencil, onClick: () => openEdit(c) },
    ...(canManage ? [
      { label: 'Archivia', icon: Archive, onClick: async () => { await update.mutateAsync({ id: c.id, patch: { status: 'archived' } }); toast.success('Contratto archiviato'); } },
      { label: 'Elimina', icon: Trash2, danger: true, separatorBefore: true, onClick: async () => { await remove.mutateAsync(c.id); toast.success('Contratto eliminato'); } },
    ] : []),
  ];

  const columns: Column<Contract>[] = [
    { key: 'number', header: 'Numero', sortValue: (c) => c.number, render: (c) => <span className="font-medium">{c.number}</span> },
    { key: 'title', header: 'Titolo', render: (c) => c.title },
    { key: 'client', header: 'Cliente', render: (c) => clientName(c.clientId) },
    { key: 'type', header: 'Tipo', render: (c) => <Badge>{TYPE_LABELS[c.type]}</Badge> },
    { key: 'value', header: 'Valore', sortValue: (c) => c.value, render: (c) => formatCurrency(c.value) },
    { key: 'end', header: 'Scadenza', render: (c) => <span className="text-fg-subtle">{formatDate(c.endDate)}</span> },
    { key: 'status', header: 'Stato', render: (c) => <StatusBadge status={c.status === 'awaiting_signature' ? 'waiting_client' : c.status} /> },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contratti"
        description={`${(contracts ?? []).length} contratti · la firma elettronica qualificata non è implementata`}
        actions={canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo contratto</Button>}
      />
      {(contracts ?? []).length === 0 ? (
        <EmptyState title="Nessun contratto" action={canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo contratto</Button>} />
      ) : (
        <DataTable data={contracts ?? []} columns={columns} onRowClick={openEdit} rowMenu={rowMenu} />
      )}

      <ContractFormModal open={open} onClose={closeModal} contract={editing} />
    </div>
  );
}
