import { LENTES, ORDEM_LENTES } from '../../src/lib/ranking/lentes';
import { rotuloLocal, ROTULO_MODELO } from '../../src/lib/ranking/local';
import { ROTULO_FAMILIA, ROTULO_SENIORIDADE, type Familia } from '../../src/lib/ranking/dicionario/cargos';
import { fold } from '../../src/lib/ranking/texto';
import type { EliminatoriaTipo, FaixaId, JobSpec, LenteId, RankingResult } from '../../src/lib/ranking/types';
import type { Caso, Plataforma, Resultado } from './casos';

/** A lente que simula a plataforma onde a candidatura foi enviada. */
export const LENTE_DA_PLATAFORMA: Record<Plataforma, LenteId> = {
  gupy: 'gupy', linkedin: 'linkedin', workday: 'workday', inhire: 'nucleo', greenhouse: 'nucleo', outra: 'nucleo',
};

export interface Avaliacao {
  caso: Caso;
  /** Nome do PDF de referência igual a este CV, ou a impressão digital do arquivo. */
  cv: string;
  formato: number;
  job: JobSpec;
  porLente: Record<LenteId, RankingResult>;
}

const NOME_PLATAFORMA: Record<Plataforma, string> = {
  gupy: 'Gupy', linkedin: 'LinkedIn', workday: 'Workday', inhire: 'InHire', greenhouse: 'Greenhouse', outra: 'outra plataforma',
};
const NOME_RESULTADO: Record<Resultado, string> = {
  passou_triagem: 'passou na triagem', reprovado: 'reprovado', sem_retorno: 'sem retorno',
};
const FAIXA_CURTA: Record<FaixaId, string> = { top: 'Top fit', maybe: 'Maybe', not: 'Not fit' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Palavras que indicam o assunto de uma pergunta do formulário, para comparar com as eliminatórias previstas. */
const ASSUNTO: Array<[EliminatoriaTipo, RegExp]> = [
  ['local', /\b(resid\w*|mora\w*|cidade|hibrid\w*|presencia\w*|deslocamento|escritorio|mudanca)\b/],
  ['idioma', /\b(ingles|english|espanhol|idioma|fluente|fluencia)\b/],
  ['formacao', /\b(formacao|graduacao|superior|faculdade|curso|semestre|formatura|diploma)\b/],
  ['disponibilidade', /\b(disponibilidade|viage\w*|plantao|sobreaviso|turno\w*|fins? de semana|finais de semana|inicio imediato)\b/],
  ['documento', /\b(cnh|habilitacao|veiculo|autorizacao|visto|passaporte)\b/],
  ['certificacao', /\b(certificac\w*|certificad\w*)\b/],
];

const lenteDoCaso = (a: Avaliacao) => LENTE_DA_PLATAFORMA[a.caso.plataforma ?? 'outra'];
const aspas = (t: string) => `"${t.replace(/[.;:,]+$/, '')}"`;

/** Casos em que a previsão contradiz o que aconteceu: são eles que guiam os ajustes. */
export function destaques(a: Avaliacao): string[] {
  const lente = lenteDoCaso(a);
  const r = a.porLente[lente];
  const nome = LENTES[lente].nome;
  const out: string[] = [];
  if (r.vazio) {
    out.push('Nenhum requisito foi lido na vaga: confira se o vaga.txt tem o texto completo (às vezes o anúncio é só um modelo, com "(requirement 1)").');
    return out;
  }
  if (a.caso.resultado === 'passou_triagem' && r.faixa === 'not') {
    out.push(`Passou na triagem, mas a lente ${nome} deu "${r.lente.rotulo}": confira se os obrigatórios marcados como não atendidos foram lidos certo.`);
  }
  if (a.caso.resultado === 'reprovado' && r.faixa === 'top') {
    out.push(`Reprovado, mas a lente ${nome} deu "${r.lente.rotulo}": o corte veio de algo que o app não vê (pergunta do formulário, concorrência, decisão humana) ou de um requisito lido errado.`);
  }
  if (a.caso.perguntas.length) {
    const previstas = new Set(r.eliminatorias.map((e) => e.tipo));
    const assuntos = a.caso.perguntas.map((p) => ({ p, tipos: ASSUNTO.filter(([, re]) => re.test(fold(p.pergunta))).map(([t]) => t) }));
    const naoPrevistas = assuntos.filter((x) => x.tipos.length && !x.tipos.some((t) => previstas.has(t)));
    if (naoPrevistas.length) out.push(`Perguntas que o app não previu: ${naoPrevistas.map((x) => aspas(x.p.pergunta)).join('; ')}.`);
    const perguntados = new Set(assuntos.flatMap((x) => x.tipos));
    const semPergunta = r.eliminatorias.filter((e) => !perguntados.has(e.tipo));
    if (semPergunta.length) out.push(`Previstas que não viraram pergunta: ${semPergunta.map((e) => e.rotulo).join('; ')}.`);
  }
  return out;
}

function resumoDasLentes(a: Avaliacao): string {
  if (a.porLente.nucleo.vazio) return 'sem requisitos lidos, sem faixa';
  return ORDEM_LENTES.map((id) => {
    const r = a.porLente[id];
    if (id === 'nucleo') return `Núcleo ${FAIXA_CURTA[r.faixa]} (${r.numero})`;
    if (id === 'linkedin' && r.lente.indicador) return `LinkedIn ${r.lente.rotulo}, ${r.lente.indicador.replace(/ da vaga aparecem no CV.*$/, '')}`;
    return `${LENTES[id].nome}: ${r.lente.rotulo}`;
  }).join(' · ');
}

function vagaLida(job: JobSpec): string {
  const partes = [
    job.titulo ? aspas(job.titulo) : 'sem título reconhecido',
    job.familia && ROTULO_FAMILIA[job.familia as Familia],
    job.senioridade && ROTULO_SENIORIDADE[job.senioridade],
    job.modelo && job.local ? `${ROTULO_MODELO[job.modelo]} em ${rotuloLocal(job.local)}` : job.modelo ? ROTULO_MODELO[job.modelo] : job.local && rotuloLocal(job.local),
  ];
  return partes.filter(Boolean).join(' · ');
}

function secaoDoCaso(a: Avaliacao): string[] {
  const { caso } = a;
  const r = a.porLente[lenteDoCaso(a)];
  const obrig = r.requisitos.filter((x) => x.requisito.tipo === 'obrigatorio');
  const quando = caso.mes ? `${caso.dia ? `${caso.dia}/` : ''}${MESES[caso.mes - 1]}/${caso.ano}` : '';
  const real = [
    caso.resultado && NOME_RESULTADO[caso.resultado], caso.plataforma && NOME_PLATAFORMA[caso.plataforma], quando,
    caso.etapa && `etapa: ${caso.etapa}`,
    caso.diasAteResposta !== undefined && `resposta em ${caso.diasAteResposta} dia${caso.diasAteResposta === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');
  const linhas = [
    `### ${caso.nome}`,
    '',
    `- **Real:** ${real}`,
    `- **CV:** ${a.cv} (formato ${a.formato}/100)`,
    `- **Vaga lida:** ${vagaLida(a.job)}`,
    `- **App:** ${resumoDasLentes(a)}`,
  ];
  const lista = (titulo: string, itens: string[]) => {
    if (itens.length) linhas.push(`- **${titulo}** (lente ${LENTES[lenteDoCaso(a)].nome}): ${itens.join('; ')}`);
  };
  lista('Obrigatórios não atendidos', obrig.filter((x) => x.status === 'nao_atende').map((x) => aspas(x.requisito.texto)));
  lista('Obrigatórios parciais ou "?"', obrig.filter((x) => x.status === 'parcial' || x.status === 'nao_verificavel').map((x) => aspas(x.requisito.texto)));
  if (a.job.termosNaoReconhecidos.length) linhas.push(`- **Termos fora do dicionário:** ${a.job.termosNaoReconhecidos.join(', ')}`);
  if (r.eliminatorias.length) linhas.push(`- **Perguntas previstas:** ${r.eliminatorias.map((e) => e.rotulo).join('; ')}`);
  if (caso.perguntas.length) linhas.push(`- **Perguntas reais:** ${caso.perguntas.map((p) => `${aspas(p.pergunta)} → ${p.resposta || '?'}`).join('; ')}`);
  if (caso.observacoes) linhas.push(`- **Observações:** ${caso.observacoes}`);
  for (const d of destaques(a)) linhas.push(`- ⚠ ${d}`);
  linhas.push('');
  return linhas;
}

/** Relatório de calibração em Markdown (seção 8.1 do plano). Fica em fixtures/candidaturas/, fora do git. */
export function gerarRelatorio(avaliacoes: Avaliacao[], invalidos: Caso[], geradoEm: Date): string {
  const conhecidos = avaliacoes.filter((a) => a.caso.resultado && a.caso.resultado !== 'sem_retorno');
  const linhas = [
    '# Relatório de calibração',
    '',
    `Gerado em ${geradoEm.toLocaleDateString('pt-BR')} por \`npm run calibrar\`, com ${avaliacoes.length} candidatura${avaliacoes.length === 1 ? '' : 's'} `
      + `(${conhecidos.length} com resultado conhecido). Cada caso é lido na lente da plataforma em que foi enviado.`,
    '',
  ];
  if (avaliacoes.length < 20) {
    linhas.push(`> Com menos de 20 casos, o relatório serve para achar erros de leitura e de regra, não para medir acerto (seção 10 do plano).`, '');
  }

  if (invalidos.length) {
    linhas.push('## Casos com problema (fora do relatório)', '');
    for (const c of invalidos) linhas.push(`- **${c.nome}**: ${c.erros.join('; ')}`);
    linhas.push('');
  }

  linhas.push('## Resumo', '', '| Resultado real | Top fit | Maybe | Not fit | Sem requisitos lidos |', '|---|---|---|---|---|');
  for (const res of ['passou_triagem', 'reprovado', 'sem_retorno'] as const) {
    const casos = avaliacoes.filter((a) => a.caso.resultado === res);
    const comFaixa = casos.filter((a) => !a.porLente[lenteDoCaso(a)].vazio);
    const conta = (f: FaixaId) => comFaixa.filter((a) => a.porLente[lenteDoCaso(a)].faixa === f).length;
    linhas.push(`| ${NOME_RESULTADO[res]} (${casos.length}) | ${conta('top')} | ${conta('maybe')} | ${conta('not')} | ${casos.length - comFaixa.length} |`);
  }
  linhas.push('', 'Faixa pela regra do núcleo, com as fontes do CV e as regras da lente de cada plataforma.', '');

  const revisar = avaliacoes.filter((a) => destaques(a).length);
  linhas.push('## Para revisar', '');
  if (revisar.length) for (const a of revisar) linhas.push(`- **${a.caso.nome}**: ${destaques(a).join(' ')}`);
  else linhas.push('Nenhum caso em que a previsão contradiz o resultado.');
  linhas.push('');

  const avisos = avaliacoes.filter((a) => a.caso.avisos.length);
  if (avisos.length) {
    linhas.push('## Avisos de preenchimento', '');
    for (const a of avisos) linhas.push(`- **${a.caso.nome}**: ${a.caso.avisos.join('; ')}`);
    linhas.push('');
  }

  linhas.push('## Casos', '');
  for (const a of avaliacoes) linhas.push(...secaoDoCaso(a));
  return `${linhas.join('\n').trimEnd()}\n`;
}
