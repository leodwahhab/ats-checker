import type { EliminatoriaResult } from '../../api/tipos';
import { Secao } from '../ui';

interface Props {
  eliminatorias: EliminatoriaResult[];
  afirmativa?: string;
  onResponder: (id: string, valor: boolean | null) => void;
}

// Seção 4.8 do plano: o que a vaga provavelmente pergunta no formulário de candidatura.
export function Knockouts({ eliminatorias, afirmativa, onResponder }: Props) {
  if (!eliminatorias.length && !afirmativa) return null;
  return (
    <Secao titulo={`Possíveis eliminatórias (${eliminatorias.length})`}>
      {eliminatorias.length > 0 && (
        <p className="sm muted">
          Trechos da vaga que costumam virar pergunta eliminatória no formulário. Responda para o resultado considerar: “não” leva a Not
          fit, porque nessas perguntas a plataforma provavelmente reprova automaticamente. A resposta fica só nesta página.
        </p>
      )}
      {eliminatorias.map((e) => (
        <div key={e.id} className="item">
          <div className="irow">
            <div className="imain">
              <div className="lbl">{e.rotulo}: você atende?</div>
              <div className="sm muted">Na vaga: “{e.trecho}”</div>
              {e.noCv && <div className="sm muted">{e.noCv}</div>}
            </div>
            <div className="acts" role="group" aria-label={`Resposta: ${e.rotulo}`}>
              <button type="button" className="pill-btn" aria-pressed={e.resposta === true} onClick={() => onResponder(e.id, e.resposta === true ? null : true)}>Sim</button>
              <button type="button" className="pill-btn" aria-pressed={e.resposta === false} onClick={() => onResponder(e.id, e.resposta === false ? null : false)}>Não</button>
              <span className="cap">{e.resposta === undefined ? 'Sem resposta' : `Sua resposta: ${e.resposta ? 'sim' : 'não'}`}</span>
            </div>
          </div>
        </div>
      ))}
      {afirmativa && (
        <p className="note neutra">
          Vaga afirmativa: “{afirmativa}”. É só uma informação: o app não pergunta nem avalia dados de identidade.
        </p>
      )}
    </Secao>
  );
}
