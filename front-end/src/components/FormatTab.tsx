import type { Analysis, CheckResult, Status } from '../api/tipos';
import { StructuredView } from './Structured';
import { mesmaSelecao, Secao, StatusChip, tomDoFormato, VerNoCv, type Marcador } from './ui';

const FATOR: Record<Status, number> = { pass: 1, warn: 0.5, fail: 0 };

export function faixaDoFormato(score: number): { tom: 'g' | 'y' | 'r'; rotulo: string } {
  return score >= 80 ? { tom: 'g', rotulo: 'OK' } : score >= 50 ? { tom: 'y', rotulo: 'Atenção' } : { tom: 'r', rotulo: 'Problema' };
}

const decimal = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function Checagem({ c, m }: { c: CheckResult; m: Marcador }) {
  const [tom, rotulo] = tomDoFormato(c.status);
  const s = { tipo: 'check' as const, id: c.id };
  const sel = mesmaSelecao(m.selecao, s);
  return (
    <div className="item">
      <div className="irow">
        <StatusChip status={tom} rotulo={rotulo} />
        <div className="imain">
          {m.tem(s)
            ? <button type="button" className={`rowbtn${sel ? ' open' : ''}`} aria-pressed={sel} onClick={() => m.alternar(s)}>{c.title} <span className="cap">· peso {c.weight}</span></button>
            : <div className="lbl">{c.title} <span className="cap">· peso {c.weight}</span></div>}
          <div className="sm muted">{c.detail}</div>
        </div>
        <VerNoCv m={m} s={s} />
      </div>
      {c.fix && <div className="fix"><span className="lbl">Como corrigir.</span> {c.fix}</div>}
    </div>
  );
}

export function FormatTab({ analysis, m }: { analysis: Analysis; m: Marcador }) {
  const { checks, formatScore, structured } = analysis;
  const faixa = faixaDoFormato(formatScore);
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const obtido = checks.reduce((s, c) => s + c.weight * FATOR[c.status], 0);
  const semTexto = checks.some((c) => c.id === 'text-layer' && c.status === 'fail');
  const corrigir = checks.filter((c) => c.status !== 'pass').sort((a, b) => b.weight - a.weight || (a.status === 'fail' ? -1 : 1));
  const passou = checks.filter((c) => c.status === 'pass');

  return (
    <div className="anim-in" role="tabpanel" id="painel-formato" aria-labelledby="aba-formato">
      <Secao titulo="Formato e leitura" aberta>
        <p className="cap">Não é a nota oficial de nenhum ATS.</p>
        <div className="verdict">
          <div>
            <div className="cap">Pontuação de formato</div>
            <p className={`vbig ${faixa.tom}`}>{formatScore} <span className="sm muted">de 100</span></p>
            <p className="sm">
              {semTexto
                ? 'O robô não encontrou texto: as outras checagens nem rodam.'
                : corrigir.length
                  ? `${corrigir.length} checage${corrigir.length > 1 ? 'ns pedem' : 'm pede'} ajuste. A de maior peso: ${corrigir[0].title.toLowerCase()}.`
                  : 'Nenhuma checagem pede ajuste.'}
            </p>
          </div>
          <span className={`fit ${faixa.tom}`}>{faixa.rotulo}</span>
        </div>
        <div className="legend" role="list" aria-label="Faixas da pontuação">
          {([['r', 'Problema · abaixo de 50'], ['y', 'Atenção · 50 a 79'], ['g', 'OK · 80 ou mais']] as const).map(([t, l]) => (
            <span key={t} role="listitem" className={`lg ${t}${t === faixa.tom ? ' cur' : ''}`}>{l}</span>
          ))}
        </div>
        <p className="sm muted espaco">
          {semTexto
            ? 'Sem texto selecionável, a nota fica em 0.'
            : `Cada checagem vale o seu peso. “Passou” conta inteira, “atenção” conta metade e “falhou” não conta. ${decimal(obtido)} de ${total} pontos de peso dão ${formatScore}.`}
        </p>
      </Secao>

      {corrigir.length > 0 && (
        <Secao titulo={`Para corrigir (${corrigir.length})`} aberta>
          <p className="cap">Mais pesados primeiro.</p>
          {corrigir.map((c) => <Checagem key={c.id} c={c} m={m} />)}
        </Secao>
      )}

      {passou.length > 0 && (
        <Secao titulo={`Passou (${passou.length})`}>
          {passou.map((c) => <Checagem key={c.id} c={c} m={m} />)}
        </Secao>
      )}

      {!semTexto && (
        <Secao titulo="Como o robô entendeu seu CV">
          <StructuredView data={structured} />
        </Secao>
      )}
    </div>
  );
}
