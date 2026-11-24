import { ROTULO_FAIXA } from './faixa';
import { fold, lista } from './texto';
import type {
  CvProfile, Eliminatoria, FaixaId, FonteDoc, FonteEvidencia, JobSpec, LensConfig, LenteId, NotaWorkday, ReqStatus,
  RequirementResult, ResultadoLente,
} from './types';

/** Data em que as páginas abaixo foram lidas (seção 14 do plano). Revisar a cada 6 meses. */
export const VERIFICADO_EM = '12/10/2026';

const doc = (rotulo: string, url: string): FonteDoc => ({ rotulo, url });
const WORKDAY = 'https://doc.workday.com/hiredscore/en-us/workday-hiredscore';

export const FONTES = {
  gupyOrdenacao: doc('Gupy: como funciona a ordenação', 'https://www.gupy.io/blog-do-emprego/como-funciona-a-ordenacao-da-gupy'),
  gupyIa: doc('Gupy: agentes de IA', 'https://www.gupy.io/blog-do-emprego/gupy-ia'),
  gupyPreenchimento: doc('Gupy: preenchimento do currículo', 'https://www.gupy.io/blog-do-emprego/preenchimento-de-curriculo'),
  gupyAlgoritmo: doc('Gupy: ordenação de pessoas candidatas', 'https://www.gupy.io/blog-do-emprego/algoritmo-de-pessoas-candidatas'),
  gupyEmpresas: doc('Gupy: nova ordenação (página para empresas)', 'https://www.gupy.io/nova-ordenacao-com-agentes-de-ia'),
  gupyAgentes: doc('Gupy: como passar pelos agentes de IA', 'https://www.gupy.io/inteligencia-artificial/criterios-eliminatorios-no-cadastro'),
  linkedinAssistente: doc('LinkedIn: assistente de IA para vagas', 'https://business.linkedin.com/hire/post-jobs/ai-assistant'),
  linkedinHiringPro: doc('LinkedIn: FAQ do Hiring Pro', 'https://www.linkedin.com/help/learning/answer/a6898871'),
  linkedinMatch: doc('LinkedIn: job match e Top Applicant', 'https://www.linkedin.com/help/linkedin/answer/a7120158'),
  linkedinSkills: doc('LinkedIn: skills match', 'https://www.linkedin.com/help/linkedin/answer/a793433'),
  linkedinTriagem: doc('LinkedIn: perguntas de triagem', 'https://www.linkedin.com/help/linkedin/answer/a519651'),
  workdayNotas: doc('Workday HiredScore: notas dos candidatos', `${WORKDAY}/recruiter-productivity-/reference--candidate-grades.html`),
  workdaySpotlight: doc('Workday HiredScore: Spotlight (quando não há nota)', `${WORKDAY}/recruiter-productivity-/concept--spotlight.html`),
  workdayFaq: doc('Workday HiredScore: FAQ', `${WORKDAY}/recruiter-productivity-/faq--hiredscore-general.html`),
  workdayFitGap: doc('Workday HiredScore: Fit & Gap', `${WORKDAY}/recruiter-productivity-/concept--fit---gap.html`),
  workdayRelease: doc('Workday HiredScore: novidades de agosto de 2026', `${WORKDAY}/hiredscore-release-notes/2026/august/wednesday--5th-august.html`),
  taleo: doc('Oracle Taleo: triagem de candidatos', 'https://docs.oracle.com/en/cloud/saas/taleo-enterprise/20b/otrec/candidate-prescreening.html'),
  greenhouse: doc('Greenhouse: Talent Matching', 'https://support.greenhouse.io/hc/en-us/articles/41396009937307-Talent-Matching'),
} satisfies Record<string, FonteDoc>;

const F = FONTES;

/** As quatro lentes (4.9 do plano). Cada regra que a documentação não fecha vira uma aproximação com fonte. */
export const LENTES: Record<LenteId, LensConfig> = {
  nucleo: {
    id: 'nucleo',
    nome: 'Núcleo',
    descricao: 'Regra comum às plataformas: requisitos obrigatórios e desejáveis, com todas as seções do CV como evidência.',
    rotulos: ROTULO_FAIXA,
    aproximacoes: [
      { texto: 'A faixa usa a regra do assistente de vagas do LinkedIn para todas as plataformas.', fonte: F.linkedinAssistente },
      { texto: 'Desejáveis para Top fit: 50% por padrão. O Taleo sugere começar com 75% no equivalente dele.', fonte: F.taleo },
      { texto: 'Os pesos do número secundário (50, 25, 10, 10 e 5) são do app: cada empresa configura os seus.', fonte: F.gupyAlgoritmo },
    ],
    notas: [
      { texto: 'O Greenhouse também compara o currículo com a vaga e nunca avança nem rejeita ninguém sozinho.', fonte: F.greenhouse },
    ],
    documentacao: [F.linkedinAssistente, F.gupyOrdenacao, F.workdayNotas, F.greenhouse, F.taleo],
  },
  gupy: {
    id: 'gupy',
    nome: 'Gupy',
    descricao: 'A ordenação da Gupy compara o perfil com os requisitos da vaga a partir dos campos Experiência e Habilidades.',
    fontes: ['habilidades', 'experiencia', 'formacao', 'idiomas'],
    rotulos: { top: 'Aderência alta', maybe: 'Aderência média', not: 'Aderência baixa' },
    aproximacoes: [
      {
        texto: 'Formação e idiomas contam: a página dos agentes de IA os lista entre o que é analisado, embora diga que só Experiência e Habilidades são lidos.',
        fonte: F.gupyIa,
      },
      { texto: 'Os rótulos alta, média e baixa são do app: a Gupy não publica faixas.', fonte: F.gupyOrdenacao },
    ],
    notas: [
      { texto: 'A IA não reprova ninguém: só os requisitos obrigatórios definidos pela empresa eliminam automaticamente.', fonte: F.gupyAlgoritmo },
      { texto: 'Testes da plataforma e respostas às perguntas eliminatórias também entram na ordenação; quem conclui etapas aparece antes.', fonte: F.gupyAlgoritmo },
      { texto: 'O parser preenche o perfil, mas não chega a 100%: revise campo a campo o que ele leu.', fonte: F.gupyPreenchimento },
      { texto: 'A leitura é melhor com DOC/DOCX ou o PDF exportado do LinkedIn, em uma coluna, sem imagens e no idioma da vaga.', fonte: F.gupyPreenchimento },
      { texto: 'Preencha em Habilidades as 30 com maior aderência a você.', fonte: F.gupyOrdenacao },
      { texto: 'Quantifique conquistas: números ajudam.', fonte: F.gupyIa },
      { texto: 'A ordenação entende contexto, em vez de buscar palavras-chave de forma rígida.', fonte: F.gupyOrdenacao },
      { texto: 'Inflar o perfil com palavras-chave não engana os agentes e pode pesar contra na revisão humana.', fonte: F.gupyAgentes },
    ],
    documentacao: [F.gupyOrdenacao, F.gupyIa, F.gupyPreenchimento, F.gupyAlgoritmo, F.gupyEmpresas, F.gupyAgentes],
  },
  linkedin: {
    id: 'linkedin',
    nome: 'LinkedIn',
    descricao: 'Assistente de vagas do LinkedIn: Top fit, Maybe ou Not a fit, e quantas skills da vaga aparecem no perfil.',
    rotulos: { top: 'Top fit', maybe: 'Maybe', not: 'Not a fit' },
    aproximacoes: [
      { texto: 'Quem publica a vaga define a porcentagem de desejáveis para Top fit; o padrão não é divulgado.', fonte: F.linkedinAssistente },
      { texto: 'Como um requisito "parcial" entra na faixa não é documentado: aqui ele impede Top fit sem causar Not a fit.', fonte: F.linkedinAssistente },
      { texto: 'O FAQ do Hiring Pro descreve a regra com um número de desejáveis, não uma porcentagem.', fonte: F.linkedinHiringPro },
    ],
    notas: [
      { texto: 'A classificação Top fit / Maybe / Not a fit existe só em vagas promovidas, com o LinkedIn em inglês, no desktop.', fonte: F.linkedinAssistente },
      { texto: 'O nível de match e o selo Top Applicant que o candidato vê são do Premium; quem contrata não vê esse nível.', fonte: F.linkedinMatch },
      { texto: 'Skills contam como explícitas na seção Skills e como implícitas no resto do perfil (resumo, cargos, headline).', fonte: F.linkedinSkills },
    ],
    documentacao: [F.linkedinAssistente, F.linkedinHiringPro, F.linkedinMatch, F.linkedinSkills, F.linkedinTriagem],
  },
  workday: {
    id: 'workday',
    nome: 'Workday',
    descricao: 'Notas A a D do HiredScore (algoritmo legado): qualificações básicas são os obrigatórios; as preferenciais, os desejáveis.',
    rotulos: { top: 'Nota A', maybe: 'Nota B', not: 'Nota D' },
    aproximacoes: [
      { texto: '"Maioria" é lida como mais de 50%, com parcial valendo 0,5 e "?" valendo 0.', fonte: F.workdayNotas },
      { texto: 'A nota A também exige um match médio acima de um limiar que não é divulgado.', fonte: F.workdayNotas },
      { texto: 'Usa o algoritmo legado: o novo, de agosto de 2026, depende de cada empresa ativar.', fonte: F.workdayRelease },
    ],
    notas: [
      { texto: 'A tabela de requisitos faz o papel do Fit & Gap, que avalia cada qualificação contra o currículo (recurso opcional).', fonte: F.workdayFitGap },
      { texto: 'O HiredScore aceita DOC, DOCX, PDF, RTF e TXT.', fonte: F.workdayFaq },
    ],
    documentacao: [F.workdayNotas, F.workdaySpotlight, F.workdayFaq, F.workdayFitGap, F.workdayRelease],
  },
};

/** Peso nas contagens do Workday (seção 11, item 13): parcial vale meio; "?" não conta. */
const PESO: Record<ReqStatus, number> = { atende: 1, parcial: 0.5, nao_atende: 0, nao_verificavel: 0 };
const cobertura = (rs: RequirementResult[]) => (rs.length ? rs.reduce((s, r) => s + PESO[r.status], 0) / rs.length : null);

/**
 * Nota do HiredScore no algoritmo legado: A = todos os obrigatórios e a maioria dos desejáveis;
 * B = todos os obrigatórios; C = a maioria dos obrigatórios; D = metade ou menos.
 */
export function notaWorkday(rs: RequirementResult[]): NotaWorkday {
  const obrig = rs.filter((r) => r.requisito.tipo === 'obrigatorio');
  const desej = cobertura(rs.filter((r) => r.requisito.tipo === 'desejavel'));
  if (obrig.every((r) => r.status === 'atende')) return desej === null || desej > 0.5 ? 'A' : 'B';
  return (cobertura(obrig) ?? 0) > 0.5 ? 'C' : 'D';
}

const SIGNIFICADO_NOTA: Record<NotaWorkday, string> = {
  A: 'todos os obrigatórios e a maioria dos desejáveis',
  B: 'todos os obrigatórios, mas não a maioria dos desejáveis',
  C: 'a maioria dos obrigatórios, mas não todos',
  D: 'metade dos obrigatórios ou menos',
};
const TOM_NOTA: Record<NotaWorkday, FaixaId> = { A: 'top', B: 'maybe', C: 'maybe', D: 'not' };

const ORDEM: Record<ReqStatus, number> = { atende: 0, parcial: 1, nao_verificavel: 2, nao_atende: 3 };
const ROTULO_FONTE: Partial<Record<FonteEvidencia, string>> = {
  resumo: 'Resumo', cabecalho: 'Cabeçalho', certificacoes: 'Certificações', projetos: 'Projetos',
};
/** Os primeiros requisitos entre aspas, sem a pontuação final da linha. */
const citar = (rs: RequirementResult[]) => lista(rs.slice(0, 3).map((r) => `"${r.requisito.texto.replace(/[.;:,]+$/, '')}"`))
  + (rs.length > 3 ? ` e mais ${rs.length - 3}` : '');

export interface EntradaLente {
  lente: LensConfig;
  /** Faixa pela regra do núcleo (4.6), com as fontes do CV que a lente aceita. */
  faixa: FaixaId;
  requisitos: RequirementResult[];
  /** Os mesmos requisitos com todas as seções do CV, para mostrar o que a lente deixa de ver. */
  requisitosTodasFontes: RequirementResult[];
  job: JobSpec;
  perfil: CvProfile;
  recusadas: Eliminatoria[];
  arquivo: { semTexto?: boolean; exportLinkedin?: boolean };
  vazio: boolean;
}

export interface SaidaLente {
  resultado: ResultadoLente;
  /** A faixa depois das regras da lente (o LinkedIn limita vaga de outro país a Maybe). */
  faixa: FaixaId;
  /** O que a lente acrescenta a "o que impede um resultado melhor". */
  comoMelhorar: string[];
}

/** Aplica as particularidades de uma plataforma ao resultado do núcleo. */
export function aplicarLente(e: EntradaLente): SaidaLente {
  const { lente } = e;
  const base: ResultadoLente = {
    id: lente.id, nome: lente.nome, descricao: lente.descricao, rotulo: lente.rotulos[e.faixa], tom: e.faixa, fontes: lente.fontes,
    alertas: [], notas: lente.notas, aproximacoes: lente.aproximacoes, documentacao: lente.documentacao,
  };
  switch (lente.id) {
    case 'gupy': return gupy(e, base);
    case 'linkedin': return linkedin(e, base);
    case 'workday': return workday(e, base);
    default: return { resultado: base, faixa: e.faixa, comoMelhorar: [] };
  }
}

function gupy(e: EntradaLente, r: ResultadoLente): SaidaLente {
  const naoAtendidos = e.requisitos.filter((x) => x.requisito.tipo === 'obrigatorio' && x.status === 'nao_atende');
  if (e.recusadas.length) {
    r.alertas.push({
      texto: 'Você respondeu “não” a uma pergunta eliminatória: na Gupy, a eliminação automática acontece justamente nas perguntas eliminatórias que a empresa cadastra.',
      fonte: F.gupyOrdenacao,
    });
  }
  if (naoAtendidos.length) {
    r.alertas.push({
      texto: `Obrigatório sem comprovação no CV: ${citar(naoAtendidos)}. Se a empresa definiu o requisito como obrigatório na Gupy, a reprovação é automática; sem isso, ele só pesa na ordenação.`,
      fonte: F.gupyAlgoritmo,
    });
  }
  // O que o núcleo encontra no CV, mas fora dos campos que a Gupy usa.
  const perdidos = e.requisitos.filter((x, i) => ORDEM[x.status] > ORDEM[e.requisitosTodasFontes[i].status] && x.requisito.tipo !== 'informativo');
  if (perdidos.length) {
    const onde = new Set(perdidos.flatMap((x) => e.requisitosTodasFontes[e.requisitos.indexOf(x)].evidencias)
      .map((ev) => ROTULO_FONTE[ev.fonte]).filter(Boolean) as string[]);
    r.alertas.push({
      texto: `${citar(perdidos)}: o CV comprova só em ${lista([...onde])}, ${onde.size > 1 ? 'seções' : 'seção'} que a ordenação da Gupy não usa. Cite também em Experiência ou Habilidades.`,
      fonte: F.gupyOrdenacao,
    });
  }
  if (e.arquivo.exportLinkedin) {
    r.alertas.push({
      texto: 'O PDF é um export do LinkedIn, formato que a Gupy diz ler melhor. O score de formato continua apontando as duas colunas, porque outros parsers sofrem com elas.',
      fonte: F.gupyPreenchimento,
    });
  }
  return { resultado: r, faixa: e.faixa, comoMelhorar: [] };
}

/** "x de y skills": cada skill pedida (ou grupo de alternativas) conta uma vez. */
function skillsEmComum(rs: RequirementResult[]) {
  const itens = new Map<string, { atende: boolean; explicita: boolean }>();
  for (const r of rs) {
    if (r.requisito.tipo === 'informativo') continue;
    r.requisito.componentes.forEach((c, i) => {
      if (c.tipo !== 'skill') return;
      const chave = [...c.ids].sort().join('|');
      const res = r.componentes[i];
      const atual = itens.get(chave) ?? { atende: false, explicita: false };
      const atende = res.status === 'atende';
      itens.set(chave, {
        atende: atual.atende || atende,
        explicita: atual.explicita || (atende && res.evidencias.some((ev) => ev.explicita)),
      });
    });
  }
  const valores = [...itens.values()];
  return { total: valores.length, atende: valores.filter((v) => v.atende).length, explicitas: valores.filter((v) => v.explicita).length };
}

function linkedin(e: EntradaLente, r: ResultadoLente): SaidaLente {
  const s = skillsEmComum(e.requisitos);
  if (s.total) r.indicador = `${s.atende} de ${s.total} skills da vaga aparecem no CV (${s.explicitas} na seção Habilidades)`;
  let faixa = e.faixa;
  const comoMelhorar: string[] = [];
  if (e.job.pais && fold(e.job.pais) !== 'brasil') {
    if (faixa === 'top') {
      faixa = 'maybe';
      comoMelhorar.push(`Vaga em outro país (${e.job.pais}): no LinkedIn, o máximo é Maybe`);
    }
    r.alertas.push({
      texto: `A vaga é em ${e.job.pais}: no LinkedIn, quem é de outro país fica no máximo em Maybe. O app considera que você está no Brasil.`,
      fonte: F.linkedinHiringPro,
    });
  }
  if (e.recusadas.length) {
    r.alertas.push({
      texto: 'Você respondeu “não” a uma pergunta eliminatória: no LinkedIn, perguntas de triagem marcadas como obrigatórias podem arquivar a candidatura e enviar a rejeição automaticamente.',
      fonte: F.linkedinTriagem,
    });
  }
  return { resultado: { ...r, rotulo: LENTES.linkedin.rotulos[faixa], tom: faixa }, faixa, comoMelhorar };
}

/** Vaga de estágio, trainee ou programa de graduação: no HiredScore, requisição de campus fica sem nota. */
const CAMPUS = /\b(estagio|estagiari[oa]|intern(ship)?|trainee|jovem aprendiz|graduate program|campus)\b/;

function workday(e: EntradaLente, r: ResultadoLente): SaidaLente {
  const nota = notaWorkday(e.requisitos);
  const seria = `Se tivesse nota, seria ${nota} (${SIGNIFICADO_NOTA[nota]}).`;
  const campus = e.job.senioridade === 'estagio' || CAMPUS.test(fold(e.job.titulo ?? ''));
  let semNota: string | undefined;
  if (e.arquivo.semTexto) semNota = 'O currículo não pôde ser lido: o HiredScore não dá nota quando não processa o currículo.';
  else if (e.vazio) semNota = 'A vaga não tem requisitos lidos: o HiredScore não dá nota a vaga sem descrição.';
  else if (campus) semNota = `Vaga de estágio ou trainee: requisições de campus/graduate ficam sem nota no HiredScore. ${seria}`;

  if (semNota) {
    r.alertas.push({ texto: semNota, fonte: F.workdaySpotlight });
    return { resultado: { ...r, rotulo: 'Sem nota', tom: 'neutro', nota: null }, faixa: e.faixa, comoMelhorar: [] };
  }
  if (e.recusadas.length) {
    // Regra do app (seção 11, item 3): "não" numa eliminatória é o pior resultado em todas as lentes.
    r.alertas.push({ texto: `Você respondeu “não” a uma pergunta eliminatória: a candidatura tende a ser reprovada antes da nota. ${seria}` });
    return { resultado: { ...r, rotulo: 'Reprovado na triagem', tom: 'not', nota }, faixa: e.faixa, comoMelhorar: [] };
  }
  r.alertas.push({ texto: `Nota ${nota}: ${SIGNIFICADO_NOTA[nota]}.`, fonte: F.workdayNotas });
  return { resultado: { ...r, rotulo: `Nota ${nota}`, tom: TOM_NOTA[nota], nota }, faixa: e.faixa, comoMelhorar: [] };
}

export const ORDEM_LENTES: LenteId[] = ['nucleo', 'gupy', 'linkedin', 'workday'];
