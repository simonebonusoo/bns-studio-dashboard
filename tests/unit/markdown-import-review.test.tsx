import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownImportReview } from '@/features/import/MarkdownImportReview';
import type { ImportCandidate } from '@/services/markdownImport';

function candidate(overrides: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    temporaryId: 'imp-test',
    entityType: 'client',
    sourceFile: 'cliente.md',
    sourceSection: 'Cliente',
    confidence: 0.95,
    rawFields: {},
    normalizedFields: {
      displayName: 'Kokoro Sushi',
      status: 'prospect',
      priority: 'medium',
    },
    relationshipHints: [],
    warnings: [],
    duplicateStatus: 'new',
    action: 'create',
    importState: 'pending',
    ...overrides,
  };
}

describe('MarkdownImportReview', () => {
  it('mostra label italiane e propaga modifiche preview', () => {
    const onChange = vi.fn();
    render(<MarkdownImportReview candidate={candidate()} onChange={onChange} />);

    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Stato')).toBeInTheDocument();
    expect(screen.getByText('Priorita')).toBeInTheDocument();
    expect(screen.queryByText('displayName')).not.toBeInTheDocument();
    expect(screen.queryByText('medium')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Kokoro Sushi'), { target: { value: 'Kokoro Sushi Roma' } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Kokoro Sushi Roma' }));
  });
});
