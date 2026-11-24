import { useState } from 'react';
import type { LenteId, ReqTipo, RequirementResult } from '../../api/tipos';
import { useLentes } from '../../api/LentesContext';
import { mesmaSelecao, Secao, StatusChip, VerNoCv, type Marcador } from '../ui';

export interface RequirementHandlers {
  onTipo: (id: string, tipo: ReqTipo) => void;
  onRemover: (id: string) => void;
  onAdicionar: (texto: string, tipo: ReqTipo) => void;
  onDeclarar: (id: string, valor: boolean | null) => void;
  onPromover: (termo: string) => void;
}

/** "Tenho / Não tenho" para um requisito "?", ou a resposta já dada (Q4.5). */
export function Declarar({ r, h }: { r: RequirementResult; h: RequirementHandlers }) {
  const id = r.requisito.id;
  if (r.declarado) {
    return (
      <div className="acts">
        <span className="tag">declarado por você</span>
        <button type="button" className="linkbtn" onClick={() => h.onDeclarar(id, null)}>desfazer</button>
      </div>
    );
  }
  if (r.status !== 'nao_verificavel' || r.requisito.tipo === 'informativo') return null;
  return (
    <div className="acts" role="group" aria-label={`Você atende: ${r.requisito.texto}`}>
      <span className="cap">Você atende?</span>
      <button type="button" className="pill-btn" onClick={() => h.onDeclarar(id, true)}>Tenho</button>
      <button type="button" className="pill-btn" onClick={() => h.onDeclarar(id, false)}>Não tenho</button>
    </div>
  );
}

export const termosDesconhecidos = (r: RequirementResult) =>
  r.requisito.componentes.flatMap((c) => (c.tipo === 'nao_reconhecido' ? c.termos : []));

function TipoSelect({ valor, onChange, rotulo, informativo = true }: {
  valor: ReqTipo; onChange: (t: ReqTipo) => void; rotulo: string; informativo?: boolean;
}) {
  return (
    <select className="sel" value={valor} onChange={(e) => onChange(e.target.value as ReqTipo)} aria-label={rotulo}>
      <option value="obrigatorio">Obrigatório</option>
      <option value="desejavel">Desejável</option>
      {informativo && <option value="informativo">Informativo</option>}
    </select>
  );
}

function Linha({ r, h, m }: { r: RequirementResult; h: RequirementHandlers; m: Marcador }) {
  const req = r.requisito;
  const s = { tipo: 'req' as const, id: req.id };
  const aberto = mesmaSelecao(m.selecao, s);
  const automatico = req.tipoFonte === 'heuristica' || req.tipoFonte === 'padrao';
  const provas = r.evidencias.filter((e) => e.fonte !== 'declarado');
  const termos = termosDesconhecidos(r);
  return (
    <div className="item">
      <div className="irow">
        <StatusChip status={r.status} />
        <div className="imain">
          <button type="button" className={`rowbtn${aberto ? ' open' : ''}`} aria-expanded={aberto} aria-controls={`prova-${req.id}`} onClick={() => m.alternar(s)}>
            {req.texto}
          </button>
          <div className="sm muted">{r.motivo}</div>
          {automatico && <span className="tag">classificação automática</span>}
        </div>
        <div className="acts">
          <TipoSelect valor={req.tipo} onChange={(t) => h.onTipo(req.id, t)} rotulo={`Tipo de ${req.texto}`} />
          <button type="button" className="icon-btn" aria-label={`Remover requisito: ${req.texto}`} onClick={() => h.onRemover(req.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
      <Declarar r={r} h={h} />
      {aberto && (
        <div className="evid" id={`prova-${req.id}`}>
          {provas.length ? provas.slice(0, 3).map((e) => (
            <div key={`${e.rotulo}|${e.trecho}`}>
              <div className="cap">{e.rotulo} · evidência {e.explicita ? 'explícita' : 'implícita'}</div>
              <p className="quote">“{e.trecho}”</p>
            </div>
          )) : <p className="quote">Nenhum trecho do CV corresponde a este requisito.</p>}
          {termos.length > 0 && (
            <div className="acts">
              {termos.map((t) => <button key={t} type="button" className="pill-btn" onClick={() => h.onPromover(t)}>Tratar “{t}” como skill</button>)}
            </div>
          )}
          <div><VerNoCv m={m} s={s} variante="secondary" /></div>
        </div>
      )}
    </div>
  );
}

const GRUPOS: Array<{ tipo: ReqTipo; titulo: string; dica: string }> = [
  { tipo: 'obrigatorio', titulo: 'Obrigatórios', dica: 'Decidem a faixa.' },
  { tipo: 'desejavel', titulo: 'Desejáveis', dica: 'Contam para Top fit quando a cobertura chega ao limiar.' },
  { tipo: 'informativo', titulo: 'Informativos', dica: 'Tecnologias das atividades da vaga: aparecem aqui, mas não entram na faixa.' },
];

interface Props {
  resultados: RequirementResult[];
  h: RequirementHandlers;
  m: Marcador;
  lente: LenteId;
  limiar: number;
  onLimiar: (v: number) => void;
  classificacaoAutomatica: boolean;
}

export function RequirementsTable({ resultados, h, m, lente, limiar, onLimiar, classificacaoAutomatica }: Props) {
  const { fontes } = useLentes();
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<ReqTipo>('obrigatorio');
  const contados = resultados.filter((r) => r.requisito.tipo !== 'informativo').length;

  return (
    <Secao titulo={`Requisitos da vaga (${contados})`}>
      {classificacaoAutomatica && (
        <p className="note">A vaga não separa requisitos de diferenciais. Classifiquei cada linha automaticamente: revise o que é obrigatório.</p>
      )}
      <div className="hd espaco">
        <p className="sm muted">Toque no requisito para ver o trecho do CV. Corrija o tipo quando a leitura da vaga errar.</p>
        {/* O Workday usa a maioria dos desejáveis (mais de 50%) para a nota A: o ajuste não se aplica. */}
        {lente === 'workday' ? (
          <p className="cap limiar">Na lente Workday, a nota A pede mais de 50% dos desejáveis: o limiar não se aplica.</p>
        ) : (
          <div className="stack limiar">
            <label className="lbl" htmlFor="limiar">Limiar de desejáveis: {Math.round(limiar * 100)}%</label>
            <input type="range" id="limiar" min={0} max={100} step={5} value={Math.round(limiar * 100)} onChange={(e) => onLimiar(Number(e.target.value) / 100)} />
            <span className="cap">
              Para Top fit, os desejáveis precisam chegar a este valor.{' '}
              <a className="lnk" href={fontes.linkedinAssistente.url} target="_blank" rel="noreferrer" title="O LinkedIn não publica o valor: quem publica a vaga define.">aproximação</a>
            </span>
          </div>
        )}
      </div>
      {GRUPOS.map((g) => {
        const itens = resultados.filter((r) => r.requisito.tipo === g.tipo);
        if (!itens.length) return null;
        return (
          <div key={g.tipo}>
            <div className="grp"><span>{g.titulo} ({itens.length})</span><span className="cap">{g.dica}</span></div>
            {itens.map((r) => <Linha key={r.requisito.id} r={r} h={h} m={m} />)}
          </div>
        );
      })}
      <hr className="hr" />
      <form
        className="rowf novo-req"
        onSubmit={(e) => {
          e.preventDefault();
          if (!texto.trim()) return;
          h.onAdicionar(texto.trim(), tipo);
          setTexto('');
        }}
      >
        <div className="campo">
          <label className="lbl" htmlFor="novo-req">Novo requisito</label>
          <input id="novo-req" className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Experiência com Redis" />
        </div>
        <TipoSelect valor={tipo} onChange={setTipo} rotulo="Tipo do novo requisito" informativo={false} />
        <button type="submit" className="btn btn-secondary">Adicionar</button>
      </form>
    </Secao>
  );
}
