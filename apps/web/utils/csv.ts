import { saveTextFile } from '@/services/downloadService';

/** Utility di import/export CSV (§52). */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Esporta un array di oggetti come CSV e avvia il download. */
export function exportToCSV<T extends object>(filename: string, rows: T[]): void {
  if (rows.length === 0) {
    void triggerDownload(`${filename}.csv`, '');
    return;
  }
  const cols = Object.keys(rows[0]).filter((k) => !['organizationId'].includes(k));
  const header = cols.join(';');
  const body = rows
    .map((r) => cols.map((c) => escapeCell((r as Record<string, unknown>)[c])).join(';'))
    .join('\n');
  void triggerDownload(`${filename}.csv`, `${header}\n${body}`);
}

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

/** Parser CSV minimale (delimitatori , o ;) con validazione base. */
export function parseCSV(text: string): CSVParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length === 0) return { headers: [], rows: [], errors: ['File vuoto'] };

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = splitLine(lines[0], delimiter).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    if (cells.length !== headers.length) {
      errors.push(`Riga ${i + 1}: numero di colonne non valido (${cells.length}/${headers.length})`);
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cells[idx].trim()));
    rows.push(row);
  }
  return { headers, rows, errors };
}

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function triggerDownload(filename: string, content: string): Promise<void> {
  const BOM = String.fromCharCode(0xfeff); // Excel legge correttamente l'UTF-8
  await saveTextFile(filename, `${BOM}${content}`, 'text/csv;charset=utf-8;');
}
