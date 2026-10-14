export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

/**
 * Capitais e polos de tecnologia, para vagas que dão só a cidade ("São Paulo, Brazil"). No CV
 * a cidade só é lida no formato "Cidade - UF", porque um nome próprio no topo pode ser o do candidato.
 */
export const CIDADES: Array<[cidade: string, uf: string]> = [
  ['Rio Branco', 'AC'], ['Maceió', 'AL'], ['Macapá', 'AP'], ['Manaus', 'AM'], ['Salvador', 'BA'], ['Fortaleza', 'CE'],
  ['Brasília', 'DF'], ['Vitória', 'ES'], ['Goiânia', 'GO'], ['São Luís', 'MA'], ['Cuiabá', 'MT'], ['Campo Grande', 'MS'],
  ['Belo Horizonte', 'MG'], ['Belém', 'PA'], ['João Pessoa', 'PB'], ['Curitiba', 'PR'], ['Recife', 'PE'], ['Teresina', 'PI'],
  ['Rio de Janeiro', 'RJ'], ['Natal', 'RN'], ['Porto Alegre', 'RS'], ['Porto Velho', 'RO'], ['Boa Vista', 'RR'],
  ['Florianópolis', 'SC'], ['São Paulo', 'SP'], ['Aracaju', 'SE'], ['Palmas', 'TO'],
  ['Campinas', 'SP'], ['Barueri', 'SP'], ['Osasco', 'SP'], ['Guarulhos', 'SP'], ['Santo André', 'SP'],
  ['São Bernardo do Campo', 'SP'], ['São Caetano do Sul', 'SP'], ['São José dos Campos', 'SP'], ['Sorocaba', 'SP'],
  ['Ribeirão Preto', 'SP'], ['Jundiaí', 'SP'], ['Santos', 'SP'], ['São Carlos', 'SP'], ['Niterói', 'RJ'],
  ['Uberlândia', 'MG'], ['Juiz de Fora', 'MG'], ['Joinville', 'SC'], ['Blumenau', 'SC'], ['Londrina', 'PR'],
  ['Maringá', 'PR'], ['Caxias do Sul', 'RS'], ['São Leopoldo', 'RS'], ['Campina Grande', 'PB'],
];

/** Países que aparecem no local de vagas (texto com fold), para a regra de vaga em outro país do LinkedIn. */
export const PAISES: Array<[pais: string, padrao: RegExp]> = [
  ['Brasil', /\b(brasil|brazil)\b/],
  ['Portugal', /\bportugal\b/],
  ['Estados Unidos', /\b(estados unidos|eua|united states|usa)\b/],
  ['Canadá', /\bcanada\b/],
  ['Reino Unido', /\b(reino unido|united kingdom|inglaterra|england)\b/],
  ['Irlanda', /\b(irlanda|ireland)\b/],
  ['Alemanha', /\b(alemanha|germany)\b/],
  ['Espanha', /\b(espanha|spain)\b/],
  ['Holanda', /\b(holanda|netherlands|paises baixos)\b/],
  ['França', /\b(franca|france)\b/],
  ['Argentina', /\bargentina\b/],
  ['México', /\bmexico\b/],
  ['Chile', /\bchile\b/],
  ['Colômbia', /\bcolombia\b/],
  ['Uruguai', /\b(uruguai|uruguay)\b/],
];
