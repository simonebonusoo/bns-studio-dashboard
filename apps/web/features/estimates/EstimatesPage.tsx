import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { useList, useRemove } from '@/hooks/useEntities';
import { documentTotals } from '@/lib/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { getEstimateDeleteSafety, hasBlockingDependencies } from '@/services/deleteSafety';
import { exportToCSV } from '@/utils/csv';
import { EstimateFormModal } from './EstimateFormModal';
import { CreateMethodDialog } from '@/features/import/CreateMethodDialog';
import { ContextualMarkdownImportDialog } from '@/features/import/ContextualMarkdownImportDialog';
import type { ResolvedImport } from '@/features/import/contextualImport';
import { useAuth } from '@/stores/auth';
import type { Estimate, Client, Contract, Invoice } from '@/types';
import { toast } from 'sonner';

export default function EstimatesPage() {
  const { data: estimates, isLoading } = useList<Estimate>('estimates');
  const { data: clients } = useList<Client>('clients');
  const { data: contracts } = useList<Contract>('contracts');
  const { data: invoices } = useList<Invoice>('invoices');
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const remove = useRemove('estimates');
  const [params, setParams] = useSearchParams();
  const [chooserOpen, setChooserOpen] = useState(params.get('new') === '1');
  const [open, setOpen] = useState(false);
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [defaults, setDefaults] = useState<Record<string, unknown> | undefined>();
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Estimate | null>(null);
  const list = estimates ?? [];

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setDefaults(undefined);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };
  const openChooser = () => setChooserOpen(true);
  const closeChooser = () => {
    setChooserOpen(false);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };
  const openManual = () => {
    setDefaults(undefined);
    setChooserOpen(false);
    setOpen(true);
  };
  const importMarkdown = (result: ResolvedImport) => {
    setDefaults(result.defaults);
    setOpen(true);
  };

  const clientName = (id?: string) => (clients ?? []).find((c) => c.id === id)?.displayName ?? '—';
  const total = (e: Estimate) => documentTotals(e.items, { globalDiscountPct: e.globalDiscountPct }).total;
  const deleteSafety = useMemo(
    () => (deleteTarget ? getEstimateDeleteSafety(deleteTarget, contracts ?? [], invoices ?? []) : null),
    [contracts, deleteTarget, invoices],
  );
  const blockedDelete = deleteSafety ? hasBlockingDependencies(deleteSafety) : false;

  const openValue = list.filter((e) => ['sent', 'viewed', 'draft'].includes(e.status)).reduce((s, e) => s + total(e), 0);
  const acceptedValue = list.filter((e) => e.status === 'accepted').reduce((s, e) => s + total(e), 0);
  const acceptedCount = list.filter((e) => e.status === 'accepted').length;
  const decided = list.filter((e) => ['accepted', 'rejected'].includes(e.status)).length;
  const conversion = decided ? Math.round((acceptedCount / decided) * 100) : 0;

  const columns: Column<Estimate>[] = [
    { key: 'number', header: 'Numero', sortValue: (e) => e.number, render: (e) => <span className="font-medium">{e.number}</span> },
    { key: 'client', header: 'Cliente', render: (e) => clientName(e.clientId) },
    { key: 'issue', header: 'Emissione', sortValue: (e) => e.issueDate, render: (e) => <span className="text-fg-subtle">{formatDate(e.issueDate)}</span> },
    { key: 'total', header: 'Totale', sortValue: (e) => total(e), render: (e) => formatCurrency(total(e)) },
    { key: 'status', header: 'Stato', render: (e) => <StatusBadge status={e.status} />, sortValue: (e) => e.status },
    {
      key: 'actions',
      header: 'Azioni',
      className: 'w-16 text-right',
      render: (estimate) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <ActionMenu
            items={[
              { label: 'Apri dettaglio', icon: ExternalLink, onClick: () => navigate(`/estimates/${estimate.id}`) },
              ...(can('estimates.manage')
                ? [
                    {
                      label: 'Modifica',
                      icon: Pencil,
                      onClick: () => {
                        setEditing(estimate);
                        setDefaults(undefined);
                        setOpen(true);
                      },
                    },
                    {
                      label: 'Elimina',
                      icon: Trash2,
                      danger: true,
                      separatorBefore: true,
                      onClick: () => setDeleteTarget(estimate),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  const confirmDelete = async () => {
    if (!deleteTarget || blockedDelete) return;
    await remove.mutateAsync(deleteTarget.id);
    toast.success('Preventivo eliminato');
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Preventivi"
        description={`${list.length} preventivi`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportToCSV('preventivi', list.map((e) => ({ numero: e.number, cliente: clientName(e.clientId), totale: total(e), stato: e.status })))}><Download className="h-4 w-4" /> CSV</Button>
            <Button onClick={openChooser}><Plus className="h-4 w-4" /> Nuovo preventivo</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Valore aperto" value={formatCurrency(openValue)} />
        <MetricCard label="Accettati" value={formatCurrency(acceptedValue)} hint={`${acceptedCount} preventivi`} />
        <MetricCard label="Conversione" value={`${conversion}%`} />
        <MetricCard label="Totale" value={list.length} />
      </div>
      <DataTable data={list} columns={columns} onRowClick={(e) => navigate(`/estimates/${e.id}`)} />
      <CreateMethodDialog
        open={chooserOpen}
        onClose={closeChooser}
        entityLabel="preventivo"
        title="Nuovo preventivo"
        description="Come vuoi creare questo preventivo?"
        onManual={openManual}
        onMarkdown={() => {
          setChooserOpen(false);
          setMarkdownOpen(true);
        }}
      />
      <ContextualMarkdownImportDialog open={markdownOpen} onClose={() => setMarkdownOpen(false)} entityType="estimate" onContinue={importMarkdown} />
      <EstimateFormModal open={open} onClose={closeModal} estimate={editing ?? undefined} defaults={defaults} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={blockedDelete ? () => {} : confirmDelete}
        title={blockedDelete ? 'Eliminazione non disponibile' : `Eliminare ${deleteTarget?.number ?? 'preventivo'}?`}
        message={
          blockedDelete && deleteSafety ? (
            <div className="space-y-2">
              <p>Questo preventivo è ancora collegato a:</p>
              <ul className="list-disc space-y-1 pl-5">
                {deleteSafety.dependencies.map((item) => (
                  <li key={item.label}>
                    {item.count} {item.label}
                    {item.count > 1 ? 'i' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            'Questa azione rimuoverà il preventivo dal gestionale.'
          )
        }
        confirmLabel={blockedDelete ? 'Chiudi' : 'Elimina'}
        danger={!blockedDelete}
      />
    </div>
  );
}
