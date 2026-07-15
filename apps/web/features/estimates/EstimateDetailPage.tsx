import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Check, X, FileOutput, Pencil, Trash2, Download, Share2, FileText, Eye, ChevronDown, Sparkles } from 'lucide-react';
import { useDetail, useList, useUpdate, useCreate, useRemove } from '@/hooks/useEntities';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { DocumentView } from '@/features/finance/DocumentView';
import { formatDate } from '@/lib/format';
import { nextInvoiceNumber } from '@/services/documentNumbers';
import { getEstimateDeleteSafety, hasBlockingDependencies } from '@/services/deleteSafety';
import { downloadMarkdown, downloadPdf, estimateMarkdown, estimatePdfBlob, sharePdf, upsertMarkdownDocument } from '@/services/documentService';
import { useAuth } from '@/stores/auth';
import { EstimateFormModal } from './EstimateFormModal';
import { BnsPdfDialog } from './BnsPdfDialog';
import { usePreview } from '@/components/preview/previewContext';
import type { Estimate, Client, Invoice, Contract } from '@/types';
import { toast } from 'sonner';

export default function EstimateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const preview = usePreview();
  const { data: estimate, isLoading } = useDetail<Estimate>('estimates', id);
  const { data: clients } = useList<Client>('clients');
  const { data: contracts } = useList<Contract>('contracts');
  const { data: invoices } = useList<Invoice>('invoices');
  const update = useUpdate<Estimate>('estimates');
  const createInvoice = useCreate<Invoice>('invoices');
  const remove = useRemove('estimates');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [bnsPdfOpen, setBnsPdfOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (!estimate) return <ErrorState message="Preventivo non trovato" />;

  const client = (clients ?? []).find((c) => c.id === estimate.clientId);
  const canManage = can('estimates.manage');
  const deleteSafety = getEstimateDeleteSafety(estimate, contracts ?? [], invoices ?? []);
  const blockedDelete = hasBlockingDependencies(deleteSafety);
  const linkedInvoices = (invoices ?? []).filter((invoice) => invoice.estimateId === estimate.id);

  const setStatus = async (status: Estimate['status']) => {
    await update.mutateAsync({
      id: estimate.id,
      patch: { status, acceptedAt: status === 'accepted' ? new Date().toISOString() : estimate.acceptedAt },
    });
    toast.success(status === 'accepted' ? 'Preventivo accettato' : 'Preventivo aggiornato');
  };

  const deleteEstimate = async () => {
    if (blockedDelete) return;
    await remove.mutateAsync(estimate.id);
    toast.success('Preventivo eliminato');
    navigate('/estimates');
  };

  const convertToInvoice = async () => {
    const createdInvoice = await createInvoice.mutateAsync({
      number: await nextInvoiceNumber(),
      clientId: estimate.clientId,
      estimateId: estimate.id,
      status: 'draft',
      currency: estimate.currency,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: null,
      items: estimate.items,
      globalDiscountPct: estimate.globalDiscountPct,
      withholdingPct: 0,
      paymentMethod: 'bank_transfer',
    });
    toast.success('Fattura creata dal preventivo');
    navigate(`/invoices/${createdInvoice.id}`);
  };

  const markdown = estimateMarkdown(estimate, client);
  const ensureMarkdown = () =>
    upsertMarkdownDocument({
      title: `Preventivo ${estimate.number}`,
      type: 'estimate',
      markdown,
      sourceEntityType: 'estimate',
      sourceEntityId: estimate.id,
      clientId: estimate.clientId,
    });
  const downloadEstimatePdf = async () => {
    await downloadPdf(`preventivo-${estimate.number}.pdf`, estimatePdfBlob(estimate, client));
  };
  const shareEstimatePdf = async () => {
    await sharePdf(`Preventivo ${estimate.number}`, `preventivo-${estimate.number}.pdf`, estimatePdfBlob(estimate, client));
  };
  const openMarkdown = async () => {
    await ensureMarkdown();
    setMarkdownOpen(true);
  };
  const downloadEstimateMarkdown = async () => {
    await ensureMarkdown();
    await downloadMarkdown(`preventivo-${estimate.number}.md`, markdown);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link to="/estimates" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Preventivi
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={estimate.status} />
          <Button variant="secondary" onClick={() => preview.open({ name: `preventivo-${estimate.number}.pdf`, blob: estimatePdfBlob(estimate, client), mime: 'application/pdf' })}><Eye className="h-4 w-4" /> Anteprima</Button>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Stampa / PDF</Button>
          <div className="relative">
            <Button variant="secondary" onClick={() => setPdfMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={pdfMenuOpen}>
              <Download className="h-4 w-4" /> PDF <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
            {pdfMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPdfMenuOpen(false)} aria-hidden />
                <div role="menu" className="absolute right-0 z-50 mt-1.5 w-60 animate-scale-in rounded-lg border border-border bg-surface p-1 shadow-pop">
                  <button
                    role="menuitem"
                    className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                    onClick={() => { setPdfMenuOpen(false); void downloadEstimatePdf(); }}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><span className="font-medium text-fg">PDF classico</span><br /><span className="text-xs text-fg-subtle">Documento essenziale (voci e totali)</span></span>
                  </button>
                  <button
                    role="menuitem"
                    className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                    onClick={() => { setPdfMenuOpen(false); setBnsPdfOpen(true); }}
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span><span className="font-medium text-fg">PDF BnsStudio</span><br /><span className="text-xs text-fg-subtle">Presentazione impaginata dai dati del preventivo</span></span>
                  </button>
                </div>
              </>
            )}
          </div>
          <Button variant="secondary" onClick={shareEstimatePdf}><Share2 className="h-4 w-4" /> Share</Button>
          <Button variant="ghost" onClick={openMarkdown}><FileText className="h-4 w-4" /> Markdown</Button>
          {canManage && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Modifica
            </Button>
          )}
          {canManage && estimate.status !== 'accepted' && (
            <>
              <Button variant="secondary" onClick={() => setStatus('accepted')}><Check className="h-4 w-4" /> Accetta</Button>
              <Button variant="ghost" onClick={() => setStatus('rejected')}><X className="h-4 w-4 text-danger" /></Button>
            </>
          )}
          {canManage && estimate.status === 'accepted' && linkedInvoices.length === 0 && (
            <Button onClick={convertToInvoice} loading={createInvoice.isPending}><FileOutput className="h-4 w-4" /> Crea fattura</Button>
          )}
          {linkedInvoices.length === 1 && (
            <Button onClick={() => navigate(`/invoices/${linkedInvoices[0].id}`)}><FileOutput className="h-4 w-4" /> Visualizza fattura</Button>
          )}
          {linkedInvoices.length > 1 && (
            <Button onClick={() => navigate(`/invoices?estimateId=${estimate.id}`)}><FileOutput className="h-4 w-4" /> Visualizza fatture</Button>
          )}
          {canManage && (
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 text-danger" /> Elimina
            </Button>
          )}
        </div>
      </div>

      <DocumentView
        title="Preventivo"
        number={estimate.number}
        clientName={client?.displayName ?? '—'}
        issueDate={formatDate(estimate.issueDate)}
        dueDate={estimate.expiryDate ? formatDate(estimate.expiryDate) : undefined}
        items={estimate.items}
        globalDiscountPct={estimate.globalDiscountPct}
        depositPct={estimate.depositPct}
        notes={estimate.notes}
      />

      <EstimateFormModal open={editOpen} onClose={() => setEditOpen(false)} estimate={estimate} />
      <BnsPdfDialog open={bnsPdfOpen} onClose={() => setBnsPdfOpen(false)} estimate={estimate} client={client} />
      <Modal
        open={markdownOpen}
        onClose={() => setMarkdownOpen(false)}
        title={`Markdown ${estimate.number}`}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMarkdownOpen(false)}>Chiudi</Button>
            <Button onClick={downloadEstimateMarkdown}><Download className="h-4 w-4" /> Scarica .md</Button>
          </>
        }
      >
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-xs leading-relaxed text-fg-subtle">
          {markdown}
        </pre>
      </Modal>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={blockedDelete ? () => {} : deleteEstimate}
        title={blockedDelete ? 'Eliminazione non disponibile' : `Eliminare ${estimate.number}?`}
        message={
          blockedDelete ? (
            <div className="space-y-2">
              <p>Non puoi eliminare definitivamente questo preventivo perché è collegato a:</p>
              <ul className="list-disc space-y-1 pl-5">
                {deleteSafety.dependencies.map((item) => (
                  <li key={item.label}>
                    {item.count} {item.label}
                    {item.count > 1 ? 'i' : ''}
                  </li>
                ))}
              </ul>
              <p>Rimuovi prima i record collegati oppure conserva il preventivo a fini storici.</p>
            </div>
          ) : (
            'Questa azione rimuoverà il preventivo dal gestionale e aggiornerà subito dashboard e analytics.'
          )
        }
        confirmLabel={blockedDelete ? 'Chiudi' : 'Elimina preventivo'}
        danger={!blockedDelete}
      />
    </div>
  );
}
