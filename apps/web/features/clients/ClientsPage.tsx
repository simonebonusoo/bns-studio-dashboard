import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, ExternalLink, Pencil, Archive } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/tables/DataTable';
import type { MenuItem } from '@/components/ui/ContextMenu';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ClientFormModal } from './ClientFormModal';
import { CreateMethodDialog } from '@/features/import/CreateMethodDialog';
import { ContextualMarkdownImportDialog } from '@/features/import/ContextualMarkdownImportDialog';
import type { ResolvedImport } from '@/features/import/contextualImport';
import { useList, useRemove } from '@/hooks/useEntities';
import { useAuth } from '@/stores/auth';
import { exportToCSV } from '@/utils/csv';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { Client } from '@/types';

export default function ClientsPage() {
  const { data: clients, isLoading } = useList<Client>('clients');
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const remove = useRemove('clients');
  const [params, setParams] = useSearchParams();
  const [chooserOpen, setChooserOpen] = useState(params.get('new') === '1');
  const [open, setOpen] = useState(false);
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [defaults, setDefaults] = useState<Record<string, unknown> | undefined>();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const rowMenu = (c: Client): MenuItem[] => [
    { label: 'Apri dettaglio', icon: ExternalLink, onClick: () => navigate(`/clients/${c.id}`) },
    ...(can('clients.write') ? [{ label: 'Modifica', icon: Pencil, onClick: () => navigate(`/clients/${c.id}`) }] : []),
    { label: 'Esporta CSV', icon: Download, onClick: () => exportToCSV(`cliente-${c.displayName}`, [c]) },
    ...(can('clients.delete')
      ? [{
          label: 'Archivia',
          icon: Archive,
          danger: true,
          separatorBefore: true,
          onClick: async () => { await remove.mutateAsync(c.id); toast.success('Cliente archiviato'); },
        }]
      : []),
  ];

  const filtered = useMemo(() => {
    return (clients ?? []).filter((c) => {
      const matchQ = !q || c.displayName.toLowerCase().includes(q.toLowerCase()) || (c.email ?? '').includes(q);
      const matchS = status === 'all' || c.status === status;
      return matchQ && matchS;
    });
  }, [clients, q, status]);

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Cliente',
      sortValue: (c) => c.displayName,
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.displayName} size="sm" color="#3b76d6" />
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{c.displayName}</p>
            <p className="truncate text-xs text-fg-subtle">{c.email ?? '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'sector', header: 'Settore', render: (c) => <span className="text-fg-subtle">{c.sector ?? '—'}</span> },
    { key: 'city', header: 'Città', render: (c) => <span className="text-fg-subtle">{c.city ?? '—'}</span> },
    { key: 'status', header: 'Stato', render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
    { key: 'priority', header: 'Priorità', render: (c) => <StatusBadge status={c.priority} /> },
    { key: 'last', header: 'Ultimo contatto', sortValue: (c) => c.lastContactAt ?? '', render: (c) => <span className="text-fg-subtle">{formatDate(c.lastContactAt)}</span> },
  ];

  const closeModal = () => {
    setOpen(false);
    setDefaults(undefined);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };
  const openChooser = () => setChooserOpen(true);
  const closeChooser = () => {
    setChooserOpen(false);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clienti"
        description={`${filtered.length} clienti · CRM BNS Studio`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportToCSV('clienti', filtered)}>
              <Download className="h-4 w-4" /> Esporta CSV
            </Button>
            {can('clients.write') && (
              <Button onClick={openChooser}>
                <Plus className="h-4 w-4" /> Nuovo cliente
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca clienti…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="all">Tutti gli stati</option>
          <option value="lead">Lead</option>
          <option value="prospect">Prospect</option>
          <option value="active">Attivi</option>
          <option value="partner">Partner</option>
          <option value="past_client">Ex clienti</option>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nessun cliente"
          description="Aggiungi il primo cliente per iniziare a costruire il tuo CRM."
          action={can('clients.write') && <Button onClick={openChooser}><Plus className="h-4 w-4" /> Nuovo cliente</Button>}
        />
      ) : (
        <DataTable data={filtered} columns={columns} onRowClick={(c) => navigate(`/clients/${c.id}`)} rowMenu={rowMenu} />
      )}

      <CreateMethodDialog
        open={chooserOpen}
        onClose={closeChooser}
        entityLabel="cliente"
        title="Nuovo cliente"
        description="Come vuoi creare questo cliente?"
        onManual={openManual}
        onMarkdown={() => {
          setChooserOpen(false);
          setMarkdownOpen(true);
        }}
      />
      <ContextualMarkdownImportDialog open={markdownOpen} onClose={() => setMarkdownOpen(false)} entityType="client" onContinue={importMarkdown} />
      <ClientFormModal open={open} onClose={closeModal} defaults={defaults} />
    </div>
  );
}
