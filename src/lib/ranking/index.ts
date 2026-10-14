import { tokens } from '../match';
import type { Structured } from '../types';
import { avaliarRequisito } from './avaliar';
import { calcularAvisos } from './avisos';
import { IGNORAR_LINHA, PALAVRAS_GENERICAS, SOFT_SKILLS } from './dicionario/lexicos';
import { COMBINACOES, SKILLS } from './dicionario/skills';
import { calcularDimensoes } from './dimensoes';
import { eliminatoriasDosRequisitos } from './eliminatorias';
import { calcularFaixa } from './faixa';
import { aplicarLente, LENTES } from './lentes';
import { rotuloLocal } from './local';
import { buildDictionary, type Dictionary } from './matcher';
import { buildCvProfile } from './perfil';
import { decompose } from './requisitos';
import { ANTES, DEPOIS, fold, padraoTermo } from './texto';
import type {
  Component, CvProfile, Eliminatoria, EliminatoriaResult, FonteEvidencia, JobSpec, RankingResult, RankOptions, ReqTipo,
  RequirementResult, SkillDef,
} from './types';
import { tituloDeSecao } from './vaga';

export { parseJob } from './vaga';
export type { Dictionary } from './matcher';

let base: Dictionary | undefined;

/** Dicionário de tecnologia, mais os termos que o usuário promoveu a skill nesta sessão. */
export function dicionario(extras: SkillDef[] = []): Dictionary {
  if (!extras.length) return (base ??= buildDictionary(SKILLS, COMBINACOES));
  return buildDictionary([...SKILLS, ...extras], COMBINACOES);
}

export function rank(
  structured: Structured, job: JobSpec, opcoes: RankOptions, dict: Dictionary = dicionario(opcoes.skillsExtras),
): RankingResult {
  const perfil = buildCvProfile(structured, dict, opcoes.hoje);
  const lente = LENTES[opcoes.lente ?? 'nucleo'];
  const avaliar = (fontes?: Set<FonteEvidencia>) => job.requisitos.map((r) => avaliarRequisito(r, perfil, dict, {
    declarado: opcoes.declarados[r.id], fontes,
  }));
  // A lente da Gupy só aceita evidência de Experiência e Habilidades (mais formação e idiomas).
  const requisitos = avaliar(lente.fontes && new Set(lente.fontes));
  const respostas = opcoes.respostas ?? {};
  const eliminatorias: EliminatoriaResult[] = [...job.eliminatorias, ...eliminatoriasDosRequisitos(job)]
    .map((e) => ({ ...e, resposta: respostas[e.id], noCv: noCv(e, perfil, requisitos) }));
  const dimensoes = calcularDimensoes(perfil, job);
  const recusadas = eliminatorias.filter((e) => e.resposta === false);
  const nucleo = calcularFaixa(requisitos, opcoes.limiarDesejaveis, { dimensoes, recusadas });
  const { resultado, faixa, comoMelhorar } = aplicarLente({
    lente, faixa: nucleo.faixa, requisitos, requisitosTodasFontes: lente.fontes ? avaliar() : requisitos, job, perfil, recusadas,
    arquivo: opcoes.arquivo ?? {}, vazio: nucleo.vazio,
  });
  return {
    ...nucleo,
    faixa,
    rotuloFaixa: resultado.rotulo,
    comoMelhorar: [...comoMelhorar, ...nucleo.comoMelhorar].slice(0, 5),
    lente: resultado,
    requisitos,
    classificacaoAutomatica: !job.temSecoes && job.requisitos.length > 0,
    dimensoes,
    eliminatorias,
    avisos: calcularAvisos(perfil, job, requisitos, dict),
    experiencia: {
      mesesTotais: perfil.mesesTotais,
      mesesEstagio: perfil.mesesEstagio,
      comData: perfil.experiencias.filter((e) => e.intervalo).length,
      semData: perfil.experiencias.filter((e) => !e.intervalo).length,
    },
  };
}

/** O que o CV mostra sobre o assunto de uma eliminatória, para o usuário responder com o CV à vista. */
function noCv(e: Eliminatoria, perfil: CvProfile, requisitos: RequirementResult[]): string | undefined {
  if (e.tipo === 'local') return perfil.local ? `No CV: ${rotuloLocal(perfil.local)}` : 'O CV não tem cidade e UF legíveis';
  const r = requisitos.find((x) => x.requisito.id === e.requisitoId);
  if (!r) return undefined;
  const i = r.requisito.componentes.findIndex((c) => c.tipo === e.tipo);
  // A pergunta já diz o que a vaga pede: fica só o que o CV mostra.
  return (i >= 0 ? r.componentes[i].motivo : r.motivo).replace(/; a vaga pede .*$/, '');
}

// ---------- Edições do usuário (só em memória, Q22) ----------

export function alterarTipo(job: JobSpec, id: string, tipo: ReqTipo): JobSpec {
  return { ...job, requisitos: job.requisitos.map((r) => (r.id === id ? { ...r, tipo, tipoFonte: 'usuario' } : r)) };
}

export function removerRequisito(job: JobSpec, id: string): JobSpec {
  return { ...job, requisitos: job.requisitos.filter((r) => r.id !== id) };
}

export function adicionarRequisito(job: JobSpec, texto: string, tipo: ReqTipo, dict: Dictionary): JobSpec {
  const usados = job.requisitos.map((r) => Number(/^u(\d+)$/.exec(r.id)?.[1] ?? 0));
  const id = `u${Math.max(0, ...usados) + 1}`;
  const dec = decompose(texto, dict);
  const componentes: Component[] = dec.componentes.length ? dec.componentes : [{ tipo: 'nao_reconhecido', termos: [] }];
  return {
    ...job,
    requisitos: [...job.requisitos, { id, texto, tipo, tipoFonte: 'usuario', origem: 'usuario', componentes }],
    termosNaoReconhecidos: [...new Set([...job.termosNaoReconhecidos, ...dec.termosNaoReconhecidos])],
  };
}

/** Transforma um termo não reconhecido em skill: todas as linhas que o citam passam a procurá-lo no CV. */
export function promoverTermo(job: JobSpec, termo: string): { job: JobSpec; skill: SkillDef } {
  const chave = fold(termo.normalize('NFC'));
  const skill: SkillDef = { id: `extra:${chave.replace(/[^a-z0-9#+.]+/g, '-')}`, rotulo: termo, categoria: 'ferramenta', aliases: [] };
  const cita = new RegExp(`${ANTES}${padraoTermo(chave)}${DEPOIS}`, 'u');
  const requisitos = job.requisitos.map((r) => {
    if (!cita.test(fold(r.texto.normalize('NFC')))) return r;
    // Sai o termo do "?"; um "?" sem termo (linha que nada reconheceu) dá lugar à skill.
    const componentes = r.componentes.flatMap((c): Component[] => {
      if (c.tipo !== 'nao_reconhecido') return [c];
      const resto = c.termos.filter((t) => fold(t.normalize('NFC')) !== chave);
      return resto.length ? [{ ...c, termos: resto }] : [];
    });
    if (componentes.some((c) => c.tipo === 'skill' && c.ids.includes(skill.id))) return r;
    return { ...r, componentes: [...componentes, { tipo: 'skill' as const, ids: [skill.id], modo: 'todas' as const }] };
  });
  return {
    job: { ...job, requisitos, termosNaoReconhecidos: job.termosNaoReconhecidos.filter((t) => fold(t.normalize('NFC')) !== chave) },
    skill,
  };
}

/**
 * Lista secundária (Q13): palavras da vaga que não aparecem no CV, fora as já cobertas pelo
 * dicionário. Não é critério documentado das plataformas; serve só para revisar.
 */
export function termosAusentes(cvText: string, jobText: string, dict: Dictionary, max = 15): string[] {
  // Fora títulos de seção e linhas de modelo de trabalho/benefícios; o que o dicionário cobre já está na tabela.
  // Linhas comportamentais já aparecem em "requisitos comportamentais".
  const linhas = jobText.normalize('NFC').split(/\r?\n/)
    .filter((l) => !tituloDeSecao(l, dict) && !IGNORAR_LINHA.test(fold(l.trim())) && !SOFT_SKILLS.test(fold(l)));
  const vaga = linhas.join('\n');
  const chars = vaga.split('');
  for (const m of dict.find(vaga)) for (let i = m.start; i < m.end; i++) chars[i] = ' ';
  const noCv = new Set(tokens(cvText).map((t) => t.raiz));
  const contagem = new Map<string, { palavra: string; n: number }>();
  for (const t of tokens(chars.join(''))) {
    const f = fold(t.palavra);
    // Verbos (infinitivo, gerúndio, "estamos") descrevem a rotina, não competências.
    const verbo = f.length >= 4 && /(ar|er|ir|ando|endo|indo|amos|emos|imos)$/.test(f);
    if (noCv.has(t.raiz) || f.length < 4 || verbo || PALAVRAS_GENERICAS.has(f)) continue;
    const atual = contagem.get(t.raiz);
    contagem.set(t.raiz, { palavra: atual?.palavra ?? t.palavra, n: (atual?.n ?? 0) + 1 });
  }
  return [...contagem.values()]
    .sort((a, b) => b.n - a.n || a.palavra.localeCompare(b.palavra))
    .slice(0, max)
    .map((x) => x.palavra);
}

/** Resumo legível de como a vaga foi lida: usado nos testes e nos arquivos .esperado.json. */
export function descreverVaga(job: JobSpec) {
  const comp = (c: Component): string => {
    switch (c.tipo) {
      case 'skill': return c.modo === 'alguma' && c.ids.length > 1 ? `alguma:${c.ids.join('|')}` : `skill:${c.ids.join('+')}`;
      case 'anos': return `anos:${c.minimo}`;
      case 'formacao': return `formacao:${c.nivelMinimo}${c.aceitaCursando ? '~cursando' : ''}:${c.area}`;
      case 'idioma': return `idioma:${fold(c.idioma)}>=${c.nivelMinimo}`;
      case 'cargo': return `cargo:${c.familia}`;
      case 'nao_reconhecido': return `?:${c.termos.join('|')}`;
    }
  };
  return {
    titulo: job.titulo ?? null,
    familia: job.familia ?? null,
    senioridade: job.senioridade ?? null,
    idioma: job.idioma ?? null,
    modelo: job.modelo ?? null,
    local: job.local ? rotuloLocal(job.local) : null,
    pais: job.pais ?? null,
    temSecoes: job.temSecoes,
    requisitos: job.requisitos.map((r) => ({ texto: r.texto, tipo: r.tipo, fonte: r.tipoFonte, componentes: r.componentes.map(comp) })),
    naoAvaliaveis: job.naoAvaliaveis,
    eliminatorias: [...job.eliminatorias, ...eliminatoriasDosRequisitos(job)].map((e) => `${e.tipo}: ${e.rotulo}`),
    afirmativa: job.afirmativa ?? null,
  };
}
