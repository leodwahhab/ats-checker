import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analyze';
import { dicionario, termosAusentes } from '../src/lib/ranking';
import type { ExtractedDoc } from '../src/lib/types';
import { loadPdf as load } from './helpers';

const byId = (a: ReturnType<typeof analyze>, id: string) => a.checks.find((c) => c.id === id)!;

describe('CVs de referência', () => {
  it.each(['CV_J-2.pdf', 'CV_P-1.pdf'])('%s: Google Docs, coluna única', async (f) => {
    const a = analyze(await load(f));
    expect(byId(a, 'columns').status).toBe('pass');
    expect(byId(a, 'images').status).toBe('pass');
    expect(byId(a, 'sections').status).toBe('pass');
    expect(byId(a, 'contact').status).toBe('pass');
    expect(a.formatScore).toBeGreaterThanOrEqual(85);
  });

  it('Profile.pdf (LinkedIn): duas colunas e gerador de risco', async () => {
    const a = analyze(await load('Profile.pdf'));
    expect(byId(a, 'columns').status).toBe('fail');
    expect(byId(a, 'producer').status).toBe('warn');
    expect(byId(a, 'linkedin').status).toBe('warn');
  });

  it('CV Canva: duas colunas, imagens, link quebrado', async () => {
    const a = analyze(await load('CV_Canva.pdf'));
    expect(byId(a, 'columns').status).toBe('fail');
    expect(byId(a, 'images').status).toBe('warn');
    expect(byId(a, 'producer').status).toBe('warn');
    expect(byId(a, 'linkedin').status).toBe('warn');
  });

  it('o CV bom pontua acima do Canva', async () => {
    const good = analyze(await load('CV_J-2.pdf'));
    const canva = analyze(await load('CV_Canva.pdf'));
    expect(good.formatScore).toBeGreaterThan(canva.formatScore);
  });
});

describe('PDF sem camada de texto', () => {
  it('reprova com nota 0', () => {
    const doc: ExtractedDoc = { numPages: 1, pageWidth: 595, producer: 'scanner', imageCount: 1, items: [], text: '' };
    const a = analyze(doc);
    expect(byId(a, 'text-layer').status).toBe('fail');
    expect(a.formatScore).toBe(0);
  });
});

describe('termos da vaga ausentes no CV (lista secundária)', () => {
  it('lista palavras que faltam e ignora as que o dicionário já cobre', async () => {
    const cvTexto = (await load('CV_J-2.pdf')).text;
    const ausentes = termosAusentes(cvTexto, 'Vaga Java Spring Boot para o time de pagamentos. Pagamentos instantâneos e Kubernetes.', dicionario());
    expect(ausentes).toContain('pagamentos');
    expect(ausentes).not.toContain('kubernetes');
    expect(ausentes).not.toContain('java');
  });
});

describe('calibração', () => {
  it('separa CV bom, LinkedIn e Canva por margem clara', async () => {
    const s = async (f: string) => analyze(await load(f)).formatScore;
    const good = await s('CV_J-2.pdf');
    expect(good).toBeGreaterThanOrEqual(90);
    expect(await s('Profile.pdf')).toBeLessThanOrEqual(good - 20);
    expect(await s('CV_Canva.pdf')).toBeLessThanOrEqual(good - 20);
  });
});

describe('dados estruturados', () => {
  it('J-2: lê experiências, formação, cursos e idiomas (inclui IDIOMAS no topo da pág. 2)', async () => {
    const s = analyze(await load('CV_J-2.pdf')).structured;
    expect(s.experiencia.map((e) => e.empresa)).toEqual(['Revizia', 'Clearsale']);
    expect(s.experiencia[0].responsabilidades).toHaveLength(7);
    expect(s.formacao.map((f) => f.nivel)).toEqual(['Graduação', 'Intercâmbio', 'Técnico']);
    expect(s.formacao.every((f) => f.status === 'Concluído' && !f.statusInferido)).toBe(true);
    expect(s.certificacoes).toHaveLength(4);
    expect(s.certificacoes[3]).toMatchObject({ emissor: 'DIO', data: 'Julho/2024' });
    expect(s.idiomas.map((l) => l.idioma)).toEqual(['Inglês', 'Espanhol']);
  });

  it('Profile (LinkedIn): agrupa dois cargos na mesma empresa e junta datas quebradas em linha', async () => {
    const s = analyze(await load('Profile.pdf')).structured;
    expect(s.experiencia.map((e) => [e.cargo, e.empresa])).toEqual([
      ['Desenvolvedor Backend Junior', 'Revizia'],
      ['Estagiário em Desenvolvimento Backend', 'Revizia'],
      ['Assistente de Sustentação Técnica', 'ClearSale'],
    ]);
    expect(s.formacao).toHaveLength(4);
    expect(s.formacao[1].periodo?.inicio).toBe('março de 2026');
  });

  it('CV Canva: não consegue estruturar experiência nem formação', async () => {
    const a = analyze(await load('CV_Canva.pdf'));
    expect(a.structured.experiencia).toHaveLength(0);
    expect(a.structured.formacao).toHaveLength(0);
    expect(byId(a, 'extraction').status).toBe('fail');
  });

  it('contato numa seção "Contato" (duas colunas) também é lido, com a cidade', async () => {
    const pedro = analyze(await load('CV_Canva.pdf')).structured;
    expect(pedro.contato).toContain('Fortaleza - CE / Brasil');
    const profile = analyze(await load('Profile.pdf')).structured;
    expect(profile.contato).toContain('github.com/leodwahhab (Portfolio)');
  });
});
