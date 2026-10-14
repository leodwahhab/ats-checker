import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analyze';
import { dicionario, parseJob, rank } from '../src/lib/ranking';
import { ORDEM_LENTES } from '../src/lib/ranking/lentes';
import type { LenteId, RankingResult, RankOptions } from '../src/lib/ranking/types';
import type { Structured } from '../src/lib/types';
import { lerMeta, lerNome, listarCasos, type Pergunta, type Resultado } from './calibracao/casos';
import { destaques, gerarRelatorio, type Avaliacao } from './calibracao/relatorio';
import { cv, FIXTURES, loadPdf } from './helpers';

const dict = dicionario();
const nasLentes = (s: Structured, vaga: string, arquivo: RankOptions['arquivo'] = {}) => {
  const job = parseJob(vaga, dict);
  const porLente = Object.fromEntries(ORDEM_LENTES.map((id) => [
    id, rank(s, job, { limiarDesejaveis: 0.5, declarados: {}, skillsExtras: [], lente: id, arquivo }, dict),
  ])) as Record<LenteId, RankingResult>;
  return { job, porLente };
};

describe('formato dos casos de calibração', () => {
  it('o nome da pasta traz mês, plataforma, empresa e cargo', () => {
    expect(lerNome('2026-09-linkedin-acme-dev-backend-jr')).toEqual({
      ano: 2026, mes: 9, plataforma: 'linkedin', empresa: 'acme', cargo: 'dev backend jr', erros: [],
    });
    expect(lerNome('2026-09-indeed-acme-dev').erros[0]).toContain('plataforma "indeed" desconhecida');
    expect(lerNome('Acme dev java').erros[0]).toContain('não segue');
  });

  it('meta.json: só "resultado" é obrigatório; o que ficou do modelo conta como vazio', () => {
    expect(lerMeta('{ "resultado": "reprovado", "data": "AAAA-MM-DD", "plataforma": "gupy" }'))
      .toMatchObject({ resultado: 'reprovado', erros: [], avisos: [] });
    expect(lerMeta('{ "resultado": "reprovado", "data": "2026-09-15", "dias_ate_resposta": 0 }'))
      .toMatchObject({ dia: 15, diasAteResposta: 0, erros: [] });
    expect(lerMeta('{ "resultado": reprovado" }').erros[0]).toContain('não é um JSON válido');
    expect(lerMeta('{ "resultado": "aprovado" }').erros[0]).toContain('resultado "aprovado" inválido');
    expect(lerMeta('{}').erros[0]).toContain('falta "resultado"');
  });

  it('destaques: previsão que contradiz o resultado e perguntas do formulário', () => {
    const avaliacao = (resultado: Resultado, vaga: string, perguntas: Pergunta[] = []): Avaliacao => ({
      caso: { nome: 'caso', pasta: 'caso', plataforma: 'linkedin', resultado, perguntas, erros: [], avisos: [] },
      cv: 'cv.pdf', formato: 100, ...nasLentes(cv({ habilidades: [{ categoria: 'Geral', itens: ['Java'] }] }), vaga),
    });
    expect(destaques(avaliacao('passou_triagem', 'Dev\nRequisitos\n- Java\n- Kubernetes'))[0]).toMatch(/^Passou na triagem, mas a lente LinkedIn deu "Not a fit"/);
    expect(destaques(avaliacao('reprovado', 'Dev\nRequisitos\n- Java'))[0]).toMatch(/^Reprovado, mas a lente LinkedIn deu "Top fit"/);
    expect(destaques(avaliacao('sem_retorno', 'Dev\nRequisitos\n- Java\nModelo híbrido em São Paulo - SP', [
      { pergunta: 'Você tem CNH?', resposta: 'sim' },
    ]))).toEqual([
      'Perguntas que o app não previu: "Você tem CNH?".',
      'Previstas que não viraram pergunta: Trabalho híbrido em São Paulo - SP.',
    ]);
  });
});

// Candidaturas reais em fixtures/candidaturas/ (fora do git). Sem a pasta, o bloco é pulado.
const raiz = path.join(FIXTURES, 'candidaturas');
const casos = listarCasos(raiz);
const impressao = (arquivo: string) => crypto.createHash('md5').update(fs.readFileSync(arquivo)).digest('hex');

describe.runIf(casos.length > 0)('calibração com as candidaturas reais', () => {
  it('cada caso tem nome, meta.json, vaga.txt e cv.pdf válidos', () => {
    const problemas = casos.flatMap((c) => c.erros.map((e) => `${c.nome}: ${e}`));
    expect(problemas, `Corrija estes casos:\n${problemas.join('\n')}`).toEqual([]);
  });

  it('relatório com cada caso nas 4 lentes', async () => {
    // O CV de cada caso é comparado com os PDFs de referência para dizer qual versão foi enviada.
    const referencias = new Map(fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.pdf')).map((f) => [impressao(path.join(FIXTURES, f)), f]));
    const validos = casos.filter((c) => !c.erros.length);
    const avaliacoes: Avaliacao[] = [];
    for (const caso of validos) {
      const pdf = path.join(caso.pasta, 'cv.pdf');
      const analise = analyze(await loadPdf(path.relative(FIXTURES, pdf)));
      const vaga = fs.readFileSync(path.join(caso.pasta, 'vaga.txt'), 'utf8');
      const marca = impressao(pdf);
      avaliacoes.push({
        caso,
        cv: referencias.get(marca) ?? `versão ${marca.slice(0, 8)}`,
        formato: analise.formatScore,
        ...nasLentes(analise.structured, vaga, { semTexto: analise.formatScore === 0, exportLinkedin: analise.exportLinkedin }),
      });
    }
    const relatorio = gerarRelatorio(avaliacoes, casos.filter((c) => c.erros.length), new Date());
    // Só "npm run calibrar" grava o relatório; "npm test" apenas confere que ele sai.
    if (process.env.npm_lifecycle_event === 'calibrar') fs.writeFileSync(path.join(raiz, 'relatorio.md'), relatorio);
    expect(avaliacoes).toHaveLength(validos.length);
    expect(relatorio).toContain('# Relatório de calibração');
  });
});
