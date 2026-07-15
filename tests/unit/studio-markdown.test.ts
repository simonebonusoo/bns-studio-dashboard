import { describe, expect, it } from 'vitest';

import { formatMessage } from '@/features/studio/lib/studioMarkdown';
import type { Member, StudioEntityReference } from '@/types';

const members = [
  {
    id: 'member-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada Lovelace',
  },
] as Member[];

const references = [
  {
    id: 'project-1',
    label: 'Progetto Alfa',
    href: '/projects/project-1',
  },
] as StudioEntityReference[];

const render = (content: string) => formatMessage(content, members, references);

describe('studio markdown formatter', () => {
  it('escapa i caratteri HTML utente', () => {
    expect(render('<div>&copy</div>')).toBe('&lt;div&gt;&amp;copy&lt;/div&gt;');
  });

  it('mantiene code inline, grassetto, a-capo, menzioni e riferimenti', () => {
    const html = render('Ciao @member:member-1 usa `x < y` e **ok**\n[[ref:project-1]]');

    expect(html).toContain('@Ada');
    expect(html).toContain('<code class="rounded bg-surface-2 px-1 py-0.5 text-[0.92em]">x &lt; y</code>');
    expect(html).toContain('<strong>ok</strong>');
    expect(html).toContain('<br />');
    expect(html).toContain('href="/projects/project-1"');
    expect(html).toContain('Progetto Alfa');
  });

  it('formatta corsivo e barrato', () => {
    expect(render('*corsivo* ~~barrato~~')).toBe('<em>corsivo</em> <del>barrato</del>');
  });

  it('formatta liste non ordinate e ordinate', () => {
    const html = render('- uno\n- due\n1. primo\n2. secondo');

    expect(html).toContain('<ul class="list-disc space-y-1 pl-5"><li>uno</li><li>due</li></ul>');
    expect(html).toContain('<ol class="list-decimal space-y-1 pl-5"><li>primo</li><li>secondo</li></ol>');
  });

  it('formatta citazioni', () => {
    expect(render('> citazione\n> **forte**')).toBe(
      '<blockquote class="border-l-2 border-border pl-3 text-muted">citazione<br /><strong>forte</strong></blockquote>',
    );
  });

  it('formatta titoli h3 e h4 con classi coerenti', () => {
    const html = render('# Titolo\n## Sezione\n### Dettaglio');

    expect(html).toContain('<h3 class="mt-3 text-base font-semibold text-fg">Titolo</h3>');
    expect(html).toContain('<h4 class="mt-3 text-sm font-semibold text-fg">Sezione</h4>');
    expect(html).toContain('<h4 class="mt-2 text-xs font-semibold uppercase text-muted">Dettaglio</h4>');
  });

  it('formatta blocchi di codice con linguaggio opzionale e contenuto escapato', () => {
    const html = render('```ts\nconst x = "<script>";\n```');

    expect(html).toBe(
      '<pre class="overflow-x-auto rounded-lg bg-surface-2 p-3"><code class="language-ts">const x = "&lt;script&gt;";\n</code></pre>',
    );
  });

  it('formatta link solo per URL http e https', () => {
    expect(render('[OpenAI](https://openai.com) [file](ftp://example.com)')).toBe(
      '<a class="font-medium text-info hover:underline" href="https://openai.com/" rel="noopener noreferrer" target="_blank">OpenAI</a> file',
    );
  });

  it('non produce script eseguibile da tag script in input', () => {
    const html = render('<script>alert(1)</script>');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('non produce link eseguibile da javascript URL', () => {
    const html = render('[x](javascript:alert(1))');

    expect(html).toBe('x');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('javascript:');
  });
});
