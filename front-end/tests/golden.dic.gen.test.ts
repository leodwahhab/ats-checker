// TEMPORÁRIO (migração para o backend Java): exporta o dicionário e os léxicos do ranqueamento como JSON.
// Só roda com GERAR_GOLDEN=1; some junto com src/lib quando a paridade estiver provada.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import * as lexicos from '../src/lib/ranking/dicionario/lexicos';
import { PAISES } from '../src/lib/ranking/dicionario/locais';
import { COMBINACOES, SKILLS } from '../src/lib/ranking/dicionario/skills';
import { FAMILIAS, SENIORIDADES } from '../src/lib/ranking/dicionario/cargos';

const SAIDA = path.resolve(__dirname, '../../backend/src/main/resources/ranking');

function serializar(v: unknown): unknown {
  if (v instanceof RegExp) return { $re: v.source, flags: v.flags };
  if (v instanceof Set) return { $set: [...v] };
  if (Array.isArray(v)) return v.map(serializar);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serializar(x)]));
  return v;
}

describe.runIf(process.env.GERAR_GOLDEN === '1')('dicionário', () => {
  it('exporta', () => {
    fs.mkdirSync(SAIDA, { recursive: true });
    const w = (nome: string, dados: unknown) => fs.writeFileSync(path.join(SAIDA, nome), JSON.stringify(serializar(dados), null, 1));
    w('skills.json', { skills: SKILLS, combinacoes: COMBINACOES });
    w('lexicos.json', { ...lexicos, PAISES });
    w('cargos.json', { familias: FAMILIAS, senioridades: SENIORIDADES });
  });
});
