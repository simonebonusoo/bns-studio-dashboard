import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeDownloadFilename, saveBlobFile, saveTextFile, toUint8Array } from '../apps/web/services/downloadService';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('downloadService', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:download-test'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('converte testo UTF-8 in Uint8Array senza perdere caratteri', async () => {
    const text = 'Cliente BNS - città, preventivo € e firma';
    const bytes = await toUint8Array(text);

    expect(ArrayBuffer.isView(bytes)).toBe(true);
    expect(new TextDecoder().decode(bytes)).toBe(text);
  });

  it('preserva byte PDF e ArrayBuffer', async () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const fromArray = await toUint8Array(pdfHeader);
    const fromBuffer = await toUint8Array(pdfHeader.buffer);

    expect([...fromArray]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect([...fromBuffer.slice(0, 5)]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it('normalizza nomi file non validi per dialog nativi e browser', () => {
    expect(sanitizeDownloadFilename('../Cliente: Demo/Report finale?.md')).toBe('Cliente- Demo-Report finale-.md');
    expect(sanitizeDownloadFilename('   ')).toBe('download');
  });

  it('usa il ramo web con anchor download per Markdown, PDF e CSV', async () => {
    const appended: HTMLAnchorElement[] = [];
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      appended.push(node as HTMLAnchorElement);
      return node;
    });

    await saveTextFile('cliente.md', '# Cliente', 'text/markdown;charset=utf-8');
    await saveBlobFile('fattura.pdf', new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }), 'application/pdf');
    await saveTextFile('fatture.csv', 'numero;totale', 'text/csv;charset=utf-8;');

    expect(appended.map((anchor) => anchor.download)).toEqual(['cliente.md', 'fattura.pdf', 'fatture.csv']);
    expect(clickSpy).toHaveBeenCalledTimes(3);
    expect(appendSpy).toHaveBeenCalledTimes(3);
  });
});
