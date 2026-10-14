import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analyze';
import { localizar } from '../src/lib/marcas';
import { detectarMargens } from '../src/lib/margens';
import { montarTexto } from '../src/lib/textoPdf';
import type { ExtractedDoc, TextItem } from '../src/lib/types';
import { loadPdf } from './helpers';

/** Documento sintético: cada linha vira um trecho, de cima para baixo, na página indicada. */
function doc(linhas: Array<string | { str: string; y: number; page?: number }>, numPages = 1): ExtractedDoc {
  let y = 760;
  const items: TextItem[] = linhas.map((l) => {
    const it = typeof l === 'string' ? { str: l, y: (y -= 16), page: 1 } : { page: 1, ...l };
    return { str: it.str, x: 72, y: it.y, page: it.page, hasEOL: true, w: it.str.length * 5, h: 10 };
  });
  return { numPages, pageWidth: 595, pageHeight: 842, producer: 'teste', imageCount: 0, items, text: montarTexto(items).text };
}

const byId = (a: ReturnType<typeof analyze>, id: string) => a.checks.find((c) => c.id === id)!;

describe('gráficos de nível', () => {
  it('nível escrito em texto passa (os 4 CVs de referência)', async () => {
    for (const f of ['CV_J-2.pdf', 'Profile.pdf', 'CV_Canva.pdf']) {
      expect(byId(analyze(await loadPdf(f)), 'level-graphics').status).toBe('pass');
    }
  });

  it('idioma sem nível em texto falha e aponta o idioma no CV', () => {
    const d = doc([
      'Nome Sobrenome', 'email@exemplo.com', 'Experiência', 'Dev | Empresa (Jan/2022 – Atual)', 'Formação', 'Graduação | Faculdade (2018 – 2021)',
      'Habilidades', 'Java', 'Idiomas', 'Inglês', 'Espanhol', ...Array(12).fill('linha de texto para passar do mínimo de caracteres por página'),
    ]);
    const c = byId(analyze(d), 'level-graphics');
    expect(c.status).toBe('fail');
    expect(c.detail).toContain('Inglês, Espanhol');
    expect(c.itens!.map((i) => d.items[i].str)).toEqual(['Inglês', 'Espanhol']);
  });
});

describe('cabeçalho e rodapé', () => {
  it('não acusa os CVs de referência (número de página do LinkedIn não conta)', async () => {
    for (const f of ['CV_J-2.pdf', 'Profile.pdf', 'CV_Canva.pdf']) {
      expect(byId(analyze(await loadPdf(f)), 'header-footer').status).toBe('pass');
    }
  });

  it('texto repetido no topo de duas páginas e contato no rodapé', () => {
    const d = doc([
      { str: 'Nome Sobrenome · Currículo', y: 820, page: 1 },
      { str: 'Experiência', y: 700, page: 1 },
      { str: 'email@exemplo.com | (11) 91234-5678', y: 30, page: 1 },
      { str: 'Nome Sobrenome · Currículo', y: 820, page: 2 },
      { str: 'Página 2 de 2', y: 30, page: 2 },
    ], 2);
    const m = detectarMargens(d);
    expect(m.repetidos).toEqual(['Nome Sobrenome · Currículo']);
    expect(m.contatoNoRodape).toBe(true);
    expect(m.itens).toEqual([0, 2, 3]);
  });
});

describe('localizar trechos no PDF', () => {
  it('acha o trecho com reticências e quebra de linha, procurando primeiro na seção da evidência', () => {
    const d = doc(['Resumo', 'Trabalho com Java há 2 anos.', 'Habilidades', 'Java, Spring Boot', 'Experiência', 'Desenvolvi APIs em Java', 'com Spring Boot.']);
    expect(localizar(d, 'Java', 'habilidades').map((i) => d.items[i].str)).toEqual(['Java, Spring Boot']);
    expect(localizar(d, 'Java').map((i) => d.items[i].str)).toEqual(['Trabalho com Java há 2 anos.']);
    expect(localizar(d, '…APIs em Java com Spring Boot.', 'experiencia').map((i) => d.items[i].str))
      .toEqual(['Desenvolvi APIs em Java', 'com Spring Boot.']);
    expect(localizar(d, 'Kubernetes')).toEqual([]);
  });

  it('acha a evidência real de um CV de referência', async () => {
    const d = await loadPdf('CV_J-2.pdf');
    const itens = localizar(d, '…com Java e Spring Boot para sistema de controladoria…', 'experiencia');
    expect(itens.length).toBeGreaterThan(0);
    expect(d.items[itens[0]].str).toContain('Java e Spring Boot');
  });
});
