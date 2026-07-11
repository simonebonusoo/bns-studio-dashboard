import { analyzeParsedMarkdown } from './entityExtractor';
import { loadImportContext, detectDuplicates } from './duplicateDetector';
import { parseMarkdownDocument } from './markdownParser';
import type { ImportAnalysisResult } from './types';

export async function analyzeMarkdownFiles(files: Array<{ name: string; content: string }>): Promise<ImportAnalysisResult> {
  const parsed = files.map((file) => parseMarkdownDocument(file.name, file.content));
  const result = analyzeParsedMarkdown(parsed);
  const context = await loadImportContext();
  detectDuplicates(result.candidates, context);
  return result;
}

export * from './constants';
export { detectDuplicates, loadImportContext };
export * from './types';
export * from './importExecutor';
