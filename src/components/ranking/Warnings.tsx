import type { Aviso, AvisoTipo } from '../../lib/ranking/types';
import { Secao } from '../ui';

const ROTULO: Record<AvisoTipo, string> = {
  so_implicita: 'Skill só no texto',
  so_certificacoes: 'Skill fora de Experiência e Habilidades',
  habilidades_demais: 'Habilidades demais',
  idioma_cv: 'Idioma do CV',
  lacuna: 'Lacuna',
  sem_experiencia: 'Sem experiência lida',
};

export function Warnings({ avisos }: { avisos: Aviso[] }) {
  if (!avisos.length) return null;
  return (
    <Secao titulo={`Avisos (${avisos.length})`}>
      <p className="sm muted">Não mudam a faixa: são ajustes no CV que ajudam as plataformas a ler o que você já tem.</p>
      <div className="stack">
        {avisos.map((a) => <div key={a.texto} className="note"><span className="lbl">{ROTULO[a.tipo]}</span><span>{a.texto}</span></div>)}
      </div>
    </Secao>
  );
}
