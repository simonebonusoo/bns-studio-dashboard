import { db, SEED_FLAG, type DemoUser } from './db';
import { uid } from '@/lib/id';
import { documentTotals } from '@/lib/finance';
import type {
  ActivityLog,
  CalendarEvent,
  Client,
  Comment,
  Company,
  Contract,
  DocItem,
  DocumentLineItem,
  Estimate,
  FileItem,
  Invoice,
  Member,
  Milestone,
  Notification,
  Opportunity,
  Organization,
  Payment,
  Project,
  Service,
  Task,
  TimeEntry,
  Transaction,
} from '@/types';
import { PIPELINE_STAGES, STAGE_PROBABILITY } from '@/types/enums';

const ORG_ID = 'org_bns';

const iso = (d: Date) => d.toISOString();
const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const pick = <T>(arr: T[], i: number): T => arr[i % arr.length];
const now = new Date();

/* ─────────────── Organizzazione ─────────────── */
const organization: Organization = {
  id: ORG_ID,
  name: 'BNS Studio',
  slug: 'bns-studio',
  currency: 'EUR',
  locale: 'it-IT',
  timezone: 'Europe/Rome',
  vat: 'IT00000000000',
  createdAt: iso(addDays(now, -400)),
};

/* ─────────────── Membri ─────────────── */
const memberSeeds: Array<Partial<Member> & { firstName: string; lastName: string; email: string; role: Member['role'] }> = [
  { firstName: 'Simone', lastName: 'Bonuso', email: 'admin@bnsstudio.demo', role: 'owner', jobTitle: 'Founder & Creative Director', collaborationType: 'founder', internalRate: 45, clientRate: 90, avatarColor: '#0f0f10' },
  { firstName: 'Marco', lastName: 'Florio', email: 'manager@bnsstudio.demo', role: 'project_manager', jobTitle: 'Project Manager', collaborationType: 'employee', internalRate: 30, clientRate: 70, avatarColor: '#3b76d6' },
  { firstName: 'Alessia', lastName: 'Conti', email: 'designer@bnsstudio.demo', role: 'designer', jobTitle: 'UI/UX Designer', collaborationType: 'freelance', internalRate: 28, clientRate: 65, avatarColor: '#b0d62e' },
  { firstName: 'Giulia', lastName: 'Romano', email: 'dev@bnsstudio.demo', role: 'developer', jobTitle: 'Frontend Developer', collaborationType: 'freelance', internalRate: 32, clientRate: 72, avatarColor: '#9b5de5' },
  { firstName: 'Luca', lastName: 'De Santis', email: 'collaborator@bnsstudio.demo', role: 'collaborator', jobTitle: 'Content Creator', collaborationType: 'occasional', internalRate: 22, clientRate: 50, avatarColor: '#e07b39' },
];

const members: Member[] = memberSeeds.map((m, i) => ({
  id: `mbr_${i + 1}`,
  organizationId: ORG_ID,
  firstName: m.firstName,
  lastName: m.lastName,
  email: m.email,
  avatarColor: m.avatarColor!,
  role: m.role,
  jobTitle: m.jobTitle!,
  skills: [],
  weeklyHours: 40,
  internalRate: m.internalRate!,
  clientRate: m.clientRate!,
  collaborationType: m.collaborationType!,
  status: 'active',
  joinedAt: iso(addDays(now, -380 + i * 20)),
  createdAt: iso(addDays(now, -380)),
  updatedAt: iso(now),
}));

/* Utenti demo (login). Password come da specifica. */
const users: DemoUser[] = [
  { id: 'usr_1', email: 'admin@bnsstudio.demo', password: 'admin1234', memberId: 'mbr_1', organizationId: ORG_ID },
  { id: 'usr_2', email: 'manager@bnsstudio.demo', password: 'manager1234', memberId: 'mbr_2', organizationId: ORG_ID },
  { id: 'usr_3', email: 'designer@bnsstudio.demo', password: 'designer1234', memberId: 'mbr_3', organizationId: ORG_ID },
  { id: 'usr_4', email: 'collaborator@bnsstudio.demo', password: 'collaborator1234', memberId: 'mbr_5', organizationId: ORG_ID },
  { id: 'usr_5', email: 'client@bnsstudio.demo', password: 'client1234', memberId: 'mbr_client', organizationId: ORG_ID },
];

/* Membro "cliente" per il portale */
members.push({
  id: 'mbr_client',
  organizationId: ORG_ID,
  firstName: 'Cliente',
  lastName: 'Demo',
  email: 'client@bnsstudio.demo',
  avatarColor: '#666',
  role: 'client',
  jobTitle: 'Referente cliente',
  skills: [],
  weeklyHours: 0,
  internalRate: 0,
  clientRate: 0,
  collaborationType: 'partner',
  status: 'active',
  joinedAt: iso(addDays(now, -120)),
  createdAt: iso(addDays(now, -120)),
  updatedAt: iso(now),
});

/* ─────────────── Aziende ─────────────── */
const companyNames = [
  ['K9 Security Academy', 'Sicurezza'],
  ['BR Service', 'Servizi'],
  ['Studio Dentistico Romeo', 'Sanità'],
  ['Kokoro Sushi Roma', 'Ristorazione'],
  ['ChemLab', 'Laboratorio'],
  ['MoveLab', 'Fitness'],
  ['Poster Collection', 'Retail'],
  ['Nova Bakery', 'Food'],
];
const companies: Company[] = companyNames.map(([name, sector], i) => ({
  id: `cmp_${i + 1}`,
  organizationId: ORG_ID,
  name,
  sector,
  size: pick(['1-10', '11-50', '50+'], i),
  website: `https://${name.toLowerCase().replace(/[^a-z]/g, '')}.it`,
  city: pick(['Roma', 'Milano', 'Napoli'], i),
  country: 'Italia',
  createdAt: iso(addDays(now, -300 + i * 10)),
  updatedAt: iso(now),
}));

/* ─────────────── Clienti ─────────────── */
const clientStatuses: Client['status'][] = ['active', 'active', 'active', 'prospect', 'active', 'lead', 'active', 'past_client', 'active', 'prospect', 'partner', 'active'];
const clients: Client[] = Array.from({ length: 12 }).map((_, i) => {
  const company = companies[i % companies.length];
  return {
    id: `cli_${i + 1}`,
    organizationId: ORG_ID,
    type: i % 4 === 0 ? 'person' : 'company',
    companyName: company.name,
    firstName: i % 4 === 0 ? pick(['Andrea', 'Sara', 'Paolo'], i) : undefined,
    lastName: i % 4 === 0 ? pick(['Bianchi', 'Verdi', 'Neri'], i) : undefined,
    displayName: i % 4 === 0 ? `${pick(['Andrea', 'Sara', 'Paolo'], i)} ${pick(['Bianchi', 'Verdi', 'Neri'], i)}` : company.name,
    email: `contatto${i + 1}@${company.name.toLowerCase().replace(/[^a-z]/g, '')}.it`,
    phone: `+39 3${(i + 1).toString().padStart(2, '0')} 000 00${i}0`,
    website: company.website,
    vat: `IT${(12345678900 + i).toString()}`,
    city: company.city,
    province: pick(['RM', 'MI', 'NA'], i),
    country: 'Italia',
    sector: company.sector,
    source: pick(['Referral', 'Instagram', 'Sito web', 'Passaparola', 'LinkedIn'], i),
    status: clientStatuses[i],
    priority: pick(['medium', 'high', 'low', 'urgent'], i) as Client['priority'],
    ownerId: pick(['mbr_1', 'mbr_2'], i),
    tags: i % 2 === 0 ? ['ricorrente'] : ['nuovo'],
    lastContactAt: iso(addDays(now, -(i * 3 + 2))),
    nextContactAt: i % 3 === 0 ? iso(addDays(now, i + 3)) : null,
    createdAt: iso(addDays(now, -200 + i * 12)),
    updatedAt: iso(now),
  };
});

/* ─────────────── Servizi ─────────────── */
const serviceSeeds = [
  ['Brand Identity', 'Branding', 2500, 'fixed', 40, '#b0d62e'],
  ['Logo Design', 'Branding', 900, 'fixed', 16, '#9b5de5'],
  ['Rebranding', 'Branding', 3500, 'fixed', 60, '#3b76d6'],
  ['Web Design', 'Web', 2200, 'fixed', 45, '#e07b39'],
  ['Sviluppo React', 'Sviluppo', 6000, 'fixed', 120, '#22a05a'],
  ['E-commerce Shopify', 'Sviluppo', 4500, 'fixed', 90, '#f24e6b'],
  ['Manutenzione sito', 'Manutenzione', 250, 'monthly', 6, '#3b76d6'],
  ['Social Media Design', 'Contenuti', 600, 'monthly', 12, '#b0d62e'],
] as const;
const services: Service[] = serviceSeeds.map(([name, category, basePrice, priceUnit, hours, color], i) => ({
  id: `svc_${i + 1}`,
  organizationId: ORG_ID,
  name,
  category,
  basePrice,
  priceUnit: priceUnit as Service['priceUnit'],
  vatRate: 22,
  estimatedHours: hours,
  internalCost: hours * 28,
  targetMargin: 45,
  active: true,
  color,
  createdAt: iso(addDays(now, -350)),
  updatedAt: iso(now),
}));

/* ─────────────── Opportunità (pipeline) ─────────────── */
const opportunities: Opportunity[] = Array.from({ length: 15 }).map((_, i) => {
  const stage = pick(PIPELINE_STAGES, i);
  return {
    id: `opp_${i + 1}`,
    organizationId: ORG_ID,
    title: `${pick(services, i).name} — ${pick(companyNames.map((c) => c[0]), i)}`,
    clientId: `cli_${(i % 12) + 1}`,
    companyId: `cmp_${(i % 8) + 1}`,
    contactName: pick(['Andrea B.', 'Sara V.', 'Paolo N.'], i),
    stage,
    value: 1200 + (i % 6) * 850,
    probability: STAGE_PROBABILITY[stage],
    serviceId: `svc_${(i % 8) + 1}`,
    source: pick(['Referral', 'Instagram', 'Sito web', 'LinkedIn'], i),
    ownerId: pick(['mbr_1', 'mbr_2'], i),
    priority: pick(['medium', 'high', 'low'], i) as Opportunity['priority'],
    expectedCloseDate: iso(addDays(now, (i % 5) * 7 + 5)),
    nextFollowUpAt: i % 2 === 0 ? iso(addDays(now, (i % 4) + 1)) : null,
    lostReason: stage === 'lost' ? pick(['Budget', 'Tempistiche', 'Concorrenza'], i) : undefined,
    tags: [],
    order: i,
    createdAt: iso(addDays(now, -60 + i * 3)),
    updatedAt: iso(now),
  };
});

/* ─────────────── Progetti ─────────────── */
const projectSeeds: Array<[string, string, Project['status'], number, number, number]> = [
  // name, clientIdx, status, contractValue, budget, estimatedHours
  ['Sito web React – BR Service', '2', 'active', 6800, 4200, 180],
  ['Brand Identity – Studio Dentistico Romeo', '3', 'active', 3500, 1900, 60],
  ['Rebranding Kokoro Sushi Roma', '4', 'review', 4200, 2400, 70],
  ['E-commerce Shopify – Poster Collection', '7', 'active', 5200, 3100, 110],
  ['Manutenzione mensile – K9 Security', '1', 'active', 3000, 1200, 72],
  ['Landing Page – MoveLab', '6', 'completed', 1800, 900, 32],
  ['Logo Design – Nova Bakery', '8', 'completed', 900, 420, 16],
  ['Sito istituzionale – ChemLab', '5', 'planned', 5800, 3400, 130],
  ['Social Package – Kokoro Sushi', '4', 'active', 2400, 1100, 48],
  ['Poster Commission – Portfolio', '11', 'paused', 1200, 500, 24],
];
const healthByStatus: Record<string, Project['health']> = {
  active: 'on_track',
  review: 'attention',
  completed: 'on_track',
  planned: 'on_track',
  paused: 'at_risk',
};
const projects: Project[] = projectSeeds.map(([name, clientIdx, status, contractValue, budget, estimatedHours], i) => ({
  id: `prj_${i + 1}`,
  organizationId: ORG_ID,
  code: `PRJ-2026-${(i + 1).toString().padStart(3, '0')}`,
  name,
  description: `${name}. Progetto gestito da BNS Studio.`,
  clientId: `cli_${clientIdx}`,
  companyId: `cmp_${((i) % 8) + 1}`,
  managerId: pick(['mbr_1', 'mbr_2'], i),
  memberIds: ['mbr_1', pick(['mbr_3', 'mbr_4', 'mbr_5'], i)],
  serviceId: `svc_${(i % 8) + 1}`,
  status,
  priority: pick(['high', 'medium', 'low', 'urgent'], i) as Project['priority'],
  health: healthByStatus[status] ?? 'on_track',
  startDate: iso(addDays(now, -40 - i * 5)),
  dueDate: iso(addDays(now, status === 'completed' ? -(i + 1) : 30 - i * 2)),
  completedAt: status === 'completed' ? iso(addDays(now, -(i + 1))) : null,
  contractValue,
  budget,
  estimatedHours,
  targetMargin: 45,
  progress: status === 'completed' ? 100 : 20 + i * 7,
  color: pick(['#b0d62e', '#9b5de5', '#3b76d6', '#e07b39', '#22a05a'], i),
  tags: [],
  createdAt: iso(addDays(now, -45 - i * 5)),
  updatedAt: iso(now),
}));

/* ─────────────── Milestone ─────────────── */
const milestones: Milestone[] = [];
projects.forEach((p, pi) => {
  const titles = ['Kickoff e analisi', 'Design UI/UX', 'Sviluppo', 'Testing & QA', 'Consegna finale'];
  const count = 3 + (pi % 3);
  for (let m = 0; m < count; m++) {
    const done = p.progress > (m + 1) * (100 / count);
    milestones.push({
      id: `ms_${pi + 1}_${m + 1}`,
      organizationId: ORG_ID,
      projectId: p.id,
      title: titles[m % titles.length],
      status: done ? 'completed' : m === 0 ? 'active' : 'planned',
      dueDate: iso(addDays(now, -20 + m * 12 + pi)),
      completedAt: done ? iso(addDays(now, -18 + m * 12)) : null,
      clientVisible: m === titles.length - 1,
      order: m,
      createdAt: iso(addDays(now, -45)),
      updatedAt: iso(now),
    });
  }
});

/* ─────────────── Task ─────────────── */
const taskStatuses: Task['status'][] = ['backlog', 'todo', 'in_progress', 'internal_review', 'client_review', 'completed', 'blocked'];
const taskTitles = ['Wireframe', 'Moodboard', 'UI design', 'Implementazione header', 'Sezione servizi', 'Integrazione CMS', 'Revisione contenuti', 'Ottimizzazione SEO', 'Test responsive', 'Consegna assets', 'Setup analytics', 'Bug fixing'];
const tasks: Task[] = [];
projects.forEach((p, pi) => {
  const count = 5 + (pi % 4);
  for (let t = 0; t < count; t++) {
    const status = p.status === 'completed' ? 'completed' : pick(taskStatuses, pi + t);
    tasks.push({
      id: `tsk_${pi + 1}_${t + 1}`,
      organizationId: ORG_ID,
      projectId: p.id,
      milestoneId: milestones.find((m) => m.projectId === p.id)?.id ?? null,
      title: pick(taskTitles, pi + t),
      description: '',
      status,
      priority: pick(['medium', 'high', 'low', 'urgent'], t) as Task['priority'],
      assigneeIds: [pick(['mbr_3', 'mbr_4', 'mbr_5', 'mbr_2'], pi + t)],
      startDate: iso(addDays(now, -20 + t)),
      dueDate: iso(addDays(now, (t % 6) - 2 + pi)),
      estimatedHours: 4 + (t % 5) * 2,
      clientVisible: status === 'client_review',
      completedAt: status === 'completed' ? iso(addDays(now, -(t + 1))) : null,
      order: t,
      tags: [],
      createdAt: iso(addDays(now, -30 + t)),
      updatedAt: iso(now),
    });
  }
});

/* ─────────────── Time entries ─────────────── */
const timeEntries: TimeEntry[] = [];
for (let i = 0; i < 60; i++) {
  const p = pick(projects, i);
  const member = pick(members.filter((m) => m.role !== 'client'), i);
  const d = addDays(now, -(i % 30));
  const minutes = 30 + (i % 8) * 45;
  timeEntries.push({
    id: `te_${i + 1}`,
    organizationId: ORG_ID,
    memberId: member.id,
    projectId: p.id,
    taskId: tasks.find((t) => t.projectId === p.id)?.id ?? null,
    clientId: p.clientId,
    description: pick(['Design', 'Sviluppo', 'Revisione', 'Call cliente', 'Setup'], i),
    date: day(d),
    startedAt: iso(d),
    durationMinutes: minutes,
    billable: i % 4 !== 0,
    hourlyRate: member.clientRate,
    internalCost: member.internalRate,
    approved: i % 3 === 0,
    running: false,
    createdAt: iso(d),
    updatedAt: iso(now),
  });
}

/* ─────────────── Preventivi ─────────────── */
const makeItems = (svcIdx: number, qty = 1): DocumentLineItem[] => {
  const svc = services[svcIdx % services.length];
  return [
    { id: uid(), serviceId: svc.id, description: svc.name, quantity: qty, unit: svc.priceUnit, unitPrice: svc.basePrice, discountPct: 0, vatRate: 22 },
  ];
};
const estimates: Estimate[] = Array.from({ length: 10 }).map((_, i) => {
  const status = pick<Estimate['status']>(['draft', 'sent', 'accepted', 'accepted', 'rejected', 'viewed', 'sent', 'accepted', 'expired', 'draft'], i);
  return {
    id: `est_${i + 1}`,
    organizationId: ORG_ID,
    number: `PREV-2026-${(i + 1).toString().padStart(4, '0')}`,
    version: 1,
    clientId: `cli_${(i % 12) + 1}`,
    opportunityId: `opp_${(i % 15) + 1}`,
    status,
    currency: 'EUR',
    issueDate: day(addDays(now, -30 + i * 2)),
    expiryDate: day(addDays(now, 15 + i)),
    items: makeItems(i, 1 + (i % 2)),
    globalDiscountPct: i % 3 === 0 ? 5 : 0,
    depositPct: 30,
    notes: 'Preventivo dimostrativo BNS Studio.',
    acceptedAt: status === 'accepted' ? iso(addDays(now, -10 + i)) : null,
    rejectedReason: status === 'rejected' ? 'Budget non compatibile' : undefined,
    createdAt: iso(addDays(now, -30 + i * 2)),
    updatedAt: iso(now),
  };
});

/* ─────────────── Fatture ─────────────── */
const invoices: Invoice[] = Array.from({ length: 12 }).map((_, i) => {
  const status = pick<Invoice['status']>(['paid', 'paid', 'sent', 'partially_paid', 'overdue', 'paid', 'issued', 'paid', 'sent', 'overdue', 'paid', 'draft'], i);
  return {
    id: `inv_${i + 1}`,
    organizationId: ORG_ID,
    number: `FAT-2026-${(i + 1).toString().padStart(4, '0')}`,
    clientId: `cli_${(i % 12) + 1}`,
    projectId: `prj_${(i % 10) + 1}`,
    estimateId: `est_${(i % 10) + 1}`,
    status,
    currency: 'EUR',
    issueDate: day(addDays(now, -150 + i * 12)),
    dueDate: day(addDays(now, -150 + i * 12 + 30)),
    items: makeItems(i, 1),
    globalDiscountPct: 0,
    withholdingPct: 0,
    paymentMethod: 'bank_transfer',
    createdAt: iso(addDays(now, -150 + i * 12)),
    updatedAt: iso(now),
  };
});

/* ─────────────── Pagamenti ─────────────── */
const payments: Payment[] = [];
invoices.forEach((inv, i) => {
  const total = documentTotals(inv.items, { globalDiscountPct: inv.globalDiscountPct }).total;
  if (inv.status === 'paid') {
    payments.push(mkPayment(inv, total, i, 0));
  } else if (inv.status === 'partially_paid') {
    payments.push(mkPayment(inv, Math.round(total * 0.4), i, 0));
  }
});
// pagamenti extra per raggiungere ~15
for (let i = payments.length; i < 15; i++) {
  const inv = invoices[i % invoices.length];
  const total = documentTotals(inv.items, { globalDiscountPct: inv.globalDiscountPct }).total;
  payments.push(mkPayment(inv, Math.round(total * 0.2), i, 5));
}
function mkPayment(inv: Invoice, amount: number, i: number, offset: number): Payment {
  return {
    id: `pay_${i + 1}_${offset}`,
    organizationId: ORG_ID,
    clientId: inv.clientId,
    invoiceId: inv.id,
    projectId: inv.projectId,
    amount,
    currency: 'EUR',
    date: day(addDays(now, -140 + i * 12 + offset)),
    method: 'bank_transfer',
    reference: `BON-${1000 + i}`,
    status: 'completed',
    createdAt: iso(addDays(now, -140 + i * 12)),
    updatedAt: iso(now),
  };
}

/* ─────────────── Movimenti economici ─────────────── */
const expenseCats = ['Software', 'Hosting', 'Advertising', 'Collaboratori', 'Attrezzatura', 'Formazione', 'Commissioni', 'Spese generali'];
const transactions: Transaction[] = [];
// entrate = mappate dai pagamenti completati
payments.forEach((p, i) => {
  transactions.push({
    id: `trx_in_${i + 1}`,
    organizationId: ORG_ID,
    type: 'income',
    category: 'Pagamento cliente',
    description: `Incasso fattura`,
    amount: p.amount,
    currency: 'EUR',
    date: p.date,
    clientId: p.clientId,
    projectId: p.projectId,
    method: 'bank_transfer',
    createdAt: p.createdAt,
    updatedAt: iso(now),
  });
});
// uscite su 6 mesi
for (let i = 0; i < 18; i++) {
  transactions.push({
    id: `trx_out_${i + 1}`,
    organizationId: ORG_ID,
    type: 'expense',
    category: pick(expenseCats, i),
    description: `${pick(expenseCats, i)} — costo ricorrente`,
    amount: 80 + (i % 6) * 120,
    currency: 'EUR',
    date: day(addDays(now, -(i * 10))),
    vendor: pick(['Adobe', 'Vercel', 'Meta', 'Freelance', 'Apple'], i),
    method: 'card',
    createdAt: iso(addDays(now, -(i * 10))),
    updatedAt: iso(now),
  });
}

/* ─────────────── Contratti ─────────────── */
const contracts: Contract[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `ctr_${i + 1}`,
  organizationId: ORG_ID,
  number: `CTR-2026-${(i + 1).toString().padStart(3, '0')}`,
  title: `Contratto ${projects[i].name}`,
  clientId: projects[i].clientId,
  projectId: projects[i].id,
  estimateId: `est_${i + 1}`,
  type: pick(['single_project', 'maintenance', 'retainer', 'software', 'collaboration'], i) as Contract['type'],
  status: pick(['active', 'active', 'awaiting_signature', 'draft', 'active'], i) as Contract['status'],
  value: projects[i].contractValue,
  startDate: iso(addDays(now, -40 + i * 5)),
  endDate: iso(addDays(now, 120 + i * 10)),
  signedByClient: i % 2 === 0,
  signedByStudio: true,
  createdAt: iso(addDays(now, -42)),
  updatedAt: iso(now),
}));

/* ─────────────── File ─────────────── */
const files: FileItem[] = Array.from({ length: 25 }).map((_, i) => ({
  id: `file_${i + 1}`,
  organizationId: ORG_ID,
  name: pick(['homepage_v2.fig', 'logo_variant.png', 'brief.pdf', 'moodboard.jpg', 'export.zip'], i),
  mime: pick(['image/png', 'application/pdf', 'image/jpeg', 'application/zip'], i),
  size: 120_000 + i * 45_000,
  projectId: `prj_${(i % 10) + 1}`,
  clientId: projects[i % 10].clientId,
  folder: pick(['Design', 'Documenti', 'Export'], i),
  clientVisible: i % 3 === 0,
  uploadedBy: pick(['mbr_1', 'mbr_3', 'mbr_4'], i),
  tags: [],
  createdAt: iso(addDays(now, -(i % 20))),
  updatedAt: iso(now),
}));

/* ─────────────── Eventi calendario ─────────────── */
const events: CalendarEvent[] = Array.from({ length: 25 }).map((_, i) => {
  const start = addDays(now, (i % 20) - 5);
  start.setHours(9 + (i % 8), 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    id: `evt_${i + 1}`,
    organizationId: ORG_ID,
    title: pick(['Call cliente', 'Revisione UI/UX', 'Kickoff progetto', 'Follow-up lead', 'Consegna brief', 'Riunione team'], i),
    type: pick(['client_call', 'meeting', 'milestone', 'lead_followup', 'project_deadline'], i) as CalendarEvent['type'],
    start: iso(start),
    end: iso(end),
    allDay: false,
    projectId: `prj_${(i % 10) + 1}`,
    clientId: projects[i % 10].clientId,
    createdAt: iso(now),
    updatedAt: iso(now),
  };
});

/* ─────────────── Notifiche ─────────────── */
const notifications: Notification[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `ntf_${i + 1}`,
  organizationId: ORG_ID,
  userId: 'mbr_1',
  type: pick(['task_assigned', 'comment', 'payment_recorded', 'estimate_accepted', 'invoice_overdue', 'milestone_soon', 'lead_followup'], i) as Notification['type'],
  title: pick(['Nuovo task assegnato', 'Nuovo commento', 'Pagamento registrato', 'Preventivo accettato', 'Fattura scaduta', 'Milestone imminente', 'Lead da ricontattare'], i),
  body: 'Aggiornamento dallo studio.',
  read: i > 6,
  createdAt: iso(addDays(now, -(i % 10))),
  updatedAt: iso(now),
}));

/* ─────────────── Commenti ─────────────── */
const comments: Comment[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `cmt_${i + 1}`,
  organizationId: ORG_ID,
  entityType: 'project',
  entityId: `prj_${(i % 10) + 1}`,
  authorId: pick(['mbr_1', 'mbr_2', 'mbr_3'], i),
  content: pick(['Ottimo lavoro sul design.', 'Serve una revisione della homepage.', 'Cliente ha approvato la milestone.', 'Aggiornati i contenuti.'], i),
  visibility: i % 3 === 0 ? 'client' : 'internal',
  edited: false,
  createdAt: iso(addDays(now, -(i % 8))),
  updatedAt: iso(now),
}));

/* ─────────────── Activity log ─────────────── */
const activityLogs: ActivityLog[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `log_${i + 1}`,
  organizationId: ORG_ID,
  actorId: pick(['mbr_1', 'mbr_2', 'mbr_3', 'mbr_4'], i),
  action: pick(['create', 'update', 'status_change', 'assign', 'file_upload', 'payment', 'approve'], i),
  entityType: pick(['project', 'task', 'invoice', 'client', 'estimate', 'payment'], i),
  entityId: `prj_${(i % 10) + 1}`,
  metadata: {},
  createdAt: iso(addDays(now, -(i % 20)) ),
  updatedAt: iso(now),
}));

/* ─────────────── Documenti ─────────────── */
const documents: DocItem[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `doc_${i + 1}`,
  organizationId: ORG_ID,
  title: pick(['Brief cliente', 'Kickoff progetto', 'Brand discovery', 'Checklist consegna', 'Note riunione'], i),
  type: pick(['brief', 'kickoff', 'guidelines', 'checklist', 'note'], i),
  content: '<h2>Documento demo</h2><p>Contenuto redatto in BNS Studio OS.</p>',
  projectId: `prj_${(i % 10) + 1}`,
  clientId: projects[i % 10].clientId,
  tags: [],
  authorId: 'mbr_1',
  createdAt: iso(addDays(now, -(i * 4))),
  updatedAt: iso(now),
}));

/** Popola il database demo (idempotente). */
export async function seedDatabase(force = false): Promise<void> {
  const flag = await db.meta.get(SEED_FLAG);
  if (flag && !force) return;

  await db.transaction(
    'rw',
    [
      db.users, db.organizations, db.members, db.companies, db.clients, db.opportunities,
      db.services, db.projects, db.milestones, db.tasks, db.timeEntries, db.estimates,
      db.invoices, db.payments, db.transactions, db.contracts, db.files, db.events,
      db.comments, db.notifications, db.activityLogs, db.documents, db.meta,
    ],
    async () => {
      await Promise.all([
        db.users.clear(), db.organizations.clear(), db.members.clear(), db.companies.clear(),
        db.clients.clear(), db.opportunities.clear(), db.services.clear(), db.projects.clear(),
        db.milestones.clear(), db.tasks.clear(), db.timeEntries.clear(), db.estimates.clear(),
        db.invoices.clear(), db.payments.clear(), db.transactions.clear(), db.contracts.clear(),
        db.files.clear(), db.events.clear(), db.comments.clear(), db.notifications.clear(),
        db.activityLogs.clear(), db.documents.clear(),
      ]);

      await db.users.bulkAdd(users);
      await db.organizations.add(organization);
      await db.members.bulkAdd(members);
      await db.companies.bulkAdd(companies);
      await db.clients.bulkAdd(clients);
      await db.opportunities.bulkAdd(opportunities);
      await db.services.bulkAdd(services);
      await db.projects.bulkAdd(projects);
      await db.milestones.bulkAdd(milestones);
      await db.tasks.bulkAdd(tasks);
      await db.timeEntries.bulkAdd(timeEntries);
      await db.estimates.bulkAdd(estimates);
      await db.invoices.bulkAdd(invoices);
      await db.payments.bulkAdd(payments);
      await db.transactions.bulkAdd(transactions);
      await db.contracts.bulkAdd(contracts);
      await db.files.bulkAdd(files);
      await db.events.bulkAdd(events);
      await db.comments.bulkAdd(comments);
      await db.notifications.bulkAdd(notifications);
      await db.activityLogs.bulkAdd(activityLogs);
      await db.documents.bulkAdd(documents);
      await db.meta.put({ key: SEED_FLAG, value: true });
    },
  );
}

/** Ripristina i dati demo cancellando tutto e riseminando. */
export async function resetDemo(): Promise<void> {
  await seedDatabase(true);
}

export const ORGANIZATION_ID = ORG_ID;
