import type { JobSpec, LenteId, RankingResult } from '../../lib/ranking/types';
import type { Marcador } from '../ui';
import { BandCard } from './BandCard';
import { Dimensions } from './Dimensions';
import { Faltas } from './Faltas';
import { Knockouts } from './Knockouts';
import { NotEvaluable } from './NotEvaluable';
import { RequirementsTable, type RequirementHandlers } from './RequirementsTable';
import { Termos } from './Termos';
import { Warnings } from './Warnings';

interface Props {
  ranking: RankingResult;
  job: JobSpec;
  semTexto: boolean;
  limiar: number;
  onLimiar: (valor: number) => void;
  lente: LenteId;
  onLente: (lente: LenteId) => void;
  onSobreLentes: () => void;
  ausentes: string[];
  handlers: RequirementHandlers;
  onResponder: (id: string, valor: boolean | null) => void;
  m: Marcador;
}

export function VagaTab(p: Props) {
  const { ranking, job } = p;
  return (
    <div className="anim-in" role="tabpanel" id="painel-vaga" aria-labelledby="aba-vaga">
      {p.semTexto && (
        <p className="note">
          O PDF não tem texto legível: nenhum requisito pôde ser encontrado. No Workday, um currículo que não pode ser lido fica sem nota.
        </p>
      )}
      <BandCard ranking={ranking} job={job} lente={p.lente} onLente={p.onLente} onSobreLentes={p.onSobreLentes} />
      {!ranking.vazio && <Faltas ranking={ranking} h={p.handlers} m={p.m} />}
      <Knockouts eliminatorias={ranking.eliminatorias} afirmativa={job.afirmativa} onResponder={p.onResponder} />
      <RequirementsTable
        resultados={ranking.requisitos} h={p.handlers} m={p.m} lente={p.lente}
        limiar={p.limiar} onLimiar={p.onLimiar} classificacaoAutomatica={ranking.classificacaoAutomatica}
      />
      <Dimensions dimensoes={ranking.dimensoes} experiencia={ranking.experiencia} />
      <Warnings avisos={ranking.avisos} />
      <Termos ausentes={p.ausentes} requisitos={ranking.requisitos} onPromover={p.handlers.onPromover} />
      <NotEvaluable comportamentais={job.naoAvaliaveis} />
    </div>
  );
}
