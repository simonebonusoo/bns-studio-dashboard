import { Link, useParams } from 'react-router-dom';
import { brandConfig } from '@/config/brandConfig';
import { ArrowLeft } from 'lucide-react';

const CONTENT: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'Documento placeholder. BNS Studio OS tratta i dati inseriti dagli utenti per finalità gestionali interne.',
      'In produzione i dati sono ospitati su Supabase con Row Level Security e isolamento per organizzazione.',
      'Questo testo è dimostrativo e va sostituito con l’informativa privacy definitiva verificata legalmente.',
    ],
  },
  terms: {
    title: 'Termini di Servizio',
    body: [
      'Documento placeholder. L’uso di BNS Studio OS è soggetto ai termini definiti da BNS Studio.',
      'Il software è fornito “così com’è” come strumento gestionale interno.',
      'Sostituire con i termini definitivi prima di un utilizzo pubblico.',
    ],
  },
  'financial-disclaimer': {
    title: 'Financial Disclaimer',
    body: [
      'BNS Studio OS è uno strumento gestionale e non sostituisce consulenza fiscale o legale.',
      'Le fatture generate devono essere verificate: il sistema non è un servizio certificato di fatturazione elettronica.',
      'I dati finanziari dipendono dalla correttezza dei dati inseriti. Preventivi e contratti vanno verificati prima dell’invio.',
    ],
  },
};

export default function LegalPage() {
  const { doc } = useParams();
  const content = CONTENT[doc ?? 'privacy'] ?? CONTENT.privacy;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <img src={brandConfig.logos.light} alt={brandConfig.name} className="mb-8 h-6 dark:hidden" />
      <img src={brandConfig.logos.dark} alt={brandConfig.name} className="mb-8 hidden h-6 dark:block" />
      <h1 className="text-2xl font-bold">{content.title}</h1>
      <div className="mt-4 space-y-3 text-sm text-fg-subtle">
        {content.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <Link to="/" className="mt-8 inline-flex items-center gap-1.5 text-sm text-info hover:underline">
        <ArrowLeft className="h-4 w-4" /> Torna all'app
      </Link>
    </div>
  );
}
