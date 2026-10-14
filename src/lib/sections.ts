import { norm } from './normalize';

export type SectionKey =
  | 'experiencia' | 'formacao' | 'habilidades' | 'resumo' | 'idiomas' | 'certificacoes' | 'projetos';

const TITLES: Record<SectionKey, string[]> = {
  experiencia: ['experiencia', 'experiencia profissional', 'experiencias', 'historico profissional', 'experiencia de trabalho'],
  formacao: ['formacao', 'formacao academica', 'educacao', 'escolaridade', 'formacao e cursos'],
  habilidades: ['habilidades', 'competencias', 'principais competencias', 'skills', 'conhecimentos', 'habilidades tecnicas', 'competencias tecnicas', 'tecnologias', 'stack'],
  resumo: ['resumo', 'resumo profissional', 'sobre', 'sobre mim', 'perfil', 'perfil profissional', 'objetivo', 'apresentacao'],
  idiomas: ['idiomas', 'languages', 'linguas'],
  certificacoes: ['certificacoes', 'certificados', 'certifications', 'cursos', 'cursos e certificacoes', 'cursos e certificados'],
  projetos: ['projetos', 'projetos pessoais', 'portfolio', 'artigos e projetos'],
};

/** Títulos de contato: encerram a seção anterior e não entram em nenhuma, mas o contato é lido à parte. */
const CONTATO = ['contato', 'contatos', 'contact', 'dados pessoais', 'informacoes de contato', 'informacoes pessoais', 'links', 'redes sociais'];
/** Títulos que encerram uma seção mas não nos interessam. */
const STOPPERS = [...CONTATO, 'publications', 'publicacoes', 'premios', 'honors awards', 'voluntariado', 'referencias'];

export const REQUIRED: SectionKey[] = ['experiencia', 'formacao', 'habilidades'];

export const SECTION_LABEL: Record<SectionKey, string> = {
  experiencia: 'Experiência', formacao: 'Formação', habilidades: 'Habilidades', resumo: 'Resumo',
  idiomas: 'Idiomas', certificacoes: 'Certificações', projetos: 'Projetos',
};

const chaveDeTitulo = (raw: string) => norm(raw).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/** Títulos de seção são linhas curtas; compara a linha normalizada com a lista. */
export function headingKey(raw: string): SectionKey | 'stop' | null {
  const line = chaveDeTitulo(raw);
  if (!line || line.split(' ').length > 5) return null;
  for (const [key, titles] of Object.entries(TITLES) as [SectionKey, string[]][]) {
    if (titles.includes(line)) return key;
  }
  return STOPPERS.includes(line) ? 'stop' : null;
}

export function detectSections(text: string): Set<SectionKey> {
  const found = new Set<SectionKey>();
  for (const raw of text.split('\n')) {
    const k = headingKey(raw);
    if (k && k !== 'stop') found.add(k);
  }
  return found;
}

/** Linhas antes do primeiro título reconhecido (nome, título profissional, contato). */
export function preambulo(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (headingKey(line)) break;
    out.push(line);
  }
  return out;
}

/**
 * Linhas sob títulos de contato ("Contato", "Redes sociais"). Em CVs de duas colunas (export do
 * LinkedIn, Canva) o contato fica numa seção assim, e não no topo.
 */
export function linhasDeContato(text: string): string[] {
  const out: string[] = [];
  let dentro = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (headingKey(line)) {
      dentro = CONTATO.includes(chaveDeTitulo(line));
      continue;
    }
    if (dentro) out.push(line);
  }
  return out;
}

/** Divide o texto em linhas por seção. Linhas antes do primeiro título são descartadas. */
export function sectionize(text: string): Map<SectionKey, string[]> {
  const out = new Map<SectionKey, string[]>();
  let current: SectionKey | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const k = headingKey(line);
    if (k) {
      current = k === 'stop' ? null : k;
      if (current && !out.has(current)) out.set(current, []);
      continue;
    }
    if (current) out.get(current)!.push(line);
  }
  return out;
}
