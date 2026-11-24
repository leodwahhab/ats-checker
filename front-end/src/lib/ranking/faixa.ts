import type { Dimensao, Eliminatoria, FaixaId, RankingResult, ReqStatus, RequirementResult } from './types';

/** Peso de cada status nas coberturas: ✓ = 1, ◐ = 0,5, ✗ e ? = 0 (4.6 do plano). */
const PESO: Record<ReqStatus, number> = { atende: 1, parcial: 0.5, nao_atende: 0, nao_verificavel: 0 };

export const ROTULO_FAIXA: Record<FaixaId, string> = {
  top: 'Alta aderência (Top fit)',
  maybe: 'Aderência parcial (Maybe)',
  not: 'Não atende (Not fit)',
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const cobertura = (rs: RequirementResult[]) => (rs.length ? rs.reduce((s, r) => s + PESO[r.status], 0) / rs.length : null);

type Faixa = Pick<RankingResult, 'faixa' | 'rotuloFaixa' | 'numero' | 'resumo' | 'comoMelhorar' | 'cobertura' | 'vazio'>;

export interface ExtrasDaFaixa {
  /** Cargo, senioridade e local: entram só no número secundário. */
  dimensoes?: Dimensao[];
  /** Eliminatórias respondidas com "não atendo". */
  recusadas?: Eliminatoria[];
}

/**
 * Regra do núcleo (regra do assistente de vagas do LinkedIn, Q10):
 * Not fit se falta algum obrigatório ou uma eliminatória foi respondida com "não"; Top fit se todos
 * os obrigatórios são atendidos e a cobertura dos desejáveis chega ao limiar; Maybe nos demais casos.
 */
export function calcularFaixa(rs: RequirementResult[], limiar: number, extras: ExtrasDaFaixa = {}): Faixa {
  const { dimensoes = [], recusadas = [] } = extras;
  const obrig = rs.filter((r) => r.requisito.tipo === 'obrigatorio');
  const desej = rs.filter((r) => r.requisito.tipo === 'desejavel');
  const cobObrig = cobertura(obrig);
  const cobDesej = cobertura(desej);

  const falharam = obrig.filter((r) => r.status === 'nao_atende');
  const pendentes = obrig.filter((r) => r.status === 'parcial' || r.status === 'nao_verificavel');
  const desejAbaixo = cobDesej !== null && cobDesej < limiar;
  const faixa: FaixaId = falharam.length || recusadas.length ? 'not' : pendentes.length || desejAbaixo ? 'maybe' : 'top';

  // Número secundário (4.7): obrigatórios 50, desejáveis 25, cargo 10, senioridade 10, local 5.
  // O que não tem dado sai do cálculo e o peso é redistribuído.
  const partes: Array<[number, number]> = [
    ...([[50, cobObrig], [25, cobDesej]] as Array<[number, number | null]>).filter((p): p is [number, number] => p[1] !== null),
    ...dimensoes.filter((d) => d.status !== 'nao_verificavel').map((d): [number, number] => [d.peso, PESO[d.status]]),
  ];
  const peso = partes.reduce((s, [p]) => s + p, 0);
  const numero = peso ? Math.round((partes.reduce((s, [p, c]) => s + p * c, 0) / peso) * 100) : 0;

  const atendidos = obrig.filter((r) => r.status === 'atende').length;
  const resumo = [
    obrig.length ? `Atende ${atendidos} de ${obrig.length} obrigatório${obrig.length > 1 ? 's' : ''}` : 'Nenhum obrigatório identificado',
    desej.length ? ` e ${pct(cobDesej!)} dos desejáveis.` : '.',
  ].join('');

  const comoMelhorar = [
    ...recusadas.map((e) => `Você respondeu que não atende "${e.rotulo}": numa pergunta eliminatória, a plataforma provavelmente reprova automaticamente`),
    ...falharam.map((r) => `Obrigatório não atendido: "${r.requisito.texto}"`),
    ...pendentes.map((r) => (r.status === 'parcial'
      ? `Obrigatório só parcial: "${r.requisito.texto}"`
      : `Obrigatório não verificável: "${r.requisito.texto}". Responda "tenho" ou "não tenho"`)),
  ];
  if (!falharam.length && !pendentes.length && !recusadas.length && desejAbaixo) {
    comoMelhorar.push(`Desejáveis: ${pct(cobDesej!)} atendidos; para Top fit é preciso ${pct(limiar)}`);
    desej.filter((r) => r.status !== 'atende').slice(0, 3)
      .forEach((r) => comoMelhorar.push(`Desejável que falta: "${r.requisito.texto}"`));
  }

  return {
    faixa,
    rotuloFaixa: ROTULO_FAIXA[faixa],
    numero,
    resumo,
    comoMelhorar: comoMelhorar.slice(0, 5),
    cobertura: { obrigatorios: cobObrig, desejaveis: cobDesej },
    // Informativos (tecnologias das atividades) não entram na faixa.
    vazio: obrig.length + desej.length === 0,
  };
}
