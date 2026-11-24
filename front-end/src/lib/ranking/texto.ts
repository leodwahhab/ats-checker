import { fold } from '../normalize';
import { PALAVRAS_EN, PALAVRAS_PT } from './dicionario/lexicos';
import type { IdiomaTexto } from './types';

export { fold };

/** Marcadores no começo de uma linha da vaga: bullets, numeração, emoji ("🔍 O Que Procuramos"). */
export const INICIO = /^(?:[\s\p{Extended_Pictographic}\u{FE0F}\u{200D}#*•●▪◦·▸✓✔➤→>\-–—]+|\d{1,2}[.)]\s+)+/u;

/** Limites de palavra para padrões com a flag `u`: o termo não pode estar colado a letra, número ou _. */
export const ANTES = '(?<![\\p{L}\\p{N}_])';
export const DEPOIS = '(?![\\p{L}\\p{N}_])';

/** Escapa só os caracteres de sintaxe permitidos com a flag `u` (hífen fora de classe não pode ser escapado). */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Padrão de um termo já normalizado: cada espaço aceita qualquer espaço em branco, inclusive quebra de linha. */
export function padraoTermo(termo: string): string {
  return termo.trim().split(/\s+/).map(escapeRegex).join('\\s+');
}

/** Regex que casa qualquer um dos termos (o mais longo primeiro), com limites de palavra. */
export function compilarTermos(termos: string[], flags = 'u'): RegExp {
  const alts = [...new Set(termos)].sort((a, b) => b.length - a.length).map(padraoTermo);
  return new RegExp(`${ANTES}(?:${alts.join('|')})${DEPOIS}`, flags);
}

/** Trecho de até `max` caracteres em volta de [start, end), cortado em limite de palavra. */
export function trecho(texto: string, start: number, end: number, max = 120): string {
  const limpo = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (texto.length <= max) return limpo(texto);
  const folga = Math.max(0, Math.floor((max - (end - start)) / 2));
  let a = Math.max(0, start - folga);
  let b = Math.min(texto.length, end + folga);
  if (a > 0) {
    const espaco = texto.indexOf(' ', a);
    if (espaco >= 0 && espaco < start) a = espaco + 1;
  }
  if (b < texto.length) {
    const espaco = texto.lastIndexOf(' ', b);
    if (espaco > end) b = espaco;
  }
  return (a > 0 ? '…' : '') + limpo(texto.slice(a, b)) + (b < texto.length ? '…' : '');
}

/** Português ou inglês, pela contagem de palavras comuns. Undefined quando o texto é curto demais. */
export function idiomaDoTexto(texto: string): IdiomaTexto | undefined {
  let pt = 0;
  let en = 0;
  for (const p of fold(texto.normalize('NFC')).match(/\p{L}+/gu) ?? []) {
    if (PALAVRAS_PT.has(p)) pt++;
    else if (PALAVRAS_EN.has(p)) en++;
  }
  if (pt + en < 15) return undefined;
  return en > pt ? 'en' : 'pt';
}

/** "Docker", "Docker e AWS", "Docker, AWS e Kafka". */
export const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0]);
