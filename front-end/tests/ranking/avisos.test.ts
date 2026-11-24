import { describe, expect, it } from 'vitest';
import { dicionario, parseJob, rank } from '../../src/lib/ranking';
import type { AvisoTipo } from '../../src/lib/ranking/types';
import type { Structured } from '../../src/lib/types';
import { cv } from '../helpers';

const dict = dicionario();
const hoje = new Date(2026, 9, 13);
const avisos = (s: Structured, vaga: string) =>
  rank(s, parseJob(vaga, dict), { limiarDesejaveis: 0.5, declarados: {}, skillsExtras: [], hoje }, dict).avisos;
const doTipo = (s: Structured, vaga: string, tipo: AvisoTipo) => avisos(s, vaga).filter((a) => a.tipo === tipo);
const experiencia = (texto: string, inicio = 'Jan/2024', fim = 'Atual') => ({
  cargo: 'Desenvolvedor', empresa: 'Acme', periodo: { inicio, fim, atual: fim === 'Atual' }, responsabilidades: [texto],
});

describe('avisos de preenchimento', () => {
  it('skill da vaga que só aparece no texto das experiências: incluir em Habilidades', () => {
    const s = cv({ habilidades: [{ categoria: 'Geral', itens: ['Java'] }], experiencia: [experiencia('Deploy com Docker')] });
    const [a] = doTipo(s, 'Requisitos\n- Java\n- Docker', 'so_implicita');
    expect(a.texto).toMatch(/^Docker aparece no CV, mas fora da seção Habilidades/);
  });

  it('skill que só aparece em Certificações ou Projetos: a Gupy não analisa esses campos', () => {
    const s = cv({ certificacoes: [{ nome: 'AWS Cloud Practitioner' }], experiencia: [experiencia('APIs em Java')] });
    expect(doTipo(s, 'Requisitos\n- AWS', 'so_certificacoes')[0].texto).toContain('só aparece em Certificações ou Projetos');
  });

  it('mais de 30 skills em Habilidades', () => {
    const itens = ['Java', 'Kotlin', 'Python', 'Go', 'Rust', 'C#', 'PHP', 'Ruby', 'Scala', 'Elixir', 'Spring Boot', 'Django',
      'Flask', 'FastAPI', 'Rails', 'Laravel', 'NestJS', 'React', 'Angular', 'Vue', 'Svelte', 'PostgreSQL', 'MySQL', 'MongoDB',
      'Redis', 'Kafka', 'RabbitMQ', 'Docker', 'Kubernetes', 'Terraform', 'AWS'];
    const s = cv({ habilidades: [{ categoria: 'Geral', itens }] });
    expect(doTipo(s, 'Requisitos\n- Java', 'habilidades_demais')[0].texto).toContain('31 tecnologias');
    expect(doTipo(cv({ habilidades: [{ categoria: 'Geral', itens: itens.slice(0, 30) }] }), 'Requisitos\n- Java', 'habilidades_demais')).toEqual([]);
  });

  it('vaga em inglês e CV em português', () => {
    const s = cv({
      resumo: 'Desenvolvedor de software com experiência em sistemas para o mercado financeiro, com foco na qualidade do código e na entrega de valor para o cliente, em times ágeis que usam Java e Spring Boot no dia a dia da empresa. Tenho interesse em arquitetura de sistemas distribuídos.',
    });
    const vaga = 'Requirements\n- You have experience with Java and with the development of APIs for the payments team\n- You are able to work with our team and to write tests for your code with the rest of the engineers';
    expect(doTipo(s, vaga, 'idioma_cv')[0].texto).toBe('A vaga está em inglês e o CV em português. A Gupy recomenda enviar o CV no idioma da vaga.');
  });

  it('lacuna de mais de 6 meses é só informação', () => {
    const s = cv({ experiencia: [experiencia('Java', 'Jan/2025', 'Atual'), experiencia('Java', 'Jan/2022', 'Mar/2024')] });
    const [a] = doTipo(s, 'Requisitos\n- Java', 'lacuna');
    expect(a.texto).toMatch(/^9 meses sem experiência registrada entre mar\/2024 e jan\/2025\. É só informação/);
  });

  it('nenhuma experiência com período lida', () => {
    expect(doTipo(cv(), 'Requisitos\n- Java', 'sem_experiencia')[0].texto).toContain('Nenhuma experiência com período foi lida');
  });
});
