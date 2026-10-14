import { duracao } from './datas';
import { compararFamilia, ORDEM_SENIORIDADE, ROTULO_FAMILIA, ROTULO_SENIORIDADE, type Familia } from './dicionario/cargos';
import { ROTULO_MODELO_VAGA, rotuloLocal } from './local';
import { fold } from './texto';
import type { CvProfile, Dimensao, JobSpec, ReqStatus } from './types';

const familia = (id: string) => ROTULO_FAMILIA[id as Familia] ?? id;

/** Dimensões do número secundário (4.7 do plano). Sem dado de um dos lados, a dimensão sai do número. */
export function calcularDimensoes(perfil: CvProfile, job: JobSpec): Dimensao[] {
  return [cargo(perfil, job), senioridade(perfil, job), local(perfil, job)];
}

function cargo(perfil: CvProfile, job: JobSpec): Dimensao {
  const d = (status: ReqStatus, motivo: string): Dimensao => ({ id: 'cargo', rotulo: 'Cargo', peso: 10, status, motivo });
  if (!job.familia) return d('nao_verificavel', 'A vaga não deixa claro a área do cargo (título ausente ou genérico).');
  const cv = perfil.atual.familia;
  if (!cv) return d('nao_verificavel', 'Não deu para identificar a área do seu cargo atual no CV.');
  const exp = perfil.atual.experiencia;
  const onde = exp?.familia ? `${exp.cargo} · ${exp.rotulo}` : 'cabeçalho do CV';
  let status: ReqStatus = compararFamilia(cv, job.familia);
  let motivo = `Seu cargo atual é de ${familia(cv)} (${onde}); a vaga é de ${familia(job.familia)}.`;
  if (status === 'nao_atende') {
    // Uma experiência anterior na área conta como parcial.
    const anterior = perfil.experiencias.find((e) => e !== exp && e.familia && compararFamilia(e.familia, job.familia!) !== 'nao_atende');
    if (anterior) {
      status = 'parcial';
      motivo += ` Você já atuou na área: ${anterior.cargo} (${anterior.rotulo}).`;
    }
  }
  return d(status, motivo);
}

function senioridade(perfil: CvProfile, job: JobSpec): Dimensao {
  const d = (status: ReqStatus, motivo: string): Dimensao => ({ id: 'senioridade', rotulo: 'Senioridade', peso: 10, status, motivo });
  if (!job.senioridade) return d('nao_verificavel', 'A vaga não informa a senioridade.');
  const cv = perfil.atual.senioridade;
  if (!cv) return d('nao_verificavel', 'Não deu para identificar a sua senioridade no CV: nem no cargo, nem no cabeçalho, nem pelo tempo de experiência.');
  const diferenca = ORDEM_SENIORIDADE.indexOf(cv) - ORDEM_SENIORIDADE.indexOf(job.senioridade);
  const status: ReqStatus = diferenca >= 0 ? 'atende' : diferenca === -1 ? 'parcial' : 'nao_atende';
  const fonte = perfil.atual.fonteSenioridade === 'cargo' ? `pelo cargo "${perfil.atual.experiencia?.cargo}"`
    : perfil.atual.fonteSenioridade === 'cabecalho' ? 'pelo cabeçalho do CV'
      : `por ${duracao(perfil.mesesTotais)} de experiência, estágio incluído (aproximação: júnior até 2 anos, pleno até 5)`;
  return d(status, `Seu CV indica ${ROTULO_SENIORIDADE[cv]} (${fonte}); a vaga é ${ROTULO_SENIORIDADE[job.senioridade]}.`);
}

function local(perfil: CvProfile, job: JobSpec): Dimensao {
  const d = (status: ReqStatus, motivo: string): Dimensao => ({ id: 'local', rotulo: 'Local e modelo', peso: 5, status, motivo });
  if (job.modelo === 'remoto') return d('atende', 'A vaga é remota.');
  if (!job.local) {
    return d('nao_verificavel', job.modelo ? `A vaga é ${ROTULO_MODELO_VAGA[job.modelo]} e não informa o local.` : 'A vaga não informa local nem modelo de trabalho.');
  }
  const vaga = job.modelo ? `A vaga é ${ROTULO_MODELO_VAGA[job.modelo]} em ${rotuloLocal(job.local)}` : `A vaga é em ${rotuloLocal(job.local)} (modelo de trabalho não informado)`;
  if (!perfil.local) return d('nao_verificavel', `${vaga}, mas o CV não tem cidade e UF legíveis (ex.: "Osasco - SP").`);
  const cv = rotuloLocal(perfil.local);
  // Mesma UF atende, com ou sem a mesma cidade (seção 11, item 33).
  if (perfil.local.uf !== job.local.uf) return d('nao_atende', `${vaga}; o CV diz ${cv}.`);
  const mesmaCidade = !job.local.cidade || fold(perfil.local.cidade ?? '') === fold(job.local.cidade);
  return d('atende', `${vaga}; o CV diz ${cv}${mesmaCidade ? '' : ' (mesma UF)'}.`);
}
