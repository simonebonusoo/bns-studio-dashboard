import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { ArrowUpRight } from 'lucide-react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-border bg-surface shadow-card', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg truncate">{title}</h3>
          {subtitle && <p className="text-xs text-fg-subtle truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  trend,
  accent,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: boolean;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <Card
      onClick={onClick}
      className={cn(
        'group px-4 py-3.5',
        interactive &&
          'cursor-pointer transition-all hover:border-border-strong hover:shadow-pop focus-visible:border-border-strong',
      )}
      {...(interactive ? { role: 'button', tabIndex: 0, onKeyDown: (e) => e.key === 'Enter' && onClick() } : {})}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-subtle">{label}</span>
        {interactive ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100" />
        ) : (
          icon && <span className="text-fg-faint">{icon}</span>
        )}
      </div>
      <div className={cn('mt-1.5 text-[1.35rem] font-bold leading-tight tracking-tight', accent && 'text-danger')}>
        {value}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-2xs">
        {trend && (
          <span className={cn('font-semibold', trend.positive ? 'text-success' : 'text-danger')}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
        {hint && <span className="text-fg-faint">{hint}</span>}
      </div>
    </Card>
  );
}
