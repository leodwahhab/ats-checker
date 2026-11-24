import { ANTES, DEPOIS, fold, padraoTermo } from './texto';
import type { SkillDef } from './types';

export interface SkillMatch {
  id: string;
  start: number;
  end: number;
}

export interface Dictionary {
  defs: Map<string, SkillDef>;
  /** Skills citadas no texto, em ordem. As posições valem para `texto` (que deve estar em NFC). */
  find(texto: string): SkillMatch[];
  rotulo(id: string): string;
  /** Skills que implicam `id`, direta ou indiretamente (PostgreSQL implica SQL). */
  implicadoPor(id: string): string[];
  /** Skills que contam como parcial para `id`. */
  relacionadas(id: string): string[];
}

const chave = (s: string) => fold(s.normalize('NFC')).replace(/\s+/g, ' ').trim();

/** Grafia que vale por mais de uma skill: "testes unitários e de integração". */
export type Combinacao = [grafia: string, ids: string[]];

export function buildDictionary(defs: SkillDef[], combinacoes: Combinacao[] = []): Dictionary {
  const porId = new Map(defs.map((d) => [d.id, d]));
  const conferir = (origem: string, ref: string) => {
    if (!porId.has(ref)) throw new Error(`"${origem}" referencia "${ref}", que não está no dicionário`);
  };
  for (const d of defs) for (const ref of [...(d.implica ?? []), ...(d.relacionadas ?? [])]) conferir(d.id, ref);
  for (const [grafia, ids] of combinacoes) ids.forEach((id) => conferir(grafia, id));

  const porAlias = new Map<string, string[]>();
  const registrar = (termo: string, ids: string[]) => {
    const k = chave(termo);
    if (!k) return;
    const atual = porAlias.get(k);
    if (atual && atual.join() !== ids.join()) throw new Error(`Grafia "${termo}" aparece em "${atual}" e em "${ids}"`);
    porAlias.set(k, ids);
  };
  for (const d of defs) for (const termo of d.regex ? d.aliases : [d.rotulo, ...d.aliases]) registrar(termo, [d.id]);
  for (const [grafia, ids] of combinacoes) registrar(grafia, ids);
  // Em cada posição a alternativa mais longa vence: "spring boot" antes de "spring".
  const alternativas = [...porAlias.keys()].sort((a, b) => b.length - a.length).map(padraoTermo);
  const principal = new RegExp(`${ANTES}(?:${alternativas.join('|')})${DEPOIS}`, 'gu');
  const proprios = defs.filter((d) => d.regex).map((d) => ({ id: d.id, re: new RegExp(d.regex!, 'gu') }));

  const implica = new Map<string, Set<string>>();
  const fecho = (id: string): Set<string> => {
    const visto = new Set<string>();
    const pilha = [...(porId.get(id)?.implica ?? [])];
    while (pilha.length) {
      const x = pilha.pop()!;
      if (x === id || visto.has(x)) continue;
      visto.add(x);
      pilha.push(...(porId.get(x)?.implica ?? []));
    }
    return visto;
  };
  for (const d of defs) implica.set(d.id, fecho(d.id));

  const implicadoPor = new Map<string, string[]>();
  for (const [id, alvos] of implica) {
    for (const alvo of alvos) implicadoPor.set(alvo, [...(implicadoPor.get(alvo) ?? []), id]);
  }

  const relacionadas = new Map<string, Set<string>>();
  const ligar = (a: string, b: string) => relacionadas.set(a, (relacionadas.get(a) ?? new Set()).add(b));
  for (const d of defs) {
    for (const r of d.relacionadas ?? []) {
      ligar(d.id, r);
      ligar(r, d.id);
    }
    // A vaga pede Spring Boot e o CV tem Spring: parcial. Conceitos amplos (back-end, containers)
    // não entram, senão qualquer linguagem viraria parcial de qualquer outra.
    for (const alvo of implica.get(d.id)!) if (!porId.get(alvo)?.conceito) ligar(d.id, alvo);
  }

  return {
    defs: porId,
    find(texto) {
      const out: SkillMatch[] = [];
      for (const m of fold(texto).matchAll(principal)) {
        for (const id of porAlias.get(m[0].replace(/\s+/g, ' ')) ?? []) out.push({ id, start: m.index, end: m.index + m[0].length });
      }
      for (const { id, re } of proprios) {
        for (const m of texto.matchAll(re)) {
          const start = m.index;
          const end = start + m[0].length;
          if (!out.some((o) => start < o.end && end > o.start)) out.push({ id, start, end });
        }
      }
      // Ordem estável: grafias combinadas mantêm a ordem das skills.
      return out.sort((a, b) => a.start - b.start);
    },
    rotulo: (id) => porId.get(id)?.rotulo ?? id,
    implicadoPor: (id) => implicadoPor.get(id) ?? [],
    relacionadas: (id) => [...(relacionadas.get(id) ?? [])],
  };
}
