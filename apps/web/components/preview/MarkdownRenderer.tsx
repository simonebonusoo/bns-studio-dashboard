import { type ReactNode } from 'react';

/**
 * Renderer Markdown minimale e self-contained (nessuna dipendenza esterna).
 * Copre i costrutti dei documenti BnsStudio: titoli, grassetto/corsivo, codice,
 * liste, citazioni, link, righe orizzontali, tabelle semplici. L'output è
 * costruito come nodi React (niente dangerouslySetInnerHTML → niente XSS).
 */

let keySeq = 0;
const nextKey = () => `md-${keySeq++}`;

/** Parsing inline: code, link, grassetto, corsivo, strikethrough. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Regex con gruppi alternativi; l'ordine conta (code prima di tutto).
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('`')) {
      nodes.push(<code key={nextKey()} className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'));
      const href = token.slice(token.indexOf('(') + 1, -1);
      nodes.push(
        <a key={nextKey()} href={href} target="_blank" rel="noopener noreferrer" className="text-info underline underline-offset-2">{label}</a>,
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={nextKey()}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('~~')) {
      nodes.push(<s key={nextKey()}>{token.slice(2, -2)}</s>);
    } else {
      nodes.push(<em key={nextKey()}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownRenderer({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    if (buf.length === 0) return;
    blocks.push(
      <p key={nextKey()} className="my-2 leading-relaxed">{renderInline(buf.join(' '))}</p>,
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code fence ```
    if (/^```/.test(line.trim())) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++]);
      i++; // salta la chiusura
      blocks.push(
        <pre key={nextKey()} className="my-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-sm"><code>{code.join('\n')}</code></pre>,
      );
      continue;
    }

    // Titoli
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'];
      const Tag = (`h${level}`) as keyof JSX.IntrinsicElements;
      blocks.push(
        <Tag key={nextKey()} className={`mt-4 mb-2 font-semibold ${sizes[level - 1]}`}>{renderInline(heading[2])}</Tag>,
      );
      i++;
      continue;
    }

    // Riga orizzontale
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(<hr key={nextKey()} className="my-4 border-border" />);
      i++;
      continue;
    }

    // Citazione
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(
        <blockquote key={nextKey()} className="my-3 border-l-2 border-accent/50 pl-3 text-fg-subtle">{renderInline(quote.join(' '))}</blockquote>,
      );
      continue;
    }

    // Tabella semplice (| a | b | con riga separatrice |---|)
    if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={nextKey()} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>{header.map((h) => <th key={nextKey()} className="border border-border bg-surface-2 px-2 py-1 text-left font-semibold">{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => <tr key={nextKey()}>{r.map((c) => <td key={nextKey()} className="border border-border px-2 py-1">{renderInline(c)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Liste (raggruppa righe consecutive)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        items.push(<li key={nextKey()} className="my-0.5">{renderInline(content)}</li>);
        i++;
      }
      blocks.push(
        ordered
          ? <ol key={nextKey()} className="my-2 ml-5 list-decimal space-y-0.5">{items}</ol>
          : <ul key={nextKey()} className="my-2 ml-5 list-disc space-y-0.5">{items}</ul>,
      );
      continue;
    }

    // Riga vuota → separa paragrafi
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragrafo (accumula righe fino a vuoto/blocco)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s+|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    flushParagraph(para);
  }

  return <div className={className}>{blocks}</div>;
}
