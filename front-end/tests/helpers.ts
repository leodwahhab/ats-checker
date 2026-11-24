import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractDoc, type PdfDocument } from '../src/lib/extract';
import type { ExtractedDoc, Structured } from '../src/lib/types';

export const FIXTURES = path.resolve(__dirname, '../../backend/fixtures');

export async function loadPdf(file: string): Promise<ExtractedDoc> {
  const data = new Uint8Array(fs.readFileSync(path.join(FIXTURES, file)));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  return extractDoc(doc as unknown as PdfDocument, pdfjs.OPS.paintImageXObject);
}

export function lerVaga(relativo: string): string {
  return fs.readFileSync(path.join(FIXTURES, 'vagas', relativo), 'utf8');
}

/** CV estruturado mínimo para testes de regra. */
export function cv(parcial: Partial<Structured> = {}): Structured {
  return {
    experiencia: [], formacao: [], certificacoes: [], idiomas: [], habilidades: [], cabecalho: [], contato: [], projetos: [],
    ...parcial,
  };
}
