import { useState, type FormEvent } from 'react';
import { api, ErroApi } from '../api/cliente';
import type { Candidatura, EstadoDaVaga, Plataforma, ResultadoReal } from '../api/tipos';

const PLATAFORMAS: Array<[Plataforma, string]> = [
  ['gupy', 'Gupy'], ['linkedin', 'LinkedIn'], ['workday', 'Workday'], ['inhire', 'InHire'], ['greenhouse', 'Greenhouse'],
  ['outra', 'Outra'],
];
export const RESULTADOS: Array<[ResultadoReal, string]> = [
  ['sem_retorno', 'Sem retorno'], ['passou_triagem', 'Passou na triagem'], ['reprovado', 'Reprovado'],
];

const mesAtual = () => new Date().toISOString().slice(0, 7);

interface Props {
  cvId: number;
  vagaTexto: string;
  estado: EstadoDaVaga;
  onVerHistorico: () => void;
}

/** Guarda a análise atual como uma candidatura: o CV, a vaga, as suas edições e a previsão de hoje. */
export function SalvarCandidatura({ cvId, vagaTexto, estado, onVerHistorico }: Props) {
  const [aberto, setAberto] = useState(false);
  const [plataforma, setPlataforma] = useState<Plataforma>('linkedin');
  const [empresa, setEmpresa] = useState('');
  const [cargo, setCargo] = useState('');
  const [mes, setMes] = useState(mesAtual);
  const [resultado, setResultado] = useState<ResultadoReal>('sem_retorno');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salva, setSalva] = useState<Candidatura | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      setSalva(await api.criarCandidatura({ cvId, vagaTexto, plataforma, empresa, cargo, mes, resultado, estado }));
      setAberto(false);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível salvar a candidatura.');
    } finally {
      setSalvando(false);
    }
  }

  if (salva) {
    return (
      <section className="card plain anim-in" aria-live="polite">
        <h2 className="h3">Candidatura salva</h2>
        <p className="sm muted">Ela guarda o CV, a vaga, as suas edições e a previsão de hoje ({salva.snapshot?.rotuloFaixa}).</p>
        <div className="rowf espaco">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onVerHistorico}>Ver no histórico</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSalva(null)}>Salvar de novo</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card plain" aria-labelledby="salvar-t">
      <div className="hd">
        <div>
          <h2 className="h3" id="salvar-t">Guardar no histórico</h2>
          <div className="cap">Salva o CV, a vaga e a previsão de hoje para comparar com o resultado real depois.</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? 'Fechar' : 'Salvar como candidatura'}
        </button>
      </div>
      {aberto && (
        <form className="stack anim-in" onSubmit={(e) => void salvar(e)}>
          <div className="rowf topo">
            <label className="campo">
              <span className="lbl">Plataforma onde enviou</span>
              <select className="sel" value={plataforma} onChange={(e) => setPlataforma(e.target.value as Plataforma)}>
                {PLATAFORMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label className="campo">
              <span className="lbl">Mês</span>
              <input className="input" type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
            </label>
            <label className="campo">
              <span className="lbl">Resultado até agora</span>
              <select className="sel" value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoReal)}>
                {RESULTADOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="rowf topo">
            <label className="campo">
              <span className="lbl">Empresa</span>
              <input className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="ex.: acme" />
            </label>
            <label className="campo">
              <span className="lbl">Cargo</span>
              <input className="input" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="ex.: dev java jr" />
            </label>
          </div>
          {erro && <p role="alert" className="erro">{erro}</p>}
          <div className="rowf">
            <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
