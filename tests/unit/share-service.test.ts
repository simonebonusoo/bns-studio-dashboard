import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const saveBlobFile = vi.fn();
const saveTextFile = vi.fn();
vi.mock('@/services/downloadService', () => ({
  saveBlobFile: (...args: unknown[]) => saveBlobFile(...args),
  saveTextFile: (...args: unknown[]) => saveTextFile(...args),
}));
vi.mock('@/lib/platform', () => ({ isTauri: false }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { shareDocument } from '@/services/shareService';

describe('shareDocument', () => {
  beforeEach(() => {
    saveBlobFile.mockClear();
    saveTextFile.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('usa la Web Share API (url) quando disponibile', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });
    await shareDocument({ title: 'Preventivo', url: 'https://bns/x' });
    expect(share).toHaveBeenCalledWith({ title: 'Preventivo', text: undefined, url: 'https://bns/x' });
    expect(saveBlobFile).not.toHaveBeenCalled();
  });

  it('annullamento utente (AbortError) non propaga né attiva fallback', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    await expect(shareDocument({ title: 'T', url: 'u' })).resolves.toBeUndefined();
    expect(writeText).not.toHaveBeenCalled();
    expect(saveBlobFile).not.toHaveBeenCalled();
  });

  it('senza Web Share e senza allegato: copia il link negli appunti', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await shareDocument({ title: 'T', url: 'https://bns/y' });
    expect(writeText).toHaveBeenCalledWith('https://bns/y');
  });

  it('senza Web Share ma con blob: salva il file come fallback reale', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } });
    const blob = new Blob(['pdf']);
    await shareDocument({ title: 'T', filename: 'preventivo.pdf', blob, mime: 'application/pdf' });
    expect(saveBlobFile).toHaveBeenCalledWith('preventivo.pdf', blob, 'application/pdf');
  });
});
