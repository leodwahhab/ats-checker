import { describe, expect, it } from 'vitest';
import { dicionario, parseJob, rank } from '../../src/lib/ranking';
import { eliminatoriasDosRequisitos, lerCondicoes } from '../../src/lib/ranking/eliminatorias';
import { cv } from '../helpers';

const dict = dicionario();
const rotulos = (linhas: string[]) => lerCondicoes(linhas).eliminatorias.map((e) => `${e.tipo}: ${e.rotulo}`);

describe('local e modelo de trabalho da vaga', () => {
  it('frase no texto: "Modelo híbrido em São Paulo - SP"', () => {
    const c = lerCondicoes(['Desenvolvedor Java Pleno', 'Requisitos:', '- Java', 'Modelo híbrido em São Paulo - SP']);
    expect(c).toMatchObject({ modelo: 'hibrido', local: { cidade: 'São Paulo', uf: 'SP' } });
    expect(c.eliminatorias).toEqual([expect.objectContaining({ id: 'v1', tipo: 'local', rotulo: 'Trabalho híbrido em São Paulo - SP' })]);
  });

  it('rótulos da Gupy, com texto colado depois da UF', () => {
    const c = lerCondicoes([
      'Local de trabalho: São Paulo - SPjobTypes.vacancy_type_effectiveSão Paulo - SP',
      'Modelo de trabalho: PresencialTrabalho Presencial íconePresencial',
    ]);
    expect(c).toMatchObject({ modelo: 'presencial', local: { cidade: 'São Paulo', uf: 'SP' } });
    // O texto que a Gupy cola depois do valor sai da citação.
    expect(c.eliminatorias[0].trecho).toBe('Modelo de trabalho: Presencial · Local de trabalho: São Paulo - SP');
  });

  it('cidade conhecida sem UF no topo da vaga; presencial em parte da semana é híbrido', () => {
    const c = lerCondicoes([
      'Software Engineer', 'São Paulo, Brazil',
      'Disponibilidade para trabalhar no modelo presencial com flexibilidade (2x por semana no escritório).',
    ]);
    expect(c).toMatchObject({ modelo: 'hibrido', local: { cidade: 'São Paulo', uf: 'SP' } });
  });

  it('formato que o guia de candidaturas pede para vagas do LinkedIn: título e "Cidade, UF (Modelo)" no topo', () => {
    const job = parseJob('Desenvolvedor Java Júnior\nSão Paulo, SP (Híbrido)\nSobre a vaga\nRequisitos\n- Java', dict);
    expect(job).toMatchObject({
      titulo: 'Desenvolvedor Java Júnior', familia: 'backend', senioridade: 'junior', modelo: 'hibrido', local: { cidade: 'São Paulo', uf: 'SP' },
    });
  });

  it('vaga remota não gera pergunta de local', () => {
    const c = lerCondicoes(['Modelo de trabalho: Remoto', 'São Paulo, SP']);
    expect(c.modelo).toBe('remoto');
    expect(c.eliminatorias).toEqual([]);
  });
});

describe('eliminatórias prováveis no texto', () => {
  it('residência, disponibilidade e documentos', () => {
    expect(rotulos([
      'Residir em Campinas ou região',
      'Disponibilidade para viagens e para plantões aos fins de semana',
      'Possuir CNH categoria B e veículo próprio',
    ])).toEqual([
      'local: Local de residência',
      'disponibilidade: Disponibilidade para viagens',
      'disponibilidade: Plantão ou sobreaviso',
      'disponibilidade: Trabalho em fins de semana, feriados ou turnos',
      'documento: CNH',
      'documento: Veículo próprio',
    ]);
  });

  it('sem pedido de disponibilidade, viagem não é pergunta', () => {
    expect(rotulos(['Viagens de integração com o time', 'Benefício: auxílio home office'])).toEqual([]);
  });

  it('vaga afirmativa é só informativa; "também para PcD" não é afirmativa', () => {
    expect(lerCondicoes(['Desenvolvedor Back-end - Vaga exclusiva para PcD']).afirmativa).toContain('exclusiva para PcD');
    expect(lerCondicoes(['Engenharia de Software JR - (Preferencialmente para Pessoas com Deficiência)']).afirmativa).toBeDefined();
    expect(lerCondicoes(['Vaga também para PcD', 'Todas as nossas vagas estão disponíveis para pessoas com deficiência!']).afirmativa)
      .toBeUndefined();
  });
});

describe('eliminatórias que vêm de requisitos obrigatórios', () => {
  const job = parseJob([
    'Requisitos',
    '- Inglês avançado',
    '- Espanhol intermediário',
    '- Ensino superior completo em Ciência da Computação',
    '- Certificação AWS Cloud Practitioner',
    '- Cursando a partir do 3º semestre',
    'Diferenciais',
    '- Francês fluente',
  ].join('\n'), dict);

  it('idioma alto, formação, certificação e período do curso; desejáveis ficam de fora', () => {
    expect(eliminatoriasDosRequisitos(job).map((e) => `${e.tipo}: ${e.rotulo}`)).toEqual([
      'idioma: Inglês avançado ou acima',
      'formacao: Ensino superior completo em TI ou área afim',
      'certificacao: Certificação exigida',
      'formacao: Ensino superior completo ou em andamento',
      'formacao: Período do curso ou previsão de formatura',
    ]);
  });

  it('mudar o requisito para desejável tira a pergunta', () => {
    const desejavel = { ...job, requisitos: job.requisitos.map((r) => ({ ...r, tipo: 'desejavel' as const })) };
    expect(eliminatoriasDosRequisitos(desejavel)).toEqual([]);
  });
});

describe('resposta às eliminatórias', () => {
  const job = parseJob('Requisitos\n- Java\nModelo híbrido em São Paulo - SP', dict);
  const estruturado = cv({ habilidades: [{ categoria: 'Geral', itens: ['Java'] }], contato: ['fulano@email.com | Osasco - SP'] });
  const opcoes = { limiarDesejaveis: 0.5, declarados: {}, skillsExtras: [] };

  it('sem resposta, a faixa não muda; o CV aparece ao lado da pergunta', () => {
    const r = rank(estruturado, job, opcoes, dict);
    expect(r.faixa).toBe('top');
    expect(r.eliminatorias).toEqual([expect.objectContaining({ id: 'v1', resposta: undefined, noCv: 'No CV: Osasco - SP' })]);
  });

  it('"não atendo" leva a Not fit e explica por quê', () => {
    const r = rank(estruturado, job, { ...opcoes, respostas: { v1: false } }, dict);
    expect(r.faixa).toBe('not');
    expect(r.comoMelhorar[0]).toContain('provavelmente reprova automaticamente');
    expect(rank(estruturado, job, { ...opcoes, respostas: { v1: true } }, dict).faixa).toBe('top');
  });
});
