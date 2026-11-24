import { fold } from './normalize';
import type { ExtractedDoc } from './types';

export interface Margens {
  /** Textos que se repetem no topo ou no pé de duas ou mais páginas (cabeçalho ou rodapé do editor). */
  repetidos: string[];
  /** Há e-mail, telefone ou LinkedIn no pé da página. */
  contatoNoRodape: boolean;
  itens: number[];
}

/** Número de página ("1", "Página 1 de 2", "Page 1 of 3"): não leva informação para o ATS. */
const NUMERO_PAGINA = /^(pagina|pag\.?|page)?\s*#\s*((de|of|\/)\s*#)?$/;
const CONTATO = /@|linkedin\.com|\(?\d{2}\)?\s?9?\d{4}[\s.-]?\d{4}/i;

/**
 * Faixa de 8% da altura no topo e no pé de cada página. Parte dos ATS descarta o que o editor
 * coloca em cabeçalho e rodapé, então contato ou dados que só existem ali podem se perder.
 */
export function detectarMargens(doc: ExtractedDoc): Margens {
  const altura = doc.pageHeight;
  if (!altura) return { repetidos: [], contatoNoRodape: false, itens: [] };
  const faixa = altura * 0.08;

  // Junta os trechos da mesma linha: "Page 1 of 3" costuma vir em quatro pedaços.
  const linhas = new Map<string, { topo: boolean; page: number; itens: number[] }>();
  doc.items.forEach((it, i) => {
    if (!it.str.trim()) return;
    const topo = it.y > altura - faixa;
    if (!topo && it.y >= faixa) return;
    const chave = `${it.page}:${Math.round(it.y / 3)}`;
    const l = linhas.get(chave) ?? { topo, page: it.page, itens: [] };
    l.itens.push(i);
    linhas.set(chave, l);
  });

  const paginas = new Map<string, { texto: string; paginas: Set<number>; itens: number[] }>();
  const rodape: number[] = [];
  for (const l of linhas.values()) {
    const texto = l.itens.map((i) => doc.items[i].str.trim()).join(' ').replace(/\s+/g, ' ');
    if (!l.topo && CONTATO.test(texto)) rodape.push(...l.itens);
    const forma = fold(texto).replace(/\d+/g, '#');
    if (NUMERO_PAGINA.test(forma)) continue;
    const chave = `${l.topo ? 't' : 'p'}:${forma}`;
    const g = paginas.get(chave) ?? { texto, paginas: new Set<number>(), itens: [] };
    g.paginas.add(l.page);
    g.itens.push(...l.itens);
    paginas.set(chave, g);
  }

  const grupos = [...paginas.values()].filter((g) => g.paginas.size >= 2);
  return {
    repetidos: grupos.map((g) => g.texto),
    contatoNoRodape: rodape.length > 0,
    itens: [...new Set([...grupos.flatMap((g) => g.itens), ...rodape])].sort((a, b) => a - b),
  };
}
