import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, LayoutDashboard, Users, Briefcase, ListChecks, GitBranch, Receipt,
  FileText, BarChart3, Clock, Settings, UserPlus, FolderPlus, ListPlus, Target,
  CornerDownLeft, type LucideIcon,
} from 'lucide-react';
import { useUI } from '@/stores/ui';
import { db } from '@/data/db';
import { ORGANIZATION_ID } from '@/data/seed';

interface Command {
  id: string;
  label: string;
  section: string;
  icon: LucideIcon;
  to: string;
  keywords?: string;
}

const NAV_COMMANDS: Command[] = [
  { id: 'n-dash', label: 'Dashboard', section: 'Vai a', icon: LayoutDashboard, to: '/', keywords: 'home' },
  { id: 'n-pipe', label: 'Pipeline', section: 'Vai a', icon: GitBranch, to: '/pipeline', keywords: 'lead opportunità' },
  { id: 'n-cli', label: 'Clienti', section: 'Vai a', icon: Users, to: '/clients', keywords: 'crm' },
  { id: 'n-prj', label: 'Progetti', section: 'Vai a', icon: Briefcase, to: '/projects' },
  { id: 'n-task', label: 'Task', section: 'Vai a', icon: ListChecks, to: '/tasks', keywords: 'kanban' },
  { id: 'n-time', label: 'Time Tracking', section: 'Vai a', icon: Clock, to: '/time', keywords: 'ore timesheet' },
  { id: 'n-est', label: 'Preventivi', section: 'Vai a', icon: FileText, to: '/estimates' },
  { id: 'n-inv', label: 'Fatture', section: 'Vai a', icon: Receipt, to: '/invoices' },
  { id: 'n-an', label: 'Analytics', section: 'Vai a', icon: BarChart3, to: '/analytics', keywords: 'report' },
  { id: 'n-set', label: 'Impostazioni', section: 'Vai a', icon: Settings, to: '/settings' },
];

const ACTION_COMMANDS: Command[] = [
  { id: 'a-cli', label: 'Nuovo cliente', section: 'Azioni', icon: UserPlus, to: '/clients?new=1' },
  { id: 'a-lead', label: 'Nuova opportunità', section: 'Azioni', icon: Target, to: '/pipeline' },
  { id: 'a-prj', label: 'Nuovo progetto', section: 'Azioni', icon: FolderPlus, to: '/projects?new=1' },
  { id: 'a-task', label: 'Nuovo task', section: 'Azioni', icon: ListPlus, to: '/tasks?new=1' },
];

export function CommandPalette() {
  const open = useUI((s) => s.commandOpen);
  const setOpen = useUI((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [entities, setEntities] = useState<Command[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    (async () => {
      const [clients, projects, tasks, invoices, estimates, opportunities] = await Promise.all([
        db.clients.where('organizationId').equals(ORGANIZATION_ID).toArray(),
        db.projects.where('organizationId').equals(ORGANIZATION_ID).toArray(),
        db.tasks.where('organizationId').equals(ORGANIZATION_ID).toArray(),
        db.invoices.where('organizationId').equals(ORGANIZATION_ID).toArray(),
        db.estimates.where('organizationId').equals(ORGANIZATION_ID).toArray(),
        db.opportunities.where('organizationId').equals(ORGANIZATION_ID).toArray(),
      ]);
      setEntities([
        ...clients.filter((c) => !c.deletedAt).map((c) => ({ id: c.id, label: c.displayName, section: 'Clienti', icon: Users, to: `/clients/${c.id}` })),
        ...projects.filter((p) => !p.deletedAt).map((p) => ({ id: p.id, label: `${p.code} · ${p.name}`, section: 'Progetti', icon: Briefcase, to: `/projects/${p.id}` })),
        ...tasks.filter((t) => !t.deletedAt).map((t) => ({ id: t.id, label: t.title, section: 'Task', icon: ListChecks, to: '/tasks' })),
        ...invoices.filter((i) => !i.deletedAt).map((i) => ({ id: i.id, label: i.number, section: 'Fatture', icon: Receipt, to: `/invoices/${i.id}` })),
        ...estimates.filter((e) => !e.deletedAt).map((e) => ({ id: e.id, label: e.number, section: 'Preventivi', icon: FileText, to: `/estimates/${e.id}` })),
        ...opportunities.filter((o) => !o.deletedAt).map((o) => ({ id: o.id, label: o.title, section: 'Opportunità', icon: Target, to: '/pipeline' })),
      ]);
    })();
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...NAV_COMMANDS, ...ACTION_COMMANDS].slice(0, 14);
    const match = (c: Command) => (c.label + ' ' + (c.keywords ?? '')).toLowerCase().includes(q);
    return [...NAV_COMMANDS, ...ACTION_COMMANDS, ...entities].filter(match).slice(0, 20);
  }, [query, entities]);

  useEffect(() => setActive(0), [query, open]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const run = (c: Command) => {
    navigate(c.to);
    close();
  };

  // Raggruppa mantenendo l'ordine per l'indice attivo
  let idx = -1;
  const grouped = results.reduce<Record<string, { cmd: Command; i: number }[]>>((acc, cmd) => {
    idx += 1;
    (acc[cmd.section] ??= []).push({ cmd, i: idx });
    return acc;
  }, {});

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh] animate-overlay-in">
      <div className="absolute inset-0" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-card border border-border bg-surface shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-fg-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && results[active]) { e.preventDefault(); run(results[active]); }
              if (e.key === 'Escape') close();
            }}
            placeholder="Cerca o vai a… (clienti, progetti, fatture, azioni)"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-faint"
          />
          <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 font-mono text-2xs text-fg-faint sm:inline">esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-fg-subtle">Nessun risultato</p>
          ) : (
            Object.entries(grouped).map(([section, items]) => (
              <div key={section} className="mb-1">
                <p className="px-2.5 pb-0.5 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-fg-faint">{section}</p>
                {items.map(({ cmd, i }) => (
                  <button
                    key={cmd.id}
                    onClick={() => run(cmd)}
                    onMouseMove={() => setActive(i)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      i === active ? 'bg-surface-2 text-fg' : 'text-fg-subtle'
                    }`}
                  >
                    <cmd.icon className="h-4 w-4 shrink-0 text-fg-faint" />
                    <span className="truncate">{cmd.label}</span>
                    {i === active && <CornerDownLeft className="ml-auto h-3.5 w-3.5 text-fg-faint" />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
