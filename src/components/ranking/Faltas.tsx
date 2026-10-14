import type { RankingResult } from '../../lib/ranking/types';
import { Secao, StatusChip, VerNoCv, type Marcador } from '../ui';
import { Declarar, type RequirementHandlers } from './RequirementsTable';

/** O que impede uma faixa melhor: obrigatórios sem comprovação e o que a lente acrescenta. */
export function Faltas({ ranking, h, m }: { ranking: RankingResult; h: RequirementHandlers; m: Marcador }) {
  const faltas = ranking.requisitos.filter((r) => r.requisito.tipo === 'obrigatorio' && r.status !== 'atende');
  // Os itens sobre obrigatórios já aparecem nas linhas; ficam eliminatórias, desejáveis e regras da lente.
  const outros = ranking.comoMelhorar.filter((t) => !t.startsWith('Obrigatório'));
  return (
    <Secao titulo={`O que falta para subir (${faltas.length})`} aberta>
      {faltas.length === 0 && !outros.length && <p className="sm muted">Nada impede um resultado melhor nesta lente.</p>}
      {faltas.length > 0 && <p className="sm muted">Obrigatórios que ainda não estão comprovados no CV.</p>}
      {faltas.map((r) => {
        const s = { tipo: 'req' as const, id: r.requisito.id };
        return (
          <div key={r.requisito.id} className="item">
            <div className="irow">
              <StatusChip status={r.status} />
              <div className="imain">
                <div className="lbl">{r.requisito.texto}</div>
                <div className="sm muted">{r.motivo}</div>
              </div>
              <div className="acts">
                {m.tem(s) ? <VerNoCv m={m} s={s} /> : <span className="cap">Não está no CV</span>}
              </div>
            </div>
            <Declarar r={r} h={h} />
          </div>
        );
      })}
      {outros.length > 0 && (
        <>
          {faltas.length > 0 && <div className="grp">Também pesa</div>}
          <ul className="lista sm">{outros.map((t) => <li key={t}>{t}</li>)}</ul>
        </>
      )}
    </Secao>
  );
}
