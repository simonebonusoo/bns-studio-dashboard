import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import type { MenuItem } from '@/components/ui/ContextMenu';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  rowMenu,
  empty,
}: {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  rowMenu?: (row: T) => MenuItem[];
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const rows = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
    });
  }, [data, sort, columns]);

  if (data.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-fg-faint">
            {columns.map((c) => {
              const activeSort = sort?.key === c.key;
              const SortIcon = !activeSort ? ChevronsUpDown : sort!.dir === 1 ? ChevronUp : ChevronDown;
              return (
                <th key={c.key} className={cn('px-4 py-2.5 font-semibold', c.className)}>
                  {c.sortValue ? (
                    <button
                      className={cn('inline-flex items-center gap-1 transition-colors hover:text-fg-subtle', activeSort && 'text-fg-subtle')}
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 },
                        )
                      }
                    >
                      {c.header}
                      <SortIcon className="h-3 w-3" />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              onContextMenu={
                rowMenu
                  ? (e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, items: rowMenu(row) });
                    }
                  : undefined
              }
              className={cn(
                'border-b border-border/50 last:border-0 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-surface-2',
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-2.5 align-middle', c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {menu &&
        createPortal(
          <div
            style={{ left: Math.min(menu.x, window.innerWidth - 200), top: menu.y }}
            className="fixed z-[70] min-w-[180px] animate-scale-in rounded-lg border border-border bg-surface p-1 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {menu.items.map((item, i) => (
              <div key={i}>
                {item.separatorBefore && <div className="my-1 h-px bg-border" />}
                <button
                  onClick={() => {
                    item.onClick();
                    setMenu(null);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                    item.danger ? 'text-danger hover:bg-danger/10' : 'text-fg-subtle hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
