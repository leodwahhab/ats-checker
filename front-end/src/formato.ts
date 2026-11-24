// Só apresentação: formatação de texto e das marcações na tela. A regra de negócio fica na API.

/** "Docker", "Docker e AWS", "Docker, AWS e Kafka". */
export const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0]);

/** "3 anos e 4 meses", "7 meses", "1 ano". */
export function duracao(meses: number): string {
  if (meses <= 0) return 'nenhum tempo';
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos ? `${anos} ano${anos > 1 ? 's' : ''}` : '';
  const m = resto ? `${resto} ${resto > 1 ? 'meses' : 'mês'}` : '';
  return [a, m].filter(Boolean).join(' e ');
}

/** Intervalos do texto do robô ocupados pelos trechos marcados, já unidos. `inicios[i]` é a posição do trecho i no texto. */
export function faixasNoTexto(
  items: Array<{ str: string }>, inicios: number[], itens: number[],
): Array<[number, number]> {
  const faixas = itens
    .map((i): [number, number] => [inicios[i], inicios[i] + items[i].str.length])
    .sort((x, y) => x[0] - y[0]);
  const out: Array<[number, number]> = [];
  for (const f of faixas) {
    const ult = out[out.length - 1];
    if (ult && f[0] <= ult[1] + 1) ult[1] = Math.max(ult[1], f[1]);
    else out.push([...f]);
  }
  return out;
}
