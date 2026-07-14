import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from '@/components/preview/MarkdownRenderer';

const renderMd = (src: string) => render(<MarkdownRenderer source={src} />).container;

describe('MarkdownRenderer', () => {
  it('rende i titoli come heading', () => {
    const c = renderMd('# Titolo\n## Sotto');
    expect(c.querySelector('h1')?.textContent).toBe('Titolo');
    expect(c.querySelector('h2')?.textContent).toBe('Sotto');
  });

  it('rende grassetto, corsivo e codice inline', () => {
    const c = renderMd('Testo **bold** e *italic* e `code`.');
    expect(c.querySelector('strong')?.textContent).toBe('bold');
    expect(c.querySelector('em')?.textContent).toBe('italic');
    expect(c.querySelector('code')?.textContent).toBe('code');
  });

  it('rende i link con href e target sicuro', () => {
    const c = renderMd('Vai su [BNS](https://bns.studio).');
    const a = c.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://bns.studio');
    expect(a?.getAttribute('rel')).toContain('noopener');
    expect(a?.textContent).toBe('BNS');
  });

  it('rende liste non ordinate e ordinate', () => {
    expect(renderMd('- uno\n- due').querySelectorAll('ul li')).toHaveLength(2);
    expect(renderMd('1. primo\n2. secondo').querySelectorAll('ol li')).toHaveLength(2);
  });

  it('rende blocchi di codice e citazioni', () => {
    expect(renderMd('```\nconst x = 1\n```').querySelector('pre code')?.textContent).toContain('const x = 1');
    expect(renderMd('> nota importante').querySelector('blockquote')?.textContent).toBe('nota importante');
  });

  it('rende una tabella semplice', () => {
    const c = renderMd('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(c.querySelectorAll('table th')).toHaveLength(2);
    expect(c.querySelectorAll('table tbody tr')).toHaveLength(1);
  });

  it('non inietta HTML grezzo (niente XSS)', () => {
    const c = renderMd('Ciao <script>alert(1)</script> mondo');
    expect(c.querySelector('script')).toBeNull();
    expect(c.textContent).toContain('<script>');
  });
});
