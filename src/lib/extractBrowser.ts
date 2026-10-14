import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractDoc, type PdfDocument } from './extract';
import type { ExtractedDoc } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfAberto = pdfjs.PDFDocumentProxy;

/** Lê o PDF uma vez: o texto vai para a análise e o documento, para a prévia do CV. */
export async function abrirPdf(file: File): Promise<{ doc: ExtractedDoc; pdf: PdfAberto; fechar: () => void }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const tarefa = pdfjs.getDocument({ data });
  const pdf = await tarefa.promise;
  const doc = await extractDoc(pdf as unknown as PdfDocument, pdfjs.OPS.paintImageXObject);
  return { doc, pdf, fechar: () => void tarefa.destroy() };
}
