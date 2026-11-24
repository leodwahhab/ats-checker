import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ErroApi } from '../api/cliente';
import type { Candidatura, CandidaturaEntrada, CandidaturaResumo } from '../api/tipos';
import { RESULTADOS } from './SalvarCandidatura';

const NOME_PLATAFORMA: Record<string, string> = {
  gupy: 'Gupy', linkedin: 'LinkedIn', workday: 'Workday', inhire: 'InHire', greenhouse: 'Greenhouse', outra: 'Outra',
};
const NOME_RESULTADO: Record<string, string> = Object.fromEntries(RESULTADOS);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const mesLegivel = (mes?: string) => {
  if (!mes) return '—';
  const [a, m] = mes.split('-');
  return `${MESES[Number(m) - 1] ?? m}/${a}`;
};
const mensagem = (e: unknown) => (e instanceof ErroApi ? e.message : 'Algo deu errado. Tente de novo.');

/** Os campos de uma candidatura que o usuário atualiza quando a resposta chega. A previsão da época não muda. */
function paraEntrada(c: Candidatura, mudancas: Partial<CandidaturaEntrada>): CandidaturaEntrada {
  return {
    cvId: c.cvId, vagaTexto: c.vagaTexto, plataforma: c.plataforma, empresa: c.empresa, cargo: c.cargo, mes: c.mes,
    data: c.data, resultado: c.resultado, etapa: c.etapa, observacoes: c.observacoes, diasAteResposta: c.diasAteResposta,
    perguntas: c.perguntas, ...mudancas,
  };
}

function Detalhe({ id, onAbrir, onMudou, onFechar }: {
  id: number; onAbrir: (c: Candidatura) => void; onMudou: () => void; onFechar: () => void;
}) {
  const [c, setC] = useState<Candidatura | null>(null);
  const [resultado, setResultado] = useState('sem_retorno');
  const [etapa, setEtapa] = useState('');
  const [dias, setDias] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verVaga, setVerVaga] = useState(false);

  useEffect(() => {
    let vivo = true;
    setC(null);
    setErro(null);
    setAviso(null);
    api.candidatura(id).then((x) => {
      if (!vivo) return;
      setC(x);
      setResultado(x.resultado);
      setEtapa(x.etapa ?? '');
      setDias(x.diasAteResposta === undefined ? '' : String(x.diasAteResposta));
      setObservacoes(x.observacoes ?? '');
    }).catch((e) => vivo && setErro(mensagem(e)));
    return () => { vivo = false; };
  }, [id]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!c) return;
    setErro(null);
    setAviso(null);
    try {
      const nova = await api.atualizarCandidatura(c.id, paraEntrada(c, {
        resultado, etapa, observacoes, diasAteResposta: dias.trim() === '' ? null : Number(dias),
      }));
      setC(nova);
      setAviso('Resultado atualizado.');
      onMudou();
    } catch (x) {
      setErro(mensagem(x));
    }
  }

  async function excluir() {
    if (!c || !window.confirm('Excluir esta candidatura? O CV continua guardado.')) return;
    try {
      await api.excluirCandidatura(c.id);
      onMudou();
      onFechar();
    } catch (x) {
      setErro(mensagem(x));
    }
  }

  if (!c) return <section className="card plain">{erro ? <p role="alert" className="erro">{erro}</p> : <p className="sm muted">Carregando…</p>}</section>;
  const s = c.snapshot;
  return (
    <section className="card plain anim-in" aria-labelledby="det-t">
      <div className="hd">
        <div>
          <h2 className="h3" id="det-t">{c.empresa ?? 'Sem empresa'} · {c.cargo ?? 'sem cargo'}</h2>
          <div className="cap">{NOME_PLATAFORMA[c.plataforma ?? ''] ?? '—'} · {mesLegivel(c.mes)}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>Fechar</button>
      </div>

      {s && (
        <div className="stack">
          <div className="lbl">Previsão da época</div>
          <p className="sm"><strong>{s.rotuloFaixa}</strong> · {s.numero}/100. {s.resumo}</p>
          <p className="cap">Lente {s.lente.nome} · regras {c.versaoRegras ?? '—'} · salva em {new Date(c.criadoEm).toLocaleDateString('pt-BR')}</p>
        </div>
      )}

      <form className="stack espaco" onSubmit={(e) => void salvar(e)}>
        <div className="lbl">O que aconteceu</div>
        <div className="rowf topo">
          <label className="campo">
            <span className="lbl">Resultado</span>
            <select className="sel" value={resultado} onChange={(e) => setResultado(e.target.value)}>
              {RESULTADOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
          <label className="campo">
            <span className="lbl">Etapa</span>
            <input className="input" value={etapa} onChange={(e) => setEtapa(e.target.value)} placeholder="ex.: entrevista técnica" />
          </label>
          <label className="campo">
            <span className="lbl">Dias até a resposta</span>
            <input className="input" type="number" min={0} value={dias} onChange={(e) => setDias(e.target.value)} />
          </label>
        </div>
        <label className="campo">
          <span className="lbl">Observações</span>
          <textarea className="ta" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </label>
        {erro && <p role="alert" className="erro">{erro}</p>}
        {aviso && <p role="status" className="sm">{aviso}</p>}
        <div className="rowf">
          <button type="submit" className="btn btn-primary">Salvar resultado</button>
          <button type="button" className="btn btn-secondary" onClick={() => onAbrir(c)}>Abrir na análise</button>
          <button type="button" className="btn btn-ghost" onClick={() => setVerVaga(!verVaga)}>{verVaga ? 'Esconder a vaga' : 'Ver a vaga'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => void excluir()}>Excluir</button>
        </div>
      </form>
      {verVaga && <pre className="robot espaco">{c.vagaTexto}</pre>}
    </section>
  );
}

/** As candidaturas guardadas: a previsão da época ao lado do que aconteceu de verdade. */
export function Historico({ onAbrir }: { onAbrir: (c: Candidatura) => void }) {
  const [lista, setLista] = useState<CandidaturaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  const carregar = useCallback(() => {
    api.candidaturas().then(setLista).catch((e) => setErro(mensagem(e)));
  }, []);
  useEffect(carregar, [carregar]);

  const comResultado = lista?.filter((c) => c.resultado !== 'sem_retorno').length ?? 0;

  return (
    <div className="stack historico-col">
      <section className="card plain" aria-labelledby="hist-t">
        <div className="hd">
          <div>
            <h2 className="h3" id="hist-t">Histórico de candidaturas</h2>
            <div className="cap">
              {lista ? `${lista.length} candidatura${lista.length === 1 ? '' : 's'} · ${comResultado} com resultado conhecido` : 'Carregando…'}
            </div>
          </div>
        </div>
        {erro && <p role="alert" className="erro">{erro}</p>}
        {lista && lista.length === 0 && (
          <p className="sm muted">Nenhuma candidatura ainda. Analise um CV com uma vaga e escolha “Salvar como candidatura”, ou importe as pastas de fixtures/candidaturas pelo comando importar do backend.</p>
        )}
        {lista && lista.length > 0 && (
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr><th>Mês</th><th>Empresa</th><th>Cargo</th><th>Plataforma</th><th>Previsão</th><th>Resultado real</th><th><span className="sr-only">Abrir</span></th></tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} aria-selected={aberta === c.id}>
                    <td>{mesLegivel(c.mes)}</td>
                    <td>{c.empresa ?? '—'}</td>
                    <td>{c.cargo ?? '—'}</td>
                    <td>{NOME_PLATAFORMA[c.plataforma ?? ''] ?? '—'}</td>
                    <td>{c.rotuloFaixa ? `${c.rotuloFaixa} · ${c.numero}` : '—'}</td>
                    <td>{NOME_RESULTADO[c.resultado] ?? c.resultado}{c.etapa ? ` · ${c.etapa}` : ''}</td>
                    <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAberta(aberta === c.id ? null : c.id)}>{aberta === c.id ? 'Fechar' : 'Ver'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {aberta !== null && <Detalhe id={aberta} onAbrir={onAbrir} onMudou={carregar} onFechar={() => setAberta(null)} />}
    </div>
  );
}
