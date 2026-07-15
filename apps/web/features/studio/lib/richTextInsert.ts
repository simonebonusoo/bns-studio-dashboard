export type RichTextAction = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'list' | 'quote';

export interface RichTextInsertResult {
  text: string;
  selStart: number;
  selEnd: number;
}

const inlineMarkers: Partial<Record<RichTextAction, [string, string]>> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  code: ['`', '`'],
};

export function applyMarkdown(
  text: string,
  selStart: number,
  selEnd: number,
  action: RichTextAction,
): RichTextInsertResult {
  const start = Math.max(0, Math.min(selStart, selEnd, text.length));
  const end = Math.max(0, Math.min(Math.max(selStart, selEnd), text.length));
  const selected = text.slice(start, end);

  if (action === 'link') {
    const open = '[';
    const close = '](url)';
    return wrapSelection(text, start, end, selected, open, close);
  }

  if (action === 'list') {
    return prefixLines(text, start, end, '- ');
  }

  if (action === 'quote') {
    return prefixLines(text, start, end, '> ');
  }

  const markers = inlineMarkers[action];
  if (!markers) return { text, selStart: start, selEnd: end };

  return wrapSelection(text, start, end, selected, markers[0], markers[1]);
}

function wrapSelection(
  text: string,
  start: number,
  end: number,
  selected: string,
  open: string,
  close: string,
): RichTextInsertResult {
  return {
    text: `${text.slice(0, start)}${open}${selected}${close}${text.slice(end)}`,
    selStart: start + open.length,
    selEnd: start + open.length + selected.length,
  };
}

function prefixLines(text: string, start: number, end: number, prefix: string): RichTextInsertResult {
  if (start === end) {
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    return {
      text: `${text.slice(0, lineStart)}${prefix}${text.slice(lineStart)}`,
      selStart: start + prefix.length,
      selEnd: start + prefix.length,
    };
  }

  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEnd = selectionLineEnd(text, start, end);
  const block = text.slice(lineStart, lineEnd);
  const prefixed = block
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
  const startOffset = start - lineStart;
  const endOffset = Math.min(end - lineStart, block.length);

  return {
    text: `${text.slice(0, lineStart)}${prefixed}${text.slice(lineEnd)}`,
    selStart: start + prefix.length * (countNewlines(block.slice(0, startOffset)) + 1),
    selEnd: end + prefix.length * (countNewlines(block.slice(0, endOffset)) + 1),
  };
}

function selectionLineEnd(text: string, start: number, end: number): number {
  if (end > start && text[end - 1] === '\n') return end - 1;

  const nextBreak = text.indexOf('\n', end);
  return nextBreak === -1 ? text.length : nextBreak;
}

function countNewlines(value: string): number {
  return value.split('\n').length - 1;
}
