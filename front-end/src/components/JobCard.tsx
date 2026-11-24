import { useEffect, useState } from 'react';
import type { JobSpec } from '../api/tipos';

interface Props {
  texto: string;
  onTexto: (t: string) => void;
  job: JobSpec | null;
  temCv: boolean;
  /** Lê o texto da vaga. Devolve false quando o usuário desistiu (edições seriam descartadas). */
  onLer: () => boolean;
}

export function JobCard({ texto, onTexto, job, temCv, onLer }: Props) {
  const temVaga = !!job;
  const [editando, setEditando] = useState(!temVaga);
  // Sem vaga, o editor fica aberto; editar requisitos (outro JobSpec) não o reabre.
  useEffect(() => setEditando(!temVaga), [temVaga]);
  const lidos = job?.requisitos.filter((r) => r.tipo !== 'informativo').length ?? 0;

  return (
    <section className="card plain" aria-labelledby="vaga-t">
      <div className="hd">
        <div>
          <h2 className="h3" id="vaga-t">Texto da vaga</h2>
          <div className="cap">
            {job
              ? `${job.titulo ?? 'Vaga sem título'} · ${lidos} requisito${lidos === 1 ? '' : 's'} lido${lidos === 1 ? '' : 's'}`
              : 'Opcional. Cada linha vira um requisito editável.'}
          </div>
        </div>
        {job && (
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={editando} aria-controls="vaga-ed" onClick={() => setEditando(!editando)}>
            {editando ? 'Fechar' : 'Trocar texto'}
          </button>
        )}
      </div>
      <div id="vaga-ed" className={`cx${editando ? ' open' : ''}`}>
        <div className="in">
          <label className="lbl" htmlFor="vaga-ta">Cole a vaga, em português ou inglês</label>
          <textarea
            id="vaga-ta"
            className="ta"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            placeholder={'Cole aqui a descrição completa da vaga, com requisitos e diferenciais.\nRequisitos\n- Java 11\n- Spring Boot'}
          />
          <div className="rowf acoes-vaga">
            <button type="button" className="btn btn-secondary" disabled={!texto.trim()} onClick={() => { if (onLer()) setEditando(false); }}>
              {job ? 'Reler a vaga' : 'Ler a vaga'}
            </button>
            {job && <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>}
          </div>
        </div>
      </div>
      {job && !temCv && <p className="sm muted nota-vaga">Envie o PDF do CV para ver o ranqueamento.</p>}
    </section>
  );
}
