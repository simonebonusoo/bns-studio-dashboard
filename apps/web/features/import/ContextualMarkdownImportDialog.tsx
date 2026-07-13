import { useRef, useState } from 'react';
import { Download, FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { MarkdownImportReview } from './MarkdownImportReview';
import { downloadMarkdownTemplate, templateForEntity } from './markdownTemplates';
import {
  analyzeMarkdownFiles,
  loadImportContext,
  type ImportCandidate,
  type ImportContextData,
} from '@/services/markdownImport';
import {
  applyRelationshipSelection,
  buildContextualDefaults,
  summarizeRelationships,
  type ContextualEntityType,
  type ResolvedImport,
} from './contextualImport';

const ENTITY_LABELS: Record<ContextualEntityType, string> = {
  client: 'cliente',
  project: 'progetto',
  estimate: 'preventivo',
  contract: 'contratto',
  invoice: 'fattura',
  payment: 'pagamento',
};

type Step = 'pick' | 'analyzing' | 'review';

export function ContextualMarkdownImportDialog({
  open,
  onClose,
  entityType,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  entityType: ContextualEntityType;
  onContinue: (result: ResolvedImport) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [candidate, setCandidate] = useState<ImportCandidate | null>(null);
  const [context, setContext] = useState<ImportContextData | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const template = templateForEntity(entityType);

  const reset = () => {
    setStep('pick');
    setCandidate(null);
    setContext(null);
    setSelections({});
    setFileName('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const analyze = async (file?: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.md') && !lower.endsWith('.markdown')) {
      toast.error('Il file selezionato non è un Markdown valido.');
      return;
    }
    setStep('analyzing');
    setFileName(file.name);
    try {
      const content = await file.text();
      const [analysis, importContext] = await Promise.all([
        analyzeMarkdownFiles([{ name: file.name, content }], { expectedEntityType: entityType }),
        loadImportContext(),
      ]);
      const best = analysis.candidates.find((item) => item.entityType === entityType && item.duplicateStatus !== 'invalid')
        ?? analysis.candidates.find((item) => item.entityType === entityType)
        ?? null;
      if (!best) {
        toast.error(`Non sono riuscito a trovare dati ${ENTITY_LABELS[entityType]} nel documento.`);
        setStep('pick');
        return;
      }
      const nextSelections = Object.fromEntries(
        summarizeRelationships(best, importContext)
          .filter((summary) => summary.status === 'matched' && summary.options.length === 1)
          .map((summary) => [summary.field, summary.options[0].id]),
      );
      setCandidate(best);
      setContext(importContext);
      setSelections(nextSelections);
      setStep('review');
    } catch (error) {
      console.error('[BnsStudio] Import contestuale Markdown fallito', error);
      toast.error(error instanceof Error ? error.message : 'Analisi del Markdown non riuscita.');
      setStep('pick');
    }
  };

  const continueToForm = () => {
    if (!candidate || !context) return;
    if (candidate.warnings.some((warning) => warning.code === 'entity_type_mismatch')) {
      toast.error(candidate.warnings.find((warning) => warning.code === 'entity_type_mismatch')?.message);
      return;
    }
    if (candidate.duplicateStatus !== 'new' && candidate.duplicateStatus !== 'invalid') {
      toast.error('Esiste già un record simile: apri il dettaglio e aggiornalo manualmente.');
      return;
    }
    if (hasInstallmentTotalMismatch(candidate)) {
      toast.error("Il totale delle rate non coincide con l'importo del pagamento.");
      return;
    }
    const resolved = applyRelationshipSelection(candidate, selections);
    onContinue(buildContextualDefaults(entityType, resolved, context));
    close();
  };

  const summaries = candidate && context ? summarizeRelationships(candidate, context) : [];
  const hasBlockingError = candidate?.warnings.some((warning) => warning.code === 'entity_type_mismatch') || (
    candidate?.duplicateStatus !== undefined
    && candidate.duplicateStatus !== 'new'
    && candidate.duplicateStatus !== 'invalid'
  ) || (candidate ? hasInstallmentTotalMismatch(candidate) : false);

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === 'review' ? 'Anteprima importazione' : `Importa Markdown ${ENTITY_LABELS[entityType]}`}
      description={step === 'review' ? 'Controlla e correggi i dati estratti prima di continuare.' : 'Import contestuale: verrà creata una sola entità e i dati precompileranno il form esistente.'}
      size="xl"
      footer={
        step === 'review' ? (
          <>
            <Button variant="ghost" onClick={close}>Annulla</Button>
            <Button variant="secondary" onClick={reset}>Indietro</Button>
            <Button onClick={continueToForm} disabled={hasBlockingError}>Continua</Button>
          </>
        ) : undefined
      }
    >
      {step === 'pick' && (
        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={(event) => {
              void analyze(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          {template && (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => void downloadMarkdownTemplate(template)}>
                <Download className="h-4 w-4" /> Scarica modello {template.label}
              </Button>
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2/50 px-6 py-8 text-center transition-colors hover:border-border-strong"
          >
            <FileUp className="h-9 w-9 text-fg-faint" />
            <p className="mt-3 text-sm font-medium">Scegli un file `.md` per {ENTITY_LABELS[entityType]}</p>
            <p className="mt-1 text-sm text-fg-subtle">Il file resta locale: prima vedrai una review, poi il form precompilato.</p>
          </button>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm font-medium">Analisi del Markdown…</p>
          <p className="max-w-md text-sm text-fg-subtle">Sto estraendo solo dati {ENTITY_LABELS[entityType]} e verificando i collegamenti esistenti.</p>
        </div>
      )}

      {step === 'review' && candidate && (
        <div className="space-y-4">
          <p className="text-xs text-fg-subtle">File selezionato: {fileName}</p>
          <MarkdownImportReview
            candidate={candidate}
            relationshipSummaries={summaries}
            selections={selections}
            onRelationshipChange={(field, id) => setSelections((current) => ({ ...current, [field]: id }))}
            onChange={(normalizedFields) => setCandidate((current) => current ? { ...current, normalizedFields } : current)}
          />

          {candidate.duplicateStatus !== 'new' && candidate.duplicateStatus !== 'invalid' && (
            <Card>
              <CardHeader title="Possibile duplicato" />
              <div className="space-y-2 p-4 text-sm text-warning">
                Questo Markdown corrisponde a un record esistente. L'import contestuale non crea duplicati: aggiorna il record esistente dal dettaglio.
              </div>
            </Card>
          )}

          <p className="text-sm text-fg-subtle">
            Prossimo step: il form BnsStudio si aprirà precompilato. Puoi correggere campi mancanti o relazioni prima di salvare.
          </p>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Cambia file
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={(event) => {
              void analyze(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </div>
      )}
    </Modal>
  );
}

function hasInstallmentTotalMismatch(candidate: ImportCandidate) {
  if (candidate.entityType !== 'payment' || !Array.isArray(candidate.normalizedFields.installments) || candidate.normalizedFields.installments.length === 0) return false;
  const amount = Number(candidate.normalizedFields.amount ?? 0);
  const total = candidate.normalizedFields.installments.reduce((sum, installment) => sum + Number((installment as Record<string, unknown>).amount ?? 0), 0);
  return Math.abs(amount - total) > 0.005;
}
