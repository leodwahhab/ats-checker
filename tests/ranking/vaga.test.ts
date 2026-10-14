import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adicionarRequisito, descreverVaga, dicionario, parseJob, promoverTermo } from '../../src/lib/ranking';
import { FIXTURES, lerVaga } from '../helpers';

const dict = dicionario();
const ler = (arquivo: string) => descreverVaga(parseJob(lerVaga(arquivo), dict));
const componentes = (arquivo: string) => ler(arquivo).requisitos.map((r) => [r.tipo, r.componentes]);

describe('leitura de vagas sintéticas', () => {
  it('java-pleno: seções, anos, grupo "alguma" com exemplos entre parênteses e idioma', () => {
    const v = ler('sinteticas/java-pleno.txt');
    expect(v).toMatchObject({ titulo: 'Desenvolvedor Java Pleno', familia: 'backend', senioridade: 'pleno', temSecoes: true });
    expect(componentes('sinteticas/java-pleno.txt')).toEqual([
      ['informativo', ['skill:rest', 'skill:microsservicos']],
      ['obrigatorio', ['skill:java', 'skill:spring-boot', 'anos:3']],
      ['obrigatorio', ['alguma:banco-relacional|postgresql|mysql']],
      ['obrigatorio', ['idioma:ingles>=intermediario']],
      ['desejavel', ['alguma:aws|gcp']],
      ['desejavel', ['skill:kubernetes']],
    ]);
  });

  it('java-pleno: modelo, local e eliminatória provável', () => {
    // Texto curto demais para saber o idioma: as vagas reais (longas) cobrem isso.
    expect(ler('sinteticas/java-pleno.txt')).toMatchObject({
      idioma: null, modelo: 'hibrido', local: 'São Paulo - SP', eliminatorias: ['local: Trabalho híbrido em São Paulo - SP'], afirmativa: null,
    });
  });

  it('sem título, o cargo vem da apresentação ("Estamos em busca de…")', () => {
    const job = parseJob('Sobre a vaga\nEstamos em busca de uma pessoa Desenvolvedora Full Stack Júnior para o time.\nRequisitos\n- Java', dict);
    expect([job.titulo, job.familia, job.senioridade]).toEqual([undefined, 'fullstack', 'junior']);
  });

  it('java-backend: atividades com tecnologia viram informativas; benefícios são ignorados', () => {
    expect(ler('sinteticas/java-backend.txt').familia).toBe('backend');
    expect(componentes('sinteticas/java-backend.txt')).toEqual([
      ['informativo', ['skill:microsservicos', 'skill:java']],
      ['informativo', ['skill:code-review']],
      ['obrigatorio', ['skill:java']],
      ['obrigatorio', ['skill:spring-boot']],
      ['obrigatorio', ['skill:sql']],
      ['obrigatorio', ['skill:docker']],
      ['desejavel', ['skill:kafka']],
      ['desejavel', ['skill:aws']],
    ]);
  });

  it('react-frontend: soft skill fica fora e exemplos entre parênteses viram alternativas', () => {
    const v = ler('sinteticas/react-frontend.txt');
    expect(v.familia).toBe('frontend');
    expect(v.naoAvaliaveis).toEqual(['Boa comunicação']);
    expect(componentes('sinteticas/react-frontend.txt')).toEqual([
      ['informativo', ['skill:responsividade']],
      ['obrigatorio', ['skill:react', 'skill:typescript']],
      ['obrigatorio', ['skill:nextjs']],
      ['obrigatorio', ['alguma:testes-automatizados|jest|testing-library']],
      ['desejavel', ['skill:tailwind']],
      ['desejavel', ['skill:storybook']],
    ]);
  });

  it('sem-secoes: tudo desejável por padrão, heurística sugere obrigatório, marcadores valem por linha', () => {
    const job = parseJob(lerVaga('sinteticas/sem-secoes.txt'), dict);
    expect(job.temSecoes).toBe(false);
    expect(job.termosNaoReconhecidos).toEqual(['Protheus']);
    expect(descreverVaga(job).requisitos.map((r) => [r.tipo, r.fonte, r.componentes])).toEqual([
      ['desejavel', 'padrao', ['skill:python']],
      ['obrigatorio', 'heuristica', ['skill:python', 'skill:django', 'skill:aws', 'skill:docker']],
      ['desejavel', 'marcador', ['skill:airflow']],
      ['desejavel', 'marcador', ['?:Protheus']],
    ]);
    expect(job.naoAvaliaveis).toEqual(['Boa comunicação e trabalho em equipe.']);
  });
});

// Ajustes que as candidaturas reais da Fase 4 pediram, com textos sintéticos (os casos ficam fora do git).
describe('leitura ajustada na calibração', () => {
  const ler = (texto: string) => descreverVaga(parseJob(texto, dict));
  const tipos = (texto: string) => ler(texto).requisitos.map((r) => [r.tipo, r.componentes]);

  it('lista colada numa linha só, com títulos no meio ("…: - Item; - Item")', () => {
    const colada = [
      'Desenvolver e manter aplicações utilizando Java e Spring Boot; - Implementar APIs REST seguindo boas práticas;',
      '- Participar do levantamento de requisitos com o time de produto. Requisitos e Qualificações: - Experiência com Java;',
      '- Conhecimento em Docker e Kubernetes; - Experiência com PostgreSQL. Desejável / Diferencial: - Experiência com Kafka;',
      '- Conhecimento em Terraform.',
    ].join(' ');
    expect(tipos(`Desenvolvedor Java\nRequisitos:\n${colada}`)).toEqual([
      ['informativo', ['skill:java', 'skill:spring-boot']],
      ['informativo', ['skill:rest']],
      ['informativo', ['skill:requisitos']],
      ['obrigatorio', ['skill:java']],
      ['obrigatorio', ['skill:docker', 'skill:kubernetes']],
      ['obrigatorio', ['skill:postgresql']],
      ['desejavel', ['skill:kafka']],
      ['desejavel', ['skill:terraform']],
    ]);
  });

  it('item de atividade dentro de Requisitos ("Desenvolver…") é informativo', () => {
    expect(tipos('Requisitos\n- Desenvolver serviços em Java\n- Conhecimento em Docker')).toEqual([
      ['informativo', ['skill:java']],
      ['obrigatorio', ['skill:docker']],
    ]);
  });

  it('sem seção de requisitos, a lista de tecnologias vale como requisito; com ela, é contexto', () => {
    const semRequisitos = 'Desenvolvedor Java Júnior\nResponsabilidades:\n- Apoiar o time\nPrincipais tecnologias:\nLinguagem: Java\nMensageria: Kafka (diferencial)';
    expect(tipos(semRequisitos)).toEqual([['desejavel', ['skill:java']], ['desejavel', ['skill:kafka']]]);
    expect(ler(semRequisitos).requisitos.map((r) => r.fonte)).toEqual(['padrao', 'marcador']);
    expect(tipos('Requisitos\n- Java\nPrincipais tecnologias:\nKafka')).toEqual([['obrigatorio', ['skill:java']], ['informativo', ['skill:kafka']]]);
  });

  it('texto institucional longo que só cita anos não vira requisito', () => {
    const institucional = 'A Acme é uma empresa especialista em outsourcing e recrutamento tech com 6 anos de experiência e expertise no mercado! '
      + 'Temos orgulho em ter clientes e parceiros com o mesmo objetivo: pessoas engajadas! Buscamos profissionais inovadores e movidos por desafios.';
    expect(tipos(`Requisitos\n- Java\n${institucional}`)).toEqual([['obrigatorio', ['skill:java']]]);
  });

  it('"Formação completa ou em andamento em…" é ensino superior, aceitando cursando', () => {
    expect(tipos('Requisitos\n- Formação completa ou em andamento em Tecnologia da Informação')).toEqual([
      ['obrigatorio', ['formacao:graduacao~cursando:ti']],
    ]);
  });

  it('"PL" no título é pleno, mas "PL/SQL" não', () => {
    expect(ler('Desenvolvedor Back End PL - Java\nRequisitos\n- Java').senioridade).toBe('pleno');
    expect(ler('Desenvolvedor PL/SQL\nRequisitos\n- Oracle').senioridade).toBeNull();
  });

  it('modelo no título depois de separador ("- Híbrido São Paulo"), mas não "Mobile Híbrido"', () => {
    expect(ler('Desenvolvimento Java AWS Junior/Pleno - Híbrido São Paulo\nSão Paulo, Brasil\nRequisitos\n- Java').modelo).toBe('hibrido');
    expect(ler('Desenvolvedor Mobile Híbrido Flutter Pleno\nRequisitos\n- Flutter').modelo).toBeNull();
  });

  it('"What can you expect from us?" e "O que você encontrará" são benefícios', () => {
    expect(tipos('Requirements\n- Java\nWhat can you expect from us?\n- Work with Kafka in global teams')).toEqual([['obrigatorio', ['skill:java']]]);
    expect(tipos('Requisitos\n- Java\nO que você encontrará\n- Ambiente com Kafka e AWS')).toEqual([['obrigatorio', ['skill:java']]]);
  });
});

describe('edições do usuário', () => {
  it('promover um termo troca o "?" por skill em todas as linhas que o citam', () => {
    const job = parseJob('Requisitos\n- Java e Protheus\n- Protheus em produção', dict);
    const { job: novo, skill } = promoverTermo(job, 'Protheus');
    expect(skill.rotulo).toBe('Protheus');
    expect(descreverVaga(novo).requisitos.map((r) => r.componentes)).toEqual([
      ['skill:java', `skill:${skill.id}`],
      [`skill:${skill.id}`],
    ]);
    expect(novo.termosNaoReconhecidos).toEqual([]);
  });

  it('adicionar requisito usa a mesma decomposição', () => {
    const job = adicionarRequisito(parseJob('Requisitos\n- Java', dict), 'AWS ou Azure', 'desejavel', dict);
    expect(descreverVaga(job).requisitos.at(-1)).toMatchObject({ tipo: 'desejavel', fonte: 'usuario', componentes: ['alguma:aws|azure'] });
  });
});

// Vagas reais (critério de pronto da Fase 1). Na primeira execução o .esperado.json é gravado
// para revisão; depois disso ele trava a leitura da vaga. Ver fixtures/vagas/README.md.
const dirReais = path.join(FIXTURES, 'vagas', 'reais');
const reais = fs.existsSync(dirReais) ? fs.readdirSync(dirReais).filter((f) => f.endsWith('.txt')).sort() : [];

describe('leitura de vagas reais', () => {
  it.each(reais)('%s', async (arquivo) => {
    const lido = descreverVaga(parseJob(fs.readFileSync(path.join(dirReais, arquivo), 'utf8'), dict));
    await expect(`${JSON.stringify(lido, null, 2)}\n`).toMatchFileSnapshot(path.join(dirReais, arquivo.replace(/\.txt$/, '.esperado.json')));
  });

  if (reais.length >= 10) it('tem pelo menos 10 vagas reais', () => expect(reais.length).toBeGreaterThanOrEqual(10));
  else it.todo(`10+ vagas reais em fixtures/vagas/reais (há ${reais.length}): critério de pronto da Fase 1`);
});
