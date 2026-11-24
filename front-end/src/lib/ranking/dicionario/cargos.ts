import { compilarTermos, fold } from '../texto';
import type { Senioridade } from '../types';

export type Familia =
  | 'fullstack' | 'backend' | 'frontend' | 'mobile' | 'dados' | 'qa' | 'devops'
  | 'seguranca' | 'produto' | 'suporte' | 'desenvolvimento';

// A ordem importa: a primeira família que casar vence ("Desenvolvedor Java" é backend, não genérico).
export const FAMILIAS: Array<[Familia, string, string[]]> = [
  ['fullstack', 'Full stack', ['full stack', 'fullstack', 'full-stack']],
  ['backend', 'Back-end', [
    'back-end', 'backend', 'back end', 'desenvolvedor java', 'desenvolvedora java', 'java developer', 'engenheiro java',
    'desenvolvedor python', 'desenvolvedora python', 'python developer', 'desenvolvedor .net', 'desenvolvedor c#',
    'desenvolvedor node', 'desenvolvedor node.js', 'desenvolvedor php', 'desenvolvedor go', 'desenvolvedor golang',
    'desenvolvedor ruby', 'desenvolvedor kotlin',
  ]],
  ['frontend', 'Front-end', [
    'front-end', 'frontend', 'front end', 'desenvolvedor react', 'desenvolvedora react', 'react developer',
    'desenvolvedor angular', 'desenvolvedor vue',
  ]],
  ['mobile', 'Mobile', ['mobile', 'android', 'ios', 'flutter', 'react native']],
  ['dados', 'Dados', [
    'dados', 'data engineer', 'data scientist', 'data analyst', 'analytics', 'business intelligence', 'analista de bi',
    'machine learning', 'ml engineer', 'engenheiro de ia', 'engenheira de ia',
  ]],
  ['qa', 'QA', [
    'qa', 'quality assurance', 'analista de testes', 'analista de qualidade', 'tester', 'sdet', 'automação de testes',
    'engenheiro de qualidade', 'engenheira de qualidade', 'test engineer',
  ]],
  ['devops', 'DevOps / SRE / Infra', [
    'devops', 'sre', 'site reliability', 'infraestrutura', 'infra', 'cloud engineer', 'engenheiro de cloud',
    'engenheira de cloud', 'platform engineer', 'engenheiro de plataforma', 'sysadmin', 'administrador de sistemas',
  ]],
  ['seguranca', 'Segurança', ['segurança', 'security', 'appsec', 'pentest', 'pentester', 'cybersecurity', 'cibersegurança']],
  ['produto', 'Produto', [
    'product owner', 'product manager', 'gerente de produto', 'ux designer', 'ui designer', 'product designer',
    'scrum master', 'agile coach',
  ]],
  ['suporte', 'Suporte / Sustentação', [
    'suporte', 'sustentação', 'service desk', 'help desk', 'helpdesk', 'support',
  ]],
  ['desenvolvimento', 'Desenvolvimento', [
    'desenvolvedor', 'desenvolvedora', 'developer', 'programador', 'programadora', 'engenheiro de software',
    'engenheira de software', 'engenharia de software', 'software engineer', 'analista desenvolvedor',
    'analista de sistemas', 'desenvolvimento', 'dev',
  ]],
];

export const SENIORIDADES: Array<[Senioridade, string, string[]]> = [
  ['estagio', 'Estágio', ['estagiário', 'estagiária', 'estágio', 'intern', 'internship']],
  ['junior', 'Júnior', ['júnior', 'jr', 'jr.', 'trainee', 'entry level', 'entry-level']],
  ['pleno', 'Pleno', ['pleno', 'pl', 'pl.', 'mid-level', 'mid level']],
  ['senior', 'Sênior', ['sênior', 'sr', 'sr.']],
  ['especialista', 'Especialista', ['especialista', 'staff', 'principal', 'tech lead', 'líder técnico', 'lead', 'arquiteto', 'arquiteta']],
];

const normalizar = (termos: string[]) => termos.map((t) => fold(t.normalize('NFC')));
const REGEX_FAMILIA = FAMILIAS.map(([id, , termos]) => [id, compilarTermos(normalizar(termos))] as const);
const REGEX_SENIORIDADE = SENIORIDADES.map(([id, , termos]) => [id, compilarTermos(normalizar(termos))] as const);

export const ROTULO_FAMILIA = Object.fromEntries(FAMILIAS.map(([id, rotulo]) => [id, rotulo])) as Record<Familia, string>;
export const ROTULO_SENIORIDADE = Object.fromEntries(SENIORIDADES.map(([id, rotulo]) => [id, rotulo])) as Record<Senioridade, string>;

/** Tira marcadores de gênero: "Engenheiro(a)", "Dev(a)", "Desenvolvedor/a". */
const semGenero = (texto: string) => fold(texto.normalize('NFC')).replace(/\((?:a|o|as|os|e)\)|\/(?:a|o)\b/g, '');

/** Família do cargo citada no texto (um título de vaga ou de experiência). */
export function familiaDe(texto: string): Familia | undefined {
  const f = semGenero(texto);
  return REGEX_FAMILIA.find(([, re]) => re.test(f))?.[0];
}

export function senioridadeDe(texto: string): Senioridade | undefined {
  // "PL" é pleno ("Desenvolvedor Back End PL"), mas "PL/SQL" é linguagem.
  const f = semGenero(texto).replace(/\bpl\s*\/?\s*sql\b/g, ' ');
  return REGEX_SENIORIDADE.find(([, re]) => re.test(f))?.[0];
}

export const ORDEM_SENIORIDADE: Senioridade[] = ['estagio', 'junior', 'pleno', 'senior', 'especialista'];

/** Famílias de quem programa: atendem uma vaga genérica de desenvolvimento. */
const DEV: Familia[] = ['backend', 'frontend', 'fullstack', 'mobile', 'desenvolvimento'];

/**
 * Famílias vizinhas contam como parcial (seção 4.5 do plano), nos dois sentidos. Só especialidades
 * da mesma área, a de programação; áreas diferentes (back-end × suporte) não contam (seção 11, item 31).
 */
const VIZINHAS: Array<[Familia, Familia]> = [
  ['fullstack', 'backend'], ['fullstack', 'frontend'], ['frontend', 'mobile'],
  ['desenvolvimento', 'backend'], ['desenvolvimento', 'frontend'], ['desenvolvimento', 'fullstack'], ['desenvolvimento', 'mobile'],
];

/** Compara a família do CV com a pedida: atende, parcial (vizinha) ou não atende. */
export function compararFamilia(cv: string, pedida: string): 'atende' | 'parcial' | 'nao_atende' {
  if (cv === pedida) return 'atende';
  // Quem é back-end, front-end ou mobile atende uma vaga de "desenvolvimento" sem especialidade.
  if (pedida === 'desenvolvimento' && DEV.includes(cv as Familia)) return 'atende';
  return VIZINHAS.some(([a, b]) => (a === cv && b === pedida) || (a === pedida && b === cv)) ? 'parcial' : 'nao_atende';
}
