import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Copy, Power, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { useList, useCreate, useUpdate, useRemove } from '@/hooks/useEntities';
import { ServiceFormModal } from './ServiceFormModal';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';
import type { Service } from '@/types';

const UNIT_LABELS: Record<string, string> = {
  fixed: 'fisso', hourly: '/ora', daily: '/giorno', monthly: '/mese', quantity: '/qtà', custom: 'personalizzato',
};

export default function ServicesPage() {
  const { data: services, isLoading } = useList<Service>('services');
  const create = useCreate<Service>('services');
  const update = useUpdate<Service>('services');
  const remove = useRemove('services');
  const can = useAuth((s) => s.can);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<Service | null>(null);
  const canManage = can('settings.manage') || can('projects.write');

  const closeModal = () => {
    setOpen(false); setEditing(null);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };
  const openEdit = (s: Service) => { setEditing(s); setOpen(true); };

  const duplicate = async (s: Service) => {
    const { id, createdAt, updatedAt, ...rest } = s;
    void id; void createdAt; void updatedAt;
    await create.mutateAsync({ ...rest, name: `${s.name} (copia)` });
    toast.success('Servizio duplicato');
  };
  const toggle = async (s: Service) => { await update.mutateAsync({ id: s.id, patch: { active: !s.active } }); toast.success(s.active ? 'Disattivato' : 'Attivato'); };

  const menu = (s: Service): MenuItem[] => [
    { label: 'Modifica', icon: Pencil, onClick: () => openEdit(s) },
    { label: 'Duplica', icon: Copy, onClick: () => duplicate(s) },
    { label: s.active ? 'Disattiva' : 'Attiva', icon: Power, onClick: () => toggle(s) },
    { label: 'Elimina', icon: Trash2, danger: true, separatorBefore: true, onClick: async () => { await remove.mutateAsync(s.id); toast.success('Eliminato'); } },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catalogo servizi"
        description={`${(services ?? []).length} servizi · clic per modificare, tasto destro per altre azioni`}
        actions={canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo servizio</Button>}
      />
      {(services ?? []).length === 0 ? (
        <EmptyState title="Nessun servizio" action={canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo servizio</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(services ?? []).map((s) => (
            <ContextMenu key={s.id} items={canManage ? menu(s) : []}>
              <Card
                onClick={() => canManage && openEdit(s)}
                className={`p-4 transition-colors ${canManage ? 'press cursor-pointer hover:border-border-strong' : ''} ${!s.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <h3 className="font-semibold">{s.name}</h3>
                  </div>
                  <Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? 'Attivo' : 'Off'}</Badge>
                </div>
                <p className="mt-1 text-xs text-fg-subtle">{s.category}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-xl font-bold">{formatCurrency(s.basePrice)}</span>
                  <span className="text-xs text-fg-subtle">{UNIT_LABELS[s.priceUnit]}</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-fg-faint">
                  <span>~{s.estimatedHours}h stimate</span>
                  <span>IVA {s.vatRate}%</span>
                </div>
              </Card>
            </ContextMenu>
          ))}
        </div>
      )}

      <ServiceFormModal open={open} onClose={closeModal} service={editing} />
    </div>
  );
}
