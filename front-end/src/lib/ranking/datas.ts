import { fold } from '../normalize';
import type { Periodo } from '../types';

// Todos os padrões rodam sobre texto com fold (minúsculas, sem acento).
const MONTH = '(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)';
const DATE = `(?:${MONTH}\\.?\\s*(?:de\\s+|[/.\\-]\\s*)?\\d{4}(?!\\d)|\\d{1,2}/\\d{4}(?!\\d)|(?<![\\d/])(?:19|20)\\d{2}(?!\\d))`;
const NOW = '(?:atual|presente|hoje|current|present|em andamento|atualmente)';
const NOW_RE = new RegExp(`^${NOW}$`, 'i');
const MONTH_IDX = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const RANGE_RE = new RegExp(`(${DATE})(?:\\s*[-–—]\\s*|\\s+(?:a|ate)\\s+)(${DATE}|${NOW})`, 'i');
export const DATE_RE = new RegExp(DATE, 'i');

/** Converte um match de RANGE_RE (feito sobre o texto com fold) no período do texto original. */
export function periodOf(m: RegExpExecArray, original: string): Periodo {
  const clean = (x: string) => x.replace(/\s+/g, ' ').trim();
  const fim = clean(original.slice(m.index + m[0].length - m[2].length, m.index + m[0].length));
  return { inicio: clean(original.slice(m.index, m.index + m[1].length)), fim, atual: NOW_RE.test(fold(fim)) };
}

export function findRange(s: string): { period: Periodo; start: number; end: number } | null {
  const m = RANGE_RE.exec(fold(s));
  return m ? { period: periodOf(m, s), start: m.index, end: m.index + m[0].length } : null;
}

/** Último dia do mês de término; null quando o período é atual ou a data não foi entendida. */
export function endDate(p: Periodo): Date | null {
  if (p.atual) return null;
  const f = fold(p.fim);
  const year = /(\d{4})/.exec(f)?.[1];
  if (!year) return null;
  const mi = MONTH_IDX.findIndex((m) => f.startsWith(m));
  const num = /^(\d{1,2})\//.exec(f)?.[1];
  const month = mi >= 0 ? mi : num ? Number(num) - 1 : 11;
  return new Date(Number(year), month + 1, 0);
}

// ---------- Intervalos de tempo (Fase 2) ----------

/** Mês absoluto: ano × 12 + mês (0 a 11). */
export type Mes = number;

/** Período em meses, com início e fim inclusivos: ago/2024–jul/2026 tem 24 meses. */
export interface Intervalo {
  inicio: Mes;
  fim: Mes;
}

export interface Lacuna extends Intervalo {
  meses: number;
  /** A lacuna vai da última experiência até hoje. */
  ateHoje: boolean;
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const mesDeData = (d: Date): Mes => d.getFullYear() * 12 + d.getMonth();

/**
 * Lê "Agosto/2024", "ago 2024", "agosto de 2024", "08/2024" ou "2024". Ano sozinho vale janeiro
 * no início do período e dezembro no fim.
 */
export function mesDe(texto: string, fimDoPeriodo: boolean): Mes | null {
  const f = fold(texto).trim();
  const ano = /(\d{4})/.exec(f)?.[1];
  if (!ano) return null;
  const nome = MONTH_IDX.findIndex((m) => f.startsWith(m));
  const numero = /^(\d{1,2})\//.exec(f)?.[1];
  const mes = nome >= 0 ? nome : numero ? Number(numero) - 1 : fimDoPeriodo ? 11 : 0;
  return mes >= 0 && mes <= 11 ? Number(ano) * 12 + mes : null;
}

/** Intervalo de um período do CV; "Atual" vai até `hoje`. Null quando as datas não fazem sentido. */
export function intervaloDe(p: Periodo, hoje: Date): Intervalo | null {
  const inicio = mesDe(p.inicio, false);
  const fim = p.atual ? mesDeData(hoje) : mesDe(p.fim, true);
  return inicio !== null && fim !== null && fim >= inicio ? { inicio, fim } : null;
}

/** Junta intervalos sobrepostos ou vizinhos: períodos simultâneos contam uma vez só. */
export function uniao(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio);
  const out: Intervalo[] = [];
  for (const i of ordenados) {
    const ultimo = out[out.length - 1];
    if (ultimo && i.inicio <= ultimo.fim + 1) ultimo.fim = Math.max(ultimo.fim, i.fim);
    else out.push({ ...i });
  }
  return out;
}

export function totalMeses(intervalos: Intervalo[]): number {
  return uniao(intervalos).reduce((s, i) => s + i.fim - i.inicio + 1, 0);
}

/** Lacunas de pelo menos `minimo` meses entre os intervalos e entre o último e hoje. */
export function lacunas(intervalos: Intervalo[], hoje: Date, minimo = 7): Lacuna[] {
  const u = uniao(intervalos);
  const out: Lacuna[] = [];
  for (let i = 1; i < u.length; i++) {
    const meses = u[i].inicio - u[i - 1].fim - 1;
    if (meses >= minimo) out.push({ inicio: u[i - 1].fim + 1, fim: u[i].inicio - 1, meses, ateHoje: false });
  }
  const ultimo = u[u.length - 1];
  const agora = mesDeData(hoje);
  if (ultimo && agora - ultimo.fim >= minimo) out.push({ inicio: ultimo.fim + 1, fim: agora, meses: agora - ultimo.fim, ateHoje: true });
  return out;
}

/** "ago/2024". */
export const rotuloMes = (m: Mes) => `${MESES_CURTOS[m % 12]}/${Math.floor(m / 12)}`;

/** "ago/2024–jul/2026". */
export const rotuloIntervalo = (i: Intervalo) => `${rotuloMes(i.inicio)}–${rotuloMes(i.fim)}`;

/** "3 anos e 4 meses", "7 meses", "1 ano". */
export function duracao(meses: number): string {
  if (meses <= 0) return 'nenhum tempo';
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos ? `${anos} ano${anos > 1 ? 's' : ''}` : '';
  const m = resto ? `${resto} ${resto > 1 ? 'meses' : 'mês'}` : '';
  return [a, m].filter(Boolean).join(' e ');
}
