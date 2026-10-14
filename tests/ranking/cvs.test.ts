import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/lib/analyze';
import { dicionario, parseJob, rank } from '../../src/lib/ranking';
import { experienciasCom } from '../../src/lib/ranking/avaliar';
import { totalMeses } from '../../src/lib/ranking/datas';
import { buildCvProfile } from '../../src/lib/ranking/perfil';
import type { FaixaId } from '../../src/lib/ranking/types';
import type { Structured } from '../../src/lib/types';
import { FIXTURES, lerVaga, loadPdf } from '../helpers';

const dict = dicionario();
// Data fixa: "Atual" e lacunas dependem de hoje.
const hoje = new Date(2026, 9, 13);
const opcoes = { limiarDesejaveis: 0.5, declarados: {}, skillsExtras: [], hoje };
const CVS = ['CV_J-2.pdf', 'CV_P-1.pdf', 'Profile.pdf', 'CV_Canva.pdf'];

const cache = new Map<string, Structured>();
async function estruturado(pdf: string) {
  if (!cache.has(pdf)) cache.set(pdf, analyze(await loadPdf(pdf)).structured);
  return cache.get(pdf)!;
}
const faixa = async (pdf: string, vaga: string) => rank(await estruturado(pdf), parseJob(lerVaga(vaga), dict), opcoes, dict);

// Faixas da Fase 2: anos, formação e idioma já são comparados.
const ESPERADO: Array<[string, string, FaixaId]> = [
  ['CV_J-2.pdf', 'sinteticas/java-backend.txt', 'top'],
  ['CV_P-1.pdf', 'sinteticas/java-backend.txt', 'top'],
  ['Profile.pdf', 'sinteticas/java-backend.txt', 'top'],
  ['CV_Canva.pdf', 'sinteticas/java-backend.txt', 'maybe'],
  // React ✓, mas TypeScript e Next.js só parciais (o CV tem JavaScript e React): obrigatório
  // parcial impede Top fit sem causar Not fit (seção 11, item 1 do plano).
  ['CV_J-2.pdf', 'sinteticas/react-frontend.txt', 'maybe'],
  ['Profile.pdf', 'sinteticas/react-frontend.txt', 'not'],
  ['CV_Canva.pdf', 'sinteticas/react-frontend.txt', 'top'],
  // "3+ anos com Java e Spring Boot": J-2 tem 2 anos (◐); o Profile, 7 meses (✗); o CV Canva não tem
  // experiência com data lida (✗). É o exemplo da seção 5 do plano.
  ['CV_J-2.pdf', 'sinteticas/java-pleno.txt', 'maybe'],
  ['Profile.pdf', 'sinteticas/java-pleno.txt', 'not'],
  ['CV_Canva.pdf', 'sinteticas/java-pleno.txt', 'not'],
];

describe('faixa dos CVs de referência', () => {
  it.each(ESPERADO)('%s × %s → %s', async (pdf, vaga, esperado) => {
    expect((await faixa(pdf, vaga)).faixa).toBe(esperado);
  });

  it('a evidência aponta o trecho e a origem', async () => {
    const r = await faixa('Profile.pdf', 'sinteticas/java-backend.txt');
    const docker = r.requisitos.find((x) => x.requisito.texto === 'Docker')!;
    expect(docker.status).toBe('atende');
    // No export do LinkedIn, Docker só aparece nas tecnologias da experiência (implícita).
    expect(docker.evidencias[0]).toMatchObject({ fonte: 'experiencia', rotulo: 'Experiência · Revizia', explicita: false });
  });

  it('PDF sem texto não atende nada', async () => {
    const { structured } = analyze({ numPages: 1, pageWidth: 595, producer: 'scanner', imageCount: 1, items: [], text: '' });
    expect(rank(structured, parseJob(lerVaga('sinteticas/java-backend.txt'), dict), opcoes, dict).faixa).toBe('not');
  });
});

// Critério de pronto da Fase 2: os anos dos 4 CVs batem com os valores esperados.
describe('tempo de experiência dos CVs de referência', () => {
  const perfil = async (pdf: string) => buildCvProfile(await estruturado(pdf), dict, hoje);
  const java = async (pdf: string) => totalMeses(experienciasCom('java', await perfil(pdf), dict).map((e) => e.intervalo!));

  it.each([
    // [pdf, Java, total, estágio, senioridade]
    ['CV_J-2.pdf', 24, 40, 0, 'junior'],
    ['CV_P-1.pdf', 24, 40, 0, 'pleno'],
    // O estágio diz "mesma stack" sem citar Java: 1 ano e 5 meses de Java somem para o ATS.
    ['Profile.pdf', 7, 40, 17, 'junior'],
    // Duas colunas no Canva: nenhuma experiência com período foi lida.
    ['CV_Canva.pdf', 0, 0, 0, undefined],
  ])('%s: Java %i meses, total %i, estágio %i', async (pdf, mesesJava, total, estagio, senioridade) => {
    const p = await perfil(pdf);
    expect(await java(pdf)).toBe(mesesJava);
    expect([p.mesesTotais, p.mesesEstagio]).toEqual([total, estagio]);
    expect(p.atual.senioridade).toBe(senioridade);
  });

  it('local: do contato no topo (J-2) e da seção Contato do Canva', async () => {
    expect((await perfil('CV_J-2.pdf')).local).toMatchObject({ cidade: 'Osasco', uf: 'SP' });
    expect((await perfil('CV_Canva.pdf')).local).toMatchObject({ cidade: 'Fortaleza', uf: 'CE' });
    // O export do LinkedIn só diz "Brasil".
    expect((await perfil('Profile.pdf')).local).toBeUndefined();
  });
});

// Faixa e número de cada CV em cada vaga real, travados num arquivo: uma mudança de regra aparece
// no diff. Formato: "faixa número · obrigatórios ✓◐✗? · desejáveis".
const dirReais = path.join(FIXTURES, 'vagas', 'reais');
const reais = fs.existsSync(dirReais) ? fs.readdirSync(dirReais).filter((f) => f.endsWith('.txt')).sort() : [];
const ICONE = { atende: '✓', parcial: '◐', nao_atende: '✗', nao_verificavel: '?' } as const;

describe('CVs × vagas reais', () => {
  it.runIf(reais.length > 0)('faixas travadas em fixtures/vagas/reais/_faixas.esperado.json', async () => {
    const tabela: Record<string, Record<string, string>> = {};
    for (const vaga of reais) {
      const job = parseJob(fs.readFileSync(path.join(dirReais, vaga), 'utf8'), dict);
      tabela[vaga.replace(/\.txt$/, '')] = Object.fromEntries(await Promise.all(CVS.map(async (pdf) => {
        const r = rank(await estruturado(pdf), job, opcoes, dict);
        const icones = (tipo: string) => r.requisitos.filter((x) => x.requisito.tipo === tipo).map((x) => ICONE[x.status]).join('');
        return [pdf.replace(/\.pdf$/, ''), `${r.faixa} ${r.numero} · ${icones('obrigatorio') || '-'} · ${icones('desejavel') || '-'}`];
      })));
    }
    await expect(`${JSON.stringify(tabela, null, 2)}\n`).toMatchFileSnapshot(path.join(dirReais, '_faixas.esperado.json'));
  });
});
