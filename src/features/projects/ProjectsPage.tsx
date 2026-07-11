import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ProjectFormModal } from './ProjectFormModal';
import { useList } from '@/hooks/useEntities';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useList<Project>('projects');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(
    () =>
      (projects ?? []).filter((p) => {
        const mq = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase());
        const ms = status === 'all' || p.status === status;
        return mq && ms;
      }),
    [projects, q, status],
  );

  const close = () => {
    setOpen(false);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progetti"
        description={`${filtered.length} progetti`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo progetto</Button>}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca progetti…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
          <option value="all">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="planned">Pianificati</option>
          <option value="review">In revisione</option>
          <option value="paused">In pausa</option>
          <option value="completed">Completati</option>
        </Select>
        <div className="flex rounded-lg border border-border">
          <button onClick={() => setView('grid')} className={`px-3 ${view === 'grid' ? 'text-fg' : 'text-fg-subtle'}`} aria-label="Griglia"><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView('list')} className={`px-3 ${view === 'list' ? 'text-fg' : 'text-fg-subtle'}`} aria-label="Lista"><List className="h-4 w-4" /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nessun progetto" description="Crea il primo progetto per iniziare." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo progetto</Button>} />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const d = daysUntil(p.dueDate);
            return (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <Card className="h-full p-4 transition-shadow hover:shadow-pop">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-xs text-fg-subtle">{p.code}</span>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <h3 className="mt-2 font-semibold leading-snug">{p.name}</h3>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-fg-subtle">
                      <span>Avanzamento</span>
                      <span>{p.progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold">{formatCurrency(p.contractValue)}</span>
                    <span className={d !== null && d < 0 && p.status !== 'completed' ? 'text-danger' : 'text-fg-subtle'}>
                      {formatDate(p.dueDate)}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-fg-subtle">{p.code} · {p.progress}%</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">{formatCurrency(p.contractValue)}</span>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}

      <ProjectFormModal open={open} onClose={close} />
    </div>
  );
}
