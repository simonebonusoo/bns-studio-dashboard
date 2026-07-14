/**
 * BNS Studio — configurazione branding centralizzata.
 * Tutti i riferimenti visivi (logo, colori, contatti, documenti) passano da qui.
 * Gli asset in /public/brand sono PLACEHOLDER neutri: sostituirli con quelli reali
 * mantenendo gli stessi percorsi.
 */
export const brandConfig = {
  name: 'BNS Studio',
  productName: 'BnsStudio',
  shortName: 'BnsStudio',
  version: 'v1.2.0',
  description: 'Il workspace operativo di BNS Studio.',

  logos: {
    light: '/favicon.png',
    dark: '/favicon.png',
    compact: '/favicon.png',
    icon: '/favicon.png',
    favicon: '/favicon.png',
  },

  colors: {
    primary: '#0f0f10',
    accent: '#c8f135', // lime BNS
  },

  contacts: {
    email: 'studio@bnsstudio.it',
    phone: '+39 000 000 0000',
    website: 'https://bnsstudio.it',
    address: 'Roma, Italia',
    vat: 'IT00000000000',
  },

  links: {
    website: 'https://bnsstudio.it',
    instagram: 'https://instagram.com/bnsstudio',
  },

  /** Impostazioni di default per la generazione documenti (preventivi/fatture). */
  document: {
    currency: 'EUR',
    locale: 'it-IT',
    vatRate: 22,
    paymentTermsDays: 30,
    footer: 'BNS Studio — documento generato con BnsStudio. Verificare prima dell’invio.',
    estimatePrefix: 'PREV',
    invoicePrefix: 'FAT',
    contractPrefix: 'CTR',
  },
} as const;

export type BrandConfig = typeof brandConfig;
