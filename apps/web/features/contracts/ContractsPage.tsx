import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Download, FileText, Pencil, Plus, Share2, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { Drawer } from '@/components/ui/Drawer';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { useList, useRemove, useUpdate } from '@/hooks/useEntities';
import { ContractFormModal } from './ContractFormModal';
import { CreateMethodDialog } from '@/features/import/CreateMethodDialog';
import { ContextualMarkdownImportDialog } from '@/features/import/ContextualMarkdownImportDialog';
import type { ResolvedImport } from '@/features/import/contextualImport';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import {
  contractMarkdown,
  contractPdfBlob,
  downloadMarkdown,
  downloadPdf,
  sharePdf,
  upsertMarkdownDocument,
} from '@/services/documentService';
import type { Client, Contract, FileItem, Project } from '@/types';
import { toast } from 'sonner';

const TYPE_LABELS: Record<string, string> = {
  single_project: 'Progetto',
  maintenance: 'Manutenzione',
  collaboration: 'Collaborazione',
  consulting: 'Consulenza',
  retainer: 'Retainer',
  software: 'Software',
  license: 'Licenza',
  custom: 'Personalizzato',
};

function contractType(contract: Contract) {
  return TYPE_LABELS[contract.type] ?? contract.type;
}

export default function ContractsPage() {
  const { data: contracts, isLoading } = useList<Contract>('contracts');
  const { data: clients } = useList<Client>('clients');
  const { data: projects } = useList<Project>('projects');
  const { data: files } = useList<FileItem>('files');
  const remove = useRemove('contracts');
  const update = useUpdate<Contract>('contracts');
  const can = useAuth((s) => s.can);
  const [params, setParams] = useSearchParams();
  const projectFilter = params.get('projectId');
  const [chooserOpen, setChooserOpen] = useState(params.get('new') === '1' && !projectFilter);
  const [open, setOpen] = useState(params.get('new') === '1' && Boolean(projectFilter));
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [defaults, setDefaults] = useState<Record<string, unknown> | undefined>();
  const [editing, setEditing] = useState<Contract | null>(null);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const canManage = can('estimates.manage');

  const filteredContracts = useMemo(
    () => (contracts ?? []).filter((contract) => !projectFilter || contract.projectId === projectFilter),
    [contracts, projectFilter],
  );
  const clientById = useMemo(() => new Map((clients ?? []).map((client) => [client.id, client])), [clients]);
  const projectById = useMemo(() => new Map((projects ?? []).map((project) => [project.id, project])), [projects]);
  const grouped = useMemo(() => {
    const groups = new Map<string, { client?: Client; projects: Map<string, { project?: Project; contracts: Contract[] }> }>();
    filteredContracts.forEach((contract) => {
      const clientKey = contract.clientId ?? 'no-client';
      if (!groups.has(clientKey)) groups.set(clientKey, { client: contract.clientId ? clientById.get(contract.clientId) : undefined, projects: new Map() });
      const group = groups.get(clientKey)!;
      const projectKey = contract.projectId ?? 'no-project';
      if (!group.projects.has(projectKey)) group.projects.set(projectKey, { project: contract.projectId ? projectById.get(contract.projectId) : undefined, contracts: [] });
      group.projects.get(projectKey)!.contracts.push(contract);
    });
    return Array.from(groups.values());
  }, [clientById, filteredContracts, projectById]);

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setDefaults(undefined);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };
  const openEdit = (contract: Contract) => {
    setEditing(contract);
    setDefaults(undefined);
    setOpen(true);
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
  const archiveContract = async (contract: Contract) => {
    await update.mutateAsync({ id: contract.id, patch: { status: 'archived' } });
    toast.success('Contratto archiviato');
  };
  const deleteContract = async () => {
    if (!deleteTarget) return;
    await remove.mutateAsync(deleteTarget.id);
    toast.success('Contratto eliminato');
    setSelected((current) => (current?.id === deleteTarget.id ? null : current));
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contratti"
        description={`${filteredContracts.length} rapporti contrattuali · cliente → progetto → servizio`}
        actions={canManage && <Button onClick={projectFilter ? openManual : openChooser}><Plus className="h-4 w-4" /> Nuovo contratto</Button>}
      />
      {projectFilter && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <div className="text-fg-subtle">Stai visualizzando i contratti collegati al progetto selezionato.</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('projectId');
              setParams(next, { replace: true });
            }}
          >
            <X className="h-4 w-4" /> Rimuovi filtro
          </Button>
        </div>
      )}
      {filteredContracts.length === 0 ? (
        <EmptyState title="Nessun contratto" action={canManage && <Button onClick={projectFilter ? openManual : openChooser}><Plus className="h-4 w-4" /> Nuovo contratto</Button>} />
      ) : (
        <div className="space-y-4">
          {grouped.map((clientGroup, index) => (
            <Card key={clientGroup.client?.id ?? `client-${index}`} className="overflow-hidden">
              <CardHeader title={clientGroup.client?.displayName ?? 'Senza cliente'} subtitle={`${Array.from(clientGroup.projects.values()).reduce((sum, item) => sum + item.contracts.length, 0)} contratti`} />
              <div className="divide-y divide-border">
                {Array.from(clientGroup.projects.values()).map((projectGroup) => (
                  <div key={projectGroup.project?.id ?? 'no-project'} className="px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{projectGroup.project?.name ?? 'Senza progetto'}</p>
                        {projectGroup.project && <Link to={`/projects/${projectGroup.project.id}`} className="text-xs text-info hover:underline">Apri progetto</Link>}
                      </div>
                      <Badge tone="neutral">{projectGroup.contracts.length}</Badge>
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2">
                      {projectGroup.contracts.map((contract) => (
                        <button
                          key={contract.id}
                          onClick={() => setSelected(contract)}
                          className="rounded-xl border border-border bg-surface px-3 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{contract.title}</p>
                              <p className="mt-1 text-xs text-fg-subtle">{contract.number} · {contractType(contract)} · {formatCurrency(contract.value)}</p>
                              <p className="mt-1 text-xs text-fg-faint">{contract.recurrence ?? 'one_time'} · rinnovo {contract.renewalType ?? 'none'}</p>
                            </div>
                            <StatusBadge status={contract.status === 'awaiting_signature' ? 'waiting_client' : contract.status} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContractDetailDrawer
        contract={selected}
        client={selected?.clientId ? clientById.get(selected.clientId) : undefined}
        project={selected?.projectId ? projectById.get(selected.projectId) : undefined}
        files={(files ?? []).filter((file) => file.entityType === 'contract' && file.entityId === selected?.id)}
        canManage={canManage}
        onClose={() => setSelected(null)}
        onEdit={(contract) => openEdit(contract)}
        onArchive={(contract) => void archiveContract(contract)}
        onDelete={(contract) => setDeleteTarget(contract)}
      />
      <CreateMethodDialog
        open={chooserOpen}
        onClose={closeChooser}
        entityLabel="contratto"
        title="Nuovo contratto"
        description="Come vuoi creare questo contratto?"
        onManual={openManual}
        onMarkdown={() => {
          setChooserOpen(false);
          setMarkdownOpen(true);
        }}
      />
      <ContextualMarkdownImportDialog open={markdownOpen} onClose={() => setMarkdownOpen(false)} entityType="contract" onContinue={importMarkdown} />
      <ContractFormModal open={open} onClose={closeModal} contract={editing} defaults={{ projectId: projectFilter ?? '', ...defaults }} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteContract}
        title={`Eliminare ${deleteTarget?.number ?? 'contratto'}?`}
        message="Questa azione rimuoverà il contratto dal gestionale."
        confirmLabel="Elimina"
        danger
      />
    </div>
  );
}

function ContractDetailDrawer({
  contract,
  client,
  project,
  files,
  canManage,
  onClose,
  onEdit,
  onArchive,
  onDelete,
}: {
  contract: Contract | null;
  client?: Client;
  project?: Project;
  files: FileItem[];
  canManage: boolean;
  onClose: () => void;
  onEdit: (contract: Contract) => void;
  onArchive: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
}) {
  const [markdownOpen, setMarkdownOpen] = useState(false);
  if (!contract) return null;
  const markdown = contractMarkdown(contract, client, project);
  const ensureMarkdown = () =>
    upsertMarkdownDocument({
      title: contract.title,
      type: 'contract',
      markdown,
      sourceEntityType: 'contract',
      sourceEntityId: contract.id,
      clientId: contract.clientId,
      projectId: contract.projectId,
    });
  const pdf = () => contractPdfBlob(contract, client, project);
  const downloadContractPdf = async () => downloadPdf(`contratto-${contract.number}.pdf`, pdf());
  const shareContractPdf = async () => sharePdf(contract.title, `contratto-${contract.number}.pdf`, pdf());
  const openMarkdown = async () => {
    await ensureMarkdown();
    setMarkdownOpen(true);
  };

  return (
    <>
      <Drawer
        open={Boolean(contract)}
        onClose={onClose}
        width="lg"
        title={contract.title}
        subtitle={`${contract.number} · ${client?.displayName ?? 'Senza cliente'}`}
        footer={
          <>
            {canManage ? (
              <Button variant="ghost" size="sm" onClick={() => onDelete(contract)}>
                <Trash2 className="h-4 w-4 text-danger" /> Elimina
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={downloadContractPdf}><Download className="h-4 w-4" /> PDF</Button>
              <ActionMenu
                items={[
                  { label: 'Condividi PDF', icon: Share2, onClick: shareContractPdf },
                  { label: 'Apri Markdown', icon: FileText, onClick: openMarkdown },
                  { label: 'Scarica Markdown', icon: Download, onClick: async () => { await ensureMarkdown(); await downloadMarkdown(`contratto-${contract.number}.md`, markdown); } },
                  ...(canManage
                    ? [
                        { label: 'Modifica', icon: Pencil, onClick: () => onEdit(contract) },
                        { label: 'Archivia', icon: Archive, onClick: () => onArchive(contract) },
                      ]
                    : []),
                ]}
              />
            </div>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Cliente" value={client?.displayName ?? '—'} />
            <Info label="Progetto" value={project?.name ?? '—'} />
            <Info label="Stato" value={contract.status} />
            <Info label="Tipologia" value={contractType(contract)} />
            <Info label="Durata" value={`${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}`} />
            <Info label="Importo" value={formatCurrency(contract.value)} />
            <Info label="Ricorrenza" value={contract.recurrence ?? 'one_time'} />
            <Info label="Billing" value={contract.billingFrequency ?? 'one_time'} />
            <Info label="Rinnovo" value={contract.renewalType ?? 'none'} />
            <Info label="Documenti" value={`${files.length} collegati`} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">Note</p>
            <p className="whitespace-pre-wrap text-sm text-fg-subtle">{contract.notes || contract.terms || 'Nessuna nota.'}</p>
          </div>
        </div>
      </Drawer>
      <Modal
        open={markdownOpen}
        onClose={() => setMarkdownOpen(false)}
        title={`Markdown ${contract.number}`}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMarkdownOpen(false)}>Chiudi</Button>
            <Button onClick={async () => { await ensureMarkdown(); await downloadMarkdown(`contratto-${contract.number}.md`, markdown); }}><Download className="h-4 w-4" /> Scarica .md</Button>
          </>
        }
      >
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-xs leading-relaxed text-fg-subtle">{markdown}</pre>
      </Modal>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-xs text-fg-faint">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}
