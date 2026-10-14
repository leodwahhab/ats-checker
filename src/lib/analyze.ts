import { detectContact } from './contact';
import { detectColumns } from './layout';
import { localizar } from './marcas';
import { detectarMargens } from './margens';
import { completeness, parseStructure } from './structure';
import { REQUIRED, SECTION_LABEL, detectSections } from './sections';
import type { Analysis, CheckResult, ExtractedDoc, Status, Structured } from './types';

const EMPTY: Structured = {
  experiencia: [], formacao: [], certificacoes: [], idiomas: [], habilidades: [], cabecalho: [], contato: [], projetos: [],
};

const RISKY_PRODUCERS: Array<[RegExp, string]> = [
  [/canva/i, 'Canva'],
  [/apache fop/i, 'exportação do LinkedIn (Apache FOP)'],
  [/photoshop|illustrator|indesign/i, 'software de design gráfico'],
];

const MONTHS = 'jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|jan(?:eiro)?|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
const DATE_RE = new RegExp(`(\\b(${MONTHS})[a-z]*\\.?\\s*(de\\s*)?\\d{4}|\\b\\d{1,2}/\\d{4}|\\b(19|20)\\d{2}\\b)`, 'i');

const FACTOR: Record<Status, number> = { pass: 1, warn: 0.5, fail: 0 };

export function analyze(doc: ExtractedDoc): Analysis {
  const checks: CheckResult[] = [];
  const add = (c: CheckResult) => checks.push(c);

  const chars = doc.text.replace(/\s/g, '').length;
  const hasText = chars / doc.numPages >= 200;
  add({
    id: 'text-layer', title: 'Texto selecionável', weight: 30,
    status: hasText ? 'pass' : 'fail',
    detail: hasText
      ? `${chars} caracteres extraídos.`
      : 'Quase nenhum texto foi extraído: o PDF parece ser uma imagem (escaneado ou "imprimir como imagem").',
    fix: hasText ? undefined : 'Exporte o CV direto do editor (Word/Google Docs) como PDF, sem digitalizar.',
  });

  if (!hasText) return finish(doc, checks, EMPTY);

  const layout = detectColumns(doc);
  add({
    id: 'columns', title: 'Coluna única', weight: 25,
    status: layout.multiColumn ? 'fail' : 'pass',
    detail: layout.multiColumn
      ? `Indício de múltiplas colunas (${Math.round(layout.secondaryShare * 100)}% do texto na coluna secundária). A ordem de leitura do ATS pode embaralhar o conteúdo.`
      : 'Texto em uma única coluna.',
    fix: layout.multiColumn ? 'Use um layout de coluna única, sem barra lateral.' : undefined,
    itens: layout.secondaryItems,
  });

  const risky = RISKY_PRODUCERS.find(([re]) => re.test(doc.producer));
  add({
    id: 'producer', title: 'Gerador do PDF', weight: 5,
    status: risky ? 'warn' : 'pass',
    detail: risky ? `Gerado por ${risky[1]}, que costuma produzir layouts difíceis para ATS.` : `Gerador: ${doc.producer || 'desconhecido'}.`,
    fix: risky ? 'Refaça em um editor de texto simples e exporte como PDF.' : undefined,
  });

  add({
    id: 'images', title: 'Sem imagens', weight: 5,
    status: doc.imageCount === 0 ? 'pass' : 'warn',
    detail: doc.imageCount === 0 ? 'Nenhuma imagem encontrada.' : `${doc.imageCount} imagem(ns): foto, ícones ou gráficos são ignorados pelo ATS.`,
    fix: doc.imageCount ? 'Remova foto, ícones e barras de habilidade; use texto.' : undefined,
  });

  const pagesStatus: Status = doc.numPages <= 2 ? 'pass' : doc.numPages === 3 ? 'warn' : 'fail';
  add({
    id: 'pages', title: 'Extensão', weight: 5, status: pagesStatus,
    detail: `${doc.numPages} página(s).`,
    fix: pagesStatus === 'pass' ? undefined : 'Mantenha em até 2 páginas.',
  });

  const contact = detectContact(doc.text);
  const missing = [!contact.email && 'e-mail', !contact.phone && 'telefone', !contact.location && 'cidade/UF'].filter(Boolean) as string[];
  add({
    id: 'contact', title: 'Contato legível', weight: 15,
    status: missing.length === 0 ? 'pass' : missing.length === 1 ? 'warn' : 'fail',
    detail: missing.length ? `Não detectado: ${missing.join(', ')}.` : 'E-mail, telefone e localização detectados.',
    fix: missing.length ? 'Coloque os dados de contato como texto simples no topo, não em cabeçalho/rodapé.' : undefined,
  });

  const li = contact.linkedin;
  add({
    id: 'linkedin', title: 'Link do LinkedIn íntegro', weight: 5,
    status: li === 'ok' ? 'pass' : 'warn',
    detail: li === 'ok' ? 'Link detectado inteiro.' : li === 'broken' ? 'O link do LinkedIn aparece partido em duas linhas.' : 'Link do LinkedIn não encontrado.',
    fix: li === 'ok' ? undefined : 'Mantenha a URL em uma linha só e curta.',
    itens: li === 'broken' ? localizar(doc, 'linkedin.com/in/') : undefined,
  });

  const sections = detectSections(doc.text);
  const lacking = REQUIRED.filter((s) => !sections.has(s));
  add({
    id: 'sections', title: 'Seções padrão', weight: 15,
    status: lacking.length === 0 ? 'pass' : lacking.length === 1 ? 'warn' : 'fail',
    detail: lacking.length ? `Não reconhecidas: ${lacking.map((s) => SECTION_LABEL[s]).join(', ')}.` : 'Experiência, Formação e Habilidades reconhecidas.',
    fix: lacking.length ? 'Use títulos convencionais: Experiência Profissional, Formação Acadêmica, Habilidades.' : undefined,
  });

  const hasDates = DATE_RE.test(doc.text);
  add({
    id: 'dates', title: 'Datas legíveis', weight: 5,
    status: hasDates ? 'pass' : 'warn',
    detail: hasDates ? 'Datas encontradas em formato reconhecível.' : 'Nenhuma data reconhecível.',
    fix: hasDates ? undefined : 'Use "mm/aaaa" ou "Jan 2022 – Atual" nas experiências.',
  });

  const structured = parseStructure(doc.text);
  const { filled, total: expected } = completeness(structured);
  const ratio = expected ? filled / expected : 0;
  add({
    id: 'extraction', title: 'Dados estruturados extraídos', weight: 10,
    status: ratio >= 0.9 ? 'pass' : ratio >= 0.6 ? 'warn' : 'fail',
    detail: expected
      ? `${structured.experiencia.length} experiência(s) e ${structured.formacao.length} formação(ões) lidas; ${filled} de ${expected} campos essenciais encontrados.`
      : 'Nenhuma experiência ou formação pôde ser lida com cargo, instituição e datas.',
    fix: ratio >= 0.9 ? undefined : 'Escreva cada item com empresa, cargo e período (ex.: "Analista | Empresa (Jan/2022 – Atual)").',
  });

  const GLYPHS = /[-\u{1F300}-\u{1FAFF}☀-➿]/u;
  const glyphs = GLYPHS.test(doc.text);
  add({
    id: 'glyphs', title: 'Sem símbolos especiais', weight: 5,
    status: glyphs ? 'warn' : 'pass',
    detail: glyphs ? 'Há ícones ou emojis que viram caracteres estranhos no ATS.' : 'Nenhum símbolo problemático.',
    fix: glyphs ? 'Troque ícones por texto ("Tel:", "E-mail:").' : undefined,
    itens: glyphs ? doc.items.flatMap((it, i) => (GLYPHS.test(it.str) ? [i] : [])) : undefined,
  });

  // Nível de idioma desenhado (barras, estrelas, bolinhas) não chega ao ATS: só o texto chega.
  const semNivel = structured.idiomas.filter((l) => !l.nivel);
  const nivelStatus: Status = !semNivel.length ? 'pass' : semNivel.length === structured.idiomas.length ? 'fail' : 'warn';
  add({
    id: 'level-graphics', title: 'Gráficos de nível', weight: 5, status: nivelStatus,
    detail: !structured.idiomas.length
      ? 'Nenhum idioma foi lido, então não há nível para conferir.'
      : semNivel.length
        ? `Nível não lido como texto: ${semNivel.map((l) => l.idioma).join(', ')}. Se ele está em barras, estrelas ou bolinhas, o robô não lê.`
        : 'O nível de cada idioma foi lido como texto.',
    fix: semNivel.length ? 'Escreva o nível em texto, por exemplo "Inglês: intermediário".' : undefined,
    itens: semNivel.flatMap((l) => localizar(doc, l.idioma, 'idiomas')),
  });

  const margens = detectarMargens(doc);
  const problemas = [
    margens.repetidos.length > 0 && `texto repetido no topo ou no pé das páginas ("${margens.repetidos.slice(0, 2).join('", "')}")`,
    margens.contatoNoRodape && 'dados de contato no pé da página',
  ].filter(Boolean) as string[];
  add({
    id: 'header-footer', title: 'Cabeçalho e rodapé', weight: 5,
    status: problemas.length ? 'warn' : 'pass',
    detail: problemas.length
      ? `Parece haver cabeçalho ou rodapé do editor: ${problemas.join(' e ')}. Alguns ATS descartam essas áreas.`
      : 'Nada importante fica no cabeçalho ou no rodapé.',
    fix: problemas.length ? 'Leve contato e informações importantes para o corpo do documento.' : undefined,
    itens: margens.itens,
  });

  return finish(doc, checks, structured);
}

function finish(doc: ExtractedDoc, checks: CheckResult[], structured: Structured): Analysis {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + c.weight * FACTOR[c.status], 0);
  // Sem texto extraível, o resto nem foi avaliado: nota fixa em 0.
  const formatScore = checks.some((c) => c.id === 'text-layer' && c.status === 'fail') ? 0 : Math.round((got / total) * 100);
  // O export do perfil sai do Apache FOP e traz o link do próprio perfil.
  const exportLinkedin = /apache fop/i.test(doc.producer) && /linkedin\.com\/in\//i.test(doc.text);
  return { structured, formatScore, checks, robotText: doc.text, exportLinkedin };
}
