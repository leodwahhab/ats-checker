import {
  AFIRMATIVA, CERTIFICACAO, CONTEXTO_DISPONIBILIDADE, DISPONIBILIDADE, DOCUMENTO, GRUPO_AFIRMATIVO, ORDEM_IDIOMA, PERIODO_CURSO,
  RESIDENCIA, ROTULO_FORMACAO, ROTULO_IDIOMA,
} from './dicionario/lexicos';
import { PAISES } from './dicionario/locais';
import { localDe, modeloDe, ROTULO_MODELO, rotuloLocal } from './local';
import { fold, INICIO } from './texto';
import type { Component, Eliminatoria, JobSpec, Local, Modelo } from './types';

const ROTULO_LOCAL = /^(?:local(?:izacao)?(?: d[ae] (?:trabalho|atuacao)(?: da vaga)?)?|location|cidade|sede)\s*:\s*/;
const ROTULO_MODELO_LINHA = /^(?:modelo(?: de (?:trabalho|atuacao))?|work(?:place)? (?:model|type)|regime de trabalho|formato de trabalho)\s*:\s*/;
/** Modelo no título, depois de um separador: "Desenvolvedor Java AWS - Híbrido São Paulo". */
const MODELO_NO_TITULO = /(?:^|[-–—|(,/]\s*)(hibrid[oa]|remot[oa]|presencial|hybrid|remote)\b/;
/** Frases que dizem o modelo no meio do texto: "modelo híbrido", "trabalho 100% remoto", "hybrid model". */
const FRASE_MODELO = /\b(modelo (de trabalho |de atuacao )?(hibrido|remoto|presencial)|trabalho (100% )?(hibrido|remoto|presencial)|(100% |totalmente )remot[oa]|hybrid (remote )?(model|work)|remote[- ](first|position|role|work)|fully remote|on-?site)\b/;

export interface CondicoesDaVaga {
  modelo?: Modelo;
  local?: Local;
  pais?: string;
  eliminatorias: Eliminatoria[];
  afirmativa?: string;
}

const palavras = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * A Gupy cola texto da interface depois do valor do rótulo ("Modelo de trabalho: HíbridoTrabalho
 * Híbrido íconeHíbrido", "São Paulo - SPjobTypes…"). Só para linhas com rótulo: em texto corrido,
 * "JavaScript" também tem minúscula seguida de maiúscula.
 */
const semColado = (linha: string) => linha.replace(/jobTypes.*$/, '').replace(/(?<=\p{Ll})\p{Lu}.*$/u, '').trim();

/**
 * Local, modelo de trabalho, eliminatórias que vêm do texto (local, disponibilidade, documentos)
 * e vaga afirmativa. Lê a vaga inteira, inclusive o cabeçalho e as seções ignoradas no ranqueamento.
 */
export function lerCondicoes(brutas: string[]): CondicoesDaVaga {
  const linhas = brutas.map((l) => l.replace(INICIO, '').replace(/\*+/g, '').trim()).filter(Boolean);
  let modelo: Modelo | undefined;
  let local: Local | undefined;
  // As linhas de onde vieram, para citar na pergunta.
  let linhaModelo: string | undefined;
  let linhaLocal: string | undefined;
  const achouModelo = (m: Modelo | undefined, linha: string) => {
    if (m && !modelo) [modelo, linhaModelo] = [m, linha];
  };
  // Linhas que falam do local, para achar o país quando não há cidade brasileira ("Lisboa, Portugal").
  const sobreLocal: string[] = [];
  const achouLocal = (l: Local | undefined, linha: string) => {
    sobreLocal.push(linha);
    if (l && !local) [local, linhaLocal] = [l, linha];
  };

  // 1. Rótulos: "Local de trabalho: São Paulo - SP", "Modelo de trabalho: Híbrido".
  for (const linha of linhas) {
    const f = fold(linha);
    const rl = ROTULO_LOCAL.exec(f);
    if (rl) achouLocal(localDe(linha.slice(rl[0].length), { rotulado: true, cidadesConhecidas: true }), semColado(linha));
    const rm = ROTULO_MODELO_LINHA.exec(f);
    if (rm) {
      achouModelo(modeloDe(f.slice(rm[0].length)), semColado(linha));
      achouLocal(localDe(linha.slice(rm[0].length), { cidadesConhecidas: true }), semColado(linha));
    }
  }
  // 2. Linhas curtas do topo ("Híbrido", "São Paulo, SP, BR").
  for (const linha of linhas.slice(0, 3)) {
    // Num título longo, só depois de separador: "Mobile Híbrido" é o tipo de app, não o modelo.
    if (palavras(linha) <= 4 || MODELO_NO_TITULO.test(fold(linha))) achouModelo(modeloDe(fold(linha)), linha);
    if (palavras(linha) <= 8) achouLocal(localDe(linha, { cidadesConhecidas: true }), linha);
  }
  // 3. Frases no meio do texto ("modelo presencial com flexibilidade em São Paulo/SP").
  for (const linha of linhas) {
    if (!FRASE_MODELO.test(fold(linha))) continue;
    achouModelo(modeloDe(fold(linha)), linha);
    achouLocal(localDe(linha, { cidadesConhecidas: true }), linha);
  }
  const pais = local ? 'Brasil' : PAISES.find(([, re]) => sobreLocal.some((l) => re.test(fold(l))))?.[0];

  const eliminatorias: Omit<Eliminatoria, 'id'>[] = [];
  const add = (e: Omit<Eliminatoria, 'id'>) => {
    if (!eliminatorias.some((x) => x.tipo === e.tipo && x.rotulo === e.rotulo)) eliminatorias.push(e);
  };
  if ((modelo === 'hibrido' || modelo === 'presencial') && local) {
    const trecho = [...new Set([linhaModelo, linhaLocal].filter(Boolean))].join(' · ');
    add({ tipo: 'local', rotulo: `Trabalho ${ROTULO_MODELO[modelo]} em ${rotuloLocal(local)}`, trecho });
  }
  let afirmativa: string | undefined;
  for (const linha of linhas) {
    const f = fold(linha);
    if (RESIDENCIA.test(f) && !eliminatorias.some((e) => e.tipo === 'local')) add({ tipo: 'local', rotulo: 'Local de residência', trecho: linha });
    if (CONTEXTO_DISPONIBILIDADE.test(f)) {
      for (const [rotulo, re] of DISPONIBILIDADE) if (re.test(f)) add({ tipo: 'disponibilidade', rotulo, trecho: linha });
    }
    for (const [rotulo, re] of DOCUMENTO) if (re.test(f)) add({ tipo: 'documento', rotulo, trecho: linha });
    if (!afirmativa && AFIRMATIVA.test(f) && GRUPO_AFIRMATIVO.test(f)) afirmativa = linha;
  }

  return { modelo, local, pais, eliminatorias: eliminatorias.map((e, i) => ({ ...e, id: `v${i + 1}` })), afirmativa };
}

function rotuloFormacao(c: Extract<Component, { tipo: 'formacao' }>): string {
  const situacao = c.aceitaCursando ? ' completo ou em andamento' : ' completo';
  return `${ROTULO_FORMACAO[c.nivelMinimo]}${situacao}${c.area === 'ti' ? ' em TI ou área afim' : ''}`;
}

/**
 * Eliminatórias que vêm de requisitos obrigatórios: idioma em nível alto, formação (inclusive
 * período do curso no estágio) e certificação. Mudar o requisito para desejável tira a pergunta.
 */
export function eliminatoriasDosRequisitos(job: JobSpec): Eliminatoria[] {
  const out: Eliminatoria[] = [];
  const add = (e: Eliminatoria) => {
    if (!out.some((x) => x.id === e.id || (x.tipo === e.tipo && x.rotulo === e.rotulo))) out.push(e);
  };
  for (const r of job.requisitos) {
    if (r.tipo !== 'obrigatorio') continue;
    const f = fold(r.texto);
    const base = { trecho: r.texto, requisitoId: r.id };
    for (const c of r.componentes) {
      if (c.tipo === 'idioma' && ORDEM_IDIOMA.indexOf(c.nivelMinimo) >= ORDEM_IDIOMA.indexOf('avancado')) {
        add({ ...base, id: `${r.id}:idioma`, tipo: 'idioma', rotulo: `${c.idioma} ${ROTULO_IDIOMA[c.nivelMinimo]} ou acima` });
      }
      if (c.tipo === 'formacao') add({ ...base, id: `${r.id}:formacao`, tipo: 'formacao', rotulo: rotuloFormacao(c) });
    }
    if (PERIODO_CURSO.test(f)) {
      add({ ...base, id: `${r.id}:periodo`, tipo: 'formacao', rotulo: 'Período do curso ou previsão de formatura' });
    }
    if (CERTIFICACAO.test(f)) add({ ...base, id: `${r.id}:certificacao`, tipo: 'certificacao', rotulo: 'Certificação exigida' });
  }
  return out;
}
