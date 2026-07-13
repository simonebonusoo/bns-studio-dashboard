import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import {
  BNS_ENTITY_LABELS,
  fieldLabel,
  formatConfidenceLabel,
  formatDuplicateLabel,
  formatEnumLabel,
  getFieldOptions,
  INSTALLMENT_STATUS_OPTIONS,
  orderedFieldEntries,
  type ImportCandidate,
  type ImportEntityType,
} from '@/services/markdownImport';
import type { RelationshipSummary } from './contextualImport';

export function MarkdownImportReview({
  candidate,
  relationshipSummaries = [],
  selections = {},
  onChange,
  onRelationshipChange,
  action,
  onActionChange,
  availableActions,
}: {
  candidate: ImportCandidate;
  relationshipSummaries?: RelationshipSummary[];
  selections?: Record<string, string>;
  onChange: (fields: Record<string, unknown>) => void;
  onRelationshipChange?: (field: string, id: string) => void;
  action?: ImportCandidate['action'];
  onActionChange?: (action: ImportCandidate['action']) => void;
  availableActions?: ImportCandidate['action'][];
}) {
  const entityLabel = BNS_ENTITY_LABELS[candidate.entityType as keyof typeof BNS_ENTITY_LABELS] ?? candidate.entityType;

  const patchField = (fieldKey: string, value: unknown) => {
    onChange({ ...candidate.normalizedFields, [fieldKey]: value });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Anteprima importazione"
          subtitle="Controlla e correggi i dati estratti prima di continuare."
        />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="neutral">Tipo: {entityLabel}</Badge>
            <Badge tone={candidate.confidence >= 0.82 ? 'success' : candidate.confidence >= 0.55 ? 'warning' : 'danger'}>
              {formatConfidenceLabel(candidate.confidence)}
            </Badge>
            <Badge tone={candidate.duplicateStatus === 'invalid' ? 'danger' : candidate.duplicateStatus === 'new' ? 'success' : 'warning'}>
              {formatDuplicateLabel(candidate.duplicateStatus, candidate.entityType)}
            </Badge>
          </div>
          <p className="text-xs text-fg-subtle">
            Origine: {candidate.sourceFile}
            {candidate.sourceSection ? ` · Sezione rilevata: ${entityLabel}` : ''}
          </p>
          {action && onActionChange && availableActions && (
            <Field label="Destinazione">
              <Select value={action} onChange={(event) => onActionChange(event.target.value as ImportCandidate['action'])}>
                {availableActions.map((item) => (
                  <option key={item} value={item}>{actionLabel(item, candidate.entityType)}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Card>

      {relationshipSummaries.length > 0 && (
        <Card>
          <CardHeader title="Collegamenti" subtitle="BnsStudio cerca record esistenti: non crea automaticamente le relazioni mancanti." />
          <div className="space-y-3 p-4">
            {relationshipSummaries.map((summary) => (
              <div key={summary.field} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{summary.label}</p>
                    <p className="text-xs text-fg-subtle">{summary.value}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle">
                    {summary.status === 'matched' ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-warning" />}
                    {summary.status === 'matched' ? `${summary.label} esistente trovato` : summary.status === 'ambiguous' ? 'Scegli una corrispondenza' : `${summary.label} non trovato`}
                  </span>
                </div>
                {summary.options.length > 0 && onRelationshipChange && (
                  <Field label={`Seleziona ${summary.label.toLowerCase()}`} className="mt-3">
                    <Select value={selections[summary.field] ?? ''} onChange={(event) => onRelationshipChange(summary.field, event.target.value)}>
                      <option value="">Nessuna selezione</option>
                      {summary.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={`Dati ${entityLabel.toLowerCase()}`} />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {orderedFieldEntries(candidate.entityType, candidate.normalizedFields).map(([fieldKey, value]) => (
            <Field key={fieldKey} label={fieldLabel(fieldKey)} className={wideField(fieldKey) ? 'md:col-span-2' : undefined}>
              <ReviewFieldEditor
                entityType={candidate.entityType}
                fieldKey={fieldKey}
                value={value}
                onChange={(nextValue) => patchField(fieldKey, nextValue)}
              />
            </Field>
          ))}
        </div>
      </Card>

      {candidate.warnings.length > 0 && (
        <Card>
          <CardHeader title="Avvisi" />
          <div className="space-y-2 p-4">
            {candidate.warnings.map((warning, index) => (
              <div key={`${warning.code}-${index}`} className={`rounded-lg px-3 py-2 text-sm ${warning.level === 'error' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                {warning.message}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function actionLabel(action: ImportCandidate['action'], entityType: ImportEntityType) {
  const entity = (BNS_ENTITY_LABELS[entityType as keyof typeof BNS_ENTITY_LABELS] ?? 'record').toLowerCase();
  if (action === 'create') return `Crea nuovo ${entity}`;
  if (action === 'update') return `Aggiorna ${entity} esistente`;
  return 'Ignora questo elemento';
}

function wideField(fieldKey: string) {
  return ['description', 'notes', 'terms', 'items', 'installments', 'tags'].includes(fieldKey);
}

function ReviewFieldEditor({
  entityType,
  fieldKey,
  value,
  onChange,
}: {
  entityType: ImportEntityType;
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (fieldKey === 'items' && Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => {
          const line = item as Record<string, unknown>;
          return (
            <div key={`${fieldKey}-${index}`} className="grid gap-2 rounded-xl border border-border bg-surface-2/40 p-3 sm:grid-cols-4">
              <Field label="Descrizione" className="sm:col-span-4">
                <Input value={String(line.description ?? '')} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...line, description: event.target.value };
                  onChange(next);
                }} />
              </Field>
              <Field label="Quantita">
                <Input type="number" step="0.01" value={String(line.quantity ?? 1)} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...line, quantity: Number(event.target.value) };
                  onChange(next);
                }} />
              </Field>
              <Field label="Prezzo unitario">
                <Input type="number" step="0.01" value={String(line.unitPrice ?? 0)} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...line, unitPrice: Number(event.target.value) };
                  onChange(next);
                }} />
              </Field>
              <Field label="Sconto">
                <Input type="number" step="0.01" value={String(line.discountPct ?? 0)} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...line, discountPct: Number(event.target.value) };
                  onChange(next);
                }} />
              </Field>
              <Field label="IVA">
                <Input type="number" step="0.01" value={String(line.vatRate ?? 22)} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...line, vatRate: Number(event.target.value) };
                  onChange(next);
                }} />
              </Field>
            </div>
          );
        })}
      </div>
    );
  }

  if (fieldKey === 'installments' && Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => {
          const installment = item as Record<string, unknown>;
          return (
            <div key={`${fieldKey}-${index}`} className="grid gap-2 rounded-xl border border-border bg-surface-2/40 p-3 sm:grid-cols-3">
              <p className="text-sm font-semibold sm:col-span-3">Rata {index + 1}</p>
              <Field label="Importo">
                <Input type="number" step="0.01" value={String(installment.amount ?? 0)} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...installment, amount: Number(event.target.value) };
                  onChange(next);
                }} />
              </Field>
              <Field label="Scadenza">
                <Input type="date" value={String(installment.dueDate ?? '')} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...installment, dueDate: event.target.value };
                  onChange(next);
                }} />
              </Field>
              <Field label="Stato">
                <Select value={String(installment.status ?? 'scheduled')} onChange={(event) => {
                  const next = [...value] as Record<string, unknown>[];
                  next[index] = { ...installment, status: event.target.value };
                  onChange(next);
                }}>
                  {INSTALLMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
            </div>
          );
        })}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="accent-accent" />{value ? 'Si' : 'No'}</label>;
  }

  if (typeof value === 'number') {
    return <Input type="number" step="0.01" value={String(value)} onChange={(event) => onChange(Number(event.target.value))} />;
  }

  if (Array.isArray(value)) {
    return <Input value={value.join(', ')} onChange={(event) => onChange(event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean))} />;
  }

  const stringValue = String(value ?? '');
  const options = getFieldOptions(entityType, fieldKey);
  if (options) {
    return (
      <Select value={stringValue} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    );
  }

  if ((fieldKey.toLowerCase().includes('date') || ['dueDate', 'expiryDate', 'issueDate'].includes(fieldKey)) && !stringValue.includes('T')) {
    return <Input type="date" value={stringValue} onChange={(event) => onChange(event.target.value)} />;
  }

  if (['description', 'notes', 'terms'].includes(fieldKey)) {
    return <Textarea value={stringValue} onChange={(event) => onChange(event.target.value)} />;
  }

  return <Input value={formatEnumLabel(fieldKey, stringValue, entityType)} onChange={(event) => onChange(event.target.value)} />;
}
