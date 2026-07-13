import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { brandConfig } from '@/config/brandConfig';

/** Etichette leggibili per i segmenti di percorso noti. */
const LABELS: Record<string, string> = {
  '': 'Dashboard',
  clients: 'Clienti',
  projects: 'Progetti',
  calendar: 'Calendario',
  time: 'Time Tracking',
  team: 'Team',
  hub: 'Hub',
  workload: 'Workload',
  estimates: 'Preventivi',
  contracts: 'Contratti',
  invoices: 'Fatture',
  payments: 'Pagamenti',
  finance: 'Entrate e uscite',
  profile: 'Profilo',
  analytics: 'Analytics',
  files: 'Archivio',
  services: 'Servizi',
  settings: 'Impostazioni',
  notifications: 'Notifiche',
};

/** Breadcrumb intelligenti: il segmento id (dettagli) diventa "Dettaglio". */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);

  const crumbs = [
    { label: brandConfig.productName, to: '/' },
    ...parts.map((part, i) => {
      const to = '/' + parts.slice(0, i + 1).join('/');
      const isId = !LABELS[part] && i > 0;
      return { label: isId ? 'Dettaglio' : (LABELS[part] ?? part), to };
    }),
  ];

  return (
    <nav aria-label="Percorso" className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Fragment key={c.to}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-faint" />}
            {last ? (
              <span className="truncate font-medium text-fg">{c.label}</span>
            ) : (
              <Link to={c.to} className="shrink-0 text-fg-subtle transition-colors hover:text-fg">
                {c.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
