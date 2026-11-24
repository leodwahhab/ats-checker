import { useId, useState, type ReactNode } from 'react';
import type { FonteDoc, ReqStatus } from '../lib/ranking/types';
import type { Status } from '../lib/types';

/** O que está selecionado para marcar no CV: um requisito da vaga ou uma checagem de formato. */
export interface Selecao {
  tipo: 'req' | 'check';
  id: string;
}

/** Liga o diagnóstico à prévia do CV. */
export interface Marcador {
  selecao: Selecao | null;
  /** O item tem trecho localizado no PDF? */
  tem: (s: Selecao) => boolean;
  /** Seleciona e rola a prévia até o trecho. */
  ver: (s: Selecao) => void;
  /** Seleciona ou desfaz a seleção, sem rolar. */
  alternar: (s: Selecao) => void;
}

export const mesmaSelecao = (a: Selecao | null, b: Selecao) => !!a && a.tipo === b.tipo && a.id === b.id;

export type Tom = ReqStatus;

const STATUS_FORMATO: Record<Status, [Tom, string]> = {
  pass: ['atende', 'Passou'], warn: ['parcial', 'Atenção'], fail: ['nao_atende', 'Falhou'],
};
export const tomDoFormato = (s: Status) => STATUS_FORMATO[s];

const ROTULO: Record<Tom, string> = {
  atende: 'Atende', parcial: 'Parcial', nao_atende: 'Não atende', nao_verificavel: 'Não verificável',
};

const DESENHO: Record<Tom, { d: string; fill: string; dash?: string }> = {
  atende: { d: 'M8 12.4l2.8 2.8L16.4 9.6', fill: 'none' },
  parcial: { d: 'M12 5.5a6.5 6.5 0 0 1 0 13z', fill: 'currentColor' },
  nao_atende: { d: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6', fill: 'none' },
  nao_verificavel: { d: 'M9.9 9.7a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7M12 16.5v.01', fill: 'none', dash: '3 3' },
};

/** Status sempre com ícone e palavra: a cor sozinha não basta (daltonismo). */
export function StatusChip({ status, rotulo }: { status: Tom; rotulo?: string }) {
  const s = DESENHO[status];
  return (
    <span className={`chip st-${status}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" strokeDasharray={s.dash} />
        <path d={s.d} fill={s.fill} />
      </svg>
      {rotulo ?? ROTULO[status]}
    </span>
  );
}

interface SecaoProps {
  titulo: ReactNode;
  aberta?: boolean;
  children: ReactNode;
  className?: string;
}

/** Cartão com título que abre e fecha. */
export function Secao({ titulo, aberta = false, children, className = '' }: SecaoProps) {
  const [open, setOpen] = useState(aberta);
  const id = useId();
  return (
    <section className={`card ${className}`}>
      <h2 className="card-h">
        <button type="button" className="ddh" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          <span>{titulo}</span>
          <span className="ddi" aria-hidden="true">{open ? '–' : '+'}</span>
        </button>
      </h2>
      <div id={id} className={`cx${open ? ' open' : ''}`}>
        <div className="in"><div className="ddbody">{children}</div></div>
      </div>
    </section>
  );
}

export function Switch({ rotulo, ligado, onChange }: { rotulo: string; ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="switch-row">
      <button type="button" role="switch" aria-checked={ligado} className={`switch${ligado ? ' on' : ''}`} onClick={() => onChange(!ligado)}>
        <span className="switch-thumb" />
        <span className="sr-only">{rotulo}</span>
      </button>
      <span aria-hidden="true">{rotulo}</span>
    </span>
  );
}

export function Fonte({ fonte, texto = 'Fonte oficial' }: { fonte: FonteDoc; texto?: string }) {
  return <a className="lnk" href={fonte.url} target="_blank" rel="noreferrer" title={fonte.rotulo}>{texto}</a>;
}

/** "Ver no CV": só aparece quando o trecho foi localizado no PDF. */
export function VerNoCv({ m, s, variante = 'ghost' }: { m: Marcador; s: Selecao; variante?: 'ghost' | 'secondary' }) {
  if (!m.tem(s)) return null;
  return <button type="button" className={`btn btn-${variante} btn-sm ver-cv`} onClick={() => m.ver(s)}>Ver no CV</button>;
}
