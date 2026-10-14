import { describe, expect, it } from 'vitest';
import { avaliarRequisito } from '../../src/lib/ranking/avaliar';
import { calcularFaixa } from '../../src/lib/ranking/faixa';
import { dicionario } from '../../src/lib/ranking';
import { buildCvProfile } from '../../src/lib/ranking/perfil';
import type { Component, NivelFormacao, NivelIdioma, ReqStatus, ReqTipo, RequirementResult } from '../../src/lib/ranking/types';
import { cv } from '../helpers';

const dict = dicionario();
const perfil = (habilidades: string[] = [], responsabilidades: string[] = []) => buildCvProfile(cv({
  habilidades: habilidades.length ? [{ categoria: 'Geral', itens: habilidades }] : [],
  experiencia: responsabilidades.length ? [{ cargo: 'Dev', empresa: 'Acme', responsabilidades }] : [],
}), dict);
const req = (componentes: Component[], tipo: ReqTipo = 'obrigatorio') => ({
  id: 'r1', texto: 'x', tipo, tipoFonte: 'secao' as const, origem: 'requisitos' as const, componentes,
});
const skill = (...ids: string[]): Component => ({ tipo: 'skill', ids, modo: ids.length > 1 ? 'alguma' : 'todas' });

describe('avaliação de requisito', () => {
  it('skill na seção Habilidades: atende, evidência explícita', () => {
    const r = avaliarRequisito(req([skill('java')]), perfil(['Java']), dict);
    expect(r.status).toBe('atende');
    expect(r.evidencias[0]).toMatchObject({ fonte: 'habilidades', explicita: true });
  });

  it('skill só no texto da experiência: atende, evidência implícita com o nome da empresa', () => {
    const r = avaliarRequisito(req([skill('spring-boot')]), perfil([], ['APIs com Spring Boot']), dict);
    expect(r.status).toBe('atende');
    expect(r.evidencias[0]).toMatchObject({ fonte: 'experiencia', rotulo: 'Experiência · Acme', explicita: false });
  });

  it('implicação: pedir SQL e ter PostgreSQL atende', () => {
    const r = avaliarRequisito(req([skill('sql')]), perfil(['PostgreSQL']), dict);
    expect(r.status).toBe('atende');
    expect(r.motivo).toContain('implícito por PostgreSQL');
  });

  it('relacionada: pedir Spring Boot e ter só Spring é parcial', () => {
    expect(avaliarRequisito(req([skill('spring-boot')]), perfil(['Spring']), dict).status).toBe('parcial');
  });

  it('grupo "alguma": basta uma das opções', () => {
    expect(avaliarRequisito(req([skill('postgresql', 'mysql')]), perfil(['MySQL']), dict).status).toBe('atende');
  });

  it('lista de 3+ skills com só uma faltando é parcial; com duas faltando, não atende', () => {
    const lista = [skill('design-patterns'), skill('poo'), skill('solid'), skill('kiss-dry-yagni')];
    expect(avaliarRequisito(req(lista), perfil(['Design Patterns', 'POO', 'SOLID']), dict).status).toBe('parcial');
    expect(avaliarRequisito(req(lista), perfil(['Design Patterns', 'POO']), dict).status).toBe('nao_atende');
  });

  it('conceito amplo não serve de ponte para parcial: ter Java não deixa Go parcial', () => {
    expect(avaliarRequisito(req([skill('go')]), perfil(['Java', 'Back-end']), dict).status).toBe('nao_atende');
  });

  it('link do GitHub no contato comprova GitHub', () => {
    const p = buildCvProfile(cv({ contato: ['(11) 99999-0000 | github.com/fulano'] }), dict);
    expect(avaliarRequisito(req([skill('github')]), p, dict).status).toBe('atende');
  });

  it('vale o pior componente da linha', () => {
    expect(avaliarRequisito(req([skill('java'), skill('kubernetes')]), perfil(['Java']), dict).status).toBe('nao_atende');
    expect(avaliarRequisito(req([skill('java'), skill('docker')]), perfil(['Java', 'Docker']), dict).status).toBe('atende');
  });

  it('"?" pode ser resolvido pelo usuário, e fica marcado como declarado', () => {
    const r = avaliarRequisito(req([{ tipo: 'nao_reconhecido', termos: ['Protheus'] }]), perfil(), dict, { declarado: true });
    expect(r).toMatchObject({ status: 'atende', declarado: true });
    // A resposta só vale para "?": um ✗ continua ✗.
    expect(avaliarRequisito(req([skill('kubernetes')]), perfil(), dict, { declarado: true }).status).toBe('nao_atende');
  });
});

describe('faixa', () => {
  const r = (status: ReqStatus, tipo: ReqTipo = 'obrigatorio') => ({
    requisito: req([], tipo), status, motivo: '', componentes: [], evidencias: [], declarado: false,
  }) as RequirementResult;

  it('Top fit: todos os obrigatórios e desejáveis no limiar', () => {
    expect(calcularFaixa([r('atende'), r('atende', 'desejavel'), r('nao_atende', 'desejavel')], 0.5).faixa).toBe('top');
  });
  it('Maybe: desejáveis abaixo do limiar', () => {
    expect(calcularFaixa([r('atende'), r('atende', 'desejavel'), r('nao_atende', 'desejavel'), r('nao_atende', 'desejavel')], 0.5).faixa)
      .toBe('maybe');
  });
  it('Not fit: falta um obrigatório', () => {
    expect(calcularFaixa([r('nao_atende'), r('atende', 'desejavel')], 0.5).faixa).toBe('not');
  });
  it('obrigatório parcial ou "?" impede Top fit, mas não causa Not fit', () => {
    expect(calcularFaixa([r('parcial')], 0.5).faixa).toBe('maybe');
    expect(calcularFaixa([r('nao_verificavel')], 0.5).faixa).toBe('maybe');
  });
  it('sem desejáveis, só os obrigatórios contam', () => {
    expect(calcularFaixa([r('atende')], 0.5).faixa).toBe('top');
  });
  it('vaga sem requisitos fica vazia', () => {
    expect(calcularFaixa([], 0.5).vazio).toBe(true);
  });
  it('número secundário: obrigatórios 50, desejáveis 25', () => {
    // obrigatórios 50% (1 de 2), desejáveis 100% → (50·0,5 + 25·1) / 75 = 67
    expect(calcularFaixa([r('atende'), r('nao_atende'), r('atende', 'desejavel')], 0.5).numero).toBe(67);
  });
});

const hoje = new Date(2026, 9, 13);
type Exp = [cargo: string, empresa: string, inicio: string, fim: string, texto: string];
const comExperiencias = (...exps: Exp[]) => buildCvProfile(cv({
  experiencia: exps.map(([cargo, empresa, inicio, fim, texto]) => ({
    cargo, empresa, periodo: { inicio, fim, atual: fim === 'Atual' }, responsabilidades: [texto],
  })),
}), dict, hoje);
const anos = (minimo: number, ...componentes: Component[]) => req([
  ...componentes, { tipo: 'anos', minimo, skillIds: componentes.flatMap((c) => (c.tipo === 'skill' ? c.ids : [])) },
]);
const status = (r: ReturnType<typeof req>, p: ReturnType<typeof buildCvProfile>) => avaliarRequisito(r, p, dict).status;

describe('tempo de experiência', () => {
  const p = comExperiencias(
    ['Desenvolvedor Back-End', 'Revizia', 'Agosto/2024', 'Julho/2026', 'APIs com Java e Spring Boot'],
    ['Assistente de Sustentação', 'Clearsale', 'Abril/2023', 'Julho/2024', 'Queries em SQL Server'],
  );

  it('conta só as experiências que citam a skill e diz qual não cita', () => {
    const r = avaliarRequisito(anos(2, skill('java')), p, dict);
    expect(r.status).toBe('atende');
    expect(r.motivo).toContain('Java: 2 anos (Revizia, ago/2024–jul/2026)');
    expect(r.motivo).toContain('Assistente de Sustentação (Clearsale) não cita Java');
    expect(r.evidencias).toContainEqual(expect.objectContaining({ fonte: 'experiencia', trecho: 'Desenvolvedor Back-End · ago/2024–jul/2026' }));
  });

  it('falta de até 1 ano é parcial quando o mínimo é 2 ou mais; além disso, não atende', () => {
    expect(status(anos(3, skill('java')), p)).toBe('parcial');
    expect(status(anos(4, skill('java')), p)).toBe('nao_atende');
    // Mínimo de 1 ano não tem faixa parcial: 0 meses de Kotlin.
    expect(status(anos(1, skill('kotlin')), p)).toBe('nao_atende');
  });

  it('a implicação vale para o tempo: SQL Server comprova SQL', () => {
    expect(avaliarRequisito(anos(1, skill('sql')), p, dict).motivo).toContain('SQL: 1 ano e 4 meses (Clearsale');
  });

  it('"A e B" vale a skill com menos tempo; "A ou B", a com mais', () => {
    const e = avaliarRequisito(anos(2, skill('java'), skill('sql')), p, dict);
    expect(e.status).toBe('parcial');
    expect(e.motivo).toContain('SQL (a skill da linha com menos tempo): 1 ano e 4 meses');
    expect(status(anos(2, skill('java', 'sql')), p)).toBe('atende');
  });

  it('sem skill na linha vale o tempo total; com família, só as experiências da área', () => {
    expect(status(req([{ tipo: 'anos', minimo: 3, skillIds: [] }]), p)).toBe('atende');
    expect(status(req([{ tipo: 'anos', minimo: 3, skillIds: [], familia: 'desenvolvimento' }]), p)).toBe('parcial');
  });

  it('estágio entra no total e aparece no motivo', () => {
    const r = avaliarRequisito(anos(2, skill('java')), comExperiencias(
      ['Estagiário de Desenvolvimento', 'Acme', 'Janeiro/2024', 'Dezembro/2024', 'Java'],
      ['Desenvolvedor Júnior', 'Acme', 'Janeiro/2025', 'Atual', 'Java'],
    ), dict);
    expect(r.status).toBe('atende');
    expect(r.motivo).toContain('inclui 1 ano de estágio');
  });

  it('sem nenhuma experiência com data, não atende e diz por quê', () => {
    const r = avaliarRequisito(anos(1, skill('java')), perfil(['Java']), dict);
    expect(r.status).toBe('nao_atende');
    expect(r.motivo).toContain('nenhuma experiência com período legível');
  });
});

describe('formação', () => {
  const comFormacao = (...fs: Array<{ nivel?: string; curso: string; status?: string }>) => buildCvProfile(cv({
    formacao: fs.map((f) => ({ nivel: 'Graduação', statusInferido: false, ...f })),
  }), dict);
  const formacao = (nivelMinimo: NivelFormacao, aceitaCursando: boolean, area: 'ti' | 'qualquer' = 'ti') =>
    req([{ tipo: 'formacao', nivelMinimo, area, aceitaCursando }]);
  const ads = { curso: 'Análise e Desenvolvimento de Sistemas', status: 'Concluído' };
  const cursando = { curso: 'Ciência da Computação', status: 'Em andamento' };

  it('nível e situação atendidos: atende', () => {
    expect(status(formacao('graduacao', false), comFormacao(ads))).toBe('atende');
    expect(status(formacao('tecnico', false), comFormacao(ads))).toBe('atende');
  });
  it('cursando é parcial quando a vaga pede completo e atende quando ela aceita cursando', () => {
    expect(status(formacao('graduacao', false), comFormacao(cursando))).toBe('parcial');
    expect(status(formacao('graduacao', true), comFormacao(cursando))).toBe('atende');
  });
  it('nível abaixo, curso trancado ou nenhuma formação lida: não atende', () => {
    expect(status(formacao('graduacao', true), comFormacao({ nivel: 'Técnico', curso: 'Informática', status: 'Concluído' }))).toBe('nao_atende');
    expect(status(formacao('graduacao', true), comFormacao({ curso: 'Sistemas de Informação', status: 'Trancado' }))).toBe('nao_atende');
    expect(avaliarRequisito(formacao('graduacao', true), perfil(), dict).motivo).toContain('nenhuma formação');
  });
  it('curso fora de TI numa vaga que pede TI fica "?" para o usuário confirmar', () => {
    const adm = comFormacao({ curso: 'Administração', status: 'Concluído' });
    expect(status(formacao('graduacao', false), adm)).toBe('nao_verificavel');
    expect(status(formacao('graduacao', false, 'qualquer'), adm)).toBe('atende');
  });
  it('vale a melhor formação do CV', () => {
    const tecnico = { nivel: 'Técnico', curso: 'Informática', status: 'Concluído' };
    expect(status(formacao('graduacao', false), comFormacao(tecnico, ads))).toBe('atende');
  });
});

describe('idioma', () => {
  const comIdiomas = (...ls: Array<{ idioma: string; nivel?: string }>) => buildCvProfile(cv({ idiomas: ls }), dict);
  const ingles = (nivelMinimo: NivelIdioma) => req([{ tipo: 'idioma', idioma: 'Inglês', nivelMinimo }]);
  const avancado = comIdiomas({ idioma: 'Inglês', nivel: 'Avançado · TOEIC (B2)' });

  it('nível igual ou acima atende; um abaixo é parcial; dois abaixo não atende', () => {
    expect(status(ingles('intermediario'), avancado)).toBe('atende');
    expect(status(ingles('avancado'), avancado)).toBe('atende');
    expect(status(ingles('fluente'), avancado)).toBe('parcial');
    expect(status(ingles('nativo'), avancado)).toBe('nao_atende');
  });
  it('níveis do LinkedIn e do CEFR', () => {
    expect(status(ingles('fluente'), comIdiomas({ idioma: 'Inglês', nivel: 'Full Professional' }))).toBe('atende');
    expect(status(ingles('avancado'), comIdiomas({ idioma: 'Inglês', nivel: 'B1' }))).toBe('parcial');
  });
  it('idioma ausente não atende; sem nível fica "?"', () => {
    expect(status(ingles('basico'), comIdiomas({ idioma: 'Espanhol', nivel: 'Fluente' }))).toBe('nao_atende');
    expect(status(ingles('basico'), comIdiomas({ idioma: 'Inglês' }))).toBe('nao_verificavel');
  });
  it('sem seção Idiomas, o resumo serve de evidência', () => {
    const p = buildCvProfile(cv({ resumo: 'Desenvolvedor com inglês avançado (TOEIC B2).' }), dict);
    const r = avaliarRequisito(ingles('intermediario'), p, dict);
    expect(r.status).toBe('atende');
    expect(r.evidencias[0]).toMatchObject({ fonte: 'resumo' });
  });
});

describe('cargo anterior', () => {
  const comCargos = (...cargos: string[]) => buildCvProfile(cv({
    experiencia: cargos.map((cargo) => ({ cargo, empresa: 'Acme', responsabilidades: [] })),
  }), dict);
  const como = (familia: string) => req([{ tipo: 'cargo', familia }]);

  it('mesma família atende; vizinha é parcial; outra não atende', () => {
    expect(status(como('backend'), comCargos('Desenvolvedor Back-End'))).toBe('atende');
    expect(status(como('backend'), comCargos('Desenvolvedor Full Stack'))).toBe('parcial');
    expect(status(como('backend'), comCargos('UX Designer'))).toBe('nao_atende');
  });
  it('áreas diferentes não são vizinhas: back-end × suporte não conta nem como parcial (seção 11, item 31)', () => {
    expect(status(como('suporte'), comCargos('Desenvolvedor Back-End'))).toBe('nao_atende');
    expect(status(como('backend'), comCargos('Analista de Suporte'))).toBe('nao_atende');
  });
  it('vaga de "desenvolvimento" aceita back-end, front-end e mobile', () => {
    expect(status(como('desenvolvimento'), comCargos('Desenvolvedor Front-End'))).toBe('atende');
  });
});
