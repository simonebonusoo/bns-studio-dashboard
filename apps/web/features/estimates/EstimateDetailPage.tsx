import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Check, X, FileOutput } from 'lucide-react';
import { useDetail, useList, useUpdate, useCreate } from '@/hooks/useEntities';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { DocumentView } from '@/features/finance/DocumentView';
import { formatDate } from '@/lib/format';
import { nextInvoiceNumber } from '@/services/documentNumbers';
import { useAuth } from '@/stores/auth';
import type { Estimate, Client, Invoice } from '@/types';
import { toast } from 'sonner';

export default function EstimateDetailPage() {
  const { id } = useParams();
  const can = useAuth((s) => s.can);
  const { data: estimate, isLoading } = useDetail<Estimate>('estimates', id);
  const { data: clients } = useList<Client>('clients');
  const update = useUpdate<Estimate>('estimates');
  const createInvoice = useCreate<Invoice>('invoices');

  if (isLoading) return <LoadingState />;
  if (!estimate) return <ErrorState message="Preventivo non trovato" />;

  const client = (clients ?? []).find((c) => c.id === estimate.clientId);
  const canManage = can('estimates.manage');

  const setStatus = async (status: Estimate['status']) => {
    await update.mutateAsync({
      id: estimate.id,
      patch: { status, acceptedAt: status === 'accepted' ? new Date().toISOString() : estimate.acceptedAt },
    });
    toast.success(status === 'accepted' ? 'Preventivo accettato' : 'Preventivo aggiornato');
  };

  const convertToInvoice = async () => {
    await createInvoice.mutateAsync({
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
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link to="/estimates" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Preventivi
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={estimate.status} />
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Stampa / PDF</Button>
          {canManage && estimate.status !== 'accepted' && (
            <>
              <Button variant="secondary" onClick={() => setStatus('accepted')}><Check className="h-4 w-4" /> Accetta</Button>
              <Button variant="ghost" onClick={() => setStatus('rejected')}><X className="h-4 w-4 text-danger" /></Button>
            </>
          )}
          {canManage && estimate.status === 'accepted' && (
            <Button onClick={convertToInvoice}><FileOutput className="h-4 w-4" /> Crea fattura</Button>
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
    </div>
  );
}
