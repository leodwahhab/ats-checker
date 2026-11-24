import { useCallback, useEffect, useRef, useState } from 'react';
import { LENTES, ORDEM_LENTES, VERIFICADO_EM } from '../lib/ranking/lentes';
import { lista } from '../lib/ranking/texto';
import type { FonteEvidencia, LenteId } from '../lib/ranking/types';
import { Fonte } from './ui';

const NOME_FONTE: Partial<Record<FonteEvidencia, string>> = {
  habilidades: 'Habilidades', experiencia: 'Experiência', formacao: 'Formação', idiomas: 'Idiomas',
};

type Tema = 'light' | 'dark';

function temaAtual(): Tema {
  const explicito = document.documentElement.dataset.theme;
  if (explicito === 'light' || explicito === 'dark') return explicito;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ToggleTema() {
  const [tema, setTema] = useState<Tema>(temaAtual);
  const alternar = () => {
    const novo: Tema = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem('tema', novo); } catch { /* sem persistência */ }
    setTema(novo);
  };
  const escuro = tema === 'dark';
  return (
    <button type="button" className="btn btn-ghost btn-sm theme-toggle" onClick={alternar} aria-label={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'} title={escuro ? 'Modo claro' : 'Modo escuro'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {escuro
          ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
          : <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
      </svg>
    </button>
  );
}

/** Todas as lentes, com o que cada uma simula, as aproximações (Q23) e as fontes oficiais. */
function SobreLentes({ atual, onFechar }: { atual: LenteId; onFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  return (
    <div ref={ref} tabIndex={-1} className="lenspop anim-in" id="sobre-lentes" role="region" aria-label="Sobre as lentes">
      <div className="lenspop-h">
        <h2 className="h4">Sobre as lentes</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>Fechar</button>
      </div>
      <p className="cap">Todas as lentes. A que você está usando aparece marcada. Fontes conferidas em {VERIFICADO_EM}.</p>
      {ORDEM_LENTES.map((id) => {
        const l = LENTES[id];
        return (
          <div key={id} className="item">
            <div className="lbl">{l.nome}{id === atual && <> <span className="tag">em uso</span></>}</div>
            <p className="sm muted">
              {l.descricao}
              {l.fontes && ` Só contam como evidência: ${lista(l.fontes.map((f) => NOME_FONTE[f] ?? f))}.`}
            </p>
            <ul className="sm lista">
              {l.notas.map((n) => <li key={n.texto}>{n.texto} <Fonte fonte={n.fonte} /></li>)}
            </ul>
            {l.aproximacoes.map((a) => (
              <div key={a.texto} className="rowf topo aprox">
                <span className="badge-aprox">aproximação</span>
                <span className="sm">{a.texto} <Fonte fonte={a.fonte} /></span>
              </div>
            ))}
            <p className="cap docs">
              Documentação: {l.documentacao.map((d, i) => <span key={d.url}>{i > 0 && ' · '}<Fonte fonte={d} texto={d.rotulo} /></span>)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function Topbar({ lente, sobreAberto, onSobre }: { lente: LenteId; sobreAberto: boolean; onSobre: (v: boolean) => void }) {
  const fechar = useCallback(() => onSobre(false), [onSobre]);
  return (
    <header className="topbar">
      <h1 className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
        </span>
        Verificador de CV para ATS
      </h1>
      <div className="topbar-a">
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={sobreAberto} aria-controls="sobre-lentes" onClick={() => onSobre(!sobreAberto)}>
          Sobre as lentes
        </button>
        <ToggleTema />
        <span className="badge-neutro">Tudo no seu navegador · nada é enviado</span>
      </div>
      {sobreAberto && <SobreLentes atual={lente} onFechar={fechar} />}
    </header>
  );
}
