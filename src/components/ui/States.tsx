import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Inbox, Loader2, AlertTriangle } from 'lucide-react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center">
      <div className="mb-3 text-fg-subtle">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <h3 className="font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-fg-subtle">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-danger/20 bg-danger/5 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" />
      <p className="text-sm text-danger">{message ?? 'Si è verificato un errore.'}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}
