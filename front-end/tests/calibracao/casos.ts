import fs from 'node:fs';
import path from 'node:path';

// Casos de calibração (seção 8.1 do plano e docs/como-documentar-candidaturas.md).

export const PLATAFORMAS = ['gupy', 'linkedin', 'workday', 'inhire', 'greenhouse', 'outra'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];
export const RESULTADOS = ['passou_triagem', 'reprovado', 'sem_retorno'] as const;
export type Resultado = (typeof RESULTADOS)[number];

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export interface Caso {
  /** Nome da pasta: AAAA-MM-plataforma-empresa-cargo. */
  nome: string;
  pasta: string;
  ano?: number;
  mes?: number;
  /** Só quando o meta.json traz a data completa. */
  dia?: number;
  plataforma?: Plataforma;
  empresa?: string;
  cargo?: string;
  resultado?: Resultado;
  observacoes?: string;
  etapa?: string;
  diasAteResposta?: number;
  perguntas: Pergunta[];
  /** Impedem o caso de entrar no relatório. */
  erros: string[];
  /** Não impedem, mas valem uma olhada. */
  avisos: string[];
}

/** Texto do vaga.txt do modelo: se continuar lá, o caso não foi preenchido. */
const VAGA_DO_MODELO = 'Cole aqui o texto completo da vaga';
const NOME = /^(\d{4})-(\d{2})-([a-z]+)-([a-z0-9]+)(?:-([a-z0-9-]+))?$/;
/** Valor que ficou do modelo ("AAAA-MM-DD", "2026-07-DD"): é o mesmo que não informar. */
const ESPACO_RESERVADO = /AAAA|MM|DD/;

/** Data, plataforma, empresa e cargo vêm do nome da pasta: o meta.json não precisa repetir. */
export function lerNome(nome: string): Pick<Caso, 'ano' | 'mes' | 'plataforma' | 'empresa' | 'cargo' | 'erros'> {
  const m = NOME.exec(nome);
  if (!m) {
    return { erros: [`o nome da pasta não segue AAAA-MM-plataforma-empresa-cargo (minúsculas, sem acento nem espaço)`] };
  }
  const [, ano, mes, plataforma, empresa, cargo] = m;
  const erros: string[] = [];
  if (Number(mes) < 1 || Number(mes) > 12) erros.push(`mês ${mes} inválido no nome da pasta`);
  if (!(PLATAFORMAS as readonly string[]).includes(plataforma)) {
    erros.push(`plataforma "${plataforma}" desconhecida no nome da pasta; use ${PLATAFORMAS.join(', ')}`);
  }
  return { ano: Number(ano), mes: Number(mes), plataforma: plataforma as Plataforma, empresa, cargo: cargo?.replace(/-/g, ' '), erros };
}

type CamposDoMeta = Pick<Caso, 'dia' | 'resultado' | 'observacoes' | 'etapa' | 'diasAteResposta' | 'perguntas' | 'erros' | 'avisos'>
  & { ano?: number; mes?: number };

/** Lê o meta.json. Só "resultado" é obrigatório; campos vazios contam como ausentes. */
export function lerMeta(json: string): CamposDoMeta {
  const campos: CamposDoMeta = { perguntas: [], erros: [], avisos: [] };
  let meta: unknown;
  try {
    meta = JSON.parse(json);
  } catch (e) {
    campos.erros.push(`meta.json não é um JSON válido (${(e as Error).message})`);
    return campos;
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    campos.erros.push('meta.json deve ser um objeto: { "resultado": "…" }');
    return campos;
  }
  const m = meta as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  const resultado = texto(m.resultado);
  if (!resultado) campos.erros.push(`falta "resultado" no meta.json (${RESULTADOS.join(', ')})`);
  else if (!(RESULTADOS as readonly string[]).includes(resultado)) {
    campos.erros.push(`resultado "${resultado}" inválido; use ${RESULTADOS.join(', ')}`);
  } else campos.resultado = resultado as Resultado;

  const data = texto(m.data);
  if (data && !ESPACO_RESERVADO.test(data)) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
    if (d) [campos.ano, campos.mes, campos.dia] = [Number(d[1]), Number(d[2]), Number(d[3])];
    else campos.avisos.push(`data "${data}" ignorada: use AAAA-MM-DD ou deixe em branco`);
  }

  campos.observacoes = texto(m.observacoes);
  campos.etapa = texto(m.etapa);
  if (typeof m.dias_ate_resposta === 'number' && m.dias_ate_resposta >= 0) campos.diasAteResposta = m.dias_ate_resposta;
  else if (m.dias_ate_resposta != null && m.dias_ate_resposta !== '') campos.avisos.push('dias_ate_resposta ignorado: use um número (0 = no mesmo dia)');

  if (Array.isArray(m.perguntas)) {
    for (const p of m.perguntas) {
      const pergunta = texto((p as Record<string, unknown>)?.pergunta);
      if (pergunta) campos.perguntas.push({ pergunta, resposta: texto((p as Record<string, unknown>)?.resposta) ?? '' });
    }
  }
  return campos;
}

export function lerCaso(pasta: string): Caso {
  const nome = path.basename(pasta);
  const peloNome = lerNome(nome);
  const caso: Caso = { nome, pasta, ...peloNome, perguntas: [], erros: [...peloNome.erros], avisos: [] };

  const arquivo = (f: string) => path.join(pasta, f);
  if (!fs.existsSync(arquivo('meta.json'))) caso.erros.push('falta meta.json');
  else {
    const meta = lerMeta(fs.readFileSync(arquivo('meta.json'), 'utf8'));
    caso.erros.push(...meta.erros);
    caso.avisos.push(...meta.avisos);
    if (meta.dia && (meta.ano !== caso.ano || meta.mes !== caso.mes)) {
      caso.avisos.push('a data do meta.json não bate com o mês do nome da pasta; vale o nome da pasta');
    } else if (meta.dia) caso.dia = meta.dia;
    Object.assign(caso, {
      resultado: meta.resultado, observacoes: meta.observacoes, etapa: meta.etapa, diasAteResposta: meta.diasAteResposta,
      perguntas: meta.perguntas,
    });
  }
  if (!fs.existsSync(arquivo('vaga.txt'))) caso.erros.push('falta vaga.txt');
  else {
    const vaga = fs.readFileSync(arquivo('vaga.txt'), 'utf8');
    if (!vaga.trim()) caso.erros.push('vaga.txt está vazio');
    else if (vaga.includes(VAGA_DO_MODELO)) caso.erros.push('vaga.txt ainda tem o texto do modelo');
  }
  if (!fs.existsSync(arquivo('cv.pdf'))) caso.erros.push('falta cv.pdf');
  return caso;
}

/** Cada subpasta é um caso; as que começam com "_" (o modelo e cópias dele) ficam de fora. */
export function listarCasos(raiz: string): Caso[] {
  if (!fs.existsSync(raiz)) return [];
  return fs.readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => lerCaso(path.join(raiz, d.name)))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
