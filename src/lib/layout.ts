import type { ExtractedDoc } from './types';

export interface LayoutInfo {
  multiColumn: boolean;
  /** Fração dos trechos de texto que começam na coluna secundária. */
  secondaryShare: number;
  /** Índices dos trechos que começam na coluna secundária (para marcar no CV). */
  secondaryItems: number[];
}

const faixaX = (x: number) => Math.round(x / 20) * 20;

/**
 * Heurística: agrupa a posição X dos trechos em faixas de 20pt. Se existem duas
 * faixas dominantes separadas por >= 25% da largura da página e a menor concentra
 * >= 15% dos trechos, há indício de múltiplas colunas.
 */
export function detectColumns(doc: ExtractedDoc): LayoutInfo {
  const buckets = new Map<number, number>();
  let total = 0;
  for (const it of doc.items) {
    if (it.str.trim().length < 3) continue;
    const b = faixaX(it.x);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
    total++;
  }
  if (total === 0) return { multiColumn: false, secondaryShare: 0, secondaryItems: [] };

  const minGap = doc.pageWidth * 0.25;
  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  let best = 0;
  let secundaria: number | null = null;
  for (const [x, count] of sorted) {
    // Maior faixa à esquerda que esteja a pelo menos minGap de distância.
    const left = sorted.filter(([lx]) => x - lx >= minGap).reduce<[number, number] | null>((m, e) => (!m || e[1] > m[1] ? e : m), null);
    if (!left) continue;
    const menor = Math.min(count, left[1]);
    if (menor > best) {
      best = menor;
      secundaria = count <= left[1] ? x : left[0];
    }
  }
  const share = best / total;
  const multiColumn = share >= 0.15;
  const secondaryItems = multiColumn && secundaria !== null
    ? doc.items.flatMap((it, i) => (it.str.trim().length >= 3 && faixaX(it.x) === secundaria ? [i] : []))
    : [];
  return { multiColumn, secondaryShare: share, secondaryItems };
}
