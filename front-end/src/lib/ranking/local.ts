import { CIDADES, UFS } from './dicionario/locais';
import { compilarTermos, fold } from './texto';
import type { Local, Modelo } from './types';

// Palavra com maiúscula ("Paulo", "Embu-Guaçu") e conectores minúsculos ("Rio de Janeiro").
const PALAVRA = "\\p{Lu}[\\p{L}'’.]*(?:-\\p{Lu}[\\p{L}'’.]*)?";
const CIDADE = `${PALAVRA}(?: (?:d[aeo]s? )?${PALAVRA})*`;
const UF = `(${UFS.join('|')})`;
/** "Osasco - SP", "São Paulo/SP", "São Paulo, SP, BR". Sem "|": em "JAVA | GO" não há cidade. */
const CIDADE_UF = new RegExp(`(?<![\\p{L}])(${CIDADE})\\s*[-–—/,]\\s*${UF}(?![\\p{L}])`, 'u');
/** Logo depois de um rótulo: "Local de trabalho: São Paulo - SPjobTypes…" (a Gupy cola texto depois da UF). */
const CIDADE_UF_ROTULADO = new RegExp(`^\\s*(${CIDADE})\\s*[-–—/,]\\s*${UF}`, 'u');

/** Palavras com maiúscula que aparecem antes da cidade sem fazer parte dela. */
const NAO_CIDADE = new Set([
  'hibrido', 'hibrida', 'remoto', 'remota', 'presencial', 'local', 'sede', 'escritorio', 'vaga', 'cidade', 'modelo',
  'trabalho', 'office', 'location', 'localizacao', 'endereco', 'residencia', 'brasil', 'brazil', 'atuacao',
]);

const CIDADES_RE = compilarTermos(CIDADES.map(([c]) => fold(c)));
const CIDADE_CONHECIDA = new Map(CIDADES.map(([c, uf]) => [fold(c), [c, uf] as const]));

function limparCidade(bruta: string): string | undefined {
  const palavras = bruta.split(' ');
  while (palavras.length && (NAO_CIDADE.has(fold(palavras[0])) || /^d[aeo]s?$/.test(palavras[0]))) palavras.shift();
  return palavras.join(' ') || undefined;
}

export interface OpcoesLocal {
  /** O texto vem logo depois de um rótulo ("Local de trabalho:"). */
  rotulado?: boolean;
  /** Aceita cidade sem UF quando ela está na lista de cidades conhecidas (só para a vaga). */
  cidadesConhecidas?: boolean;
}

/** Cidade e UF citadas no texto. */
export function localDe(texto: string, op: OpcoesLocal = {}): Local | undefined {
  const src = texto.normalize('NFC').trim();
  const m = (op.rotulado ? CIDADE_UF_ROTULADO.exec(src) : null) ?? CIDADE_UF.exec(src);
  if (m) return { cidade: limparCidade(m[1]), uf: m[2], trecho: src };
  if (op.cidadesConhecidas) {
    const c = CIDADES_RE.exec(fold(src));
    const conhecida = c && CIDADE_CONHECIDA.get(c[0].replace(/\s+/g, ' '));
    if (conhecida) return { cidade: conhecida[0], uf: conhecida[1], trecho: src };
  }
  return undefined;
}

/** "São Paulo - SP", "SP". */
export const rotuloLocal = (l: Local) => [l.cidade, l.uf].filter(Boolean).join(' - ');

/** "2x por semana no escritório", "1 ou 2 dias na semana", "com flexibilidade": presencial em parte da semana. */
const PARTE_DA_SEMANA = /\b(\d+ ?x|uma|duas|tres|\d+ (ou \d+ )?dias?|\d+ vezes) (por|na|a cada) semana\b|\bflexibilidade\b/;

/** Modelo de trabalho citado no texto (já com fold). Híbrido vence: "hybrid remote model" é híbrido. */
export function modeloDe(f: string): Modelo | undefined {
  if (/\b(hibrid[oa]s?|hybrid)\b/.test(f)) return 'hibrido';
  if (/\b(presencia(l|is)|on-?site|in-?office)\b/.test(f)) return PARTE_DA_SEMANA.test(f) ? 'hibrido' : 'presencial';
  if (/\b(remot[oa]s?|remote|home[\s-]?office|anywhere|teletrabalho)\b/.test(f)) return 'remoto';
  return undefined;
}

/** "Trabalho híbrido". */
export const ROTULO_MODELO: Record<Modelo, string> = { remoto: 'remoto', hibrido: 'híbrido', presencial: 'presencial' };
/** "A vaga é híbrida". */
export const ROTULO_MODELO_VAGA: Record<Modelo, string> = { remoto: 'remota', hibrido: 'híbrida', presencial: 'presencial' };
