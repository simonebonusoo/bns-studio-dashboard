import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { useList, useUpdate } from '@/hooks/useEntities';
import { PIPELINE_STAGES, STAGE_LABELS, STAGE_PROBABILITY } from '@/types/enums';
import type { Opportunity, OpportunityStage } from '@/types';
import { formatCurrency } from '@/lib/format';
import { OpportunityFormModal } from './OpportunityFormModal';
import { toast } from 'sonner';

export default function PipelinePage() {
  const { data: opportunities, isLoading } = useList<Opportunity>('opportunities');
  const update = useUpdate<Opportunity>('opportunities');
  const [params, setParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(params.get('new') === '1');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const closeModal = () => {
    setOpen(false);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };

  const byStage = useMemo(() => {
    const map = new Map<OpportunityStage, Opportunity[]>();
    PIPELINE_STAGES.forEach((s) => map.set(s, []));
    (opportunities ?? []).forEach((o) => {
      if (!map.has(o.stage)) map.set(o.stage, []);
      map.get(o.stage)!.push(o);
    });
    map.forEach((list) => list.sort((a, b) => a.order - b.order));
    return map;
  }, [opportunities]);

  const active = (opportunities ?? []).find((o) => o.id === activeId) ?? null;

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const oppId = e.active.id as string;
    const newStage = e.over?.id as OpportunityStage | undefined;
    if (!newStage) return;
    const opp = (opportunities ?? []).find((o) => o.id === oppId);
    if (!opp || opp.stage === newStage) return;
    await update.mutateAsync({
      id: oppId,
      patch: { stage: newStage, probability: STAGE_PROBABILITY[newStage] },
    });
    toast.success(`Spostato in "${STAGE_LABELS[newStage]}"`);
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline commerciale"
        description="Trascina le opportunità tra le fasi"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nuova opportunità
          </Button>
        }
      />

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const items = byStage.get(stage) ?? [];
            const total = items.reduce((s, o) => s + o.value, 0);
            return (
              <Column key={stage} stage={stage} count={items.length} total={total}>
                {items.map((o) => (
                  <OppCard key={o.id} opp={o} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{active && <OppCardView opp={active} dragging />}</DragOverlay>
      </DndContext>

      <OpportunityFormModal open={open} onClose={closeModal} />
    </div>
  );
}

function Column({
  stage,
  count,
  total,
  children,
}: {
  stage: OpportunityStage;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
          <span className="rounded-full bg-surface-2 px-1.5 text-xs text-fg-subtle">{count}</span>
        </div>
        <span className="text-xs text-fg-subtle">{formatCurrency(total)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-card border border-dashed p-2 transition-colors ${
          isOver ? 'border-accent bg-accent/5' : 'border-border bg-surface-2/50'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function OppCard({ opp }: { opp: Opportunity }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <OppCardView opp={opp} />
    </div>
  );
}

function OppCardView({ opp, dragging }: { opp: Opportunity; dragging?: boolean }) {
  return (
    <Card className={`p-3 ${dragging ? 'shadow-pop rotate-2' : ''}`}>
      <p className="text-sm font-medium leading-snug">{opp.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{formatCurrency(opp.value)}</span>
        <StatusBadge status={opp.priority} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-fg-subtle">
        <span>{opp.probability}%</span>
        <span>{opp.source}</span>
      </div>
    </Card>
  );
}
