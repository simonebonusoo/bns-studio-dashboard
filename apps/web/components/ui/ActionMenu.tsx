import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import type { MenuItem } from './ContextMenu';

export function ActionMenu({
  items,
  label = 'Azioni',
}: {
  items: MenuItem[];
  label?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        left: Math.min(rect.right - 180, window.innerWidth - 196),
        top: Math.min(rect.bottom + 8, window.innerHeight - items.length * 38 - 24),
      });
    };

    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [items.length, open]);

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && position
        ? createPortal(
            <div
              style={{ left: position.left, top: position.top }}
              className="fixed z-[70] min-w-[180px] animate-scale-in rounded-lg border border-border bg-surface p-1 shadow-pop"
              onClick={(event) => event.stopPropagation()}
            >
              {items.map((item, index) => (
                <div key={`${item.label}-${index}`}>
                  {item.separatorBefore && <div className="my-1 h-px bg-border" />}
                  <button
                    onClick={() => {
                      item.onClick();
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                      item.danger
                        ? 'text-danger hover:bg-danger/10'
                        : 'text-fg-subtle hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
                    {item.label}
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
