import type { ReactNode } from 'react';
import type { Periodo, Structured as StructuredData } from '../lib/types';

const period = (p?: Periodo) => (p ? `${p.inicio} – ${p.fim}` : undefined);

/** Campo que o robô não leu: aparece destacado, porque um ATS real também não o verá. */
function Valor({ v, falta = 'Não lido' }: { v?: string | null; falta?: string }) {
  return v ? <>{v}</> : <em className="missing">{falta}</em>;
}

function Grupo({ titulo, aberto = false, children }: { titulo: string; aberto?: boolean; children: ReactNode }) {
  return (
    <details className="details" open={aberto}>
      <summary>{titulo}</summary>
      <div className="dbody">{children}</div>
    </details>
  );
}

export function StructuredView({ data }: { data: StructuredData }) {
  const nHab = data.habilidades.reduce((n, g) => n + g.itens.length, 0);
  return (
    <div className="structured">
      <p className="cap">Confira se os dados saíram certos. Campo marcado como “não lido” é o que o robô não identificou.</p>

      <Grupo titulo={`Experiência (${data.experiencia.length})`} aberto>
        {data.experiencia.length === 0 ? (
          <p className="sm missing">Nenhuma experiência com cargo, empresa e período foi reconhecida.</p>
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">Cargo</th><th scope="col">Empresa</th><th scope="col">Período</th><th scope="col">Itens</th></tr></thead>
              <tbody>
                {data.experiencia.map((e, i) => (
                  <tr key={i}>
                    <td><Valor v={e.cargo} /></td>
                    <td><Valor v={e.empresa} /></td>
                    <td><Valor v={period(e.periodo)} falta="Sem data lida" /></td>
                    <td>{e.responsabilidades.length || (e.resumo ? 'texto corrido' : <em className="missing">nenhum</em>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.experiencia.map((e, i) => (e.responsabilidades.length || e.resumo || e.tecnologias || e.local) && (
          <details key={i} className="details sub">
            <summary>{e.cargo ?? 'Cargo não lido'} · {e.empresa ?? 'empresa não lida'}</summary>
            <div className="dbody sm">
              {e.local && <p>Local: {e.local}</p>}
              {e.tecnologias && <p>Tecnologias: {e.tecnologias}</p>}
              {e.responsabilidades.length > 0
                ? <ul className="lista">{e.responsabilidades.map((r, j) => <li key={j}>{r}</li>)}</ul>
                : e.resumo && <p>{e.resumo}</p>}
            </div>
          </details>
        ))}
      </Grupo>

      <Grupo titulo={`Formação (${data.formacao.length}) e certificações (${data.certificacoes.length})`}>
        {data.formacao.length === 0 && <p className="sm missing">Nenhuma formação com instituição e período foi reconhecida.</p>}
        <ul className="lista sm">
          {data.formacao.map((f, i) => (
            <li key={i}>
              <Valor v={f.nivel === 'Não identificado' ? undefined : f.nivel} falta="Nível não lido" /> · <Valor v={f.curso} falta="Curso não lido" /> ·{' '}
              <Valor v={f.instituicao} falta="Instituição não lida" /> · <Valor v={period(f.periodo)} falta="Sem período lido" />
              {f.status && <> · {f.status}{f.statusInferido && ' (inferido pela data)'}</>}
            </li>
          ))}
        </ul>
        {data.certificacoes.length > 0 && (
          <ul className="lista sm">
            {data.certificacoes.map((c, i) => <li key={i}>Certificação: {c.nome}{c.emissor && ` · ${c.emissor}`}{c.data && ` · ${c.data}`}</li>)}
          </ul>
        )}
      </Grupo>

      <Grupo titulo={`Idiomas (${data.idiomas.length})`}>
        {data.idiomas.length === 0 ? <p className="sm missing">Nenhum idioma reconhecido.</p> : (
          <ul className="lista sm">
            {data.idiomas.map((l, i) => <li key={i}><strong>{l.idioma}</strong>: <Valor v={l.nivel} falta="nível não lido" /></li>)}
          </ul>
        )}
      </Grupo>

      <Grupo titulo={`Habilidades (${data.habilidades.length} grupo${data.habilidades.length === 1 ? '' : 's'}, ${nHab} ite${nHab === 1 ? 'm' : 'ns'})`}>
        {nHab === 0 ? <p className="sm missing">Nenhuma habilidade reconhecida.</p> : data.habilidades.map((g, i) => (
          <div key={i} className="grupo-hab">
            <div className="cap">Grupo lido como “{g.categoria}”</div>
            <div className="tags">{g.itens.map((s, j) => <span key={j} className="tag">{s}</span>)}</div>
          </div>
        ))}
      </Grupo>

      <Grupo titulo="Resumo, cabeçalho, contato e projetos">
        <dl className="campos sm">
          <dt>Cabeçalho</dt><dd><Valor v={data.cabecalho.join(' · ')} /></dd>
          <dt>Contato</dt><dd><Valor v={data.contato.join(' · ')} /></dd>
          <dt>Resumo</dt><dd><Valor v={data.resumo} /></dd>
          <dt>Projetos</dt><dd>{data.projetos.length ? <ul className="lista">{data.projetos.map((p, i) => <li key={i}>{p}</li>)}</ul> : <em className="missing">Nenhum lido</em>}</dd>
        </dl>
      </Grupo>
    </div>
  );
}
