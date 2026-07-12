import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Clock,
  UsersRound,
  FileText,
  FileSignature,
  Receipt,
  CreditCard,
  ArrowLeftRight,
  BarChart3,
  FolderOpen,
  FileUp,
  Settings,
  Package,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/features/auth/permissions';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: Permission;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Clienti',
    items: [
      { label: 'Clienti', to: '/clients', icon: Users, permission: 'clients.read' },
    ],
  },
  {
    label: 'Lavoro',
    items: [
      { label: 'Progetti', to: '/projects', icon: Briefcase, permission: 'projects.read' },
      { label: 'Calendario', to: '/calendar', icon: Calendar },
      { label: 'Time Tracking', to: '/time', icon: Clock, permission: 'time.log' },
    ],
  },
  {
    label: 'Team',
    items: [
      { label: 'Membri', to: '/team', icon: UsersRound, permission: 'team.read' },
      { label: 'Hub', to: '/hub', icon: Gauge, permission: 'team.read' },
    ],
  },
  {
    label: 'Finanze',
    items: [
      { label: 'Preventivi', to: '/estimates', icon: FileText, permission: 'estimates.read' },
      { label: 'Contratti', to: '/contracts', icon: FileSignature, permission: 'estimates.read' },
      { label: 'Fatture', to: '/invoices', icon: Receipt, permission: 'invoices.read' },
      { label: 'Pagamenti', to: '/payments', icon: CreditCard, permission: 'finances.read' },
      { label: 'Entrate e uscite', to: '/finance', icon: ArrowLeftRight, permission: 'finances.read' },
    ],
  },
  {
    items: [{ label: 'Analytics', to: '/analytics', icon: BarChart3, permission: 'finances.read' }],
  },
  {
    label: 'Risorse',
    items: [
      { label: 'File', to: '/files', icon: FolderOpen, permission: 'files.read' },
      { label: 'Importa Markdown', to: '/import', icon: FileUp, permission: 'imports.manage' },
      { label: 'Servizi', to: '/services', icon: Package },
    ],
  },
  {
    items: [{ label: 'Impostazioni', to: '/settings', icon: Settings }],
  },
];
