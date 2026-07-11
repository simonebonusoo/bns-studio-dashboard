import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/stores/ui';

/** true se il focus è in un campo editabile (per non intercettare la digitazione). */
function isTyping(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

/** Scorciatoie di navigazione "g + tasto" (stile Linear) e comandi globali. */
const GO_TO: Record<string, string> = {
  d: '/',
  c: '/clients',
  p: '/projects',
  t: '/tasks',
  l: '/pipeline',
  i: '/invoices',
  e: '/estimates',
  a: '/analytics',
  k: '/time',
  s: '/settings',
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const pendingG = useRef(false);
  const gTimer = useRef<number>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K gestito qui per coerenza (la palette lo ascolta anche da sola)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }
      // ⌘\ / Ctrl+\ comprime la sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;

      if (pendingG.current) {
        const to = GO_TO[e.key.toLowerCase()];
        pendingG.current = false;
        window.clearTimeout(gTimer.current);
        if (to) {
          e.preventDefault();
          navigate(to);
        }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        pendingG.current = true;
        gTimer.current = window.setTimeout(() => (pendingG.current = false), 800);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, setCommandOpen, toggleSidebar]);
}
