import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}

/**
 * Wrapper che apre un menu contestuale al click destro sui figli.
 * Il menu si posiziona al cursore e si chiude su click esterno / Escape / scroll.
 */
export function ContextMenu({ items, children }: { items: MenuItem[]; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  // Mantiene il menu dentro il viewport
  const clamped = pos
    ? {
        x: Math.min(pos.x, window.innerWidth - 200),
        y: Math.min(pos.y, window.innerHeight - items.length * 36 - 16),
      }
    : null;

  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setPos({ x: e.clientX, y: e.clientY });
        }}
      >
        {children}
      </div>
      {clamped &&
        createPortal(
          <div
            ref={menuRef}
            style={{ left: clamped.x, top: clamped.y }}
            className="fixed z-[70] min-w-[180px] animate-scale-in rounded-lg border border-border bg-surface p-1 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) => (
              <div key={i}>
                {item.separatorBefore && <div className="my-1 h-px bg-border" />}
                <button
                  onClick={() => {
                    item.onClick();
                    setPos(null);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                    item.danger
                      ? 'text-danger hover:bg-danger/10'
                      : 'text-fg-subtle hover:bg-surface-2 hover:text-fg',
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
    </>
  );
}
