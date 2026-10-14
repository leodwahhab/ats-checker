import { duracao, rotuloMes } from './datas';
import type { Dictionary } from './matcher';
import { lista } from './texto';
import type { Aviso, CvProfile, IdiomaTexto, JobSpec, RequirementResult } from './types';

const IDIOMA: Record<IdiomaTexto, string> = { pt: 'português', en: 'inglês' };


/** Avisos de preenchimento (4.8 do plano): nada aqui muda a faixa. */
export function calcularAvisos(perfil: CvProfile, job: JobSpec, resultados: RequirementResult[], dict: Dictionary): Aviso[] {
  const avisos: Aviso[] = [];
  const evidencias = (id: string) => [id, ...dict.implicadoPor(id)].flatMap((x) => perfil.skills.get(x) ?? []);

  // Skills que a vaga pede e o CV tem, mas fora da seção Habilidades.
  const soImplicitas = new Set<string>();
  const soCertificacoes = new Set<string>();
  for (const r of resultados) {
    if (r.requisito.tipo === 'informativo') continue;
    for (const c of r.requisito.componentes) {
      if (c.tipo !== 'skill') continue;
      const achadas = c.ids.filter((id) => evidencias(id).length);
      if (!achadas.length || (c.modo === 'alguma' && achadas.some((id) => evidencias(id).some((e) => e.explicita)))) continue;
      for (const id of c.modo === 'alguma' ? achadas.slice(0, 1) : achadas) {
        const ev = evidencias(id);
        if (ev.some((e) => e.explicita)) continue;
        const destino = ev.every((e) => e.fonte === 'certificacoes' || e.fonte === 'projetos') ? soCertificacoes : soImplicitas;
        destino.add(dict.rotulo(id));
      }
    }
  }
  if (soImplicitas.size) {
    const xs = [...soImplicitas];
    avisos.push({
      tipo: 'so_implicita',
      texto: `${lista(xs)} ${xs.length > 1 ? 'aparecem' : 'aparece'} no CV, mas fora da seção Habilidades. Gupy e LinkedIn leem essa seção como a lista explícita de habilidades: inclua ${xs.length > 1 ? 'esses itens' : 'esse item'} lá também.`,
    });
  }
  if (soCertificacoes.size) {
    const xs = [...soCertificacoes];
    avisos.push({
      tipo: 'so_certificacoes',
      texto: `${lista(xs)} só ${xs.length > 1 ? 'aparecem' : 'aparece'} em Certificações ou Projetos. A Gupy diz ordenar por Experiência e Habilidades: cite também numa dessas seções.`,
    });
  }

  if (perfil.habilidadesExplicitas > 30) {
    avisos.push({
      tipo: 'habilidades_demais',
      texto: `A seção Habilidades cita ${perfil.habilidadesExplicitas} tecnologias. A Gupy recomenda preencher as 30 com maior aderência a você: escolha as que a vaga pede.`,
    });
  }

  if (job.idioma && perfil.idioma && job.idioma !== perfil.idioma) {
    avisos.push({
      tipo: 'idioma_cv',
      texto: `A vaga está em ${IDIOMA[job.idioma]} e o CV em ${IDIOMA[perfil.idioma]}. A Gupy recomenda enviar o CV no idioma da vaga.`,
    });
  }

  if (!perfil.experiencias.length) {
    avisos.push({
      tipo: 'sem_experiencia',
      texto: 'Nenhuma experiência com período foi lida do CV, então tempo de experiência, cargo e senioridade ficam sem dado. Escreva cada experiência com cargo, empresa e período (ex.: "Analista | Empresa (Jan/2022 – Atual)").',
    });
  } else {
    const semData = perfil.experiencias.filter((e) => !e.intervalo);
    if (semData.length) {
      avisos.push({
        tipo: 'sem_experiencia',
        texto: `${lista(semData.map((e) => e.rotulo))}: o período não foi entendido, então ${semData.length > 1 ? 'essas experiências ficam' : 'essa experiência fica'} fora do tempo de experiência. Use "mm/aaaa" ou "Jan/2022 – Atual".`,
      });
    }
  }

  for (const l of perfil.lacunas) {
    const quando = l.ateHoje ? `desde ${rotuloMes(l.inicio - 1)}, quando terminou a última experiência` : `entre ${rotuloMes(l.inicio - 1)} e ${rotuloMes(l.fim + 1)}`;
    avisos.push({
      tipo: 'lacuna',
      texto: `${duracao(l.meses)} sem experiência registrada ${quando}. É só informação, o app não penaliza; mas alguns sistemas usam lacunas de 6 meses ou mais para ranquear (estudo Hidden Workers, Harvard Business School).`,
    });
  }
  return avisos;
}
