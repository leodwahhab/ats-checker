import type {
  AcaoDeEdicao, BuscaDeMarca, Candidatura, CandidaturaEntrada, CandidaturaResumo, CvDetalhe, CvResumo, EstadoDaVaga,
  JobSpec, Lentes, RankingResult, ReqTipo, SkillDef,
} from './tipos';

/** Erro devolvido pela API (application/problem+json), com a mensagem em português. */
export class ErroApi extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ErroApi(0, 'Não foi possível falar com a API. Ela está rodando em http://127.0.0.1:8080?');
  }
  if (!r.ok) {
    let mensagem = `Erro ${r.status} da API.`;
    try {
      const p = await r.json() as { detail?: string; title?: string };
      mensagem = p.detail ?? p.title ?? mensagem;
    } catch { /* corpo sem JSON */ }
    throw new ErroApi(r.status, mensagem);
  }
  return r.status === 204 ? (undefined as T) : r.json() as Promise<T>;
}

const json = (metodo: string, corpo: unknown, signal?: AbortSignal): RequestInit => ({
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal,
});

export interface PedidoDeRanking extends EstadoDaVaga {
  cvId: number;
}

export interface PedidoDeEdicao {
  job: JobSpec;
  acao: AcaoDeEdicao;
  id?: string;
  tipo?: ReqTipo;
  texto?: string;
  termo?: string;
  extras?: SkillDef[];
}

export const api = {
  lentes: () => pedir<Lentes>('/api/lentes'),

  // Currículos
  enviarCv(arquivo: File): Promise<CvDetalhe> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return pedir<CvDetalhe>('/api/cvs', { method: 'POST', body: form });
  },
  cvs: () => pedir<CvResumo[]>('/api/cvs'),
  cv: (id: number) => pedir<CvDetalhe>(`/api/cvs/${id}`),
  async pdf(id: number): Promise<ArrayBuffer> {
    const r = await fetch(`/api/cvs/${id}/pdf`);
    if (!r.ok) throw new ErroApi(r.status, 'Não foi possível baixar o PDF guardado.');
    return r.arrayBuffer();
  },
  marcas: (id: number, buscas: BuscaDeMarca[], signal?: AbortSignal) =>
    pedir<Record<string, number[]>>(`/api/cvs/${id}/marcas`, json('POST', { buscas }, signal)),

  // Vagas e ranking
  lerVaga: (texto: string) => pedir<JobSpec>('/api/vagas/ler', json('POST', { texto })),
  editarVaga: (p: PedidoDeEdicao) => pedir<{ job: JobSpec; skill?: SkillDef }>('/api/vagas/editar', json('POST', p)),
  termosAusentes: (cvId: number, texto: string, extras: SkillDef[], signal?: AbortSignal) =>
    pedir<string[]>('/api/vagas/termos-ausentes', json('POST', { cvId, texto, extras }, signal)),
  ranquear: (p: PedidoDeRanking, signal?: AbortSignal) => pedir<RankingResult>('/api/ranking', json('POST', p, signal)),

  // Histórico
  candidaturas: () => pedir<CandidaturaResumo[]>('/api/candidaturas'),
  candidatura: (id: number) => pedir<Candidatura>(`/api/candidaturas/${id}`),
  criarCandidatura: (e: CandidaturaEntrada) => pedir<Candidatura>('/api/candidaturas', json('POST', e)),
  atualizarCandidatura: (id: number, e: CandidaturaEntrada) =>
    pedir<Candidatura>(`/api/candidaturas/${id}`, json('PUT', e)),
  excluirCandidatura: (id: number) => pedir<void>(`/api/candidaturas/${id}`, { method: 'DELETE' }),
};
