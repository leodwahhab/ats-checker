import type { TextItem } from './types';

/**
 * Junta os trechos na ordem do stream, quebrando a linha quando a posição Y muda, como parsers
 * baseados em layout (pdfminer, Tika) fazem. `inicios[i]` é a posição do trecho i no texto.
 */
export function montarTexto(items: TextItem[]): { text: string; inicios: number[] } {
  let text = '';
  const inicios: number[] = [];
  items.forEach((it, idx) => {
    const prev = items[idx - 1];
    const moved = prev && (prev.page !== it.page || Math.abs(prev.y - it.y) > 3);
    if (moved && !text.endsWith('\n') && it.str.trim()) text += '\n';
    inicios.push(text.length);
    text += it.str + (it.hasEOL ? '\n' : '');
  });
  return { text, inicios };
}
