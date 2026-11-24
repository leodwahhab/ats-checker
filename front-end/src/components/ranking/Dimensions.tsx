import { duracao } from '../../lib/ranking/datas';
import type { Dimensao, RankingResult } from '../../lib/ranking/types';
import { Secao, StatusChip } from '../ui';

function tempoLido({ mesesTotais, mesesEstagio, comData, semData }: RankingResult['experiencia']): string {
  if (!comData) return 'Nenhuma experiência com período foi lida do CV.';
  const estagio = mesesEstagio ? `, sendo ${duracao(mesesEstagio)} de estágio` : '';
  const fora = semData ? ` ${semData} sem período legível ${semData > 1 ? 'ficaram' : 'ficou'} de fora.` : '';
  return `${duracao(mesesTotais)} de experiência lidos do CV${estagio}, em ${comData} experiência${comData > 1 ? 's' : ''}. Períodos simultâneos contam uma vez.${fora}`;
}

export function Dimensions({ dimensoes, experiencia }: { dimensoes: Dimensao[]; experiencia: RankingResult['experiencia'] }) {
  return (
    <Secao titulo="Cargo, senioridade e local">
      <p className="cap">{tempoLido(experiencia)}</p>
      <p className="sm muted">Entram só na nota de apoio. Sem dado de um dos lados, a dimensão fica “não verificável” e sai da conta.</p>
      {dimensoes.map((d) => (
        <div key={d.id} className="item">
          <div className="irow">
            <StatusChip status={d.status} />
            <div className="imain"><div className="lbl">{d.rotulo}</div><div className="sm muted">{d.motivo}</div></div>
            <span className="cap">{d.status === 'nao_verificavel' ? 'sem dado' : `peso ${d.peso}`}</span>
          </div>
        </div>
      ))}
    </Secao>
  );
}
