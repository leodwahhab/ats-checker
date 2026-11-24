import type { Structured } from '../types';
import { intervaloDe, lacunas, totalMeses } from './datas';
import { familiaDe, senioridadeDe } from './dicionario/cargos';
import { AREA_TI_CURSO, IDIOMAS, NIVEIS_IDIOMA } from './dicionario/lexicos';
import { localDe } from './local';
import type { Dictionary } from './matcher';
import { fold, idiomaDoTexto, trecho } from './texto';
import type {
  CvProfile, Evidence, ExperienciaPerfil, FormacaoPerfil, IdiomaPerfil, NivelFormacao, NivelIdioma, Senioridade,
  SituacaoFormacao,
} from './types';

/**
 * O que o ranqueamento sabe do CV, usando só o que o parser extraiu (Q5). Habilidades é a fonte
 * explícita de skills; experiência, resumo, cabeçalho, certificações, projetos e formação são implícitas.
 */
export function buildCvProfile(s: Structured, dict: Dictionary, hoje = new Date()): CvProfile {
  const skills = new Map<string, Evidence[]>();

  const registrar = (texto: string | undefined, base: Omit<Evidence, 'trecho'>): string[] => {
    if (!texto) return [];
    const src = texto.normalize('NFC');
    const ms = dict.find(src);
    for (const m of ms) {
      const lista = skills.get(m.id) ?? [];
      const t = trecho(src, m.start, m.end);
      if (!lista.some((e) => e.rotulo === base.rotulo && e.trecho === t && e.entrada === base.entrada)) lista.push({ ...base, trecho: t });
      skills.set(m.id, lista);
    }
    return ms.map((m) => m.id);
  };

  // Skills listadas em Habilidades, sem contar o nome das categorias ("Back-end: Java, …").
  const listadas = new Set<string>();
  for (const g of s.habilidades) {
    const geral = g.categoria === 'Geral';
    const base = { fonte: 'habilidades' as const, rotulo: geral ? 'Habilidades' : `Habilidades · ${g.categoria}`, explicita: true };
    if (!geral) registrar(g.categoria, base);
    for (const item of g.itens) registrar(item, base).forEach((id) => listadas.add(id));
  }

  s.experiencia.forEach((e, i) => {
    const base = { fonte: 'experiencia' as const, rotulo: `Experiência · ${e.empresa ?? e.cargo ?? `item ${i + 1}`}`, explicita: false, entrada: i };
    registrar(e.cargo, base);
    registrar(e.resumo, base);
    e.responsabilidades.forEach((r) => registrar(r, base));
    registrar(e.tecnologias, base);
  });

  registrar(s.resumo, { fonte: 'resumo', rotulo: 'Resumo', explicita: false });
  s.cabecalho.forEach((l) => registrar(l, { fonte: 'cabecalho', rotulo: 'Cabeçalho', explicita: false }));
  // Links do contato: "github.com/usuario" comprova GitHub.
  s.contato.forEach((l) => registrar(l, { fonte: 'cabecalho', rotulo: 'Contato', explicita: false }));
  s.certificacoes.forEach((c) => registrar([c.nome, c.emissor].filter(Boolean).join(' | '), {
    fonte: 'certificacoes', rotulo: 'Certificações', explicita: false,
  }));
  s.projetos.forEach((l) => registrar(l, { fonte: 'projetos', rotulo: 'Projetos', explicita: false }));
  s.formacao.forEach((f) => registrar(f.curso, { fonte: 'formacao', rotulo: 'Formação', explicita: false }));

  // ---------- Tempo de experiência (4.4 do plano) ----------
  const experiencias: ExperienciaPerfil[] = s.experiencia.map((e, i) => {
    const senioridade = e.cargo ? senioridadeDe(e.cargo) : undefined;
    return {
      indice: i,
      rotulo: e.empresa ?? e.cargo ?? `item ${i + 1}`,
      cargo: e.cargo,
      intervalo: e.periodo ? intervaloDe(e.periodo, hoje) : null,
      atual: !!e.periodo?.atual,
      estagio: senioridade === 'estagio' || /\baprendiz\b/.test(fold(e.cargo ?? '')),
      familia: e.cargo ? familiaDe(e.cargo) : undefined,
      senioridade,
    };
  });
  const comData = experiencias.filter((e) => e.intervalo);
  const intervalos = comData.map((e) => e.intervalo!);
  const mesesTotais = totalMeses(intervalos);
  const mesesEstagio = mesesTotais - totalMeses(comData.filter((e) => !e.estagio).map((e) => e.intervalo!));

  // A experiência mais recente; sem datas, vale a primeira da lista (os CVs costumam começar pela atual).
  const recente = comData.length
    ? comData.reduce((a, b) => {
      const [x, y] = [a.intervalo!, b.intervalo!];
      return y.fim > x.fim || (y.fim === x.fim && y.inicio > x.inicio) ? b : a;
    })
    : experiencias[0];
  const cabecalho = s.cabecalho.join(' · ');
  let senioridade: Senioridade | undefined;
  let fonteSenioridade: CvProfile['atual']['fonteSenioridade'];
  if (recente?.senioridade) [senioridade, fonteSenioridade] = [recente.senioridade, 'cargo'];
  else if (senioridadeDe(cabecalho)) [senioridade, fonteSenioridade] = [senioridadeDe(cabecalho), 'cabecalho'];
  else if (comData.length) [senioridade, fonteSenioridade] = [senioridadePorTempo(mesesTotais), 'anos'];

  return {
    skills,
    habilidadesExplicitas: listadas.size,
    experiencias,
    mesesTotais,
    mesesEstagio,
    lacunas: lacunas(intervalos, hoje),
    formacao: s.formacao.flatMap(formacaoDoCv),
    idiomas: idiomasDoCv(s),
    atual: { experiencia: recente, familia: recente?.familia ?? familiaDe(cabecalho), senioridade, fonteSenioridade },
    // Só "Cidade - UF": um nome próprio solto no topo pode ser o do candidato.
    local: [...s.contato, ...s.cabecalho].map((l) => localDe(l)).find(Boolean),
    idioma: idiomaDoTexto([
      s.resumo, ...s.cabecalho, ...s.experiencia.flatMap((e) => [e.cargo, e.resumo, ...e.responsabilidades]),
    ].filter(Boolean).join('\n')),
  };
}

/**
 * Aproximação de mercado (seção 11, itens 7 e 30): júnior até 2 anos, pleno de 2 a 5, sênior acima
 * disso. O estágio conta no tempo.
 */
function senioridadePorTempo(meses: number): Senioridade {
  if (meses < 24) return 'junior';
  return meses <= 60 ? 'pleno' : 'senior';
}

const NIVEL_DO_PARSER: Record<string, NivelFormacao> = {
  doutorado: 'doutorado', mestrado: 'mestrado', 'pos-graduacao': 'pos', graduacao: 'graduacao', tecnico: 'tecnico',
  'ensino medio': 'medio',
};

function formacaoDoCv(f: Structured['formacao'][number]): FormacaoPerfil[] {
  if (f.nivel === 'Intercâmbio') return [];
  const status = fold(f.status ?? '');
  const situacao: SituacaoFormacao = /^conclu/.test(status) ? 'concluido'
    : /andamento|cursando/.test(status) ? 'cursando'
      : /incompleto|trancado|interrompido/.test(status) ? 'incompleto' : 'desconhecida';
  return [{
    nivel: NIVEL_DO_PARSER[fold(f.nivel)],
    curso: f.curso,
    areaTi: AREA_TI_CURSO.test(fold(f.curso ?? '')),
    situacao,
    inferida: f.statusInferido,
    descricao: [f.nivel !== 'Não identificado' ? f.nivel : undefined, f.curso, f.instituicao, f.status].filter(Boolean).join(' · '),
  }];
}

const nivelIdioma = (f: string): NivelIdioma | undefined => NIVEIS_IDIOMA.find(([, re]) => re.test(f))?.[0];

function idiomasDoCv(s: Structured): IdiomaPerfil[] {
  const out: IdiomaPerfil[] = s.idiomas.map((l) => ({
    idioma: IDIOMAS.find(([, re]) => re.test(fold(l.idioma)))?.[0] ?? l.idioma,
    nivel: nivelIdioma(fold(l.nivel ?? '')),
    fonte: 'idiomas',
    trecho: [l.idioma, l.nivel].filter(Boolean).join(' · '),
  }));
  // Sem seção Idiomas, o resumo pode dizer "inglês avançado (TOEIC B2)".
  const resumo = (s.resumo ?? '').normalize('NFC');
  const f = fold(resumo);
  for (const [idioma, re] of IDIOMAS) {
    if (out.some((l) => l.idioma === idioma)) continue;
    const m = new RegExp(re.source, 'g').exec(f);
    if (!m) continue;
    const fim = m.index + m[0].length;
    const nivel = nivelIdioma(f.slice(fim, fim + 40)) ?? nivelIdioma(f.slice(Math.max(0, m.index - 25), m.index));
    out.push({ idioma, nivel, fonte: 'resumo', trecho: trecho(resumo, m.index, fim, 80) });
  }
  return out;
}
