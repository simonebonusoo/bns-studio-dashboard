import { jsPDF } from 'jspdf';
import { brandConfig } from '@/config/brandConfig';
import { documentTotals, lineTotals, round2 } from '@/lib/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Client, Estimate } from '@/types';

/**
 * Generatore del "PDF BnsStudio": un preventivo impaginato in stile presentazione
 * (copertina, chi siamo, cosa comprende, team, valore, offerta, pagamento, chiusura),
 * ispirato al modello commerciale dello studio. I contenuti istituzionali sono fissi,
 * mentre le parti variabili vengono derivate dai dati del preventivo o passate come
 * opzioni dal dialog di generazione (modello "ibrido").
 */

export interface BnsPdfOptions {
  /** Titolo del progetto in copertina (es. "Sito web + Brand Identity per K9 PRO"). */
  projectTitle: string;
  /** Sottotitolo/kicker sopra al titolo (opzionale). */
  subtitle?: string;
  /** Obiettivo del progetto (paragrafo). */
  objective?: string;
  /** Prezzo riservato del pacchetto (offerta). Default = totale documento. */
  reservedPrice: number;
  /** Numero di rate del piano di pagamento. */
  installmentsCount: number;
  /** Validità del preventivo in mesi (per la riga in copertina). */
  validityMonths: number;
}

const TEAM = [
  {
    name: 'Simone Bonuso',
    role: 'Direzione creativa & UI',
    skills: [
      'Frontend Development',
      'UI Design',
      'UX Design',
      'Brand Identity',
      'Logo & Graphic Design',
      'Comunicazione visiva',
    ],
  },
  {
    name: 'Andrea Brandolini',
    role: 'Sviluppo & Infrastruttura',
    skills: [
      'Backend Development',
      'Database Design',
      'Software Architecture',
      'Gestione dati',
      'Infrastruttura & sistemi',
      'Stabilità della piattaforma',
    ],
  },
];

// ---- Palette e costanti di layout -----------------------------------------
const INK = '#0f0f10';
const LIME = '#c8f135';
const PAPER = '#ffffff';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const HAIR = '#e5e7eb';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Calcola il piano rate: prima rata più alta se presente un acconto. */
function buildInstallments(total: number, count: number, depositPct?: number) {
  const n = Math.max(1, Math.min(12, Math.floor(count || 1)));
  if (n === 1) return [{ label: 'Rata unica', amount: round2(total) }];

  const deposit = depositPct ? round2(total * (depositPct / 100)) : 0;
  const rates: { label: string; amount: number }[] = [];
  if (deposit > 0 && deposit < total) {
    const rest = round2(total - deposit);
    const each = round2(rest / (n - 1));
    rates.push({ label: 'Prima rata (acconto)', amount: deposit });
    for (let i = 1; i < n; i++) {
      const amount = i === n - 1 ? round2(rest - each * (n - 2)) : each;
      rates.push({ label: `${ordinal(i + 1)} rata`, amount });
    }
  } else {
    const each = round2(total / n);
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(total - each * (n - 1)) : each;
      rates.push({ label: `${ordinal(i + 1)} rata`, amount });
    }
  }
  return rates;
}

function ordinal(i: number) {
  return ['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta', 'Sesta', 'Settima', 'Ottava', 'Nona', 'Decima', 'Undicesima', 'Dodicesima'][i - 1] ?? `${i}ª`;
}

export function bnsPdfDefaults(estimate: Estimate, client?: Client | null): BnsPdfOptions {
  const totals = documentTotals(estimate.items, {
    globalDiscountPct: estimate.globalDiscountPct,
    depositPct: estimate.depositPct,
  });
  const clientName = client?.displayName?.trim();
  return {
    projectTitle: clientName ? `Progetto per ${clientName}` : `Preventivo ${estimate.number}`,
    subtitle: 'Preventivo completo',
    objective:
      'Dotare il progetto di una presenza digitale moderna, elegante e immediatamente riconoscibile, capace di trasmettere competenza e generare valore concreto nel tempo.',
    // Imponibile dopo lo sconto globale: coerente col "valore reale" (imponibile
    // pieno) mostrato nella pagina offerta, così il prezzo riservato risulta ≤.
    reservedPrice: totals.taxable,
    installmentsCount: 3,
    validityMonths: 3,
  };
}

export function bnsEstimatePdfBlob(
  estimate: Estimate,
  client: Client | null | undefined,
  options: BnsPdfOptions,
): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totals = documentTotals(estimate.items, {
    globalDiscountPct: estimate.globalDiscountPct,
    depositPct: estimate.depositPct,
  });
  const clientName = client?.displayName?.trim() || 'Cliente';
  const footerLabel = `Preventivo · ${clientName}`;

  // --- Helper di disegno ----------------------------------------------------
  const fill = (hex: string) => doc.setFillColor(...rgb(hex));
  const ink = (hex: string) => doc.setTextColor(...rgb(hex));
  const stroke = (hex: string) => doc.setDrawColor(...rgb(hex));
  const font = (weight: 'normal' | 'bold' = 'normal') => doc.setFont('helvetica', weight);

  /** Riempie l'intera pagina con un colore di sfondo. */
  const pageBg = (hex: string) => {
    fill(hex);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  };

  /** Kicker in maiuscoletto con barretta lime. */
  const sectionLabel = (text: string, y: number) => {
    fill(LIME);
    doc.rect(MARGIN, y - 3.5, 8, 2.4, 'F');
    ink(INK);
    font('bold');
    doc.setFontSize(9);
    doc.text(text.toUpperCase(), MARGIN + 11, y);
  };

  /** Footer standard delle pagine chiare. */
  let pageNo = 0;
  const footer = () => {
    pageNo += 1;
    ink(FAINT);
    font('normal');
    doc.setFontSize(7.5);
    doc.text(footerLabel, MARGIN, PAGE_H - 10);
    font('bold');
    ink(INK);
    doc.text('bns', PAGE_W / 2 - 6, PAGE_H - 10);
    ink(FAINT);
    doc.text('STUDIO', PAGE_W / 2 - 0.5, PAGE_H - 10);
    font('normal');
    doc.text(`Pag. ${String(pageNo).padStart(2, '0')}`, PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' });
  };

  /** Scrive un paragrafo giustificato a sinistra, ritorna la nuova y. */
  const paragraph = (text: string, x: number, y: number, width: number, size = 10.5, lh = 5.6, color = MUTED) => {
    ink(color);
    font('normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    doc.text(lines, x, y);
    return y + lines.length * lh;
  };

  // ========================================================================
  // PAGINA 1 — COPERTINA
  // ========================================================================
  pageBg(INK);
  // wordmark in alto
  font('bold');
  doc.setFontSize(12);
  ink(PAPER);
  doc.text('bns', MARGIN, 24);
  ink(LIME);
  doc.text('STUDIO', MARGIN + 9.5, 24);

  // kicker
  ink(FAINT);
  font('normal');
  doc.setFontSize(10);
  const kicker = (options.subtitle || 'Preventivo completo').toUpperCase();
  doc.text(kicker, MARGIN, 120);

  // titolo progetto
  ink(PAPER);
  font('bold');
  doc.setFontSize(30);
  const titleLines = doc.splitTextToSize(options.projectTitle, CONTENT_W) as string[];
  doc.text(titleLines, MARGIN, 134);
  let cy = 134 + titleLines.length * 12;

  // "PREVENTIVO" grande in lime
  ink(LIME);
  doc.setFontSize(46);
  doc.text('PREVENTIVO', MARGIN, cy + 14);

  // barra lime decorativa
  fill(LIME);
  doc.rect(MARGIN, cy + 22, 60, 1.5, 'F');

  // validità in basso
  ink(FAINT);
  font('normal');
  doc.setFontSize(10);
  doc.text(
    `Valido ${options.validityMonths} mesi a partire dal ${formatDate(estimate.issueDate)}`,
    MARGIN,
    PAGE_H - 24,
  );
  doc.text(`N. ${estimate.number}`, PAGE_W - MARGIN, PAGE_H - 24, { align: 'right' });

  // ========================================================================
  // PAGINA 2 — CHI SIAMO + OBIETTIVO
  // ========================================================================
  doc.addPage();
  pageBg(PAPER);
  sectionLabel('Chi siamo', 40);
  let y = 52;
  ink(INK);
  font('bold');
  doc.setFontSize(20);
  doc.text(`${brandConfig.name}`, MARGIN, y);
  y += 10;
  y = paragraph(
    'BnsStudio è uno studio creativo specializzato nella costruzione di identità digitali complete. Uniamo design, strategia e cura ai dettagli per offrire ai nostri partner una presenza digitale coerente e riconoscibile.',
    MARGIN,
    y,
    CONTENT_W,
  );
  y += 3;
  y = paragraph(
    'Non realizziamo semplici siti web: progettiamo esperienze digitali. Ogni progetto nasce su misura, partendo da persone reali e obiettivi concreti.',
    MARGIN,
    y,
    CONTENT_W,
  );

  y += 14;
  sectionLabel("L'obiettivo del progetto", y);
  y += 12;
  paragraph(
    options.objective ||
      'Dotare il progetto di una presenza digitale moderna, elegante e riconoscibile, capace di trasmettere competenza e generare valore concreto nel tempo.',
    MARGIN,
    y,
    CONTENT_W,
    11,
    6,
    INK,
  );
  footer();

  // ========================================================================
  // PAGINA 3 — COSA COMPRENDE IL PREVENTIVO
  // ========================================================================
  doc.addPage();
  pageBg(PAPER);
  sectionLabel('Cosa comprende il preventivo', 40);
  y = 56;
  const items: Estimate['items'] = estimate.items.length
    ? estimate.items
    : [{ id: '0', description: 'Servizio', quantity: 1, unit: 'fixed', unitPrice: 0, discountPct: 0, vatRate: 0 }];
  const colW = (CONTENT_W - 8) / 2;
  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = MARGIN + col * (colW + 8);
    const by = y + row * 34;
    // numero
    ink(LIME);
    font('bold');
    doc.setFontSize(9);
    fill(INK);
    doc.rect(bx, by - 5, 9, 6.5, 'F');
    ink(LIME);
    doc.text(String(i + 1).padStart(2, '0'), bx + 4.5, by, { align: 'center' });
    // titolo servizio
    ink(INK);
    font('bold');
    doc.setFontSize(11);
    const t = doc.splitTextToSize(item.description || 'Servizio', colW - 14) as string[];
    doc.text(t, bx + 13, by);
    // valore riga
    ink(MUTED);
    font('normal');
    doc.setFontSize(9);
    const net = lineTotals(item).net;
    if (net > 0) doc.text(formatCurrency(net), bx + 13, by + t.length * 5 + 2);
  });
  footer();

  // ========================================================================
  // PAGINA 4 — IL TEAM
  // ========================================================================
  doc.addPage();
  pageBg(PAPER);
  sectionLabel('Il team dietro al progetto', 40);
  y = 54;
  paragraph(
    'Un team dedicato, con competenze complementari e un unico obiettivo: realizzare un progetto all’altezza della vostra identità.',
    MARGIN,
    y,
    CONTENT_W,
  );
  y += 16;
  const teamColW = (CONTENT_W - 10) / 2;
  TEAM.forEach((member, i) => {
    const bx = MARGIN + i * (teamColW + 10);
    stroke(HAIR);
    fill(PAPER);
    doc.roundedRect(bx, y, teamColW, 92, 3, 3, 'S');
    // avatar placeholder
    fill(INK);
    doc.circle(bx + 12, y + 15, 6, 'F');
    ink(LIME);
    font('bold');
    doc.setFontSize(9);
    const initials = member.name.split(' ').map((p) => p[0]).join('');
    doc.text(initials, bx + 12, y + 16.5, { align: 'center' });
    // nome + ruolo
    ink(INK);
    doc.setFontSize(12);
    doc.text(member.name, bx + 22, y + 13);
    ink(MUTED);
    font('normal');
    doc.setFontSize(8.5);
    doc.text(member.role.toUpperCase(), bx + 22, y + 18.5);
    // skills
    let sy = y + 30;
    member.skills.forEach((skill) => {
      fill(LIME);
      doc.rect(bx + 8, sy - 1.6, 2, 2, 'F');
      ink(INK);
      font('normal');
      doc.setFontSize(9.5);
      doc.text(skill, bx + 13, sy);
      sy += 8.4;
    });
  });
  footer();

  // ========================================================================
  // PAGINA 5 — COME NASCE IL VALORE
  // ========================================================================
  doc.addPage();
  pageBg(PAPER);
  sectionLabel('Come nasce il valore', 40);
  y = 58;
  ink(MUTED);
  font('normal');
  doc.setFontSize(10);
  y = paragraph('Il dettaglio delle attività previste e del relativo valore.', MARGIN, y, CONTENT_W);
  y += 6;
  items.forEach((item) => {
    const net = lineTotals(item).net;
    stroke(HAIR);
    doc.line(MARGIN, y + 3, PAGE_W - MARGIN, y + 3);
    ink(INK);
    font('normal');
    doc.setFontSize(10.5);
    const label = doc.splitTextToSize(item.description || 'Servizio', CONTENT_W - 40) as string[];
    doc.text(label, MARGIN, y);
    font('bold');
    doc.text(net > 0 ? formatCurrency(net) : '—', PAGE_W - MARGIN, y, { align: 'right' });
    y += Math.max(label.length * 5.4, 9) + 3;
  });
  // valore complessivo
  y += 6;
  fill(INK);
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 3, 3, 'F');
  ink(PAPER);
  font('normal');
  doc.setFontSize(9);
  doc.text('VALORE COMPLESSIVO', MARGIN + 8, y + 9);
  ink(LIME);
  font('bold');
  doc.setFontSize(18);
  doc.text(formatCurrency(totals.subtotal), PAGE_W - MARGIN - 8, y + 14, { align: 'right' });
  footer();

  // ========================================================================
  // PAGINA 6 — OFFERTA RISERVATA
  // ========================================================================
  doc.addPage();
  pageBg(INK);
  fill(LIME);
  doc.rect(MARGIN, 46, 8, 2.4, 'F');
  ink(PAPER);
  font('bold');
  doc.setFontSize(9);
  doc.text('OFFERTA RISERVATA BNSSTUDIO', MARGIN + 11, 48);

  ink(PAPER);
  doc.setFontSize(26);
  const offerTitle = doc.splitTextToSize('Un pacchetto completo, un’unica opportunità', CONTENT_W) as string[];
  doc.text(offerTitle, MARGIN, 74);

  ink(FAINT);
  font('normal');
  doc.setFontSize(11);
  paragraph(
    'Scegliendo il pacchetto completo, tutti i servizi descritti nel presente documento vengono forniti a un prezzo promozionale riservato, dalla progettazione iniziale alla consegna del progetto completo e funzionante.',
    MARGIN,
    74 + offerTitle.length * 11 + 6,
    CONTENT_W,
    11,
    6,
    FAINT,
  );

  // riquadri prezzo
  const boxY = 190;
  const boxW = (CONTENT_W - 10) / 2;
  // valore reale
  stroke('#3a3a3d');
  doc.roundedRect(MARGIN, boxY, boxW, 46, 3, 3, 'S');
  ink(FAINT);
  font('normal');
  doc.setFontSize(9);
  doc.text('VALORE REALE', MARGIN + 8, boxY + 13);
  ink(FAINT);
  font('bold');
  doc.setFontSize(20);
  doc.text(formatCurrency(totals.subtotal), MARGIN + 8, boxY + 30);
  // prezzo riservato
  fill(LIME);
  doc.roundedRect(MARGIN + boxW + 10, boxY, boxW, 46, 3, 3, 'F');
  ink(INK);
  font('normal');
  doc.setFontSize(9);
  doc.text('PREZZO RISERVATO', MARGIN + boxW + 18, boxY + 13);
  font('bold');
  doc.setFontSize(24);
  doc.text(formatCurrency(options.reservedPrice), MARGIN + boxW + 18, boxY + 31);
  ink(INK);
  font('normal');
  doc.setFontSize(8);
  doc.text('IVA esclusa', MARGIN + boxW + 18, boxY + 40);
  footer();

  // ========================================================================
  // PAGINA 7 — MODALITÀ DI PAGAMENTO
  // ========================================================================
  doc.addPage();
  pageBg(PAPER);
  sectionLabel('Modalità di pagamento', 40);
  y = 56;
  y = paragraph(
    `Il corrispettivo potrà essere versato in ${options.installmentsCount === 1 ? 'un’unica soluzione' : `${options.installmentsCount} rate`}, secondo il piano riportato di seguito. Ogni richiesta di pagamento sarà emessa da ${brandConfig.name} alle rispettive scadenze.`,
    MARGIN,
    y,
    CONTENT_W,
  );
  y += 8;
  const rates = buildInstallments(options.reservedPrice, options.installmentsCount, estimate.depositPct);
  rates.forEach((rate, i) => {
    stroke(HAIR);
    fill(PAPER);
    doc.roundedRect(MARGIN, y, CONTENT_W, 22, 3, 3, 'S');
    ink(LIME);
    font('bold');
    doc.setFontSize(9);
    fill(INK);
    doc.rect(MARGIN + 6, y + 7, 9, 6.5, 'F');
    ink(LIME);
    doc.text(String(i + 1).padStart(2, '0'), MARGIN + 10.5, y + 11.5, { align: 'center' });
    ink(INK);
    font('bold');
    doc.setFontSize(11);
    doc.text(rate.label, MARGIN + 22, y + 9);
    ink(MUTED);
    font('normal');
    doc.setFontSize(8.5);
    const when = i === 0 ? 'All’avvio del progetto' : `${i * 30} giorni dopo la prima rata`;
    doc.text(when, MARGIN + 22, y + 15);
    ink(INK);
    font('bold');
    doc.setFontSize(13);
    doc.text(formatCurrency(rate.amount), PAGE_W - MARGIN - 8, y + 13, { align: 'right' });
    y += 27;
  });
  y += 2;
  fill(INK);
  doc.roundedRect(MARGIN, y, CONTENT_W, 20, 3, 3, 'F');
  ink(PAPER);
  font('normal');
  doc.setFontSize(9);
  doc.text('TOTALE PROGETTO', MARGIN + 8, y + 12);
  ink(FAINT);
  doc.setFontSize(7.5);
  doc.text('IVA esclusa', MARGIN + 8, y + 16.5);
  ink(LIME);
  font('bold');
  doc.setFontSize(16);
  doc.text(formatCurrency(options.reservedPrice), PAGE_W - MARGIN - 8, y + 13, { align: 'right' });
  footer();

  // ========================================================================
  // PAGINA 8 — GRAZIE
  // ========================================================================
  doc.addPage();
  pageBg(INK);
  ink(PAPER);
  font('bold');
  doc.setFontSize(40);
  doc.text('Grazie', PAGE_W / 2, PAGE_H / 2 - 6, { align: 'center' });
  fill(LIME);
  doc.rect(PAGE_W / 2 - 15, PAGE_H / 2 + 2, 30, 1.5, 'F');
  ink(FAINT);
  font('normal');
  doc.setFontSize(10);
  doc.text(brandConfig.contacts.email, PAGE_W / 2, PAGE_H / 2 + 16, { align: 'center' });
  doc.text(brandConfig.contacts.website.replace(/^https?:\/\//, ''), PAGE_W / 2, PAGE_H / 2 + 23, { align: 'center' });

  return doc.output('blob');
}
