import { familiaDe, senioridadeDe } from './dicionario/cargos';
import {
  HEURISTICA_OBRIGATORIO, IGNORAR_LINHA, MARCADOR_DESEJAVEL, MARCADOR_OBRIGATORIO, PARECE_REQUISITO, SECOES, type TipoSecao,
  VERBO_ATIVIDADE,
} from './dicionario/lexicos';
import type { Dictionary } from './matcher';
import { decompose } from './requisitos';
import { lerCondicoes } from './eliminatorias';
import { fold, idiomaDoTexto, INICIO } from './texto';
import type { Component, JobSpec, ReqOrigem, ReqTipo, ReqTipoFonte, Requirement } from './types';

const INVISIVEIS = /[​-‍⁠﻿]/g;
const palavras = (s: string) => s.split(/\s+/).filter(Boolean).length;

interface TituloDeSecao {
  tipo: TipoSecao;
  /** Texto depois de "Título:" na mesma linha. */
  resto: string;
}

/** Uma linha é título de seção quando é curta, casa com o léxico e não cita nenhum requisito. */
export function tituloDeSecao(linha: string, dict: Dictionary): TituloDeSecao | null {
  const semInvisiveis = linha.replace(INVISIVEIS, '').trim();
  const comEmoji = /^\p{Extended_Pictographic}/u.test(semInvisiveis);
  const raw = semInvisiveis.replace(INICIO, '').replace(/\*+/g, '').trim();
  const m = /^([^:]{2,80}):\s*(.*)$/.exec(raw);
  const cabeca = m ? m[1] : raw;
  const f = fold(cabeca).replace(/[^a-z0-9+# ]/g, ' ').replace(/\s+/g, ' ').trim();
  // Títulos com emoji ou do tipo "Sobre a área de…" podem ser um pouco mais longos.
  const institucional = comEmoji || /^(sobre|about|why|who is|conheca)\b/.test(f);
  const n = palavras(f);
  if (!f || n > (institucional ? 12 : 7)) return null;
  if (!m && /\.$/.test(raw)) return null;
  const componentes = decompose(cabeca, dict).componentes;
  if (componentes.some((c) => c.tipo !== 'nao_reconhecido')) return null;
  // Termo desconhecido indica conteúdo ("Desejável conhecimento do Ecomex"), salvo em títulos
  // bem curtos ("REQUISITOS E QUALIFICAÇÕES") ou institucionais ("Who is Equifax?").
  if (componentes.length && n > 3 && !institucional) return null;
  const tipo = SECOES.find(([, re]) => re.test(f))?.[0];
  return tipo ? { tipo, resto: m ? m[2].trim() : '' } : null;
}

function marcadorDaLinha(f: string): ReqTipo | null {
  if (MARCADOR_DESEJAVEL.test(f)) return 'desejavel';
  if (MARCADOR_OBRIGATORIO.test(f)) return 'obrigatorio';
  return null;
}

/**
 * Parágrafos longos viram uma frase por requisito. A cópia do LinkedIn às vezes junta a vaga numa
 * linha só, com títulos e bullets no meio: "…produtivo. Requisitos e Qualificações: - Ensino…; - Experiência…".
 */
function dividir(linha: string): string[] {
  if (linha.length <= 160) return [linha];
  // Lista colada ("…: - Item; - Item"): quebra também nos bullets e depois dos títulos.
  const colada = (linha.match(/(?:^|[;:.]\s*|\s)-\s+\p{Lu}/gu) ?? []).length >= 2;
  const separador = colada ? /;\s*(?:-\s+)?|(?<=[.:!?])\s+(?:-\s+)?(?=\p{Lu})|\s+-\s+(?=\p{Lu})/u : /;\s+|(?<=\.)\s+(?=\p{Lu})/u;
  return linha.split(separador).map((s) => s.trim()).filter(Boolean);
}

/**
 * Texto institucional ou prosa: só nomes próprios sem cara de requisito, ou parágrafo longo que só
 * cita tempo ("A Acme é especialista em… com 6 anos de experiência no mercado").
 */
function descartavel(componentes: Component[], limpo: string, f: string, n: number): boolean {
  if (componentes.every((c) => c.tipo === 'nao_reconhecido')) {
    return /[?!]$/.test(limpo) || n > 20 || IGNORAR_LINHA.test(f) || (n > 4 && !PARECE_REQUISITO.test(f));
  }
  return n > 30 && componentes.every((c) => c.tipo === 'anos' || c.tipo === 'cargo' || c.tipo === 'nao_reconhecido');
}

export function parseJob(texto: string, dict: Dictionary): JobSpec {
  const linhas = texto.normalize('NFC').replace(INVISIVEIS, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titulos = linhas.map((l) => tituloDeSecao(l, dict));

  let titulo: string | undefined;
  let inicio = 0;
  const primeira = linhas[0];
  // Ponto final indica frase, salvo abreviação de senioridade ("Engenheiro de Software Jr.").
  if (primeira && !titulos[0] && palavras(primeira) <= 16 && (!/\.$/.test(primeira) || /\b(jr|sr|pl)\.$/i.test(primeira))
    && (familiaDe(primeira) || senioridadeDe(primeira))) {
    titulo = primeira.replace(/^vaga\s*[:\-–]\s*/i, '');
    inicio = 1;
  }

  // Linha longa vira pedaços, e um pedaço também pode ser título de seção ("Requisitos e Qualificações:").
  // Linha que já começa com título ("Certificações desejáveis: A, B ou C") continua inteira.
  const entradas = linhas.slice(inicio).flatMap((linha, k): Array<[string, TituloDeSecao | null]> => {
    const t = titulos[inicio + k];
    const pedacos = t ? [linha] : dividir(linha);
    return pedacos.length > 1 ? pedacos.map((p) => [p, tituloDeSecao(p, dict)]) : [[linha, t]];
  });
  // Só títulos "puros" (sem texto depois dos dois pontos) contam como estrutura da vaga.
  const temSecoes = entradas.some(([, t]) => t && !t.resto && (t.tipo === 'obrigatorio' || t.tipo === 'desejavel'));

  const requisitos: Requirement[] = [];
  const naoAvaliaveis: string[] = [];
  const termos = new Set<string>();
  let secao: TipoSecao | null = null;

  const processar = (pedaco: string, marcadorSecao: ReqTipo | null) => {
    const limpo = pedaco.replace(INICIO, '').trim();
    if (limpo.length < 2) return;
    const f = fold(limpo);
    // Sem título de seção, numa vaga que tem seções, o texto solto é contexto (apresentação, stack).
    let efetiva: TipoSecao | null = secao ?? (temSecoes ? 'contexto' : null);
    // A lista de tecnologias é contexto quando a vaga tem requisitos; sem eles, ela é o requisito (Q17).
    if (efetiva === 'stack') efetiva = temSecoes ? 'contexto' : null;
    if (efetiva === 'ignorada') return;

    const dec = decompose(limpo, dict);
    let componentes: Component[] = [...dec.componentes];
    const n = palavras(limpo);
    if (!componentes.length) {
      if (dec.soft) {
        if (efetiva !== 'contexto' && n <= 25) naoAvaliaveis.push(limpo);
        return;
      }
      // Rótulo ("Com certeza tem que ter:"), modelo de trabalho, benefícios.
      if (/:$/.test(limpo) || IGNORAR_LINHA.test(f)) return;
    }

    const marcador = marcadorSecao ?? marcadorDaLinha(f);
    // "Desenvolver e manter…", mesmo listado em Requisitos, é atividade: só as tecnologias, como informativas.
    if (efetiva !== 'contexto' && !marcador && VERBO_ATIVIDADE.test(f)) efetiva = 'contexto';
    let tipo: ReqTipo;
    let tipoFonte: ReqTipoFonte;
    let origem: ReqOrigem;
    if (efetiva === 'obrigatorio' || efetiva === 'desejavel') {
      if (!componentes.length) {
        // Sem nada reconhecível: só fica se tiver cara de requisito ("Noção de boas práticas…").
        if (/[?!]$/.test(limpo) || n > 14 || (n > 5 && !PARECE_REQUISITO.test(f))) return;
        componentes.push({ tipo: 'nao_reconhecido', termos: [] });
      } else if (descartavel(componentes, limpo, f, n)) {
        // Só nomes próprios sem cara de requisito ("Na Neppo, você irá…", "Auxílio Creche…") ou prosa.
        return;
      }
      tipo = marcador ?? efetiva;
      tipoFonte = marcador ? 'marcador' : 'secao';
      origem = efetiva === 'obrigatorio' ? 'requisitos' : 'diferenciais';
    } else if (efetiva === 'contexto') {
      // Atividades: só as tecnologias citadas, como informativas (não entram na faixa).
      componentes = componentes.filter((c) => c.tipo === 'skill');
      if (!componentes.length) return;
      tipo = marcador ?? 'informativo';
      tipoFonte = marcador ? 'marcador' : 'secao';
      origem = 'atividades';
    } else {
      if (!componentes.length || descartavel(componentes, limpo, f, n)) return;
      if (marcador) {
        tipo = marcador;
        tipoFonte = 'marcador';
      } else if (HEURISTICA_OBRIGATORIO.test(f)) {
        tipo = 'obrigatorio';
        tipoFonte = 'heuristica';
      } else {
        tipo = 'desejavel';
        tipoFonte = 'padrao';
      }
      origem = 'sem_secao';
    }
    requisitos.push({ id: `r${requisitos.length + 1}`, texto: limpo, tipo, tipoFonte, origem, componentes });
    for (const c of componentes) if (c.tipo === 'nao_reconhecido') c.termos.forEach((t) => termos.add(t));
  };

  for (const [entrada, t] of entradas) {
    let linha = entrada;
    let marcadorSecao: ReqTipo | null = null;
    if (t) {
      if (!t.resto) {
        secao = t.tipo;
        continue;
      }
      // "Diferencial: Airflow" no meio da lista marca só esta linha (e a linha inteira é lida, para
      // "Certificações desejáveis: …" continuar sendo uma lista de certificações); "Benefícios: VR"
      // troca de seção.
      if (t.tipo === 'obrigatorio' || t.tipo === 'desejavel') {
        marcadorSecao = t.tipo;
      } else {
        secao = t.tipo;
        linha = t.resto;
      }
    }
    for (const pedaco of dividir(linha)) processar(pedaco, marcadorSecao);
  }

  // Sem título, o cargo pode estar na apresentação: "Estamos em busca de uma pessoa Desenvolvedora Full Stack Júnior".
  const apresentacao = titulo ? undefined : cargoNaApresentacao(linhas);
  return {
    titulo,
    familia: familiaDe(titulo ?? apresentacao ?? ''),
    senioridade: titulo ? senioridadeDe(titulo) : senioridadeDe(apresentacao ?? '') ?? senioridadeDe(linhas.slice(0, 3).join(' ')),
    temSecoes,
    requisitos,
    naoAvaliaveis,
    termosNaoReconhecidos: [...termos],
    ...lerCondicoes(linhas),
    // Pelos requisitos: o texto institucional pode estar em outro idioma ("Who is Equifax?").
    idioma: idiomaDoTexto(requisitos.map((r) => r.texto).join('\n')) ?? idiomaDoTexto(texto),
  };
}

const BUSCA = /\b(?:buscamos|procuramos|contratamos|estamos (?:em busca de|buscando|procurando|contratando)|we ?(?:'|’)?re (?:looking for|hiring)|we are (?:looking for|hiring))\s+(?:um\(a\)\s+|uma?\s+|an?\s+|o\(a\)\s+)?(?:pessoa\s+)?([^,.;:!]{3,80}?)(?=\s+(?:para|que|to|who|with|com|em|no|na)\b|[,.;:!]|$)/;

function cargoNaApresentacao(linhas: string[]): string | undefined {
  for (const linha of linhas.slice(0, 25)) {
    const m = BUSCA.exec(fold(linha));
    if (m && (familiaDe(m[1]) || senioridadeDe(m[1]))) return m[1];
  }
  return undefined;
}
