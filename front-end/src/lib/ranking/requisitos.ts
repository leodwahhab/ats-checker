import { familiaDe } from './dicionario/cargos';
import {
  ACEITA_CURSANDO, ANOS, AREA_TI, COMO_CARGO, IDIOMAS, NIVEIS_FORMACAO, NIVEIS_IDIOMA, PALAVRAS_GENERICAS, SOFT_SKILLS,
} from './dicionario/lexicos';
import type { Dictionary, SkillMatch } from './matcher';
import { fold } from './texto';
import type { Component, NivelFormacao, NivelIdioma } from './types';

export interface Decomposicao {
  componentes: Component[];
  /** Termos com cara de tecnologia que não estão no dicionário. */
  termosNaoReconhecidos: string[];
  /** A linha é só comportamental (comunicação, proatividade…). */
  soft: boolean;
}

const ORDEM_FORMACAO: NivelFormacao[] = ['medio', 'tecnico', 'graduacao', 'pos', 'mestrado', 'doutorado'];
const STOP = new Set(['a', 'o', 'as', 'os', 'e', 'ou', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'com',
  'para', 'por', 'um', 'uma', 'ao', 'aos', 'and', 'or', 'with', 'the', 'of', 'in', 'to', 'for']);

export function decompose(linha: string, dict: Dictionary): Decomposicao {
  const src = expandirPrefixos(linha.normalize('NFC'), dict);
  const f = fold(src);
  const matches = dict.find(src);
  const componentes: Component[] = [...gruposDeSkills(src, f, rotuloRedundante(src, matches, dict))];

  const anos = ANOS.exec(f);
  if (anos) {
    const skillIds = [...new Set(matches.map((m) => m.id))];
    componentes.push({ tipo: 'anos', minimo: Number(anos[1]), skillIds, familia: skillIds.length ? undefined : familiaDe(src) });
  }

  const formacao = formacaoDe(f);
  if (formacao) componentes.push(formacao);

  for (const [idioma, re] of IDIOMAS) {
    if (!re.test(f)) continue;
    const nivel: NivelIdioma = NIVEIS_IDIOMA.find(([, r]) => r.test(f))?.[0] ?? 'intermediario';
    componentes.push({ tipo: 'idioma', idioma, nivelMinimo: nivel });
  }

  const cargo = COMO_CARGO.exec(f);
  const familia = cargo ? familiaDe(cargo[0]) : undefined;
  if (familia) componentes.push({ tipo: 'cargo', familia });

  // Numa lista "qualquer uma de…", os termos desconhecidos são só mais alternativas.
  const termos = qualquerUma(src, f) && matches.length ? [] : termosDesconhecidos(src, matches);
  if (termos.length) componentes.push({ tipo: 'nao_reconhecido', termos });

  const unicos = [...new Map(componentes.map((c) => [JSON.stringify(c), c])).values()];
  return { componentes: unicos, termosNaoReconhecidos: termos, soft: unicos.length === 0 && SOFT_SKILLS.test(f) };
}

/**
 * "Mensageria: Kafka / RabbitMQ", "Cloud: AWS": o rótulo é só a categoria dos itens. Quando um item
 * já comprova o rótulo (Kafka implica mensageria), o rótulo sai e vale o que vem depois dos dois pontos.
 */
function rotuloRedundante(src: string, matches: SkillMatch[], dict: Dictionary): SkillMatch[] {
  const rotulo = /^([^:]{2,40}):\s*\S/.exec(src);
  if (!rotulo) return matches;
  const fim = rotulo[1].length;
  const depois = new Set(matches.filter((m) => m.start > fim).map((m) => m.id));
  return matches.filter((m) => m.end > fim || !dict.implicadoPor(m.id).some((id) => depois.has(id)));
}

/**
 * "Spring (Boot, Cloud)" vira "Spring Boot, Spring Cloud" quando a combinação é uma skill
 * diferente do item sozinho. "AWS (SQS, S3)" fica como está: SQS já é SQS sozinho.
 */
function expandirPrefixos(src: string, dict: Dictionary): string {
  const unica = (texto: string) => {
    const ms = dict.find(texto);
    return ms.length === 1 && ms[0].start === 0 && ms[0].end === texto.length ? ms[0].id : undefined;
  };
  return src.replace(/(\p{L}[\p{L}\p{N}.#+-]*)\s*\(([^()]{1,80})\)/gu, (todo, prefixo: string, dentro: string) => {
    const base = unica(prefixo);
    if (!base) return todo;
    const itens = dentro.split(/\s*(?:[,;/]|\s(?:e|ou|and|or)\s)\s*/).map((x) => x.trim()).filter(Boolean);
    let expandiu = false;
    const novos = itens.map((item) => {
      const combinado = unica(`${prefixo} ${item}`);
      if (combinado && combinado !== base && combinado !== unica(item)) {
        expandiu = true;
        return `${prefixo} ${item}`;
      }
      return item;
    });
    return expandiu ? novos.join(', ') : todo;
  });
}

type Separador = 'virgula' | 'e' | 'ou' | 'barra' | 'exemplo' | 'quebra';

/** "X, como A", "X (ex.: A", "X, preferencialmente A", "X (A": A é exemplo/alternativa de X. */
const EXEMPLO = /^\s*,?\s*(?:\(\s*)?(?:ex(?:emplos?)?\.?|e\.?\s?g\.?|i\.?\s?e\.?|como|tais como|por exemplo|incluindo|including|especialmente|principalmente|preferencialmente|preferably|such as|like)\s*[:,]?\s*$|^\s*\(\s*$/;
const CONECTORES = new Set(['e', 'ou', 'and', 'or', '&']);
/** Palavras que podem ficar entre itens de uma lista sem quebrá-la: "ou outra ferramenta de", "ou arquitetura de". */
const ENCHIMENTO = new Set([
  'outra', 'outro', 'outras', 'outros', 'other', 'others', 'ferramenta', 'ferramentas', 'tools', 'framework', 'frameworks',
  'tecnologia', 'tecnologias', 'linguagem', 'linguagens', 'similar', 'similares', 'equivalente', 'equivalentes', 'qualquer',
  'arquitetura', 'arquiteturas', 'plataforma', 'plataformas', 'ambiente', 'ambientes', 'banco', 'bancos', 'servicos',
  'conceitos', 'praticas', 'metodologia', 'metodologias', 'de', 'do', 'da', 'dos', 'das', 'em', 'a', 'o', 'as', 'os', 'um', 'uma',
]);

function separador(entre: string): Separador {
  if (EXEMPLO.test(entre)) return 'exemplo';
  const t = entre.trim();
  if (t === '/') return 'barra';
  if (/^[,;]*$/.test(t)) return 'virgula';
  const palavras = t.replace(/[,;/()]/g, ' ').split(/\s+/).filter(Boolean);
  if (!palavras.every((p) => CONECTORES.has(p) || ENCHIMENTO.has(p))) return 'quebra';
  if (palavras.some((p) => p === 'ou' || p === 'or') || t.includes('/')) return 'ou';
  if (palavras.some((p) => p === 'e' || p === 'and' || p === '&')) return 'e';
  return 'quebra';
}

interface Grupo {
  itens: SkillMatch[];
  /** Os itens são alternativas (basta um). */
  ou: boolean;
  /** O grupo é "skill + exemplos": a lista de exemplos continua enquanto houver conectores. */
  exemplos: boolean;
}

/**
 * Agrupa as skills da linha. "A, B ou C" vira um grupo "alguma"; "A, B e C" viram componentes
 * separados (todas). Exemplos ("X, como A ou B", "X (A, B)") entram no grupo de X. "A/B" liga só o par.
 */
/**
 * Linhas em que qualquer item basta: "pelo menos uma de A, B, C" (sem parênteses, que já agrupam
 * sozinhos) e listas de certificações ("Certificações desejáveis: AWS…, Azure… ou ITIL").
 */
function qualquerUma(src: string, f: string): boolean {
  if (/^\s*certificac(ao|oes)|^\s*certificad[oa]s?\b/.test(f)) return true;
  return !src.includes('(')
    && /\b(alguma d[ao]s|uma d[ao]s|uma ou mais|um ou mais|pelo menos (uma?|um)|ao menos (uma?|um)|qualquer uma|at least one|one or more|any of)\b/.test(f);
}

function gruposDeSkills(src: string, f: string, matches: SkillMatch[]): Component[] {
  if (!matches.length) return [];
  const ids = (ms: SkillMatch[]) => [...new Set(ms.map((m) => m.id))];
  if (qualquerUma(src, f)) return [{ tipo: 'skill', ids: ids(matches), modo: 'alguma' }];

  const dentroDeParenteses = (pos: number) => {
    const antes = src.slice(0, pos);
    return (antes.match(/\(/g)?.length ?? 0) > (antes.match(/\)/g)?.length ?? 0);
  };
  const grupos: Grupo[] = [];
  const novo = (m: SkillMatch): Grupo => {
    const g = { itens: [m], ou: false, exemplos: false };
    grupos.push(g);
    return g;
  };
  /** Tira a última skill de uma lista "e" para um grupo só dela (que vai receber exemplos ou um par A/B). */
  const isolarUltima = (g: Grupo): Grupo => (g.itens.length < 2 || g.ou ? g : novo(g.itens.pop()!));

  matches.forEach((m, i) => {
    if (i === 0) {
      novo(m);
      return;
    }
    const anterior = matches[i - 1];
    // Grafia combinada ("testes unitários e de integração"): cada skill é exigida à parte.
    if (m.start === anterior.start && m.end === anterior.end) {
      novo(m);
      return;
    }
    let g = grupos[grupos.length - 1];
    const entre = f.slice(anterior.end, m.start);
    const dentro = dentroDeParenteses(m.start);
    const mesmoNivel = dentro === dentroDeParenteses(anterior.start) && !/[()]/.test(entre);
    const sep = separador(entre);

    if (sep === 'exemplo') {
      g = isolarUltima(g);
      g.itens.push(m);
      g.ou = true;
      g.exemplos = true;
    } else if (mesmoNivel && dentro) {
      // Itens dentro do mesmo parêntese são alternativas.
      g.itens.push(m);
      g.ou = true;
    } else if (g.exemplos && mesmoNivel && sep !== 'quebra') {
      g.itens.push(m);
    } else if (sep === 'barra' && mesmoNivel) {
      g = isolarUltima(g);
      g.itens.push(m);
      g.ou = true;
    } else if (sep === 'ou' && mesmoNivel) {
      g.itens.push(m);
      g.ou = true;
    } else if (sep === 'virgula' && mesmoNivel && !g.ou) {
      g.itens.push(m);
    } else {
      // Quebra, "e", ou vírgula depois de um "ou" ("Java/Kotlin, Spring Boot" pede Spring Boot à parte).
      novo(m);
    }
  });

  // "JUnit, Mockito ou similares": a lista do fim vira alternativa.
  const depois = f.slice(matches[matches.length - 1].end);
  if (/^\s*,?\s*(ou|or)\s+(outr[oa]s?|similar(es)?|equivalentes?|semelhantes|afins|frameworks? similares|ferramentas? similares)\b/.test(depois)) {
    grupos[grupos.length - 1].ou = true;
  }

  return grupos.flatMap((g): Component[] => {
    const lista = ids(g.itens);
    if (g.ou && lista.length > 1) return [{ tipo: 'skill', ids: lista, modo: 'alguma' }];
    return lista.map((id) => ({ tipo: 'skill', ids: [id], modo: 'todas' }));
  });
}

function formacaoDe(f: string): Component | null {
  const niveis = NIVEIS_FORMACAO.filter(([, re]) => re.test(f)).map(([n]) => n);
  const cursando = ACEITA_CURSANDO.test(f);
  if (!niveis.length && !/\bcursando\b/.test(f)) return null;
  const nivelMinimo = niveis.length
    ? niveis.reduce((min, n) => (ORDEM_FORMACAO.indexOf(n) < ORDEM_FORMACAO.indexOf(min) ? n : min))
    : 'graduacao';
  return { tipo: 'formacao', nivelMinimo, area: AREA_TI.test(f) ? 'ti' : 'qualquer', aceitaCursando: cursando };
}

/**
 * Palavras com cara de termo técnico que o dicionário não reconheceu: com maiúscula no meio da
 * frase (Quarkus, Protheus), em caixa alta (ADVPL) ou com número/símbolo (K8s).
 */
function termosDesconhecidos(src: string, matches: SkillMatch[]): string[] {
  const chars = src.split('');
  for (const m of matches) for (let i = m.start; i < m.end; i++) chars[i] = ',';
  const texto = chars.join('');
  // Parênteses que já têm uma skill reconhecida são lista de exemplos: "(IDoc, RFC, APIs)".
  const exemplos = [...src.matchAll(/\([^()]*\)/g)]
    .map((p) => [p.index, p.index + p[0].length] as const)
    .filter(([a, b]) => matches.some((m) => m.start >= a && m.end <= b));
  const emExemplo = (pos: number) => exemplos.some(([a, b]) => pos > a && pos < b);

  const termos: string[] = [];
  let atual: string[] = [];
  const fechar = () => {
    if (atual.length) termos.push(atual.join(' '));
    atual = [];
  };
  let fim = 0;
  let inicioDeFrase = true;
  for (const m of texto.matchAll(/[\p{L}\p{N}][\p{L}\p{N}#+.\-]*/gu)) {
    const entre = texto.slice(fim, m.index);
    if (/[,;:()!?/]|\.\s/.test(entre)) fechar();
    if (fim === 0 || /[.:!?]\s*$/.test(entre)) inicioDeFrase = true;
    const palavra = m[0].replace(/[.\-]+$/, '');
    const chave = fold(palavra);
    // Versões ("v4+", "8+") e frequência ("2x por semana") não são termos.
    const versao = /^(?:v?\d+(?:\.\d+)*\+?|\d+x)$/i.test(palavra);
    const tecnico = /\p{Lu}.*\p{Lu}/u.test(palavra) || /[#+]/.test(palavra) || (/\d/.test(palavra) && /\p{L}/u.test(palavra));
    const maiuscula = /^\p{Lu}/u.test(palavra);
    // No início da frase, a maiúscula só conta se a palavra for item de lista ("Quarkus, Java…")
    // e não tiver cara de substantivo comum ("Inovação", "Resiliência").
    // "Quarkus e Java" é lista; "Desenvolver e manter" não (depois do "e" vem minúscula).
    const itemDeLista = /^\s*(?:[,;/)]|$|(?:e|ou|and|or)\s+(?:,|\p{Lu}))/u.test(texto.slice(m.index + m[0].length))
      && (matches.length > 0 || !/(cao|coes|dade|dades|mento|mentos|encia|ancia|ismo|ivo|iva)$/.test(chave));
    const candidato = palavra.length > 1 && /\p{L}/u.test(palavra) && !versao && !emExemplo(m.index) && !STOP.has(chave)
      && !PALAVRAS_GENERICAS.has(chave) && !SOFT_SKILLS.test(chave)
      && (tecnico || (maiuscula && (!inicioDeFrase || itemDeLista)));
    if (candidato) atual.push(palavra);
    else fechar();
    inicioDeFrase = false;
    fim = m.index + m[0].length;
  }
  fechar();
  return [...new Set(termos)];
}
