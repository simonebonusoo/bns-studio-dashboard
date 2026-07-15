import { jsPDF } from 'jspdf';
import { brandConfig } from '@/config/brandConfig';
import { documentTotals, round2 } from '@/lib/finance';
import { formatDate } from '@/lib/format';
import type { Client, Estimate } from '@/types';

export type BnsStudioQuoteDocument = {
  cover: {
    title: string;
    subtitle: string;
    validityText: string;
  };
  introduction: {
    aboutTitle: string;
    aboutBody: string;
    objectiveTitle: string;
    objectiveBody: string[];
  };
  scope: {
    intro?: string;
    items: Array<{
      id: string;
      number: string;
      title: string;
      description: string;
    }>;
  };
  team: {
    members: Array<{
      id: string;
      name: string;
      role: string;
      skills: string[];
      image?: string;
      visible: boolean;
    }>;
  };
  valueBreakdown: {
    sections: Array<{
      id: string;
      title: string;
      items: string[];
      value: number;
    }>;
    totalRealValue: number;
  };
  offer: {
    eyebrow: string;
    headline: string;
    description: string;
    realValue: number;
    reservedPrice: number;
    footerText: string;
  };
  payment: {
    intro: string;
    installments: Array<{
      id: string;
      title: string;
      description: string;
      amount: number;
    }>;
    total: number;
  };
};

export type BnsStudioQuoteCopy = {
  headerLabel: string;
  scopePageTitle: string;
  teamPageTitle: string;
  teamPageSubtitle: string;
  valuePageTitle: string;
  valuePageSubtitle: string;
  valueTotalLabel: string;
  offerValueRealLabel: string;
  offerReservedLabel: string;
  paymentPageTitle: string;
  paymentTotalLabel: string;
  closingHeadline: string;
};

export interface BnsQuoteWarning {
  id: string;
  severity: 'warning' | 'error';
  message: string;
}

export const BNS_QUOTE_PAGE = {
  width: 595.5,
  height: 842.25,
};

export const BNS_QUOTE_LIMITS = {
  coverTitle: 26,
  coverSubtitle: 52,
  validityText: 72,
  aboutTitle: 18,
  aboutBody: 360,
  objectiveTitle: 42,
  objectiveParagraphs: 3,
  objectiveParagraphLength: 240,
  scopeIntro: 120,
  scopeItems: 6,
  scopeTitle: 30,
  scopeDescription: 112,
  teamRole: 34,
  teamSkills: 9,
  teamSkillLength: 28,
  valueSections: 2,
  valueSectionTitle: 38,
  valueItems: 12,
  valueItemLength: 28,
  offerHeadline: 44,
  offerDescription: 160,
  offerFooterText: 118,
  paymentIntro: 360,
  paymentInstallments: 3,
  paymentTitle: 24,
  paymentDescription: 116,
} as const;

export const BNS_QUOTE_TEMPLATE_PAGES = Array.from({ length: 8 }, (_, index) => `/bns-quote-template/page-${index + 1}.png`);

type FontFamilyName =
  | 'PoppinsMedium'
  | 'PoppinsBold'
  | 'PoppinsBlack'
  | 'LatoRegular'
  | 'LatoBold'
  | 'LatoItalic';

const COLORS = {
  ink: '#060606',
  paper: '#ffffff',
  muted: '#111111',
};

const FONT_SOURCES: Record<FontFamilyName, string> = {
  PoppinsMedium: '/fonts/Poppins-Medium.ttf',
  PoppinsBold: '/fonts/Poppins-Bold.ttf',
  PoppinsBlack: '/fonts/Poppins-Black.ttf',
  LatoRegular: '/fonts/Lato-Regular.ttf',
  LatoBold: '/fonts/Lato-Bold.ttf',
  LatoItalic: '/fonts/Lato-Italic.ttf',
};

const DEFAULT_TEAM = [
  {
    id: 'simone',
    name: 'Simone Bonuso',
    role: 'DIREZIONE CREATIVA & UI',
    skills: [
      'Frontend Development',
      'UI Design',
      'UX Design',
      'Brand Identity',
      'Logo Design',
      'Graphic Design',
      'Social Design',
      'Materiale promozionale',
      'Comunicazione visiva',
    ],
    visible: true,
  },
  {
    id: 'andrea',
    name: 'Andrea Brandolini',
    role: 'SVILUPPO & INFRASTRUTTURA',
    skills: [
      'Backend Development',
      'Database Design',
      'Sviluppo software',
      'Software Architecture',
      'Software Design',
      'Gestione dati',
      'Infrastruttura',
      'Sistemi di gestione',
      'Stabilita della piattaforma',
    ],
    visible: true,
  },
] satisfies BnsStudioQuoteDocument['team']['members'];

const fontBinaryCache = new Map<string, Promise<string>>();
const imageDataCache = new Map<string, Promise<string>>();

function runtimeAssetUrl(path: string) {
  if (/^(https?:|data:)/.test(path)) return path;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).toString();
  }
  return new URL(`../public${path}`, import.meta.url).toString();
}

function sanitizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function clampString(value: string, limit: number) {
  const safe = sanitizeText(value);
  if (safe.length <= limit) return safe;
  const sliced = safe.slice(0, limit + 1);
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace >= Math.max(6, Math.floor(limit * 0.55))) {
    return sliced.slice(0, lastSpace).trim();
  }
  return safe.slice(0, limit).trim();
}

function clampArray<T>(items: T[], limit: number) {
  return items.slice(0, limit);
}

function formatLongDate(value: string) {
  const formatted = formatDate(value, 'd MMMM yyyy');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatEuroNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(round2(value));
}

export function formatBnsEuro(value: number, digits = 0) {
  return `€ ${formatEuroNumber(value, digits)}`;
}

function clientLabel(client?: Client | null) {
  return client?.displayName?.trim() || 'Cliente';
}

export function bnsHeaderLabel(client?: Client | null) {
  return `Preventivo · ${clampString(clientLabel(client), 12)}`;
}

export function bnsPdfCopyDefaults(client?: Client | null): BnsStudioQuoteCopy {
  return {
    headerLabel: bnsHeaderLabel(client),
    scopePageTitle: 'COSA COMPRENDE IL PREVENTIVO',
    teamPageTitle: 'IL TEAM DIETRO AL PROGETTO',
    teamPageSubtitle:
      "Un team dedicato, con competenze complementari e un unico obiettivo: realizzare un progetto all'altezza della vostra identita.",
    valuePageTitle: 'COME NASCE IL VALORE',
    valuePageSubtitle: 'Il progetto si compone di grandi aree di lavoro, ognuna con un valore preciso.',
    valueTotalLabel: 'VALORE COMPLESSIVO',
    offerValueRealLabel: 'VALORE REALE',
    offerReservedLabel: 'PREZZO RISERVATO',
    paymentPageTitle: 'MODALITA DI PAGAMENTO',
    paymentTotalLabel: 'Totale progetto',
    closingHeadline: 'Grazie',
  };
}

function coverSubtitle(estimate: Estimate, client?: Client | null) {
  const label = clientLabel(client);
  const primaryItem = estimate.items[0]?.description?.trim();
  if (primaryItem && /sito|web/i.test(primaryItem)) return `Sito web per ${label}`;
  if (primaryItem && /brand|identity|logo/i.test(primaryItem)) return `Brand identity per ${label}`;
  if (primaryItem) return `${primaryItem} per ${label}`;
  return `Progetto per ${label}`;
}

function objectiveTitleForEstimate(estimate: Estimate) {
  const source = estimate.items.map((item) => item.description).join(' ').toLowerCase();
  if (source.includes('sito') || source.includes('web')) return 'MIGLIORARE LA PRESENZA DIGITALE';
  if (source.includes('dashboard') || source.includes('software')) return 'SEMPLIFICARE LA GESTIONE OPERATIVA';
  if (source.includes('brand') || source.includes('logo')) return 'RAFFORZARE IDENTITA E FIDUCIA';
  return 'TRASFORMARE IL PROGETTO IN UNO STRUMENTO COMMERCIALE';
}

function defaultObjectiveParagraphs(clientName: string) {
  return [
    `L'obiettivo del progetto e dotare ${clientName} di una presenza digitale moderna, coerente e immediatamente riconoscibile, capace di trasmettere professionalita e affidabilita fin dal primo contatto.`,
    'Abbiamo progettato questa proposta per valorizzare al meglio i servizi offerti, semplificare la comprensione dell\'offerta e guidare le richieste in modo piu chiaro e qualificato.',
    'Non stiamo realizzando un semplice sito: stiamo costruendo un asset digitale solido, credibile e pronto a sostenere la crescita del brand nel tempo.',
  ];
}

function defaultScopeItems(estimate: Estimate) {
  const source = estimate.items.map((item) => item.description).join(' ').toLowerCase();
  if (source.includes('dashboard') || source.includes('software')) {
    return [
      ['Analisi funzionale', 'Studio dei flussi, delle esigenze operative e delle priorita del progetto.'],
      ['Progettazione interfaccia', 'Definizione di struttura, schermate e logiche di utilizzo in ottica UX/UI.'],
      ['Sviluppo applicativo', 'Realizzazione completa del gestionale con componenti, logiche e integrazioni.'],
      ['Gestione dati', 'Modellazione dei dati, relazioni, permessi e struttura del database.'],
      ['Controlli e collaudo', 'Verifica dei flussi principali, test funzionali e affinamento dell\'esperienza.'],
      ['Rilascio e supporto', 'Consegna, affiancamento iniziale e supporto al corretto utilizzo della piattaforma.'],
    ];
  }

  return [
    ['Progettazione', 'Studio della struttura, dell\'organizzazione dei contenuti e dell\'esperienza di navigazione.'],
    ['Brand Identity', 'L\'identita visiva del marchio: logo, colori, tipografia e linee guida.'],
    ['Realizzazione del sito', 'Un sito professionale completo, elegante e perfettamente funzionante su computer, tablet e smartphone.'],
    ['Blog', 'Uno spazio dedicato ad articoli e contenuti, per raccontare il progetto e crescere nel tempo.'],
    ['Sistema di contatto', 'Un canale di richiesta informazioni curato e affidabile, per non perdere nessuna opportunita.'],
    ['Supporto e manutenzione', 'Supporto dalla consegna del progetto per garantire un avvio fluido e il corretto utilizzo del lavoro realizzato.'],
  ];
}

function defaultValueSections(estimate: Estimate, totalRealValue: number) {
  const source = estimate.items.map((item) => item.description).join(' ').toLowerCase();
  if (source.includes('dashboard') || source.includes('software')) {
    const primary = round2(totalRealValue * 0.74);
    const secondary = round2(totalRealValue - primary);
    return [
      {
        id: 'value-1',
        title: 'Progettazione e sviluppo del gestionale',
        items: ['Analisi funzionale', 'Design UX / UI', 'Sviluppo completo', 'Gestione dati', 'Ottimizzazione'],
        value: primary,
      },
      {
        id: 'value-2',
        title: 'Rilascio e supporto operativo',
        items: ['Collaudo', 'Affinamento interfaccia', 'Formazione iniziale', 'Supporto di avvio'],
        value: secondary,
      },
    ];
  }

  const primary = round2(totalRealValue * 0.71);
  const secondary = round2(totalRealValue - primary);
  return [
    {
      id: 'value-1',
      title: 'Progettazione e sviluppo del sito web',
      items: ['Progettazione', 'Design UX / UI', 'Sviluppo completo', 'Ottimizzazione', 'Versione responsive'],
      value: primary,
    },
    {
      id: 'value-2',
      title: 'Contenuti, contatto e supporto',
      items: ['Sistema di contatto', 'Blog', 'Supporto dedicato', 'Affinamento finale'],
      value: secondary,
    },
  ];
}

function installmentTitle(index: number) {
  return ['Prima rata', 'Seconda rata', 'Terza rata'][index] ?? `${index + 1}ª rata`;
}

function buildInstallments(total: number, count = 3, depositPct = 0) {
  const safeCount = Math.max(1, Math.min(BNS_QUOTE_LIMITS.paymentInstallments, Math.floor(count || 1)));
  if (safeCount === 1) {
    return [
      {
        id: 'installment-1',
        title: 'Rata unica',
        description: `Saldo complessivo da ${formatBnsEuro(total, 2)} alla conferma del progetto.`,
        amount: round2(total),
      },
    ];
  }

  const deposit = depositPct > 0 ? round2(total * (depositPct / 100)) : round2(total / safeCount);
  const remaining = round2(total - deposit);
  const otherCount = safeCount - 1;
  const baseOther = otherCount > 0 ? round2(remaining / otherCount) : 0;
  const installments = Array.from({ length: safeCount }, (_, index) => {
    const amount = index === 0
      ? deposit
      : index === safeCount - 1
        ? round2(total - deposit - baseOther * Math.max(0, otherCount - 1))
        : baseOther;

    const description =
      index === 0
        ? `Avvio progetto, pianificazione e inizio sviluppo subordinati alla ricezione della prima rata da ${formatBnsEuro(amount, 2)}.`
        : `Rata da ${formatBnsEuro(amount, 2)} da corrispondere ${index * 30} giorni dopo il pagamento della prima rata.`;

    return {
      id: `installment-${index + 1}`,
      title: installmentTitle(index),
      description,
      amount,
    };
  });

  return installments;
}

function normalizeValueSections(sections: BnsStudioQuoteDocument['valueBreakdown']['sections']) {
  return clampArray(sections, BNS_QUOTE_LIMITS.valueSections).map((section, index) => ({
    id: section.id || `value-${index + 1}`,
    title: clampString(section.title, BNS_QUOTE_LIMITS.valueSectionTitle),
    items: clampArray(section.items.map((item) => clampString(item, BNS_QUOTE_LIMITS.valueItemLength)).filter(Boolean), BNS_QUOTE_LIMITS.valueItems),
    value: Math.max(0, round2(section.value)),
  }));
}

export function normalizeBnsQuoteDocument(input: BnsStudioQuoteDocument): BnsStudioQuoteDocument {
  const scopeItems = clampArray(input.scope.items, BNS_QUOTE_LIMITS.scopeItems).map((item, index) => ({
    id: item.id || `scope-${index + 1}`,
    number: String(index + 1).padStart(2, '0'),
    title: clampString(item.title, BNS_QUOTE_LIMITS.scopeTitle),
    description: clampString(item.description, BNS_QUOTE_LIMITS.scopeDescription),
  }));

  const teamMembers = DEFAULT_TEAM.map((member, index) => {
    const current = input.team.members[index] ?? member;
    return {
      ...member,
      ...current,
      role: clampString(current.role || member.role, BNS_QUOTE_LIMITS.teamRole),
      skills: clampArray(
        (current.skills?.length ? current.skills : member.skills)
          .map((skill) => clampString(skill, BNS_QUOTE_LIMITS.teamSkillLength))
          .filter(Boolean),
        BNS_QUOTE_LIMITS.teamSkills,
      ),
      visible: current.visible !== false,
    };
  });

  const sections = normalizeValueSections(input.valueBreakdown.sections);
  const totalRealValue = round2(sections.reduce((sum, section) => sum + section.value, 0));
  const reservedPrice = Math.min(Math.max(0, round2(input.offer.reservedPrice)), totalRealValue || Math.max(0, round2(input.offer.realValue)));
  const installments = clampArray(
    input.payment.installments.map((installment, index) => ({
      id: installment.id || `installment-${index + 1}`,
      title: clampString(installment.title, BNS_QUOTE_LIMITS.paymentTitle),
      description: clampString(installment.description, BNS_QUOTE_LIMITS.paymentDescription),
      amount: Math.max(0, round2(installment.amount)),
    })),
    BNS_QUOTE_LIMITS.paymentInstallments,
  );

  const normalizedInstallments = installments.length > 0 ? installments : buildInstallments(reservedPrice, 3, 0);
  const paymentTotal = round2(normalizedInstallments.reduce((sum, installment) => sum + installment.amount, 0));

  return {
    cover: {
      title: clampString(input.cover.title, BNS_QUOTE_LIMITS.coverTitle),
      subtitle: clampString(input.cover.subtitle, BNS_QUOTE_LIMITS.coverSubtitle),
      validityText: clampString(input.cover.validityText, BNS_QUOTE_LIMITS.validityText),
    },
    introduction: {
      aboutTitle: clampString(input.introduction.aboutTitle, BNS_QUOTE_LIMITS.aboutTitle),
      aboutBody: clampString(input.introduction.aboutBody, BNS_QUOTE_LIMITS.aboutBody),
      objectiveTitle: clampString(input.introduction.objectiveTitle, BNS_QUOTE_LIMITS.objectiveTitle),
      objectiveBody: clampArray(
        input.introduction.objectiveBody
          .map((paragraph) => clampString(paragraph, BNS_QUOTE_LIMITS.objectiveParagraphLength))
          .filter(Boolean),
        BNS_QUOTE_LIMITS.objectiveParagraphs,
      ),
    },
    scope: {
      intro: clampString(input.scope.intro ?? '', BNS_QUOTE_LIMITS.scopeIntro),
      items: scopeItems,
    },
    team: {
      members: teamMembers,
    },
    valueBreakdown: {
      sections,
      totalRealValue,
    },
    offer: {
      eyebrow: clampString(input.offer.eyebrow, 42),
      headline: clampString(input.offer.headline, BNS_QUOTE_LIMITS.offerHeadline),
      description: clampString(input.offer.description, BNS_QUOTE_LIMITS.offerDescription),
      realValue: totalRealValue,
      reservedPrice,
      footerText: clampString(input.offer.footerText, BNS_QUOTE_LIMITS.offerFooterText),
    },
    payment: {
      intro: clampString(input.payment.intro, BNS_QUOTE_LIMITS.paymentIntro),
      installments: normalizedInstallments,
      total: Math.max(reservedPrice, paymentTotal),
    },
  };
}

export function bnsPdfDefaults(estimate: Estimate, client?: Client | null): BnsStudioQuoteDocument {
  const totals = documentTotals(estimate.items, {
    globalDiscountPct: estimate.globalDiscountPct,
    depositPct: estimate.depositPct,
  });
  const realValue = round2(totals.subtotal);
  const reservedPrice = Math.min(realValue, round2(totals.taxable));
  const clientName = clientLabel(client);
  const sections = defaultValueSections(estimate, realValue);

  return normalizeBnsQuoteDocument({
    cover: {
      title: 'PREVENTIVO COMPLETO',
      subtitle: coverSubtitle(estimate, client),
      validityText: `Preventivo valido per 3 mesi a partire dal ${formatLongDate(estimate.issueDate)}`,
    },
    introduction: {
      aboutTitle: 'CHI SIAMO',
      aboutBody:
        `${brandConfig.name} e uno studio creativo specializzato nella costruzione di identita digitali complete. ` +
        'Uniamo design, strategia e cura ai dettagli per offrire ai nostri partner una presenza digitale coerente e completa. ' +
        'Non realizziamo semplici siti web: progettiamo esperienze digitali, costruite intorno a persone reali e obiettivi concreti.',
      objectiveTitle: objectiveTitleForEstimate(estimate),
      objectiveBody: defaultObjectiveParagraphs(clientName),
    },
    scope: {
      intro: 'Ogni elemento e progettato per lavorare in armonia con gli altri, in un percorso curato dall\'idea alla consegna.',
      items: defaultScopeItems(estimate).map(([title, description], index) => ({
        id: `scope-${index + 1}`,
        number: String(index + 1).padStart(2, '0'),
        title,
        description,
      })),
    },
    team: {
      members: DEFAULT_TEAM.map((member) => ({ ...member })),
    },
    valueBreakdown: {
      sections,
      totalRealValue: realValue,
    },
    offer: {
      eyebrow: 'OFFERTA RISERVATA BnsStudio',
      headline: "UN PACCHETTO COMPLETO UN'UNICA OPPORTUNITA",
      description:
        'Scegliendo il pacchetto completo, tutti i servizi descritti nel presente documento vengono forniti ad un prezzo promozionale riservato.',
      realValue,
      reservedPrice,
      footerText:
        "L'offerta comprende tutte le attivita descritte nel documento, dalla progettazione iniziale alla consegna del progetto completo.",
    },
    payment: {
      intro:
        `Una volta ricevuta l'accettazione del presente preventivo, ${brandConfig.name} provvedera ad emettere una richiesta di pagamento ufficiale. ` +
        `Per agevolare la gestione amministrativa, il corrispettivo potra essere versato in tre rate mensili secondo il piano riportato di seguito.`,
      installments: buildInstallments(reservedPrice, 3, estimate.depositPct ?? 0),
      total: reservedPrice,
    },
  });
}

export function bnsQuoteWarnings(document: BnsStudioQuoteDocument) {
  const doc = normalizeBnsQuoteDocument(document);
  const warnings: BnsQuoteWarning[] = [];
  if (document.scope.items.length > BNS_QUOTE_LIMITS.scopeItems) {
    warnings.push({
      id: 'scope-items',
      severity: 'warning',
      message: `Il template supporta al massimo ${BNS_QUOTE_LIMITS.scopeItems} voci nella pagina "Cosa comprende".`,
    });
  }
  if (document.valueBreakdown.sections.length > BNS_QUOTE_LIMITS.valueSections) {
    warnings.push({
      id: 'value-sections',
      severity: 'warning',
      message: `Il template supporta al massimo ${BNS_QUOTE_LIMITS.valueSections} aree nella pagina "Come nasce il valore".`,
    });
  }
  if (document.payment.installments.length > BNS_QUOTE_LIMITS.paymentInstallments) {
    warnings.push({
      id: 'payment-installments',
      severity: 'warning',
      message: `Il template supporta al massimo ${BNS_QUOTE_LIMITS.paymentInstallments} rate piu il totale finale.`,
    });
  }
  if (document.offer.reservedPrice > doc.offer.realValue) {
    warnings.push({
      id: 'reserved-price',
      severity: 'error',
      message: 'Il prezzo riservato non puo superare il valore reale del progetto.',
    });
  }
  if (doc.payment.total !== round2(doc.payment.installments.reduce((sum, installment) => sum + installment.amount, 0))) {
    warnings.push({
      id: 'payment-total',
      severity: 'warning',
      message: 'La somma delle rate non coincide con il totale progetto e verra riallineata in export.',
    });
  }
  return warnings;
}

async function arrayBufferToBinaryString(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let result = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return result;
}

async function fetchBinaryString(url: string) {
  const cached = fontBinaryCache.get(url);
  if (cached) return cached;
  const promise =
    typeof window === 'undefined'
      ? import('node:fs/promises')
          .then((fs) => fs.readFile(new URL(`../public${url}`, import.meta.url)))
          .then((buffer) => arrayBufferToBinaryString(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)))
      : fetch(runtimeAssetUrl(url))
          .then((response) => {
            if (!response.ok) throw new Error(`Impossibile caricare ${url}`);
            return response.arrayBuffer();
          })
          .then(arrayBufferToBinaryString);
  fontBinaryCache.set(url, promise);
  return promise;
}

async function blobToDataUrl(blob: Blob) {
  if (typeof FileReader === 'undefined') {
    const buffer = Buffer.from(await blob.arrayBuffer());
    return `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Impossibile leggere il blob'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageData(url: string) {
  const cached = imageDataCache.get(url);
  if (cached) return cached;
  const promise =
    typeof window === 'undefined'
      ? import('node:fs/promises')
          .then((fs) => fs.readFile(new URL(`../public${url}`, import.meta.url)))
          .then((buffer) => `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`)
      : fetch(runtimeAssetUrl(url))
          .then((response) => {
            if (!response.ok) throw new Error(`Impossibile caricare ${url}`);
            return response.blob();
          })
          .then(blobToDataUrl);
  imageDataCache.set(url, promise);
  return promise;
}

async function registerFonts(doc: jsPDF) {
  const fonts = await Promise.all(
    Object.entries(FONT_SOURCES).map(async ([family, url]) => [family, await fetchBinaryString(url)] as const),
  );

  fonts.forEach(([family, binary]) => {
    const filename = `${family}.ttf`;
    doc.addFileToVFS(filename, binary);
    doc.addFont(filename, family, 'normal');
  });
}

function setFill(doc: jsPDF, color: string) {
  doc.setFillColor(color);
}

function setText(doc: jsPDF, color: string) {
  doc.setTextColor(color);
}

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.rect(x, y, w, h, 'F');
}

function addPageBackground(doc: jsPDF, dataUrl: string) {
  doc.addImage(dataUrl, 'PNG', 0, 0, BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height, undefined, 'FAST');
}

function paragraph(doc: jsPDF, text: string, options: {
  x: number;
  y: number;
  width: number;
  size: number;
  lineHeight: number;
  font: FontFamilyName;
  align?: 'left' | 'center' | 'right';
}) {
  const lines = doc.splitTextToSize(text, options.width) as string[];
  doc.setFont(options.font, 'normal');
  doc.setFontSize(options.size);
  doc.text(lines, options.x, options.y, { align: options.align ?? 'left', maxWidth: options.width, lineHeightFactor: options.lineHeight / options.size });
  return options.y + lines.length * options.lineHeight;
}

function centeredParagraph(doc: jsPDF, text: string, options: {
  centerX: number;
  y: number;
  width: number;
  size: number;
  lineHeight: number;
  font: FontFamilyName;
}) {
  const lines = doc.splitTextToSize(text, options.width) as string[];
  doc.setFont(options.font, 'normal');
  doc.setFontSize(options.size);
  doc.text(lines, options.centerX, options.y, {
    align: 'center',
    maxWidth: options.width,
    lineHeightFactor: options.lineHeight / options.size,
  });
  return { lines, bottom: options.y + lines.length * options.lineHeight };
}

function multiline(doc: jsPDF, lines: string[], options: {
  x: number;
  y: number;
  width: number;
  size: number;
  lineHeight: number;
  font: FontFamilyName;
}) {
  let y = options.y;
  lines.forEach((line, index) => {
    y = paragraph(doc, line, { ...options, y });
    if (index < lines.length - 1) y += 9;
  });
  return y;
}

function drawFooterPageNumber(doc: jsPDF, pageNumber: string) {
  setFill(doc, COLORS.paper);
  fillRect(doc, 236, 780, 124, 46);
  setText(doc, COLORS.ink);
  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(12);
  doc.text(pageNumber, 298, 810, { align: 'center' });
}

function drawHeaderLabel(doc: jsPDF, label: string) {
  setFill(doc, COLORS.paper);
  fillRect(doc, 470, 36, 102, 18);
  setText(doc, COLORS.ink);
  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(10.5);
  doc.text(label, 520, 48, { align: 'center' });
}

function drawCoverPage(doc: jsPDF, image: string, quote: BnsStudioQuoteDocument) {
  addPageBackground(doc, image);
  setFill(doc, COLORS.paper);
  fillRect(doc, 72, 392, 460, 120);
  fillRect(doc, 225, 548, 150, 140);
  fillRect(doc, 140, 744, 330, 60);

  setText(doc, COLORS.ink);
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(30);
  doc.text(quote.cover.title, 297.75, 444, { align: 'center', maxWidth: 420 });

  doc.setFont('PoppinsMedium', 'normal');
  doc.setFontSize(20);
  doc.text(quote.cover.subtitle, 297.75, 487, { align: 'center', maxWidth: 420 });

  doc.setFont('LatoItalic', 'normal');
  doc.setFontSize(12);
  doc.text(quote.cover.validityText, 297.75, 780, { align: 'center', maxWidth: 320 });
}

function drawIntroPage(doc: jsPDF, image: string, quote: BnsStudioQuoteDocument, copy: BnsStudioQuoteCopy) {
  addPageBackground(doc, image);
  drawHeaderLabel(doc, copy.headerLabel);
  drawFooterPageNumber(doc, 'Pag.01');

  setFill(doc, COLORS.paper);
  fillRect(doc, 56, 70, 484, 664);

  setText(doc, COLORS.ink);
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(26);
  doc.text(quote.introduction.aboutTitle, 58, 150);

  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(16);
  paragraph(doc, quote.introduction.aboutBody, {
    x: 58,
    y: 185,
    width: 488,
    size: 16,
    lineHeight: 24,
    font: 'LatoRegular',
  });

  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(24);
  doc.text(quote.introduction.objectiveTitle, 58, 402, { maxWidth: 478 });

  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(16);
  multiline(doc, quote.introduction.objectiveBody, {
    x: 58,
    y: 438,
    width: 488,
    size: 16,
    lineHeight: 24,
    font: 'LatoRegular',
  });
}

function drawScopePage(doc: jsPDF, image: string, quote: BnsStudioQuoteDocument, copy: BnsStudioQuoteCopy) {
  addPageBackground(doc, image);
  drawHeaderLabel(doc, copy.headerLabel);
  drawFooterPageNumber(doc, 'Pag.02');

  setFill(doc, COLORS.paper);
  fillRect(doc, 54, 70, 500, 664);

  setText(doc, COLORS.ink);
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(26);
  doc.text(copy.scopePageTitle, 58, 146);

  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(15);
  paragraph(doc, quote.scope.intro || '', {
    x: 58,
    y: 175,
    width: 500,
    size: 15,
    lineHeight: 19,
    font: 'LatoRegular',
  });

  let y = 244;
  quote.scope.items.forEach((item, index) => {
    doc.setFont('PoppinsBlack', 'normal');
    doc.setFontSize(26);
    doc.text(item.number, 62, y);
    if (index < quote.scope.items.length - 1) {
      doc.setDrawColor(36);
      doc.setLineWidth(1);
      doc.line(80, y + 16, 80, y + 56);
    }

    doc.setFont('PoppinsBold', 'normal');
    doc.setFontSize(22);
    doc.text(item.title, 150, y - 12, { maxWidth: 330 });

    doc.setFont('LatoRegular', 'normal');
    doc.setFontSize(15);
    paragraph(doc, item.description, {
      x: 150,
      y: y + 3,
      width: 390,
      size: 15,
      lineHeight: 19,
      font: 'LatoRegular',
    });
    y += 96;
  });
}

function drawTeamPage(doc: jsPDF, image: string, quote: BnsStudioQuoteDocument, copy: BnsStudioQuoteCopy) {
  addPageBackground(doc, image);
  drawHeaderLabel(doc, copy.headerLabel);
  drawFooterPageNumber(doc, 'Pag.03');
  const defaultCopy = bnsPdfCopyDefaults();
  const showCustomHeading = copy.teamPageTitle !== defaultCopy.teamPageTitle || copy.teamPageSubtitle !== defaultCopy.teamPageSubtitle;

  setFill(doc, COLORS.paper);
  fillRect(doc, 56, 488, 214, 276);
  fillRect(doc, 324, 488, 214, 276);
  if (showCustomHeading) fillRect(doc, 54, 92, 500, 100);

  if (showCustomHeading) {
    setText(doc, COLORS.ink);
    doc.setFont('PoppinsBlack', 'normal');
    doc.setFontSize(26);
    doc.text(copy.teamPageTitle, 58, 146);

    doc.setFont('LatoRegular', 'normal');
    doc.setFontSize(14);
    paragraph(doc, copy.teamPageSubtitle, {
      x: 58,
      y: 170,
      width: 485,
      size: 14,
      lineHeight: 18,
      font: 'LatoRegular',
    });
  }

  const columns = [
    { member: quote.team.members[0], centerX: 162, textX: 58, skillX: 78 },
    { member: quote.team.members[1], centerX: 431, textX: 324, skillX: 346 },
  ];

  columns.forEach(({ member, centerX, textX, skillX }) => {
    if (!member?.visible) {
      setFill(doc, COLORS.paper);
      fillRect(doc, textX - 10, 225, 220, 520);
      return;
    }
    doc.setFont('PoppinsBlack', 'normal');
    doc.setFontSize(19);
    doc.text(member.name, centerX, 544, { align: 'center', maxWidth: 214 });

    doc.setFont('LatoItalic', 'normal');
    doc.setFontSize(11);
    doc.text(member.role, centerX, 570, { align: 'center', maxWidth: 182 });

    doc.setFont('LatoRegular', 'normal');
    doc.setFontSize(13.5);
    let skillY = 606;
    member.skills.forEach((skill) => {
      doc.text(`•`, skillX, skillY);
      doc.text(skill, skillX + 15, skillY, { maxWidth: 172 });
      skillY += 19;
    });
  });
}

function drawValuePage(doc: jsPDF, image: string, quote: BnsStudioQuoteDocument, copy: BnsStudioQuoteCopy) {
  addPageBackground(doc, image);
  drawHeaderLabel(doc, copy.headerLabel);
  drawFooterPageNumber(doc, 'Pag.04');

  setFill(doc, COLORS.paper);
  fillRect(doc, 54, 70, 500, 664);

  setText(doc, COLORS.ink);
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(26);
  doc.text(copy.valuePageTitle, 58, 146);

  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(14);
  paragraph(doc, copy.valuePageSubtitle, {
    x: 58,
    y: 174,
    width: 490,
    size: 14,
    lineHeight: 18,
    font: 'LatoRegular',
  });

  let y = 220;
  quote.valueBreakdown.sections.forEach((section) => {
    doc.setFont('PoppinsBold', 'normal');
    doc.setFontSize(21);
    const titleLines = doc.splitTextToSize(section.title, 320) as string[];
    doc.text(titleLines, 58, y);

    doc.setDrawColor(30);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(380, y - 7, 486, y - 7);
    doc.setLineDashPattern([], 0);

    doc.setFont('PoppinsBold', 'normal');
    doc.setFontSize(22);
    doc.text(formatBnsEuro(section.value, 0), 552, y, { align: 'right' });

    doc.setFont('LatoRegular', 'normal');
    doc.setFontSize(12.5);
    let itemY = y + titleLines.length * 22 + 6;
    section.items.forEach((item) => {
      doc.text('•', 54, itemY);
      doc.text(item, 72, itemY);
      itemY += 17;
    });

    y = itemY + 30;
  });

  const totalY = Math.max(610, y + 12);
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(22);
  doc.text(copy.valueTotalLabel, 58, totalY);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(254, totalY - 8, 486, totalY - 8);
  doc.setLineDashPattern([], 0);
  doc.text(formatBnsEuro(quote.valueBreakdown.totalRealValue, 0), 552, totalY, { align: 'right' });
}

function drawOfferPage(doc: jsPDF, image: string, quote: BnsStudioQuoteDocument, copy: BnsStudioQuoteCopy) {
  addPageBackground(doc, image);
  drawHeaderLabel(doc, copy.headerLabel);
  drawFooterPageNumber(doc, 'Pag.05');

  setFill(doc, COLORS.paper);
  fillRect(doc, 24, 120, 548, 620);
  fillRect(doc, 58, 70, 482, 664);

  setText(doc, COLORS.ink);
  doc.setFont('PoppinsBold', 'normal');
  doc.setFontSize(20);
  doc.text(quote.offer.eyebrow, 297.75, 172, { align: 'center' });

  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(32);
  const headline = centeredParagraph(doc, quote.offer.headline, {
    centerX: 297.75,
    y: 248,
    width: 390,
    size: 32,
    lineHeight: 37,
    font: 'PoppinsBlack',
  });

  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(16);
  centeredParagraph(doc, quote.offer.description, {
    centerX: 297.75,
    y: headline.bottom + 16,
    width: 380,
    size: 16,
    lineHeight: 21,
    font: 'LatoRegular',
  });

  doc.setFont('PoppinsMedium', 'normal');
  doc.setFontSize(24);
  doc.text(copy.offerValueRealLabel, 297.75, 484, { align: 'center' });
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(28);
  doc.text(formatBnsEuro(quote.offer.realValue, 0), 297.75, 522, { align: 'center' });

  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(24);
  doc.text(copy.offerReservedLabel, 297.75, 648, { align: 'center' });
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(54);
  doc.text(formatBnsEuro(quote.offer.reservedPrice, 0), 297.75, 714, { align: 'center' });
  doc.setLineWidth(6);
  doc.line(175, 732, 420, 732);

  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(11.5);
  centeredParagraph(doc, quote.offer.footerText, {
    centerX: 297.75,
    y: 770,
    width: 404,
    size: 11.5,
    lineHeight: 14,
    font: 'LatoRegular',
  });
}

function drawPaymentPage(doc: jsPDF, image: string, quote: BnsStudioQuoteDocument, copy: BnsStudioQuoteCopy) {
  addPageBackground(doc, image);
  drawHeaderLabel(doc, copy.headerLabel);
  drawFooterPageNumber(doc, 'Pag.06');

  setFill(doc, COLORS.paper);
  fillRect(doc, 54, 70, 500, 664);

  setText(doc, COLORS.ink);
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(26);
  doc.text(copy.paymentPageTitle, 58, 146);

  doc.setFont('LatoRegular', 'normal');
  doc.setFontSize(15);
  const introBottom = paragraph(doc, quote.payment.intro, {
    x: 58,
    y: 174,
    width: 485,
    size: 15,
    lineHeight: 20,
    font: 'LatoRegular',
  });

  let y = introBottom + 42;
  quote.payment.installments.forEach((installment, index) => {
    doc.setFont('PoppinsBlack', 'normal');
    doc.setFontSize(26);
    doc.text(String(index + 1).padStart(2, '0'), 62, y);
    if (index < quote.payment.installments.length) {
      doc.setDrawColor(36);
      doc.setLineWidth(1);
      doc.line(80, y + 16, 80, y + 58);
    }

    doc.setFont('PoppinsBold', 'normal');
    doc.setFontSize(21);
    doc.text(installment.title, 150, y - 10, { maxWidth: 320 });

    doc.setFont('LatoRegular', 'normal');
    doc.setFontSize(13.5);
    const descBottom = paragraph(doc, installment.description, {
      x: 150,
      y: y + 6,
      width: 388,
      size: 13.5,
      lineHeight: 17,
      font: 'LatoRegular',
    });

    doc.setFont('PoppinsBold', 'normal');
    doc.setFontSize(17);
    doc.text(formatBnsEuro(installment.amount, 2), 150, descBottom + 8);
    y += 102;
  });

  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(22);
  doc.text('04', 62, y);
  doc.text(copy.paymentTotalLabel, 150, y - 8);
  doc.setFont('PoppinsBold', 'normal');
  doc.setFontSize(18);
  doc.text(formatBnsEuro(quote.payment.total, 2), 150, y + 18);
}

function drawClosingPage(doc: jsPDF, image: string, copy: BnsStudioQuoteCopy) {
  addPageBackground(doc, image);
  const defaultCopy = bnsPdfCopyDefaults();
  if (copy.closingHeadline === defaultCopy.closingHeadline) return;
  setFill(doc, COLORS.paper);
  fillRect(doc, 214, 354, 176, 56);
  setText(doc, COLORS.ink);
  doc.setFont('PoppinsBlack', 'normal');
  doc.setFontSize(28);
  doc.text(copy.closingHeadline, 303, 402, { align: 'center' });
}

export async function bnsEstimatePdfBlob(
  _estimate: Estimate,
  client: Client | null | undefined,
  input: BnsStudioQuoteDocument,
  copyInput?: Partial<BnsStudioQuoteCopy>,
) {
  const quote = normalizeBnsQuoteDocument(input);
  const copy = { ...bnsPdfCopyDefaults(client), ...copyInput };
  const doc = new jsPDF({
    unit: 'pt',
    format: [BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height],
  });

  await registerFonts(doc);
  const images = await Promise.all(BNS_QUOTE_TEMPLATE_PAGES.map(fetchImageData));

  drawCoverPage(doc, images[0], quote);

  doc.addPage([BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height], 'portrait');
  drawIntroPage(doc, images[1], quote, copy);

  doc.addPage([BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height], 'portrait');
  drawScopePage(doc, images[2], quote, copy);

  doc.addPage([BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height], 'portrait');
  drawTeamPage(doc, images[3], quote, copy);

  doc.addPage([BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height], 'portrait');
  drawValuePage(doc, images[4], quote, copy);

  doc.addPage([BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height], 'portrait');
  drawOfferPage(doc, images[5], quote, copy);

  doc.addPage([BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height], 'portrait');
  drawPaymentPage(doc, images[6], quote, copy);

  doc.addPage([BNS_QUOTE_PAGE.width, BNS_QUOTE_PAGE.height], 'portrait');
  drawClosingPage(doc, images[7], copy);

  return doc.output('blob');
}
