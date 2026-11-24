import { describe, expect, it } from 'vitest';
import { dicionario } from '../../src/lib/ranking';
import { SKILLS } from '../../src/lib/ranking/dicionario/skills';

const dict = dicionario();
const ids = (texto: string) => dict.find(texto).map((m) => m.id);

describe('dicionário', () => {
  it('é válido: sem grafia duplicada nem referência quebrada, com ~300 skills', () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(280);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
  });

  it('reconhece símbolos como parte do termo', () => {
    expect(ids('C#, C++ e .NET')).toEqual(['csharp', 'cpp', 'dotnet']);
    expect(ids('ASP.NET Core e Node.js')).toEqual(['aspnet', 'nodejs']);
    expect(ids('JavaScript e Java')).toEqual(['javascript', 'java']);
    expect(ids('CI/CD com GitHub Actions')).toEqual(['ci-cd', 'github-actions']);
  });

  it('prefere a grafia mais longa', () => {
    expect(ids('SQL Server, PL/SQL e SQL')).toEqual(['sql-server', 'plsql', 'sql']);
    expect(ids('Spring Boot e Spring')).toEqual(['spring-boot', 'spring']);
    expect(ids('React Native e React')).toEqual(['react-native', 'react']);
    expect(ids('k8s e Docker Compose')).toEqual(['kubernetes', 'docker-compose']);
  });

  it('aceita quebra de linha no meio de um termo', () => {
    expect(ids('Spring\nBoot')).toEqual(['spring-boot']);
  });

  it('não confunde grafias ambíguas', () => {
    expect(ids('Go e Golang; go-live')).toEqual(['go', 'go']);
    expect(ids('Salário de R$ 5.000; linguagem R')).toEqual(['r']);
    expect(ids('C/C++ e CNH categoria C')).toEqual(['c', 'cpp']);
    expect(ids('sólidos conhecimentos em SOLID')).toEqual(['solid']);
    expect(ids('expressões lambda em Java; AWS Lambda')).toEqual(['java', 'lambda']);
    expect(ids('e aí, tudo bem? Conhecimento de IA')).toEqual(['ia']);
  });

  it('termos que apareceram nas candidaturas (Fase 4)', () => {
    expect(ids('PostgreSQL e/ou DB2')).toEqual(['postgresql', 'db2']);
    expect(ids('Banco de dados: Relacional e não relacional')).toEqual(['banco-relacional', 'nosql']);
    expect(ids('Arquitetura: REST, SOA; isso soa bem')).toEqual(['rest', 'soa']);
    expect(ids('Linux/Unix')).toEqual(['linux', 'unix']);
    expect(ids('agentes de IA no desenvolvimento, preferencialmente o Lovable')).toEqual(['ia-generativa', 'ai-coding']);
    expect(ids('Noções de redes e internet; ferramentas de depuração')).toEqual(['redes', 'debugging']);
    expect(ids('Kubernetes, OpenShift e API Gateways')).toEqual(['kubernetes', 'openshift', 'api-gateway']);
  });

  it('calcula implicação e relação', () => {
    expect(dict.implicadoPor('sql')).toContain('postgresql');
    expect(dict.implicadoPor('testes-automatizados')).toContain('junit');
    expect(dict.relacionadas('spring-boot')).toContain('spring');
    expect(dict.relacionadas('postgresql')).toContain('mysql');
  });
});
