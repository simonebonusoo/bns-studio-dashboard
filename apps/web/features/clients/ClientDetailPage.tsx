import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { useDetail, useList, useRemove } from '@/hooks/useEntities';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ClientFormModal } from './ClientFormModal';
import { formatCurrency } from '@/lib/format';
import { documentTotals } from '@/lib/finance';
import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';
import type { Client, Project, Invoice } from '@/types';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const { data: client, isLoading } = useDetail<Client>('clients', id);
  const { data: projects } = useList<Project>('projects');
  const { data: invoices } = useList<Invoice>('invoices');
  const remove = useRemove('clients');
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return <LoadingState />;
  if (!client) return <ErrorState message="Cliente non trovato" />;

  const clientProjects = (projects ?? []).filter((p) => p.clientId === client.id);
  const clientInvoices = (invoices ?? []).filter((i) => i.clientId === client.id);
  const totalRevenue = clientInvoices.reduce(
    (s, i) => s + documentTotals(i.items, { globalDiscountPct: i.globalDiscountPct }).total,
    0,
  );

  const handleDelete = async () => {
    await remove.mutateAsync(client.id);
    toast.success('Cliente archiviato');
    navigate('/clients');
  };

  return (
    <div className="space-y-5">
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Clienti
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={client.displayName} size="lg" color="#3b76d6" />
          <div>
            <h1 className="text-2xl font-bold">{client.displayName}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={client.status} />
              <StatusBadge status={client.priority} />
              <span className="text-sm text-fg-subtle">{client.sector}</span>
            </div>
          </div>
        </div>
        {can('clients.write') && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <Pencil className="h-4 w-4" /> Modifica
            </Button>
            {can('clients.delete') && (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Contatti" />
          <div className="space-y-3 p-4 text-sm">
            <Info icon={<Mail className="h-4 w-4" />} value={client.email} />
            <Info icon={<Phone className="h-4 w-4" />} value={client.phone} />
            <Info icon={<Globe className="h-4 w-4" />} value={client.website} />
            <Info icon={<MapPin className="h-4 w-4" />} value={[client.city, client.province].filter(Boolean).join(', ')} />
            <div className="border-t border-border pt-3">
              <p className="text-xs text-fg-subtle">P. IVA</p>
              <p>{client.vat ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-fg-subtle">Fonte</p>
              <p>{client.source ?? '—'}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-fg-subtle">Ricavi generati</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(totalRevenue)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-fg-subtle">Progetti</p>
              <p className="mt-1 text-xl font-bold">{clientProjects.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-fg-subtle">Fatture</p>
              <p className="mt-1 text-xl font-bold">{clientInvoices.length}</p>
            </Card>
          </div>

          <Card>
            <CardHeader title="Progetti collegati" />
            <ul className="divide-y divide-border">
              {clientProjects.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-fg-subtle">{p.code} · {formatCurrency(p.contractValue)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
              {clientProjects.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessun progetto</li>}
            </ul>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader title="Note" />
              <p className="p-4 text-sm text-fg-subtle">{client.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <ClientFormModal open={edit} onClose={() => setEdit(false)} client={client} />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleDelete}
        title="Archivia cliente"
        message={`Archiviare "${client.displayName}"? Potrai ripristinarlo dai dati demo.`}
        confirmLabel="Archivia"
        danger
      />
    </div>
  );
}

function Info({ icon, value }: { icon: React.ReactNode; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-fg-subtle">
      {icon}
      <span className="text-fg">{value}</span>
    </div>
  );
}
