import { repositories } from '@/services/repository';
import type { Client, Estimate, Invoice, Project } from '@/types';

export interface SearchEntity {
  id: string;
  label: string;
  section: string;
  to: string;
}

export async function loadCommandPaletteEntities(): Promise<SearchEntity[]> {
  const [clients, projects, invoices, estimates] = await Promise.all([
    repositories.clients.list() as Promise<Client[]>,
    repositories.projects.list() as Promise<Project[]>,
    repositories.invoices.list() as Promise<Invoice[]>,
    repositories.estimates.list() as Promise<Estimate[]>,
  ]);

  return [
    ...clients.map((client) => ({
      id: client.id,
      label: client.displayName,
      section: 'Clienti',
      to: `/clients/${client.id}`,
    })),
    ...projects.map((project) => ({
      id: project.id,
      label: `${project.code} · ${project.name}`,
      section: 'Progetti',
      to: `/projects/${project.id}`,
    })),
    ...invoices.map((invoice) => ({
      id: invoice.id,
      label: invoice.number,
      section: 'Fatture',
      to: `/invoices/${invoice.id}`,
    })),
    ...estimates.map((estimate) => ({
      id: estimate.id,
      label: estimate.number,
      section: 'Preventivi',
      to: `/estimates/${estimate.id}`,
    })),
  ];
}
