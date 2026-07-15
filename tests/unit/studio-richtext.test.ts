import { describe, expect, it } from 'vitest';
import { applyMarkdown, type RichTextAction } from '@/features/studio/lib/richTextInsert';

const selectedCases: Array<{
  action: RichTextAction;
  expectedText: string;
  expectedSelStart: number;
  expectedSelEnd: number;
}> = [
  { action: 'bold', expectedText: 'hello **world**', expectedSelStart: 8, expectedSelEnd: 13 },
  { action: 'italic', expectedText: 'hello *world*', expectedSelStart: 7, expectedSelEnd: 12 },
  { action: 'strike', expectedText: 'hello ~~world~~', expectedSelStart: 8, expectedSelEnd: 13 },
  { action: 'code', expectedText: 'hello `world`', expectedSelStart: 7, expectedSelEnd: 12 },
  { action: 'link', expectedText: 'hello [world](url)', expectedSelStart: 7, expectedSelEnd: 12 },
  { action: 'list', expectedText: '- one\n- two', expectedSelStart: 2, expectedSelEnd: 11 },
  { action: 'quote', expectedText: '> one\n> two', expectedSelStart: 2, expectedSelEnd: 11 },
];

const emptyCases: Array<{
  action: RichTextAction;
  expectedText: string;
  expectedSelStart: number;
  expectedSelEnd: number;
}> = [
  { action: 'bold', expectedText: 'hello ****world', expectedSelStart: 8, expectedSelEnd: 8 },
  { action: 'italic', expectedText: 'hello **world', expectedSelStart: 7, expectedSelEnd: 7 },
  { action: 'strike', expectedText: 'hello ~~~~world', expectedSelStart: 8, expectedSelEnd: 8 },
  { action: 'code', expectedText: 'hello ``world', expectedSelStart: 7, expectedSelEnd: 7 },
  { action: 'link', expectedText: 'hello [](url)world', expectedSelStart: 7, expectedSelEnd: 7 },
  { action: 'list', expectedText: '- hello world', expectedSelStart: 8, expectedSelEnd: 8 },
  { action: 'quote', expectedText: '> hello world', expectedSelStart: 8, expectedSelEnd: 8 },
];

describe('applyMarkdown', () => {
  it.each(selectedCases)('applies $action to a selection', ({ action, expectedText, expectedSelStart, expectedSelEnd }) => {
    const input = action === 'list' || action === 'quote' ? 'one\ntwo' : 'hello world';
    const result = applyMarkdown(input, action === 'list' || action === 'quote' ? 0 : 6, input.length, action);

    expect(result).toEqual({
      text: expectedText,
      selStart: expectedSelStart,
      selEnd: expectedSelEnd,
    });
  });

  it.each(emptyCases)('applies $action to an empty selection', ({ action, expectedText, expectedSelStart, expectedSelEnd }) => {
    const result = applyMarkdown('hello world', 6, 6, action);

    expect(result).toEqual({
      text: expectedText,
      selStart: expectedSelStart,
      selEnd: expectedSelEnd,
    });
  });
});
