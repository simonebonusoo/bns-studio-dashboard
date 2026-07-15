import { useEffect, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { usePreview } from '@/components/preview/previewContext';
import { downloadPdf } from '@/services/documentService';
import { bnsEstimatePdfBlob, bnsPdfDefaults, type BnsPdfOptions } from '@/services/bnsEstimatePdf';
import type { Client, Estimate } from '@/types';

/**
 * Dialog di generazione del "PDF BnsStudio". I campi sono precompilati dai dati
 * del preventivo (modello ibrido): di solito basta confermare, ma le poche parti
 * variabili — titolo progetto, obiettivo, prezzo riservato, rate, validità —
 * restano modificabili prima di generare il documento.
 */
export function BnsPdfDialog({
  open,
  onClose,
  estimate,
  client,
}: {
  open: boolean;
  onClose: () => void;
  estimate: Estimate;
  client?: Client | null;
}) {
  const preview = usePreview();
  const [opts, setOpts] = useState<BnsPdfOptions>(() => bnsPdfDefaults(estimate, client));

  // Ricalcola i default quando cambia il preventivo o si riapre il dialog.
  useEffect(() => {
    if (open) setOpts(bnsPdfDefaults(estimate, client));
  }, [open, estimate, client]);

  const set = <K extends keyof BnsPdfOptions>(key: K, value: BnsPdfOptions[K]) =>
    setOpts((current) => ({ ...current, [key]: value }));

  const filename = `preventivo-bnsstudio-${estimate.number}.pdf`;

  const handlePreview = () => {
    preview.open({ name: filename, blob: bnsEstimatePdfBlob(estimate, client, opts), mime: 'application/pdf' });
  };

  const handleDownload = async () => {
    await downloadPdf(filename, bnsEstimatePdfBlob(estimate, client, opts));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="PDF BnsStudio"
      description="Documento impaginato in stile presentazione. I campi sono già compilati dal preventivo."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="secondary" onClick={handlePreview}>
            <Eye className="h-4 w-4" /> Anteprima
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4" /> Scarica PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Titolo progetto (copertina)">
          <Input value={opts.projectTitle} onChange={(e) => set('projectTitle', e.target.value)} />
        </Field>
        <Field label="Sottotitolo">
          <Input value={opts.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
        <Field label="Obiettivo del progetto" hint="Paragrafo nella pagina «Chi siamo».">
          <Textarea value={opts.objective ?? ''} onChange={(e) => set('objective', e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Prezzo riservato (€)" hint="Imponibile scontato, IVA esclusa.">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={Number.isFinite(opts.reservedPrice) ? opts.reservedPrice : 0}
              onChange={(e) => set('reservedPrice', Number(e.target.value))}
            />
          </Field>
          <Field label="Numero rate">
            <Input
              type="number"
              min={1}
              max={12}
              value={opts.installmentsCount}
              onChange={(e) => set('installmentsCount', Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            />
          </Field>
          <Field label="Validità (mesi)">
            <Input
              type="number"
              min={1}
              max={24}
              value={opts.validityMonths}
              onChange={(e) => set('validityMonths', Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
