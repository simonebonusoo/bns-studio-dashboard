import { z } from 'zod';

export const clientSchema = z.object({
  type: z.enum(['person', 'company']),
  displayName: z.string().min(1, 'Nome obbligatorio'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  vat: z.string().optional(),
  city: z.string().optional(),
  sector: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['lead', 'prospect', 'active', 'inactive', 'past_client', 'partner', 'archived']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  notes: z.string().optional(),
});
export type ClientForm = z.infer<typeof clientSchema>;

export const projectSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  clientId: z.string().optional(),
  serviceId: z.string().optional(),
  status: z.enum(['lead', 'draft', 'planned', 'active', 'waiting_client', 'review', 'paused', 'completed', 'cancelled', 'archived']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  contractValue: z.coerce.number().min(0),
  budget: z.coerce.number().min(0),
  estimatedHours: z.coerce.number().min(0),
  dueDate: z.string().optional(),
  description: z.string().optional(),
});
export type ProjectForm = z.infer<typeof projectSchema>;
