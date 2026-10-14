import { montarTexto } from './textoPdf';
import type { ExtractedDoc, TextItem } from './types';

// Subconjunto estrutural do pdf.js, para o mesmo código rodar no navegador e no Node (testes).
interface PdfPage {
  view: number[];
  getTextContent(): Promise<{
    items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean; width?: number; height?: number }>;
  }>;
  getOperatorList(): Promise<{ fnArray: number[] }>;
}
export interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  getMetadata(): Promise<{ info: Record<string, unknown> }>;
}

/** paintImageOp = OPS.paintImageXObject do pdf.js; vem do chamador para não acoplar a versão. */
export async function extractDoc(doc: PdfDocument, paintImageOp: number): Promise<ExtractedDoc> {
  const items: TextItem[] = [];
  let imageCount = 0;
  let pageWidth = 595;
  let pageHeight = 842;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    if (p === 1) {
      pageWidth = page.view[2] - page.view[0];
      pageHeight = page.view[3] - page.view[1];
    }
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (typeof it.str !== 'string' || !it.transform) continue;
      const t = it.transform;
      items.push({
        str: it.str, x: t[4] - page.view[0], y: t[5] - page.view[1], page: p, hasEOL: !!it.hasEOL,
        w: it.width ?? 0,
        // Sem altura informada, o tamanho da fonte sai da matriz de transformação.
        h: it.height || Math.hypot(t[2], t[3]),
      });
    }
    const ops = await page.getOperatorList();
    imageCount += ops.fnArray.filter((op) => op === paintImageOp).length;
  }

  const meta = await doc.getMetadata().catch(() => ({ info: {} as Record<string, unknown> }));
  return {
    numPages: doc.numPages,
    pageWidth,
    pageHeight,
    producer: String(meta.info?.Producer ?? meta.info?.Creator ?? ''),
    imageCount,
    items,
    text: montarTexto(items).text,
  };
}
