import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/lib/analyze';
import { dicionario, parseJob, rank } from '../../src/lib/ranking';
import { LENTES, notaWorkday, ORDEM_LENTES } from '../../src/lib/ranking/lentes';
import type { LenteId, RankOptions, ReqStatus, ReqTipo, RequirementResult } from '../../src/lib/ranking/types';
import type { Structured } from '../../src/lib/types';
import { cv, FIXTURES, lerVaga, loadPdf } from '../helpers';

const dict = dicionario();
const hoje = new Date(2026, 9, 13);
const opcoes = (lente: LenteId, extra: Partial<RankOptions> = {}): RankOptions => ({
  limiarDesejaveis: 0.5, declarados: {}, skillsExtras: [], hoje, lente, ...extra,
});
const lente = (s: Structured, vaga: string, id: LenteId, extra: Partial<RankOptions> = {}) =>
  rank(s, parseJob(vaga, dict), opcoes(id, extra), dict);

describe('nota do Workday (algoritmo legado)', () => {
  const r = (status: ReqStatus, tipo: ReqTipo = 'obrigatorio') => ({
    requisito: { id: 'r', texto: 'x', tipo, tipoFonte: 'secao', origem: 'requisitos', componentes: [] },
    status, motivo: '', componentes: [], evidencias: [], declarado: false,
  }) as RequirementResult;

  it('A: todos os obrigatórios e mais da metade dos desejáveis; B: todos os obrigatórios', () => {
    expect(notaWorkday([r('atende'), r('atende', 'desejavel'), r('parcial', 'desejavel')])).toBe('A');
    expect(notaWorkday([r('atende'), r('atende', 'desejavel'), r('nao_atende', 'desejavel')])).toBe('B');
    // Sem desejáveis, todos os obrigatórios bastam para A.
    expect(notaWorkday([r('atende')])).toBe('A');
  });
  it('C: mais da metade dos obrigatórios; D: metade ou menos (parcial vale 0,5; "?" vale 0)', () => {
    expect(notaWorkday([r('atende'), r('atende'), r('nao_atende')])).toBe('C');
    expect(notaWorkday([r('atende'), r('nao_atende')])).toBe('D');
    expect(notaWorkday([r('atende'), r('parcial'), r('nao_verificavel')])).toBe('D');
  });
});

describe('lente Workday: quando não há nota', () => {
  const javaDocker = cv({ habilidades: [{ categoria: 'Geral', itens: ['Java', 'Docker'] }] });

  it('PDF escaneado (sem texto) fica sem nota', () => {
    const { structured } = analyze({ numPages: 1, pageWidth: 595, producer: 'scanner', imageCount: 1, items: [], text: '' });
    const r = rank(structured, parseJob(lerVaga('sinteticas/java-backend.txt'), dict), opcoes('workday', { arquivo: { semTexto: true } }), dict);
    expect(r.lente).toMatchObject({ rotulo: 'Sem nota', tom: 'neutro', nota: null });
    expect(r.lente.alertas[0].texto).toContain('não pôde ser lido');
  });

  it('vaga de estágio é requisição de campus: sem nota, mas diz qual seria', () => {
    const r = lente(javaDocker, 'Estágio em Desenvolvimento\nRequisitos\n- Java\n- Docker', 'workday');
    expect(r.lente).toMatchObject({ rotulo: 'Sem nota', nota: null });
    expect(r.lente.alertas[0].texto).toContain('Se tivesse nota, seria A');
  });

  it('com nota, explica o que ela significa', () => {
    const r = lente(javaDocker, 'Desenvolvedor Java\nRequisitos\n- Java\n- Kubernetes', 'workday');
    expect(r.lente).toMatchObject({ rotulo: 'Nota D', tom: 'not', nota: 'D' });
  });

  it('"não" numa eliminatória: reprovado na triagem, com a nota que teria', () => {
    const vaga = 'Desenvolvedor Java\nRequisitos\n- Java\nModelo híbrido em São Paulo - SP';
    const r = lente(javaDocker, vaga, 'workday', { respostas: { v1: false } });
    expect(r.lente).toMatchObject({ rotulo: 'Reprovado na triagem', tom: 'not', nota: 'A' });
  });
});

describe('lente Gupy: só Experiência e Habilidades (mais formação e idiomas)', () => {
  const s = cv({
    habilidades: [{ categoria: 'Geral', itens: ['Java'] }],
    resumo: 'Desenvolvedor com experiência em Docker e inglês avançado.',
    certificacoes: [{ nome: 'AWS Cloud Practitioner' }],
  });
  const vaga = 'Desenvolvedor Java\nRequisitos\n- Java\n- Docker\nDiferenciais\n- AWS';

  it('skill que só está no resumo vale no núcleo e não vale na Gupy', () => {
    expect(lente(s, vaga, 'nucleo').faixa).toBe('top');
    const g = lente(s, vaga, 'gupy');
    expect(g.lente.rotulo).toBe('Aderência baixa');
    const docker = g.requisitos.find((r) => r.requisito.texto === 'Docker')!;
    expect(docker).toMatchObject({ status: 'nao_atende', motivo: 'Docker: o CV cita só em Resumo, seção que esta plataforma não usa' });
    const alerta = g.lente.alertas.map((a) => a.texto).find((t) => t.includes('Cite também em Experiência ou Habilidades'))!;
    expect(alerta).toContain('"Docker" e "AWS": o CV comprova só em Resumo e Certificações');
  });

  it('obrigatório não atendido: alerta de reprovação automática se a empresa o definiu como obrigatório', () => {
    const textos = lente(s, vaga, 'gupy').lente.alertas.map((a) => a.texto);
    expect(textos.some((t) => t.startsWith('Obrigatório sem comprovação no CV: "Docker"'))).toBe(true);
  });

  it('idioma só da seção Idiomas', () => {
    const ingles = 'Dev\nRequisitos\n- Inglês intermediário';
    expect(lente(s, ingles, 'nucleo').requisitos[0].status).toBe('atende');
    expect(lente(s, ingles, 'gupy').requisitos[0].status).toBe('nao_atende');
  });

  it('PDF exportado do LinkedIn: a Gupy diz ler melhor esse formato', () => {
    const textos = lente(s, vaga, 'gupy', { arquivo: { exportLinkedin: true } }).lente.alertas.map((a) => a.texto);
    expect(textos.some((t) => t.startsWith('O PDF é um export do LinkedIn'))).toBe(true);
  });
});

describe('lente LinkedIn', () => {
  const s = cv({ habilidades: [{ categoria: 'Geral', itens: ['Java'] }], experiencia: [{ cargo: 'Dev', empresa: 'Acme', responsabilidades: ['Docker'] }] });

  it('"x de y skills", com quantas estão na seção Habilidades', () => {
    const r = lente(s, 'Desenvolvedor Java\nRequisitos\n- Java\n- Docker\n- Kubernetes', 'linkedin');
    expect(r.lente.indicador).toBe('2 de 3 skills da vaga aparecem no CV (1 na seção Habilidades)');
    expect(r.lente.rotulo).toBe('Not a fit');
  });

  it('vaga em outro país fica no máximo em Maybe', () => {
    const vaga = 'Java Developer\nLisboa, Portugal\nRequisitos\n- Java\n- Docker';
    expect(lente(s, vaga, 'nucleo').faixa).toBe('top');
    const r = lente(s, vaga, 'linkedin');
    expect(r).toMatchObject({ faixa: 'maybe', lente: { rotulo: 'Maybe', tom: 'maybe' } });
    expect(r.comoMelhorar[0]).toBe('Vaga em outro país (Portugal): no LinkedIn, o máximo é Maybe');
  });
});

describe('aproximações e fontes', () => {
  it.each(ORDEM_LENTES)('%s: cada aproximação e cada nota tem link para a fonte', (id) => {
    const l = LENTES[id];
    expect(l.aproximacoes.length).toBeGreaterThan(0);
    for (const x of [...l.aproximacoes, ...l.notas]) expect(x.fonte.url).toMatch(/^https:\/\/\S+$/);
    expect(l.documentacao.length).toBeGreaterThan(0);
  });
});

// Critério de pronto da Fase 3: cada lente com os 4 CVs. A tabela fica travada num arquivo:
// "núcleo · Gupy · LinkedIn · Workday" para cada CV em cada vaga real.
const CVS = ['CV_J-2.pdf', 'CV_P-1.pdf', 'Profile.pdf', 'CV_Canva.pdf'];
const dirReais = path.join(FIXTURES, 'vagas', 'reais');
const reais = fs.existsSync(dirReais) ? fs.readdirSync(dirReais).filter((f) => f.endsWith('.txt')).sort() : [];

describe('as 4 lentes com os 4 CVs de referência', () => {
  it.runIf(reais.length > 0)('resultados travados em fixtures/vagas/reais/_lentes.esperado.json', async () => {
    const analises = await Promise.all(CVS.map(async (pdf) => analyze(await loadPdf(pdf))));
    const tabela: Record<string, Record<string, string>> = {};
    for (const vaga of reais) {
      const job = parseJob(fs.readFileSync(path.join(dirReais, vaga), 'utf8'), dict);
      tabela[vaga.replace(/\.txt$/, '')] = Object.fromEntries(CVS.map((pdf, i) => {
        const a = analises[i];
        const arquivo = { semTexto: a.formatScore === 0, exportLinkedin: a.exportLinkedin };
        const partes = ORDEM_LENTES.map((id) => {
          const r = rank(a.structured, job, opcoes(id, { arquivo }), dict);
          return id === 'linkedin' && r.lente.indicador
            ? `${r.lente.rotulo} (${r.lente.indicador.replace(/ skills da vaga aparecem no CV.*$/, ' skills')})`
            : r.lente.rotulo;
        });
        return [pdf.replace(/\.pdf$/, ''), partes.join(' · ')];
      }));
    }
    await expect(`${JSON.stringify(tabela, null, 2)}\n`).toMatchFileSnapshot(path.join(dirReais, '_lentes.esperado.json'));
  });
});
