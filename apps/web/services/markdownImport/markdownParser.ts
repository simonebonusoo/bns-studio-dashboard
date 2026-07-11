import YAML from 'yaml';
import { extractLinks, extractWikiLinks, normalizeLabel, sanitizeText } from './utils';
import type { ParsedMarkdownFile, ParsedMarkdownSection, ParsedMarkdownTable } from './types';

function emptySection(heading: string, level: number): ParsedMarkdownSection {
  return {
    id: `${heading || 'root'}-${level}`,
    heading,
    level,
    lines: [],
    fields: {},
    tables: [],
    checklist: [],
    paragraphs: [],
    wikiLinks: [],
    links: [],
  };
}

function splitFrontmatter(text: string) {
  if (!text.startsWith('---\n')) return { frontmatter: {}, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: {}, body: text };
  const rawFrontmatter = text.slice(4, end);
  const body = text.slice(end + 5);
  const document = YAML.parseDocument(rawFrontmatter);
  if (document.errors.length > 0) {
    throw new Error('Frontmatter YAML non valido');
  }
  const frontmatter = (document.toJSON() ?? {}) as Record<string, unknown>;
  return { frontmatter, body };
}

function parseTable(lines: string[]): ParsedMarkdownTable | null {
  if (lines.length < 2) return null;
  const headers = lines[0].split('|').map((cell) => sanitizeText(cell)).filter(Boolean);
  if (headers.length === 0) return null;
  const rows = lines.slice(2).map((line) => {
    const cells = line.split('|').map((cell) => sanitizeText(cell)).filter((_, index) => index < headers.length + 1);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
  return { headers, rows };
}

function parseSection(section: ParsedMarkdownSection) {
  const tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const table = parseTable(tableBuffer);
    if (table) {
      section.tables.push(table);
      const headers = table.headers.map((header) => normalizeLabel(header));
      if (headers.length >= 2 && ['campo', 'field'].includes(headers[0]) && ['valore', 'value'].includes(headers[1])) {
        table.rows.forEach((row) => {
          const key = sanitizeText(row[table.headers[0]]);
          const value = row[table.headers[1]];
          if (key) section.fields[normalizeLabel(key)] = sanitizeText(value);
        });
      }
    }
    tableBuffer.length = 0;
  };

  section.lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushTable();
      return;
    }

    if (trimmed.startsWith('|')) {
      tableBuffer.push(trimmed);
      return;
    }
    flushTable();

    const wikiLinks = extractWikiLinks(trimmed);
    if (wikiLinks.length > 0) section.wikiLinks.push(...wikiLinks);
    const links = extractLinks(trimmed);
    if (links.length > 0) section.links.push(...links);

    const checklistMatch = trimmed.match(/^[-*]\s+\[[ xX]\]\s+(.+)$/);
    if (checklistMatch) {
      section.checklist.push(sanitizeText(checklistMatch[1] ?? ''));
      return;
    }

    const fieldPatterns = [
      /^\*\*([^*]+)\*\*\s*:\s*(.+)$/,
      /^[-*]\s*([^:]+?)\s*:\s*(.+)$/,
      /^([^:\n]+?)::\s*(.+)$/,
      /^([^:\n]+?)\s*:\s*(.+)$/,
    ];

    for (const pattern of fieldPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const label = normalizeLabel(match[1] ?? '');
        const value = sanitizeText(match[2] ?? '');
        if (label && value) {
          section.fields[label] = value;
          return;
        }
      }
    }

    section.paragraphs.push(sanitizeText(trimmed));
  });

  flushTable();
}

export function parseMarkdownDocument(fileName: string, content: string): ParsedMarkdownFile {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const { frontmatter, body } = splitFrontmatter(normalized);
  const lines = body.split('\n');

  const rootSection = emptySection('', 0);
  const sections: ParsedMarkdownSection[] = [];
  let current = rootSection;
  let title = fileName.replace(/\.(md|markdown)$/i, '');

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const heading = sanitizeText(headingMatch[2] ?? '');
      const level = (headingMatch[1] ?? '').length;
      if (level === 1 && title === fileName.replace(/\.(md|markdown)$/i, '')) title = heading;
      current = emptySection(heading, level);
      sections.push(current);
      return;
    }
    current.lines.push(line);
  });

  parseSection(rootSection);
  sections.forEach(parseSection);

  return {
    fileName,
    title,
    frontmatter,
    sections,
    rootSection,
  };
}
