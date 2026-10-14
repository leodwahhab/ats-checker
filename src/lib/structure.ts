import { fold } from './normalize';
import { DATE_RE, RANGE_RE, endDate, findRange, periodOf } from './ranking/datas';
import { localDe } from './ranking/local';
import { linhasDeContato, preambulo, sectionize } from './sections';
import type {
  CertificationEntry, EducationEntry, ExperienceEntry, LanguageEntry, SkillGroup, Structured,
} from './types';

const BULLET_RE = /^[●•▸·\-–*◦▪]\s*/;
const DURATION_RE = /^\d+\s*(anos?|mes(?:es)?)(\s+\d+\s*mes(?:es)?)?$/i;
const CONTATO_RE = /@|https?:|www\.|linkedin|github|\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/i;

export function cleanText(text: string): string {
  // "Page 2 of 4" do export do LinkedIn vem colado ao conteúdo seguinte.
  return text.normalize('NFC').replace(/Page \d+ of \d+/g, '\n');
}

function tidy(s: string): string {
  return s
    .replace(/\(\s*\)/g, '')
    .replace(/\(\s*\d+\s*(?:anos?|mes(?:es)?)(?:\s+\d+\s*mes(?:es)?)?\s*\)/gi, '')
    .replace(/^[\s·•)\-–|,:(]+/, '')
    .replace(/[\s·•\-–|,:(]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Experiência ----------

const companyLike = (s: string) =>
  s.length > 1 && s.length <= 45 && s.split(' ').length <= 6 && !/[.,;:]$/.test(s) && !BULLET_RE.test(s) && !findRange(s) && !DURATION_RE.test(s);

export function parseExperience(lines: string[]): ExperienceEntry[] {
  const anchors = lines.map((l, i) => (findRange(l) ? i : -1)).filter((i) => i >= 0);
  const starts: number[] = [];
  const heads: Array<Pick<ExperienceEntry, 'cargo' | 'empresa' | 'periodo'>> = [];
  let lastCompany: string | undefined;

  for (const i of anchors) {
    const r = findRange(lines[i])!;
    const rest = tidy(lines[i].slice(0, r.start) + ' ' + lines[i].slice(r.end));
    const floor = (starts.length ? anchors[starts.length - 1] : -1) + 1;
    let cargo: string | undefined;
    let empresa: string | undefined;
    let start = i;

    if (rest.includes('|')) {
      const [a, b] = rest.split('|').map((x) => tidy(x));
      cargo = a || undefined;
      empresa = b || undefined;
    } else if (rest.length > 3) {
      cargo = rest;
    } else if (i - 1 >= floor) {
      cargo = lines[i - 1];
      start = i - 1;
      const cand = lines[i - 2];
      if (i - 2 >= floor && cand && DURATION_RE.test(cand) && i - 3 >= floor) {
        empresa = lines[i - 3];
        start = i - 3;
      } else if (i - 2 >= floor && cand && companyLike(cand)) {
        empresa = cand;
        start = i - 2;
      } else {
        empresa = lastCompany;
      }
    }
    if (empresa) lastCompany = empresa;
    starts.push(start);
    heads.push({ cargo, empresa, periodo: r.period });
  }

  return anchors.map((anchor, n) => {
    const end = n + 1 < anchors.length ? starts[n + 1] : lines.length;
    const body = lines.slice(anchor + 1, end);
    const entry: ExperienceEntry = { ...heads[n], responsabilidades: [] };

    if (body[0] && body[0].length <= 60 && /^[\p{L}][\p{L} .'-]+,\s*[\p{L} .'-]+(,\s*[\p{L} .'-]+)?$/u.test(body[0]) && !/[.:;]$/.test(body[0])) {
      entry.local = body.shift();
    }
    const summary: string[] = [];
    let techBuf: string[] | null = null;
    for (const line of body) {
      if (/^(principais\s+)?(tecnologias|stack|ferramentas)\s*:/i.test(fold(line))) {
        techBuf = [line.replace(/^[^:]*:\s*/, '')];
      } else if (techBuf) {
        techBuf.push(line);
      } else if (BULLET_RE.test(line)) {
        entry.responsabilidades.push(line.replace(BULLET_RE, ''));
      } else if (entry.responsabilidades.length) {
        entry.responsabilidades[entry.responsabilidades.length - 1] += ' ' + line;
      } else {
        summary.push(line);
      }
    }
    if (techBuf) entry.tecnologias = techBuf.join(' ');
    if (summary.length) entry.resumo = summary.join(' ');
    return entry;
  });
}

// ---------- Formação ----------

const STATUS_RE = /\(\s*(conclu[ií]d[oa]|em andamento|cursando|incompleto|trancado|interrompido)\s*\)/i;

function levelOf(s: string): string {
  const f = fold(s);
  if (/intercambio|mobilidade estudantil/.test(f)) return 'Intercâmbio';
  if (/doutorado/.test(f)) return 'Doutorado';
  if (/mestrado/.test(f)) return 'Mestrado';
  if (/\bmba\b|pos-?graduacao|especializacao/.test(f)) return 'Pós-graduação';
  if (/tecnic[oa]\b/.test(f)) return 'Técnico';
  if (/graduacao|bacharel|tecnologo|superior de tecnologia|licenciatura/.test(f)) return 'Graduação';
  if (/ensino medio|ensino secundario/.test(f)) return 'Ensino Médio';
  return 'Não identificado';
}

export function parseEducation(lines: string[]): EducationEntry[] {
  const blob = lines.join('\n');
  const entries: EducationEntry[] = [];
  const re = new RegExp(RANGE_RE.source, 'gi');
  const folded = fold(blob);
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(folded))) {
    const segment = blob.slice(cursor, m.index);
    cursor = m.index + m[0].length;
    const period = periodOf(m, blob);

    const statusText = STATUS_RE.exec(segment)?.[1];
    const seg = segment.replace(STATUS_RE, '');
    const segLines = seg.split('\n').map(tidy).filter(Boolean);
    if (!segLines.length) continue;

    let curso: string | undefined;
    let instituicao: string | undefined;
    const joined = segLines.join(' ');
    if (joined.includes('|')) {
      const [a, b] = joined.split('|').map(tidy);
      curso = a;
      instituicao = b;
    } else if (segLines.length > 1) {
      instituicao = segLines[0];
      curso = segLines.slice(1).join(' ');
    } else {
      curso = segLines[0];
    }

    const nivel = levelOf(curso ?? '');
    if (curso) {
      curso = tidy(
        curso
          .replace(/^curso superior de tecnologia( \(cst\))?,?\s*/i, '')
          .replace(/^(gradua[çc][aã]o|t[eé]cnic[oa]|p[oó]s-?gradua[çc][aã]o|mestrado|doutorado)\s+(em|de)\s+/i, ''),
      );
    }

    let status: string | undefined;
    let inferido = false;
    if (statusText) {
      status = statusText[0].toUpperCase() + statusText.slice(1).toLowerCase();
    } else {
      const end = endDate(period);
      if (period.atual) {
        status = 'Em andamento';
        inferido = true;
      } else if (end) {
        status = end > new Date() ? 'Em andamento' : 'Concluído';
        inferido = true;
      }
    }
    entries.push({ nivel, curso, instituicao, status, statusInferido: inferido, periodo: period });
  }
  return entries;
}

// ---------- Certificações, idiomas, habilidades ----------

const CONNECTOR_END = /\b(ao|a|de|do|da|dos|das|com|e|em|no|na|para|o|os)$/i;

export function parseCertifications(lines: string[]): CertificationEntry[] {
  const items: string[] = [];
  for (const raw of lines) {
    const isBullet = BULLET_RE.test(raw);
    const line = raw.replace(BULLET_RE, '');
    const prev = items[items.length - 1];
    if (prev && !isBullet && (/^[a-zà-ú]/.test(line) || /^(utilizando|usando|com|em|para)/i.test(line) || CONNECTOR_END.test(prev))) items[items.length - 1] = prev + ' ' + line;
    else items.push(line);
  }
  return items.map((it) => {
    const dm = [...fold(it).matchAll(new RegExp(DATE_RE.source, 'gi'))].pop();
    const data = dm ? it.slice(dm.index, dm.index + dm[0].length) : undefined;
    const noDate = tidy(dm ? it.slice(0, dm.index) + it.slice(dm.index + dm[0].length) : it);
    const [nome, emissor] = noDate.split('|').map(tidy);
    return { nome, emissor: emissor || undefined, data };
  });
}

const LANGS = /^(portugu[êe]s|ingl[êe]s|espanhol|franc[êe]s|alem[ãa]o|italiano|japon[êe]s|mandarim|chin[êe]s|libras)\b/i;

export function parseLanguages(lines: string[]): LanguageEntry[] {
  const out: LanguageEntry[] = [];
  for (const l of lines) {
    const m = LANGS.exec(l.replace(BULLET_RE, ''));
    if (!m) continue;
    const rest = tidy(l.replace(BULLET_RE, '').slice(m[0].length).replace(/^\s*\(([^)]*)\)\s*$/, '$1').replace(/\s*\|\s*/g, ' · '));
    out.push({ idioma: m[0], nivel: rest || undefined });
  }
  return out;
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;·•|]/.test(ch)) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.replace(/\.$/, '').trim()).filter(Boolean);
}

export function parseSkills(lines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  let buf: { categoria: string; text: string } | null = null;
  const flush = () => {
    if (buf) groups.push({ categoria: buf.categoria, itens: splitTopLevel(buf.text) });
    buf = null;
  };
  for (const raw of lines) {
    const line = raw.replace(BULLET_RE, '');
    const m = /^([^:()]{2,40}):\s*(.*)$/.exec(line);
    if (m) {
      flush();
      buf = { categoria: m[1].trim(), text: m[2] };
    } else if (buf && /[,(]$/.test(buf.text.trim())) {
      buf.text += ' ' + line;
    } else {
      flush();
      buf = { categoria: 'Geral', text: line };
      // Itens soltos, um por linha, ficam no mesmo grupo.
      const last = groups[groups.length - 1];
      if (last?.categoria === 'Geral') {
        last.itens.push(...splitTopLevel(line));
        buf = null;
      }
    }
  }
  flush();
  return groups;
}

export function parseStructure(rawText: string): Structured {
  const text = cleanText(rawText);
  const sections = sectionize(text);
  const get = (k: Parameters<typeof sections.get>[0]) => sections.get(k) ?? [];
  return {
    experiencia: parseExperience(get('experiencia')),
    formacao: parseEducation(get('formacao')),
    certificacoes: parseCertifications(get('certificacoes')),
    idiomas: parseLanguages(get('idiomas')),
    habilidades: parseSkills(get('habilidades')),
    resumo: get('resumo').join(' ') || undefined,
    // Linhas antes do primeiro título, sem contato: nome e título profissional (o "headline").
    cabecalho: preambulo(text).filter((l) => !CONTATO_RE.test(l)),
    // Contato do topo e de uma seção "Contato" (CVs de duas colunas), com a cidade ("Fortaleza - CE").
    contato: [
      ...preambulo(text).filter((l) => CONTATO_RE.test(l)),
      ...linhasDeContato(text).filter((l) => CONTATO_RE.test(l) || localDe(l)),
    ],
    projetos: get('projetos'),
  };
}

/** Campos essenciais preenchidos / esperados, em experiência e formação. */
export function completeness(s: Structured): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  const count = (...fields: unknown[]) => {
    total += fields.length;
    filled += fields.filter(Boolean).length;
  };
  for (const e of s.experiencia) count(e.cargo, e.empresa, e.periodo, e.responsabilidades.length || e.resumo);
  for (const e of s.formacao) count(e.curso, e.instituicao, e.periodo, e.status, e.nivel !== 'Não identificado');
  return { filled, total };
}
