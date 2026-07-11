import {
  LayoutDashboard,
  Users,
  Briefcase,
  ListChecks,
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
  Settings,
  Target,
  Package,
  GitBranch,
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
    label: 'CRM',
    items: [
      { label: 'Pipeline', to: '/pipeline', icon: GitBranch, permission: 'leads.read' },
      { label: 'Clienti', to: '/clients', icon: Users, permission: 'clients.read' },
      { label: 'Opportunità', to: '/leads', icon: Target, permission: 'leads.read' },
    ],
  },
  {
    label: 'Lavoro',
    items: [
      { label: 'Progetti', to: '/projects', icon: Briefcase, permission: 'projects.read' },
      { label: 'Task', to: '/tasks', icon: ListChecks, permission: 'tasks.read' },
      { label: 'Calendario', to: '/calendar', icon: Calendar },
      { label: 'Time Tracking', to: '/time', icon: Clock, permission: 'time.log' },
    ],
  },
  {
    label: 'Team',
    items: [{ label: 'Membri', to: '/team', icon: UsersRound, permission: 'team.read' }],
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
    label: 'Analytics',
    items: [{ label: 'Panoramica', to: '/analytics', icon: BarChart3, permission: 'finances.read' }],
  },
  {
    label: 'Risorse',
    items: [
      { label: 'File', to: '/files', icon: FolderOpen, permission: 'files.read' },
      { label: 'Servizi', to: '/services', icon: Package },
    ],
  },
  {
    items: [{ label: 'Impostazioni', to: '/settings', icon: Settings }],
  },
];
