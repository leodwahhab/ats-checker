import { describe, expect, it } from 'vitest';
import { dicionario, parseJob } from '../../src/lib/ranking';
import { calcularDimensoes } from '../../src/lib/ranking/dimensoes';
import { calcularFaixa } from '../../src/lib/ranking/faixa';
import { buildCvProfile } from '../../src/lib/ranking/perfil';
import type { Dimensao } from '../../src/lib/ranking/types';
import type { Structured } from '../../src/lib/types';
import { cv } from '../helpers';

const dict = dicionario();
const hoje = new Date(2026, 9, 13);
const dimensao = (s: Structured, vaga: string, id: Dimensao['id']) =>
  calcularDimensoes(buildCvProfile(s, dict, hoje), parseJob(vaga, dict)).find((d) => d.id === id)!;
const experiencia = (cargo: string, inicio = 'Jan/2024', fim = 'Atual') => ({
  cargo, empresa: 'Acme', periodo: { inicio, fim, atual: fim === 'Atual' }, responsabilidades: [],
});

describe('dimensão cargo', () => {
  it('compara a família do cargo atual com a da vaga', () => {
    const s = cv({ experiencia: [experiencia('Desenvolvedor Back-End')] });
    expect(dimensao(s, 'Desenvolvedor Java Pleno\nRequisitos\n- Java', 'cargo').status).toBe('atende');
    expect(dimensao(s, 'Engenheiro de Software Jr.\nRequisitos\n- Java', 'cargo').status).toBe('atende');
    expect(dimensao(s, 'Desenvolvedor Full Stack\nRequisitos\n- Java', 'cargo').status).toBe('parcial');
    expect(dimensao(s, 'Product Manager\nRequisitos\n- Jira', 'cargo').status).toBe('nao_atende');
  });

  it('uma experiência anterior na área conta como parcial', () => {
    const s = cv({ experiencia: [experiencia('Product Owner', 'Jan/2025'), experiencia('Desenvolvedor Back-End', 'Jan/2022', 'Dez/2024')] });
    const d = dimensao(s, 'Desenvolvedor Back-end\nRequisitos\n- Java', 'cargo');
    expect(d.status).toBe('parcial');
    expect(d.motivo).toContain('Você já atuou na área');
  });

  it('vaga sem título: sem dado, sai do número', () => {
    expect(dimensao(cv({ experiencia: [experiencia('Desenvolvedor')] }), 'Requisitos\n- Java', 'cargo').status).toBe('nao_verificavel');
  });
});

describe('dimensão senioridade', () => {
  const vaga = 'Desenvolvedor Java Pleno\nRequisitos\n- Java';
  it('procura no cargo atual, depois no cabeçalho, depois pelo tempo', () => {
    expect(dimensao(cv({ experiencia: [experiencia('Desenvolvedor Pleno')] }), vaga, 'senioridade').status).toBe('atende');
    const cabecalho = cv({ cabecalho: ['Fulana', 'Desenvolvedora Júnior'], experiencia: [experiencia('Desenvolvedora')] });
    expect(dimensao(cabecalho, vaga, 'senioridade')).toMatchObject({ status: 'parcial', motivo: expect.stringContaining('pelo cabeçalho') });
    // Sem nada escrito: 2 anos e 10 meses = pleno (aproximação de mercado).
    expect(dimensao(cv({ experiencia: [experiencia('Desenvolvedor', 'Jan/2024')] }), vaga, 'senioridade').status).toBe('atende');
  });

  it('o estágio conta no tempo (seção 11, item 30)', () => {
    // 1 ano e 10 meses como dev + 2 anos de estágio antes = 3 anos e 10 meses: pleno.
    const s = cv({ experiencia: [experiencia('Desenvolvedor', 'Jan/2025'), experiencia('Estagiário de TI', 'Jan/2023', 'Dez/2024')] });
    expect(dimensao(s, vaga, 'senioridade')).toMatchObject({ status: 'atende', motivo: expect.stringContaining('estágio incluído') });
  });

  it('senioridade acima da pedida atende; dois níveis abaixo não', () => {
    expect(dimensao(cv({ experiencia: [experiencia('Desenvolvedor Sênior')] }), vaga, 'senioridade').status).toBe('atende');
    expect(dimensao(cv({ experiencia: [experiencia('Estagiário de TI')] }), vaga, 'senioridade').status).toBe('nao_atende');
  });
});

describe('dimensão local e modelo', () => {
  const osasco = cv({ contato: ['(11) 99999-0000 | Osasco - SP'] });
  it('vaga remota atende; mesma UF atende, com ou sem a mesma cidade; outra UF não atende', () => {
    expect(dimensao(osasco, 'Dev\nModelo de trabalho: Remoto\nRequisitos\n- Java', 'local').status).toBe('atende');
    expect(dimensao(osasco, 'Dev\nRequisitos\n- Java\nModelo híbrido em Osasco - SP', 'local').status).toBe('atende');
    expect(dimensao(osasco, 'Dev\nRequisitos\n- Java\nModelo híbrido em São Paulo - SP', 'local'))
      .toMatchObject({ status: 'atende', motivo: 'A vaga é híbrida em São Paulo - SP; o CV diz Osasco - SP (mesma UF).' });
    expect(dimensao(osasco, 'Dev\nRequisitos\n- Java\nTrabalho presencial em Curitiba - PR', 'local').status).toBe('nao_atende');
  });
  it('sem cidade no CV ou na vaga, a dimensão sai do número', () => {
    expect(dimensao(cv(), 'Dev\nRequisitos\n- Java\nModelo híbrido em São Paulo - SP', 'local').status).toBe('nao_verificavel');
    expect(dimensao(osasco, 'Dev\nRequisitos\n- Java', 'local').status).toBe('nao_verificavel');
  });
});

describe('número secundário com as dimensões', () => {
  it('pesos 50/25/10/10/5; dimensão sem dado sai e o peso é redistribuído', () => {
    const d = (id: Dimensao['id'], peso: number, status: Dimensao['status']): Dimensao => ({ id, rotulo: id, peso, status, motivo: '' });
    // Sem requisitos: só as dimensões. Cargo ✓ (10) e senioridade ◐ (10); local sem dado.
    const r = calcularFaixa([], 0.5, { dimensoes: [d('cargo', 10, 'atende'), d('senioridade', 10, 'parcial'), d('local', 5, 'nao_verificavel')] });
    expect(r.numero).toBe(75);
  });
});
