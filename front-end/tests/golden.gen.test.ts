// TEMPORÁRIO (migração para o backend Java): grava a saída do TypeScript atual em
// backend/src/test/resources/golden, para o Java ser comparado com ela.
// Só roda com GERAR_GOLDEN=1; some junto com src/lib quando a paridade estiver provada.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { analyze } from '../src/lib/analyze';
import { dicionario, parseJob, rank } from '../src/lib/ranking';
import type { LenteId } from '../src/lib/ranking/types';
import { FIXTURES, loadPdf } from './helpers';

const SAIDA = path.resolve(FIXTURES, '../src/test/resources/golden');
const dict = dicionario();
const hoje = new Date(2026, 9, 13);
const LENTES: LenteId[] = ['nucleo', 'gupy', 'linkedin', 'workday'];

const slug = (s: string) => s.replace(/\.(pdf|txt)$/, '').replace(/[^\w.-]+/g, '_');
const gravar = (arquivo: string, dados: unknown) => {
  fs.mkdirSync(path.dirname(path.join(SAIDA, arquivo)), { recursive: true });
  fs.writeFileSync(path.join(SAIDA, arquivo), JSON.stringify(dados, null, 1));
};
const listar = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);

describe.runIf(process.env.GERAR_GOLDEN === '1')('golden files', () => {
  it('gera', async () => {
    // Vagas: sintéticas, reais e as das candidaturas.
    const vagas: Record<string, string> = {};
    for (const sub of ['sinteticas', 'reais']) {
      for (const f of listar(path.join(FIXTURES, 'vagas', sub)).filter((x) => x.endsWith('.txt'))) {
        vagas[`${sub}/${slug(f)}`] = fs.readFileSync(path.join(FIXTURES, 'vagas', sub, f), 'utf8');
      }
    }
    const cands = listar(path.join(FIXTURES, 'candidaturas')).filter((n) => !n.startsWith('_') && fs.existsSync(path.join(FIXTURES, 'candidaturas', n, 'cv.pdf')));
    for (const c of cands) vagas[`candidaturas/${c}`] = fs.readFileSync(path.join(FIXTURES, 'candidaturas', c, 'vaga.txt'), 'utf8');

    const jobs: Record<string, ReturnType<typeof parseJob>> = {};
    for (const [id, texto] of Object.entries(vagas)) {
      jobs[id] = parseJob(texto, dict);
      gravar(`vagas/${id}.job.json`, jobs[id]);
    }

    // CVs de referência × todas as vagas; cada candidatura × a própria vaga.
    const cvs: Array<{ id: string; arquivo: string; vagas: string[] }> = [
      ...listar(FIXTURES).filter((f) => f.endsWith('.pdf')).map((f) => ({ id: slug(f), arquivo: f, vagas: Object.keys(vagas) })),
      ...cands.map((c) => ({ id: `candidaturas_${c}`, arquivo: `candidaturas/${c}/cv.pdf`, vagas: [`candidaturas/${c}`] })),
    ];
    for (const cv of cvs) {
      const doc = await loadPdf(cv.arquivo);
      const analise = analyze(doc);
      gravar(`cvs/${cv.id}.doc.json`, doc);
      gravar(`cvs/${cv.id}.analysis.json`, analise);
      const ranking: Record<string, Record<string, unknown>> = {};
      for (const v of cv.vagas) {
        ranking[v] = {};
        for (const lente of LENTES) {
          ranking[v][lente] = rank(analise.structured, jobs[v], {
            limiarDesejaveis: 0.5, declarados: {}, skillsExtras: [], hoje, lente,
            arquivo: { semTexto: analise.formatScore === 0, exportLinkedin: analise.exportLinkedin },
          }, dict);
        }
      }
      gravar(`cvs/${cv.id}.rank.json`, ranking);
    }
  });
});
