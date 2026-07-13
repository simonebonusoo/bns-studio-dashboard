import { useMemo, useRef, useState } from 'react';
import { Download, FileUp, Loader2, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { useAuth } from '@/stores/auth';
import { queryKeys, useList } from '@/hooks/useEntities';
import type { MarkdownImport } from '@/types';
import {
  analyzeMarkdownFiles,
  detectDuplicates,
  ENTITY_GROUP_LABELS,
  ENTITY_LABELS,
  executeMarkdownImport,
  loadImportContext,
  type ImportAction,
  type ImportCandidate,
  type ImportEntityType,
  type ImportExecutionSummary,
  fieldLabel,
} from '@/services/markdownImport';
import { MarkdownImportReview } from './MarkdownImportReview';
import { MARKDOWN_TEMPLATES, downloadMarkdownTemplate } from './markdownTemplates';
import { summarizeRelationships } from './contextualImport';
import type { ImportContextData } from '@/services/markdownImport';

type WizardStep = 1 | 2 | 3 | 4;

interface LocalMarkdownFile {
  id: string;
  file: File;
  name: string;
  size: number;
  content: string;
  status: 'ready' | 'error';
  error?: string;
}

const ACCEPTED_EXTENSIONS = ['.md', '.markdown'];
const MAX_FILES = 12;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Caricamento',
  2: 'Analisi',
  3: 'Revisione',
  4: 'Importazione',
};

export default function ImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useAuth((state) => state.can);
  const canImport = can('imports.manage');
  const { data: history } = useList<MarkdownImport>('markdownImports', { enabled: canImport });
  const [step, setStep] = useState<WizardStep>(1);
  const [files, setFiles] = useState<LocalMarkdownFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [summary, setSummary] = useState<ImportExecutionSummary | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [context, setContext] = useState<ImportContextData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    return (Object.keys(ENTITY_GROUP_LABELS) as ImportEntityType[]).map((entityType) => ({
      entityType,
      label: ENTITY_GROUP_LABELS[entityType],
      items: candidates.filter((candidate) => candidate.entityType === entityType),
    })).filter((group) => group.items.length > 0);
  }, [candidates]);

  const handleFiles = async (inputFiles: File[]) => {
    const next: LocalMarkdownFile[] = [];
    const existingCount = files.length;
    for (const file of inputFiles.slice(0, Math.max(0, MAX_FILES - existingCount))) {
      const lower = file.name.toLowerCase();
      const accepted = ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
      if (!accepted) {
        next.push({ id: crypto.randomUUID(), file, name: file.name, size: file.size, content: '', status: 'error', error: 'Estensione non supportata. Usa solo file .md o .markdown.' });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        next.push({ id: crypto.randomUUID(), file, name: file.name, size: file.size, content: '', status: 'error', error: 'File troppo grande. Limite massimo 2 MB.' });
        continue;
      }
      try {
        const content = await file.text();
        next.push({ id: crypto.randomUUID(), file, name: file.name, size: file.size, content, status: 'ready' });
      } catch {
        next.push({ id: crypto.randomUUID(), file, name: file.name, size: file.size, content: '', status: 'error', error: 'Impossibile leggere il file localmente.' });
      }
    }
    setFiles((current) => [...current, ...next]);
  };

  const analyze = async () => {
    const readyFiles = files.filter((file) => file.status === 'ready');
    if (readyFiles.length === 0) {
      toast.error('Carica almeno un file Markdown valido.');
      return;
    }
    setStep(2);
    setAnalyzing(true);
    setSummary(null);
    try {
      const [analysis, importContext] = await Promise.all([
        analyzeMarkdownFiles(readyFiles.map((file) => ({ name: file.name, content: file.content }))),
        loadImportContext(),
      ]);
      setContext(importContext);
      setCandidates(analysis.candidates);
      setExpandedIds(Object.fromEntries(analysis.candidates.slice(0, 6).map((candidate) => [candidate.temporaryId, true])));
      setStep(3);
      toast.success(`${analysis.candidateCount} elementi analizzati`);
    } catch (error) {
      console.error('[BnsStudio] Analisi markdown fallita:', error);
      toast.error(error instanceof Error ? error.message : 'Analisi non riuscita');
      setStep(1);
    } finally {
      setAnalyzing(false);
    }
  };

  const refreshDuplicates = async () => {
    try {
      const context = await loadImportContext();
      const cloned = structuredClone(candidates) as ImportCandidate[];
      detectDuplicates(cloned, context);
      setCandidates(cloned);
      toast.success('Conflitti e duplicati aggiornati');
    } catch (error) {
      console.error('[BnsStudio] Aggiornamento duplicati fallito:', error);
      toast.error('Impossibile aggiornare i duplicati');
    }
  };

  const runImport = async () => {
    if (candidates.length === 0) {
      toast.error('Nessun candidato da importare.');
      return;
    }
    setStep(4);
    setImporting(true);
    try {
      const result = await executeMarkdownImport(structuredClone(candidates) as ImportCandidate[], files.filter((file) => file.status === 'ready').map((file) => file.name));
      setCandidates(result.candidates);
      setSummary(result.summary);

      ['clients', 'services', 'projects', 'estimates', 'contracts', 'invoices', 'payments', 'transactions', 'events', 'markdownImports']
        .forEach((entity) => qc.invalidateQueries({ queryKey: [entity] }));
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.analytics });
      toast.success('Importazione completata');
    } catch (error) {
      console.error('[BnsStudio] Import markdown fallito:', error);
      toast.error(error instanceof Error ? error.message : 'Importazione non riuscita');
    } finally {
      setImporting(false);
    }
  };

  const updateCandidate = (temporaryId: string, updater: (candidate: ImportCandidate) => ImportCandidate) => {
    setCandidates((current) => current.map((candidate) => (candidate.temporaryId === temporaryId ? updater(candidate) : candidate)));
  };

  if (!canImport) {
    return <EmptyState icon={<FileUp className="h-8 w-8" />} title="Import non disponibile" description="Il tuo ruolo non ha i permessi per importare dati Markdown." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Importa dati" description="Trasforma documenti Markdown operativi in dati strutturati BnsStudio." actions={step >= 3 ? <Button variant="secondary" onClick={refreshDuplicates}><RefreshCcw className="h-4 w-4" /> Rivalida</Button> : <Button onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Aggiungi file</Button>} />

      <StepBar step={step} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {step === 1 && (
            <Card>
              <CardHeader title="Caricamento Markdown" subtitle="Drag & drop, file picker e upload multiplo. I file restano locali fino alla conferma dell'import." />
              <div className="space-y-4 p-4">
                <input ref={inputRef} type="file" className="hidden" accept=".md,.markdown,text/markdown,text/plain" multiple onChange={(event) => { const selected = Array.from(event.target.files ?? []); void handleFiles(selected); event.currentTarget.value = ''; }} />
                <button
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => { event.preventDefault(); setDragActive(false); void handleFiles(Array.from(event.dataTransfer.files)); }}
                  className={`flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${dragActive ? 'border-accent bg-accent/5' : 'border-border bg-surface-2/50 hover:border-border-strong'}`}
                >
                  <FileUp className="h-9 w-9 text-fg-faint" />
                  <p className="mt-3 text-sm font-medium">Trascina qui i file `.md` oppure clicca per selezionare</p>
                  <p className="mt-1 text-xs text-fg-subtle">Massimo {MAX_FILES} file, 2 MB ciascuno. Nessun upload automatico su Storage.</p>
                </button>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-fg-subtle">{Math.round(file.size / 1024)} KB · {file.status === 'ready' ? 'Pronto' : file.error}</p>
                        </div>
                        <button onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} className="rounded-md p-1.5 text-fg-faint hover:bg-surface hover:text-danger" aria-label="Rimuovi file">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={analyze} disabled={analyzing || files.filter((file) => file.status === 'ready').length === 0}>Analizza i file</Button>
                </div>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm font-medium">Analisi locale in corso</p>
                <p className="max-w-md text-sm text-fg-subtle">Sto leggendo frontmatter, heading, tabelle, liste e relazioni per costruire l’anteprima completa dell’import.</p>
              </div>
            </Card>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {grouped.map((group) => (
                <Card key={group.entityType}>
                  <CardHeader title={group.label} subtitle={`${group.items.length} elementi`} />
                  <div className="space-y-3 p-4">
                    {group.items.map((candidate) => {
                      const expanded = expandedIds[candidate.temporaryId] ?? false;
                      return (
                        <div key={candidate.temporaryId} className="rounded-xl border border-border">
                          <button onClick={() => setExpandedIds((current) => ({ ...current, [candidate.temporaryId]: !expanded }))} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{String(candidate.normalizedFields.displayName ?? candidate.normalizedFields.name ?? candidate.normalizedFields.number ?? candidate.normalizedFields.title ?? candidate.sourceSection ?? candidate.sourceFile)}</p>
                              <p className="text-xs text-fg-subtle">{ENTITY_LABELS[candidate.entityType]} · {confidenceLabel(candidate.confidence)} · {duplicateLabel(candidate.duplicateStatus, candidate.entityType)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={candidate.confidence >= 0.82 ? 'success' : candidate.confidence >= 0.55 ? 'warning' : 'danger'}>{confidenceLabel(candidate.confidence)}</Badge>
                              <Badge tone={duplicateTone(candidate.duplicateStatus)}>{duplicateLabel(candidate.duplicateStatus, candidate.entityType)}</Badge>
                            </div>
                          </button>

                          {expanded && (
                            <div className="space-y-4 border-t border-border px-4 py-4">
                              {candidate.duplicateStatus === 'existing_different' && candidate.existingSnapshot && (
                                <div className="space-y-2 rounded-xl border border-border bg-surface-2/50 p-3">
                                  <p className="text-sm font-medium">Un record simile esiste già</p>
                                  {Object.entries(candidate.existingSnapshot).map(([key, databaseValue]) => {
                                    const markdownValue = candidate.normalizedFields[key];
                                    if (JSON.stringify(databaseValue ?? null) === JSON.stringify(markdownValue ?? null)) return null;
                                    return (
                                      <div key={key} className="rounded-lg border border-border bg-surface px-3 py-2">
                                        <p className="text-xs font-medium uppercase tracking-wide text-fg-faint">{fieldLabel(key)}</p>
                                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                                          <div>
                                            <p className="text-2xs text-fg-faint">Database</p>
                                            <p className="text-sm">{formatFieldValue(databaseValue)}</p>
                                          </div>
                                          <div>
                                            <p className="text-2xs text-fg-faint">Markdown</p>
                                            <p className="text-sm">{formatFieldValue(markdownValue)}</p>
                                          </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <Button variant="secondary" size="sm" onClick={() => updateCandidate(candidate.temporaryId, (current) => ({ ...current, normalizedFields: { ...current.normalizedFields, [key]: databaseValue } }))}>Mantieni DB</Button>
                                          <Button variant="ghost" size="sm" onClick={() => updateCandidate(candidate.temporaryId, (current) => ({ ...current, normalizedFields: { ...current.normalizedFields, [key]: markdownValue } }))}>Usa Markdown</Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <MarkdownImportReview
                                candidate={candidate}
                                relationshipSummaries={context ? summarizeRelationships(candidate, context) : []}
                                selections={Object.fromEntries(candidate.relationshipHints.map((hint) => [hint.field, hint.resolvedId ?? '']))}
                                onRelationshipChange={(field, id) => updateCandidate(candidate.temporaryId, (current) => ({
                                  ...current,
                                  relationshipHints: current.relationshipHints.map((hint) => hint.field === field ? { ...hint, resolvedId: id || undefined } : hint),
                                }))}
                                action={candidate.action}
                                availableActions={availableActions(candidate)}
                                onActionChange={(action) => updateCandidate(candidate.temporaryId, (current) => ({ ...current, action }))}
                                onChange={(normalizedFields) => updateCandidate(candidate.temporaryId, (current) => ({ ...current, normalizedFields }))}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Torna ai file</Button>
                <Button onClick={runImport}>Importa in BnsStudio</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <Card>
              <CardHeader title="Importazione completata" subtitle={importing ? 'Sto salvando i record via repository e Supabase.' : undefined} />
              <div className="space-y-4 p-4">
                {importing && <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-4"><Loader2 className="h-5 w-5 animate-spin text-accent" /><p className="text-sm">Importazione in corso...</p></div>}
                {summary && (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                      <Metric label="Analizzati" value={summary.analyzed} />
                      <Metric label="Creati" value={summary.created} />
                      <Metric label="Aggiornati" value={summary.updated} />
                      <Metric label="Ignorati" value={summary.skipped} />
                      <Metric label="Errori" value={summary.failed} />
                    </div>

                    <div className="space-y-3">
                      {grouped.map((group) => (
                        <div key={group.entityType} className="rounded-xl border border-border">
                          <div className="flex items-center justify-between px-4 py-3">
                            <p className="font-medium">{group.label}</p>
                            <p className="text-sm text-fg-subtle">{summary.byEntity[group.entityType].created} creati · {summary.byEntity[group.entityType].updated} aggiornati · {summary.byEntity[group.entityType].failed} errori</p>
                          </div>
                          <div className="divide-y divide-border">
                            {candidates.filter((candidate) => candidate.entityType === group.entityType).map((candidate) => (
                              <div key={candidate.temporaryId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                <div>
                                  <p className="font-medium">{String(candidate.normalizedFields.displayName ?? candidate.normalizedFields.name ?? candidate.normalizedFields.number ?? candidate.normalizedFields.title ?? candidate.sourceSection ?? candidate.sourceFile)}</p>
                                  <p className="text-fg-subtle">{candidate.importState === 'failed' ? candidate.errorMessage : candidate.importState}</p>
                                </div>
                                {candidate.resultPath && <Button variant="secondary" size="sm" onClick={() => navigate(candidate.resultPath!)}>Apri</Button>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Modelli Markdown" subtitle="Template ufficiali BnsStudio v1 per Claude, Codex e compilazione manuale." />
            <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-1">
              {MARKDOWN_TEMPLATES.map((template) => (
                <Button key={template.entityType} variant="secondary" className="justify-start" onClick={() => void downloadMarkdownTemplate(template)}>
                  <Download className="h-4 w-4" /> {template.label}
                </Button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Importazioni recenti" subtitle="Storico persistito per organizzazione" />
            <div className="space-y-2 p-4">
              {(history ?? []).length === 0 ? <p className="text-sm text-fg-subtle">Nessuna importazione registrata.</p> : [...(history ?? [])].sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1)).slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-border px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{new Date(item.createdAt).toLocaleDateString('it-IT')}</p>
                    <Badge tone={item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}>{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-fg-subtle">{item.filesCount} file · {item.candidateCount} record · {item.createdCount} creati · {item.updatedCount} aggiornati</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Regole chiave" />
            <div className="space-y-2 p-4 text-sm text-fg-subtle">
              <p>Il Markdown non diventa mai source of truth: dopo la revisione i dati vengono salvati solo tramite repository e Supabase.</p>
              <p>I file restano locali durante parsing e analisi. Nessun invio a servizi AI esterni.</p>
              <p>Dashboard, Analytics e feed attività si aggiornano via invalidazione React Query dopo l’import.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepBar({ step }: { step: WizardStep }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3">
      {([1, 2, 3, 4] as WizardStep[]).map((item, index) => (
        <div key={item} className="flex items-center gap-2">
          <div className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold ${step >= item ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-faint'}`}>{item}</div>
          <p className={`text-sm ${step >= item ? 'text-fg' : 'text-fg-subtle'}`}>{STEP_LABELS[item]}</p>
          {index < 3 && <span className="mx-1 text-fg-faint">—</span>}
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-border px-3 py-3"><p className="text-xs text-fg-subtle">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return 'Alta affidabilità';
  if (confidence >= 0.7) return 'Da verificare';
  return 'Incerta';
}

function duplicateLabel(status: ImportCandidate['duplicateStatus'], entityType?: ImportEntityType) {
  const entity = entityType ? (ENTITY_LABELS[entityType] ?? 'record').toLowerCase() : 'record';
  return {
    new: `Crea nuovo ${entity}`,
    existing_identical: 'Gia presente',
    existing_different: 'Record esistente trovato',
    ambiguous_match: 'Corrispondenza ambigua',
    invalid: 'Da correggere',
  }[status];
}

function duplicateTone(status: ImportCandidate['duplicateStatus']): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'new':
    case 'existing_identical':
      return 'success';
    case 'existing_different':
    case 'ambiguous_match':
      return 'warning';
    case 'invalid':
      return 'danger';
  }
}

function availableActions(candidate: ImportCandidate) {
  switch (candidate.duplicateStatus) {
    case 'new':
      return ['create', 'skip'] as ImportAction[];
    case 'existing_identical':
      return ['skip', 'create'] as ImportAction[];
    case 'existing_different':
      return ['skip', 'update', 'create'] as ImportAction[];
    case 'ambiguous_match':
      return ['skip', 'create'] as ImportAction[];
    case 'invalid':
      return ['skip', 'create'] as ImportAction[];
  }
}

function formatFieldValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 0 ? '—' : JSON.stringify(value);
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sì' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
