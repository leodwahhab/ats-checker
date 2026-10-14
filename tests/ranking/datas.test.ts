import { describe, expect, it } from 'vitest';
import { duracao, intervaloDe, lacunas, mesDe, rotuloIntervalo, totalMeses, uniao } from '../../src/lib/ranking/datas';

const mes = (ano: number, m: number) => ano * 12 + (m - 1);
const hoje = new Date(2026, 9, 13);

describe('datas do CV', () => {
  it('lê mês por extenso, abreviado, numérico e ano sozinho', () => {
    expect(mesDe('Agosto/2024', false)).toBe(mes(2024, 8));
    expect(mesDe('janeiro de 2026', false)).toBe(mes(2026, 1));
    expect(mesDe('mar. 2023', false)).toBe(mes(2023, 3));
    expect(mesDe('08/2024', false)).toBe(mes(2024, 8));
    // Ano sozinho: janeiro no início do período, dezembro no fim.
    expect(mesDe('2021', false)).toBe(mes(2021, 1));
    expect(mesDe('2021', true)).toBe(mes(2021, 12));
    expect(mesDe('sem data', false)).toBeNull();
  });

  it('intervalo inclui os dois meses; "Atual" vai até hoje', () => {
    const i = intervaloDe({ inicio: 'Agosto/2024', fim: 'Julho/2026', atual: false }, hoje)!;
    expect(totalMeses([i])).toBe(24);
    expect(rotuloIntervalo(i)).toBe('ago/2024–jul/2026');
    expect(intervaloDe({ inicio: 'Jan/2026', fim: 'Atual', atual: true }, hoje)).toEqual({ inicio: mes(2026, 1), fim: mes(2026, 10) });
    expect(intervaloDe({ inicio: 'Jan/2026', fim: 'Jan/2025', atual: false }, hoje)).toBeNull();
  });

  it('períodos sobrepostos ou vizinhos contam uma vez', () => {
    const a = { inicio: mes(2023, 4), fim: mes(2024, 7) };
    const b = { inicio: mes(2024, 8), fim: mes(2026, 7) };
    const sobreposto = { inicio: mes(2025, 1), fim: mes(2025, 6) };
    expect(uniao([b, a, sobreposto])).toEqual([{ inicio: mes(2023, 4), fim: mes(2026, 7) }]);
    expect(totalMeses([a, b, sobreposto])).toBe(40);
  });

  it('lacunas de 7 meses ou mais, entre experiências e até hoje', () => {
    const a = { inicio: mes(2020, 1), fim: mes(2020, 12) };
    const seisMeses = { inicio: mes(2021, 7), fim: mes(2022, 6) };
    const oitoMeses = { inicio: mes(2023, 3), fim: mes(2025, 12) };
    expect(lacunas([a, seisMeses, oitoMeses], hoje)).toEqual([
      { inicio: mes(2022, 7), fim: mes(2023, 2), meses: 8, ateHoje: false },
      { inicio: mes(2026, 1), fim: mes(2026, 10), meses: 10, ateHoje: true },
    ]);
    expect(lacunas([{ inicio: mes(2024, 1), fim: mes(2026, 7) }], hoje)).toEqual([]);
  });

  it('duração por extenso', () => {
    expect(duracao(40)).toBe('3 anos e 4 meses');
    expect(duracao(24)).toBe('2 anos');
    expect(duracao(13)).toBe('1 ano e 1 mês');
    expect(duracao(7)).toBe('7 meses');
    expect(duracao(0)).toBe('nenhum tempo');
  });
});
