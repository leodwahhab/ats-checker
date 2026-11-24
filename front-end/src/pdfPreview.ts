import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfAberto = pdfjs.PDFDocumentProxy;

/** Abre o PDF só para desenhar a prévia: a leitura do texto e a análise são feitas pela API. */
export async function abrirPdf(dados: ArrayBuffer): Promise<{ pdf: PdfAberto; fechar: () => void }> {
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(dados) });
  const pdf = await tarefa.promise;
  return { pdf, fechar: () => void tarefa.destroy() };
}
