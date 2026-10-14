import { duracao, rotuloIntervalo, totalMeses } from './datas';
import { compararFamilia, ROTULO_FAMILIA, type Familia } from './dicionario/cargos';
import { ORDEM_FORMACAO, ORDEM_IDIOMA, ROTULO_FORMACAO, ROTULO_IDIOMA } from './dicionario/lexicos';
import type { Dictionary } from './matcher';
import { lista } from './texto';
import type {
  Component, ComponentResult, CvProfile, Evidence, ExperienciaPerfil, FonteEvidencia, FormacaoPerfil, ReqStatus, Requirement,
  RequirementResult,
} from './types';

/** Do melhor para o pior. Numa linha com vários componentes, vale o pior (4.5 do plano). */
const ORDEM: Record<ReqStatus, number> = { atende: 0, parcial: 1, nao_verificavel: 2, nao_atende: 3 };

export const ROTULO_STATUS: Record<ReqStatus, string> = {
  atende: 'Atende',
  parcial: 'Parcial',
  nao_atende: 'Não atende',
  nao_verificavel: 'Não verificável',
};

export const ICONE_STATUS: Record<ReqStatus, string> = { atende: '✓', parcial: '◐', nao_atende: '✗', nao_verificavel: '?' };

export interface OpcoesAvaliacao {
  /** Fontes que a lente aceita como evidência. Sem valor, todas valem. */
  fontes?: Set<FonteEvidencia>;
  /** Resposta do usuário para um requisito "?": tenho (true) ou não tenho (false). */
  declarado?: boolean;
}

const onde = (ev: Evidence[]) => [...new Set(ev.map((e) => e.rotulo))].slice(0, 3).join(', ');

export function avaliarRequisito(
  req: Requirement, perfil: CvProfile, dict: Dictionary, op: OpcoesAvaliacao = {},
): RequirementResult {
  const evidencias = (id: string) => (perfil.skills.get(id) ?? []).filter((e) => !op.fontes || op.fontes.has(e.fonte));
  /** Skills do CV que comprovam `id`, diretamente ou por implicação (PostgreSQL comprova SQL). */
  const comprovantes = (id: string) => [id, ...dict.implicadoPor(id)]
    .map((x) => ({ id: x, ev: evidencias(x) }))
    .filter((x) => x.ev.length);

  const skill = (id: string): ComponentResult => {
    const rotulo = dict.rotulo(id);
    const achados = comprovantes(id);
    if (achados.length) {
      const [primeiro, ...outros] = achados;
      const direto = primeiro.id === id;
      const partes = [direto ? onde(primeiro.ev) : `implícito por ${dict.rotulo(primeiro.id)} (${onde(primeiro.ev)})`];
      const extras = outros.slice(0, 2).map((x) => `${dict.rotulo(x.id)} (${onde(x.ev)})`);
      if (extras.length) partes.push(`${direto ? 'implícito também por' : 'e por'} ${extras.join(', ')}`);
      return { status: 'atende', motivo: `${rotulo}: ${partes.join('; ')}`, evidencias: achados.flatMap((x) => x.ev) };
    }
    for (const rel of dict.relacionadas(id)) {
      const [achado] = comprovantes(rel);
      if (achado) {
        return {
          status: 'parcial',
          motivo: `${rotulo}: não encontrado, mas o CV cita ${dict.rotulo(achado.id)} (${onde(achado.ev)}), que é relacionado`,
          evidencias: achado.ev,
        };
      }
    }
    // Lente com fontes restritas (Gupy): o CV cita a skill, mas numa seção que a plataforma não usa.
    const fora = op.fontes ? [id, ...dict.implicadoPor(id)].flatMap((x) => perfil.skills.get(x) ?? []) : [];
    if (fora.length) {
      return { status: 'nao_atende', motivo: `${rotulo}: o CV cita só em ${onde(fora)}, seção que esta plataforma não usa`, evidencias: [] };
    }
    return { status: 'nao_atende', motivo: `${rotulo}: não encontrado no que foi lido do CV`, evidencias: [] };
  };

  const componente = (c: Component): ComponentResult => {
    switch (c.tipo) {
      case 'skill': {
        const rs = c.ids.map(skill);
        if (c.modo === 'todas') return pior(rs);
        const melhor = rs.reduce((a, b) => (ORDEM[b.status] < ORDEM[a.status] ? b : a));
        if (melhor.status !== 'nao_atende') return melhor;
        return { status: 'nao_atende', motivo: `Nenhum de: ${c.ids.map(dict.rotulo).join(', ')}`, evidencias: [] };
      }
      case 'anos':
        return anos(c, req, perfil, dict);
      case 'formacao':
        return formacao(c, perfil);
      case 'idioma':
        return idioma(c, perfil, op.fontes);
      case 'cargo':
        return cargo(c, perfil);
      case 'nao_reconhecido':
        return {
          status: 'nao_verificavel',
          motivo: c.termos.length
            ? `${c.termos.map((t) => `"${t}"`).join(', ')} ${c.termos.length > 1 ? 'não estão' : 'não está'} no dicionário`
            : 'Requisito não reconhecido automaticamente: confirme se você atende',
          evidencias: [],
        };
    }
  };

  const componentes = req.componentes.map(componente);
  const resultado: ComponentResult = componentes.length
    ? pior(componentes)
    : { status: 'nao_verificavel', motivo: 'Requisito sem conteúdo reconhecível', evidencias: [] };
  // Lista de 3+ skills em que só uma falta ("Design Patterns, POO, SOLID, KISS…"): parcial, não ✗.
  const faltando = componentes.filter((c) => c.status === 'nao_atende');
  const skills = req.componentes.filter((c) => c.tipo === 'skill').length;
  if (resultado.status === 'nao_atende' && skills >= 3 && faltando.length === 1
    && req.componentes[componentes.indexOf(faltando[0])].tipo === 'skill'
    && componentes.every((c) => c.status === 'atende' || c === faltando[0])) {
    resultado.status = 'parcial';
    resultado.motivo = `Atende quase toda a lista; falta um item · ${resultado.motivo}`;
  }
  const evidenciasUnicas = [...new Map(resultado.evidencias.map((e) => [`${e.rotulo}|${e.trecho}`, e])).values()];

  if (resultado.status === 'nao_verificavel' && op.declarado !== undefined) {
    return {
      requisito: req,
      status: op.declarado ? 'atende' : 'nao_atende',
      motivo: `${op.declarado ? 'Você declarou que atende' : 'Você declarou que não atende'} · ${resultado.motivo}`,
      componentes,
      evidencias: [{ fonte: 'declarado', rotulo: 'Declarado por você', trecho: op.declarado ? 'tenho' : 'não tenho', explicita: false }, ...evidenciasUnicas],
      declarado: true,
    };
  }
  return { requisito: req, status: resultado.status, motivo: resultado.motivo, componentes, evidencias: evidenciasUnicas, declarado: false };
}

/** Junta componentes: o status é o pior; motivos e evidências se acumulam. */
function pior(rs: ComponentResult[]): ComponentResult {
  const status = rs.reduce<ReqStatus>((s, r) => (ORDEM[r.status] > ORDEM[s] ? r.status : s), 'atende');
  return { status, motivo: rs.map((r) => r.motivo).join(' · '), evidencias: rs.flatMap((r) => r.evidencias) };
}

const melhor = (rs: ComponentResult[]) => rs.reduce((a, b) => (ORDEM[b.status] < ORDEM[a.status] ? b : a));

type Comp<T extends Component['tipo']> = Extract<Component, { tipo: T }>;

const evidenciaDe = (e: ExperienciaPerfil): Evidence => ({
  fonte: 'experiencia', rotulo: `Experiência · ${e.rotulo}`, explicita: false, entrada: e.indice,
  trecho: [e.cargo, e.intervalo && rotuloIntervalo(e.intervalo)].filter(Boolean).join(' · '),
});

/** Experiências com data que citam a skill, ou uma skill que a implica (PostgreSQL conta para SQL). */
export function experienciasCom(id: string, perfil: CvProfile, dict: Dictionary): ExperienciaPerfil[] {
  const indices = new Set<number>();
  for (const x of [id, ...dict.implicadoPor(id)]) {
    for (const e of perfil.skills.get(x) ?? []) if (e.fonte === 'experiencia' && e.entrada !== undefined) indices.add(e.entrada);
  }
  return perfil.experiencias.filter((e) => e.intervalo && indices.has(e.indice));
}

const mesesDe = (exps: ExperienciaPerfil[]) => totalMeses(exps.map((e) => e.intervalo!));

/**
 * Anos de experiência (4.5): ✓ atinge o mínimo; ◐ falta até 1 ano, para mínimos de 2 anos ou mais;
 * ✗ falta mais que isso. Com skills na linha, conta o tempo das experiências que citam a skill.
 */
function anos(c: Comp<'anos'>, req: Requirement, perfil: CvProfile, dict: Dictionary): ComponentResult {
  const pedido = `a vaga pede ${c.minimo}+ ${c.minimo > 1 ? 'anos' : 'ano'}`;
  const comData = perfil.experiencias.filter((e) => e.intervalo);
  if (!comData.length) {
    return { status: 'nao_atende', motivo: `Tempo de experiência: nenhuma experiência com período legível foi lida do CV; ${pedido}`, evidencias: [] };
  }

  let rotulo: string;
  let exps: ExperienciaPerfil[];
  const skills = req.componentes.filter((x): x is Comp<'skill'> => x.tipo === 'skill');
  if (skills.length) {
    // "Java e Spring Boot": vale a skill com menos tempo; "Java ou Kotlin": a com mais (seção 11, item 6).
    const porGrupo = skills.map((g) => {
      const opcoes = g.ids.map((id) => ({ id, exps: experienciasCom(id, perfil, dict) }));
      const ordenadas = opcoes.sort((a, b) => mesesDe(a.exps) - mesesDe(b.exps));
      return g.modo === 'alguma' ? ordenadas[ordenadas.length - 1] : ordenadas[0];
    });
    const limitante = porGrupo.reduce((a, b) => (mesesDe(b.exps) < mesesDe(a.exps) ? b : a));
    const empate = porGrupo.every((g) => mesesDe(g.exps) === mesesDe(limitante.exps));
    rotulo = porGrupo.length === 1 || empate
      ? lista(porGrupo.map((g) => dict.rotulo(g.id)))
      : `${dict.rotulo(limitante.id)} (a skill da linha com menos tempo)`;
    exps = limitante.exps;
  } else if (c.familia) {
    rotulo = `Experiência como ${ROTULO_FAMILIA[c.familia as Familia] ?? c.familia}`;
    exps = comData.filter((e) => e.familia && compararFamilia(e.familia, c.familia!) === 'atende');
  } else {
    rotulo = 'Experiência profissional';
    exps = comData;
  }

  const meses = mesesDe(exps);
  const minimo = c.minimo * 12;
  const status: ReqStatus = meses >= minimo ? 'atende' : c.minimo >= 2 && minimo - meses <= 12 ? 'parcial' : 'nao_atende';
  const onde = exps.slice(0, 3).map((e) => `${e.rotulo}, ${rotuloIntervalo(e.intervalo!)}`).join('; ');
  const estagio = mesesDe(exps) - mesesDe(exps.filter((e) => !e.estagio));
  const partes = [`${rotulo}: ${duracao(meses)}${onde ? ` (${onde})` : ''}`];
  if (estagio > 0) partes.push(`inclui ${duracao(estagio)} de estágio`);
  // A experiência que não cita a skill não conta: diz qual, para o candidato saber o que escrever.
  const fora = comData.filter((e) => !exps.includes(e)).slice(0, 2);
  if (skills.length && fora.length) {
    const nomes = fora.map((e) => (e.cargo ? `${e.cargo} (${e.rotulo})` : e.rotulo));
    partes.push(`${lista(nomes)} não ${fora.length > 1 ? 'citam' : 'cita'} ${rotulo.replace(/ \(.*$/, '')}`);
  }
  return { status, motivo: `${partes.join('; ')}; ${pedido}`, evidencias: exps.map(evidenciaDe) };
}

/** Formação (4.5): ✓ nível e situação atendidos; ◐ cursando quando a vaga pede completo; ? área ou situação não lida. */
function formacao(c: Comp<'formacao'>, perfil: CvProfile): ComponentResult {
  const pedido = `${ROTULO_FORMACAO[c.nivelMinimo]}${c.aceitaCursando ? ' completo ou em andamento' : ' completo'}${c.area === 'ti' ? ' em TI ou área afim' : ''}`;
  if (!perfil.formacao.length) {
    return { status: 'nao_atende', motivo: `Formação: nenhuma formação com curso e período legíveis foi lida do CV; a vaga pede ${pedido}`, evidencias: [] };
  }
  const avaliar = (f: FormacaoPerfil): ComponentResult => {
    const ev: Evidence[] = [{ fonte: 'formacao', rotulo: 'Formação', trecho: f.descricao, explicita: false }];
    const r = (status: ReqStatus, motivo: string): ComponentResult => ({ status, motivo: `Formação: ${f.descricao}: ${motivo}; a vaga pede ${pedido}`, evidencias: ev });
    if (!f.nivel) return r('nao_verificavel', 'o nível do curso não foi identificado');
    if (ORDEM_FORMACAO.indexOf(f.nivel) < ORDEM_FORMACAO.indexOf(c.nivelMinimo)) return { ...r('nao_atende', 'nível abaixo do pedido'), evidencias: [] };
    if (c.area === 'ti' && !f.areaTi) return r('nao_verificavel', 'não reconheci o curso como da área de TI; confirme se a vaga aceita');
    switch (f.situacao) {
      case 'concluido': return r('atende', f.inferida ? 'concluído (pela data de término)' : 'concluído');
      case 'cursando': return c.aceitaCursando ? r('atende', 'em andamento') : r('parcial', 'em andamento');
      case 'incompleto': return { ...r('nao_atende', 'incompleto ou trancado'), evidencias: [] };
      case 'desconhecida': return r('nao_verificavel', 'o CV não diz se o curso foi concluído');
    }
  };
  return melhor(perfil.formacao.map(avaliar));
}

/** Idioma (4.5): ✓ nível igual ou acima; ◐ um nível abaixo; ✗ ausente ou dois abaixo; ? nível não lido. */
function idioma(c: Comp<'idioma'>, perfil: CvProfile, fontes?: Set<FonteEvidencia>): ComponentResult {
  const pedido = `a vaga pede ${ROTULO_IDIOMA[c.nivelMinimo]}`;
  // Na Gupy, só a seção Idiomas: o resumo não preenche o campo de idiomas do perfil.
  const l = perfil.idiomas.find((x) => x.idioma === c.idioma && (!fontes || fontes.has(x.fonte)));
  if (!l) return { status: 'nao_atende', motivo: `${c.idioma}: não aparece no CV; ${pedido}`, evidencias: [] };
  const ev: Evidence[] = [{ fonte: l.fonte, rotulo: l.fonte === 'idiomas' ? 'Idiomas' : 'Resumo', trecho: l.trecho, explicita: l.fonte === 'idiomas' }];
  if (!l.nivel) return { status: 'nao_verificavel', motivo: `${c.idioma}: o CV não informa o nível; ${pedido}`, evidencias: ev };
  const diferenca = ORDEM_IDIOMA.indexOf(l.nivel) - ORDEM_IDIOMA.indexOf(c.nivelMinimo);
  const status: ReqStatus = diferenca >= 0 ? 'atende' : diferenca === -1 ? 'parcial' : 'nao_atende';
  return { status, motivo: `${c.idioma}: ${ROTULO_IDIOMA[l.nivel]} no CV; ${pedido}`, evidencias: ev };
}

/** Cargo anterior (4.5): ✓ mesma família; ◐ família vizinha (full stack ↔ back-end); ✗ outra. */
function cargo(c: Comp<'cargo'>, perfil: CvProfile): ComponentResult {
  const pedido = ROTULO_FAMILIA[c.familia as Familia] ?? c.familia;
  const exps = perfil.experiencias.filter((e) => e.familia);
  const rs = exps.map((e): ComponentResult => {
    const status = compararFamilia(e.familia!, c.familia);
    const cargoLido = `${e.cargo} (${e.rotulo})`;
    return {
      status,
      motivo: status === 'atende' ? `Experiência como ${pedido}: ${cargoLido}` : `Experiência como ${pedido}: o mais próximo é ${cargoLido}`,
      evidencias: status === 'nao_atende' ? [] : [evidenciaDe(e)],
    };
  });
  const r = rs.length ? melhor(rs) : null;
  if (r && r.status !== 'nao_atende') return r;
  return {
    status: 'nao_atende',
    motivo: perfil.experiencias.length ? `Experiência como ${pedido}: nenhum cargo lido do CV é dessa área` : `Experiência como ${pedido}: nenhuma experiência foi lida do CV`,
    evidencias: [],
  };
}
