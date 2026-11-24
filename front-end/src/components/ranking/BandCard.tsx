import { useState } from 'react';
import { LENTES, ORDEM_LENTES } from '../../lib/ranking/lentes';
import type { FaixaId, JobSpec, LenteId, NotaWorkday, RankingResult, ReqStatus, RequirementResult, ResultadoLente } from '../../lib/ranking/types';
import { Fonte, Secao } from '../ui';

const PESO: Record<ReqStatus, number> = { atende: 1, parcial: 0.5, nao_atende: 0, nao_verificavel: 0 };
const TOM: Record<ResultadoLente['tom'], string> = { top: 'g', maybe: 'y', not: 'r', neutro: 'n' };
const NIVEL: Record<FaixaId, number> = { not: 1, maybe: 2, top: 3 };
const NOTAS: NotaWorkday[] = ['D', 'C', 'B', 'A'];
const TOM_NOTA: Record<NotaWorkday, string> = { D: 'r', C: 'y', B: 'y', A: 'g' };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const pts = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** O selo da faixa, no jeito de cada plataforma: barras, trilho, ponto ou letra. */
function Selo({ lente }: { lente: ResultadoLente }) {
  const nivel = lente.tom === 'neutro' ? 0 : NIVEL[lente.tom];
  return (
    <span className={`fit ${TOM[lente.tom]}`}>
      {lente.id === 'nucleo' && (
        <span className="fbars" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= nivel ? 'on' : ''} />)}</span>
      )}
      {lente.id === 'gupy' && <span className="ftrk" aria-hidden="true"><i className={`w${nivel}`} /></span>}
      {lente.id === 'linkedin' && <span className="fdot" aria-hidden="true" />}
      {lente.id === 'workday' && lente.nota && <span className="fgrade" aria-hidden="true">{lente.nota}</span>}
      {lente.rotulo}
    </span>
  );
}

function Legenda({ lente }: { lente: ResultadoLente }) {
  const itens = lente.id === 'workday'
    ? NOTAS.map((n) => ({ chave: n, rotulo: `Nota ${n}`, tom: TOM_NOTA[n], cur: lente.nota === n }))
    : (['not', 'maybe', 'top'] as FaixaId[]).map((f) => ({ chave: f, rotulo: LENTES[lente.id].rotulos[f], tom: TOM[f], cur: lente.tom === f }));
  return (
    <div className="legend" role="list" aria-label="Faixas desta lente">
      {itens.map((i) => <span key={i.chave} role="listitem" className={`lg ${i.tom}${i.cur ? ' cur' : ''}`}>{i.rotulo}</span>)}
    </div>
  );
}

function contagem(rs: RequirementResult[]): string {
  const n = (s: ReqStatus) => rs.filter((r) => r.status === s).length;
  const partes = [
    n('atende') && `${n('atende')} atende${n('atende') > 1 ? 'm' : ''}`,
    n('parcial') && `${n('parcial')} parcia${n('parcial') > 1 ? 'is' : 'l'} (vale${n('parcial') > 1 ? 'm' : ''} metade)`,
    n('nao_atende') && `${n('nao_atende')} não atende${n('nao_atende') > 1 ? 'm' : ''}`,
    n('nao_verificavel') && `${n('nao_verificavel')} não verificáve${n('nao_verificavel') > 1 ? 'is' : 'l'} (vale${n('nao_verificavel') > 1 ? 'm' : ''} zero)`,
  ].filter(Boolean);
  return partes.join(', ');
}

/** A conta do número secundário (4.7), parte por parte. */
function ComoChegamos({ ranking }: { ranking: RankingResult }) {
  const [aberto, setAberto] = useState(false);
  const obrig = ranking.requisitos.filter((r) => r.requisito.tipo === 'obrigatorio');
  const desej = ranking.requisitos.filter((r) => r.requisito.tipo === 'desejavel');
  const { obrigatorios: co, desejaveis: cd } = ranking.cobertura;
  const linhas = [
    { nome: 'Obrigatórios', peso: 50, valor: co, motivo: co === null ? 'A vaga não tem obrigatórios.' : `${contagem(obrig)}. Cobertura de ${pct(co)}.` },
    { nome: 'Desejáveis', peso: 25, valor: cd, motivo: cd === null ? 'A vaga não tem desejáveis.' : `${contagem(desej)}. Cobertura de ${pct(cd)}.` },
    ...ranking.dimensoes.map((d) => ({ nome: d.rotulo, peso: d.peso, valor: d.status === 'nao_verificavel' ? null : PESO[d.status], motivo: d.motivo })),
  ];
  const usadas = linhas.filter((l) => l.valor !== null);
  const possivel = usadas.reduce((s, l) => s + l.peso, 0);
  const obtido = usadas.reduce((s, l) => s + l.peso * l.valor!, 0);
  const fora = linhas.filter((l) => l.valor === null).map((l) => l.nome.toLowerCase());

  return (
    <>
      <div className="numline">
        <span className="cap">Nota de apoio</span>
        <span className="num">{ranking.numero} de 100</span>
        <span className="sm muted">
          {pts(obtido)} de {possivel} pontos possíveis.{fora.length > 0 && ` Sem dado, ${fora.join(' e ')} ${fora.length > 1 ? 'saíram' : 'saiu'} da conta.`}
        </span>
      </div>
      <div className="ddsub">
        <button type="button" className="ddh sm" aria-expanded={aberto} aria-controls="como-numero" onClick={() => setAberto(!aberto)}>
          <span>Como chegamos nesse número</span><span className="ddi" aria-hidden="true">{aberto ? '–' : '+'}</span>
        </button>
        <div id="como-numero" className={`cx${aberto ? ' open' : ''}`}>
          <div className="in">
            <div className="tablewrap espaco">
              <table className="tbl">
                <thead><tr><th scope="col">Parte</th><th scope="col">Pontos</th><th scope="col">Por quê</th></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.nome}>
                      <td className="lbl">{l.nome}</td>
                      <td className="nowrap">{l.valor === null ? 'sem dado' : `${pts(l.peso * l.valor)} de ${l.peso}`}</td>
                      <td className="muted">{l.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cap espaco">
              Os pesos são do app, não de uma plataforma (aproximação). Quando falta dado, a parte sai e o total é recalculado:
              {' '}{pts(obtido)} ÷ {possivel} = {ranking.numero} de 100.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

interface Props {
  ranking: RankingResult;
  job: JobSpec;
  lente: LenteId;
  onLente: (l: LenteId) => void;
  onSobreLentes: () => void;
}

export function BandCard({ ranking, job, lente, onLente, onSobreLentes }: Props) {
  const r = ranking.lente;
  return (
    <Secao titulo="Sua faixa nesta vaga" aberta>
      <div className="lbl" id="lente-lbl">Como a plataforma mostraria</div>
      <div className="seg2wrap" role="radiogroup" aria-labelledby="lente-lbl">
        {ORDEM_LENTES.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={id === lente} className={`seg2${id === lente ? ' on' : ''}`} onClick={() => onLente(id)}>
            {LENTES[id].nome}
          </button>
        ))}
      </div>
      <div key={lente} className="anim-in">
        <p className="sm muted espaco">{r.descricao}</p>

        {ranking.vazio ? (
          <p className="note">Nenhum requisito foi identificado na vaga. Adicione os requisitos em “Requisitos da vaga” para ver a faixa.</p>
        ) : (
          <>
            <p className="cap espaco-g">Assim a plataforma mostraria seu perfil em uma lista de candidatos</p>
            <div className="listrow">
              <div className="lr-main">
                <div className="lbl">Seu currículo</div>
                <div className="cap">{job.titulo ?? 'Vaga sem título'}</div>
              </div>
              <div className="rowf">
                {r.indicador && <span className="tag forte">{r.indicador}</span>}
                <Selo lente={r} />
              </div>
            </div>
            <p className="sm espaco">{ranking.resumo}</p>
            <Legenda lente={r} />
          </>
        )}

        {r.alertas.length > 0 && (
          <div className="stack espaco">
            {r.alertas.map((a) => (
              <div key={a.texto} className="note">
                <span className="lbl">Atenção</span>
                <span>{a.texto} {a.fonte ? <Fonte fonte={a.fonte} /> : <span className="badge-aprox">regra do app</span>}</span>
              </div>
            ))}
          </div>
        )}
        <p className="cap espaco">
          {r.aproximacoes.length} {r.aproximacoes.length === 1 ? 'regra desta lente é aproximação' : 'regras desta lente são aproximações'}.{' '}
          <button type="button" className="linkbtn" onClick={onSobreLentes}>Ver em “Sobre as lentes”</button>
        </p>
      </div>

      {!ranking.vazio && (
        <>
          <hr className="hr" />
          <ComoChegamos ranking={ranking} />
        </>
      )}
    </Secao>
  );
}
