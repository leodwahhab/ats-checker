import { fold } from './normalize';
import { headingKey, type SectionKey } from './sections';
import { montarTexto } from './textoPdf';
import type { ExtractedDoc } from './types';

interface Base {
  /** Texto do PDF em minúsculas e sem acento, com o mesmo comprimento do original. */
  folded: string;
  inicios: number[];
  /** Trecho do texto ocupado por cada seção do CV. */
  secoes: Map<SectionKey, Array<[number, number]>>;
}

const cache = new WeakMap<ExtractedDoc, Base>();

function base(doc: ExtractedDoc): Base {
  let b = cache.get(doc);
  if (b) return b;
  const { text, inicios } = montarTexto(doc.items);
  const secoes = new Map<SectionKey, Array<[number, number]>>();
  let atual: { key: SectionKey; ini: number } | null = null;
  let pos = 0;
  const fechar = (fim: number) => {
    if (atual) secoes.set(atual.key, [...(secoes.get(atual.key) ?? []), [atual.ini, fim]]);
  };
  for (const linha of text.split('\n')) {
    const k = headingKey(linha);
    if (k) {
      fechar(pos);
      atual = k === 'stop' ? null : { key: k, ini: pos };
    }
    pos += linha.length + 1;
  }
  fechar(text.length);
  // Sem normalizar para NFC: o texto dobrado precisa manter as posições de `inicios`.
  b = { folded: fold(text), inicios, secoes };
  cache.set(doc, b);
  return b;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Palavras do trecho na ordem, aceitando quebra de linha e marcador de lista entre elas. */
function padrao(trecho: string): RegExp | null {
  const palavras = fold(trecho.normalize('NFC')).split(/\s+/).filter(Boolean);
  if (!palavras.length) return null;
  return new RegExp(palavras.map(escapar).join('(?:\\s+|\\s*[•▪●◦·]\\s*)'), 'g');
}

function buscar(b: Base, trecho: string, faixas: Array<[number, number]>): [number, number] | null {
  const palavras = trecho.split(/\s+/);
  // Trecho longo que não aparece inteiro (linhas juntadas de outro jeito): tenta o começo e o fim.
  const tentativas = palavras.length > 8 ? [trecho, palavras.slice(0, 6).join(' '), palavras.slice(-6).join(' ')] : [trecho];
  for (const t of tentativas) {
    const re = padrao(t);
    if (!re) continue;
    for (const [ini, fim] of faixas) {
      re.lastIndex = ini;
      const m = re.exec(b.folded);
      if (m && m.index + m[0].length <= fim) return [m.index, m.index + m[0].length];
    }
  }
  return null;
}

/** Índices dos trechos do PDF que cobrem o intervalo [ini, fim) do texto. */
function itensEntre(doc: ExtractedDoc, b: Base, ini: number, fim: number): number[] {
  const out: number[] = [];
  doc.items.forEach((it, i) => {
    const a = b.inicios[i];
    if (it.str.trim() && a < fim && a + it.str.length > ini) out.push(i);
  });
  return out;
}

/**
 * Onde um trecho do CV aparece no PDF. A busca começa pela seção de onde a evidência veio
 * ("Habilidades" antes do resto), porque a mesma palavra costuma aparecer em vários lugares.
 */
export function localizar(doc: ExtractedDoc, trecho: string, secao?: SectionKey): number[] {
  const b = base(doc);
  const todo: Array<[number, number]> = [[0, b.folded.length]];
  const faixas = secao && b.secoes.get(secao) ? [...b.secoes.get(secao)!, ...todo] : todo;
  const out = new Set<number>();
  for (const parte of trecho.split(/…|\.\.\./).map((s) => s.trim()).filter((s) => s.length >= 2)) {
    const achado = buscar(b, parte, faixas);
    if (achado) itensEntre(doc, b, achado[0], achado[1]).forEach((i) => out.add(i));
  }
  return [...out].sort((x, y) => x - y);
}

/** Intervalos do texto do robô ocupados pelos trechos marcados, já unidos. */
export function faixasNoTexto(doc: ExtractedDoc, itens: number[]): Array<[number, number]> {
  const b = base(doc);
  const faixas = itens
    .map((i): [number, number] => [b.inicios[i], b.inicios[i] + doc.items[i].str.length])
    .sort((x, y) => x[0] - y[0]);
  const out: Array<[number, number]> = [];
  for (const f of faixas) {
    const ult = out[out.length - 1];
    if (ult && f[0] <= ult[1] + 1) ult[1] = Math.max(ult[1], f[1]);
    else out.push([...f]);
  }
  return out;
}
