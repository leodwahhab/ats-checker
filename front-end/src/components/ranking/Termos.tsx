import type { RequirementResult } from '../../api/tipos';
import { Secao } from '../ui';
import { termosDesconhecidos } from './RequirementsTable';

/** Lista secundária (Q13) e termos fora do dicionário que o usuário pode promover a skill (Q18). */
export function Termos({ ausentes, requisitos, onPromover }: { ausentes: string[]; requisitos: RequirementResult[]; onPromover: (t: string) => void }) {
  const desconhecidos = [...new Set(requisitos.flatMap(termosDesconhecidos))];
  if (!ausentes.length && !desconhecidos.length) return null;
  return (
    <Secao titulo="Termos da vaga que não aparecem no CV">
      {ausentes.length > 0 && (
        <>
          <div className="tags" aria-label="Termos ausentes">{ausentes.map((t) => <span key={t} className="tag">{t}</span>)}</div>
          <p className="sm muted espaco">Esta lista é só um apoio. As plataformas comparam requisitos, não frequência de palavras.</p>
        </>
      )}
      {desconhecidos.length > 0 && (
        <>
          {ausentes.length > 0 && <hr className="hr" />}
          <div className="lbl">Termos que não reconhecemos</div>
          <p className="sm muted">Ficam como “não verificável” até você dizer que são uma skill.</p>
          <div className="stack espaco">
            {desconhecidos.map((t) => (
              <div key={t} className="rowf">
                <span className="tag">{t}</span>
                <button type="button" className="pill-btn" aria-label={`Tratar ${t} como skill`} onClick={() => onPromover(t)}>Tratar como skill</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Secao>
  );
}
