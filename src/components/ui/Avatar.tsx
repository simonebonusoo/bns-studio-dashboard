import { cn } from '@/lib/cn';

export function Avatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const parts = name.trim().split(' ');
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color ?? '#71717a' }}
      title={name}
    >
      {initials}
    </span>
  );
}
