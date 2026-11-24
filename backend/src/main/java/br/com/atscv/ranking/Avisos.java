package br.com.atscv.ranking;

import static br.com.atscv.ranking.Datas.duracao;
import static br.com.atscv.ranking.Datas.rotuloMes;

import br.com.atscv.ranking.Tipos.Aviso;
import br.com.atscv.ranking.Tipos.AvisoTipo;
import br.com.atscv.ranking.Tipos.CompSkill;
import br.com.atscv.ranking.Tipos.Component;
import br.com.atscv.ranking.Tipos.CvProfile;
import br.com.atscv.ranking.Tipos.Evidence;
import br.com.atscv.ranking.Tipos.ExperienciaPerfil;
import br.com.atscv.ranking.Tipos.FonteEvidencia;
import br.com.atscv.ranking.Tipos.IdiomaTexto;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.Lacuna;
import br.com.atscv.ranking.Tipos.ModoSkill;
import br.com.atscv.ranking.Tipos.ReqTipo;
import br.com.atscv.ranking.Tipos.RequirementResult;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Avisos de preenchimento: nada aqui muda a faixa. */
public final class Avisos {
    private Avisos() {}

    private static String idioma(IdiomaTexto i) {
        return i == IdiomaTexto.PT ? "português" : "inglês";
    }

    private static List<Evidence> evidencias(CvProfile perfil, Dicionario dict, String id) {
        List<String> ids = new ArrayList<>(List.of(id));
        ids.addAll(dict.implicadoPor(id));
        List<Evidence> out = new ArrayList<>();
        for (String x : ids) out.addAll(perfil.skills().getOrDefault(x, List.of()));
        return out;
    }

    public static List<Aviso> calcularAvisos(CvProfile perfil, JobSpec job, List<RequirementResult> resultados, Dicionario dict) {
        List<Aviso> avisos = new ArrayList<>();

        // Skills que a vaga pede e o CV tem, mas fora da seção Habilidades.
        Set<String> soImplicitas = new LinkedHashSet<>();
        Set<String> soCertificacoes = new LinkedHashSet<>();
        for (RequirementResult r : resultados) {
            if (r.requisito().tipo() == ReqTipo.INFORMATIVO) continue;
            for (Component c : r.requisito().componentes()) {
                if (!(c instanceof CompSkill s)) continue;
                List<String> achadas = s.ids().stream().filter(id -> !evidencias(perfil, dict, id).isEmpty()).toList();
                if (achadas.isEmpty() || (s.modo() == ModoSkill.ALGUMA
                        && achadas.stream().anyMatch(id -> evidencias(perfil, dict, id).stream().anyMatch(Evidence::explicita)))) {
                    continue;
                }
                for (String id : s.modo() == ModoSkill.ALGUMA ? achadas.subList(0, 1) : achadas) {
                    List<Evidence> ev = evidencias(perfil, dict, id);
                    if (ev.stream().anyMatch(Evidence::explicita)) continue;
                    boolean soCerts = ev.stream().allMatch(e -> e.fonte() == FonteEvidencia.CERTIFICACOES
                            || e.fonte() == FonteEvidencia.PROJETOS);
                    (soCerts ? soCertificacoes : soImplicitas).add(dict.rotulo(id));
                }
            }
        }
        if (!soImplicitas.isEmpty()) {
            List<String> xs = new ArrayList<>(soImplicitas);
            avisos.add(new Aviso(AvisoTipo.SO_IMPLICITA, Texto.lista(xs) + " " + (xs.size() > 1 ? "aparecem" : "aparece")
                    + " no CV, mas fora da seção Habilidades. Gupy e LinkedIn leem essa seção como a lista explícita de "
                    + "habilidades: inclua " + (xs.size() > 1 ? "esses itens" : "esse item") + " lá também."));
        }
        if (!soCertificacoes.isEmpty()) {
            List<String> xs = new ArrayList<>(soCertificacoes);
            avisos.add(new Aviso(AvisoTipo.SO_CERTIFICACOES, Texto.lista(xs) + " só " + (xs.size() > 1 ? "aparecem" : "aparece")
                    + " em Certificações ou Projetos. A Gupy diz ordenar por Experiência e Habilidades: cite também numa dessas seções."));
        }

        if (perfil.habilidadesExplicitas() > 30) {
            avisos.add(new Aviso(AvisoTipo.HABILIDADES_DEMAIS, "A seção Habilidades cita " + perfil.habilidadesExplicitas()
                    + " tecnologias. A Gupy recomenda preencher as 30 com maior aderência a você: escolha as que a vaga pede."));
        }

        if (job.idioma() != null && perfil.idioma() != null && job.idioma() != perfil.idioma()) {
            avisos.add(new Aviso(AvisoTipo.IDIOMA_CV, "A vaga está em " + idioma(job.idioma()) + " e o CV em "
                    + idioma(perfil.idioma()) + ". A Gupy recomenda enviar o CV no idioma da vaga."));
        }

        if (perfil.experiencias().isEmpty()) {
            avisos.add(new Aviso(AvisoTipo.SEM_EXPERIENCIA, "Nenhuma experiência com período foi lida do CV, então tempo de "
                    + "experiência, cargo e senioridade ficam sem dado. Escreva cada experiência com cargo, empresa e período "
                    + "(ex.: \"Analista | Empresa (Jan/2022 – Atual)\")."));
        } else {
            List<ExperienciaPerfil> semData = perfil.experiencias().stream().filter(e -> e.intervalo() == null).toList();
            if (!semData.isEmpty()) {
                avisos.add(new Aviso(AvisoTipo.SEM_EXPERIENCIA, Texto.lista(semData.stream().map(ExperienciaPerfil::rotulo).toList())
                        + ": o período não foi entendido, então "
                        + (semData.size() > 1 ? "essas experiências ficam" : "essa experiência fica")
                        + " fora do tempo de experiência. Use \"mm/aaaa\" ou \"Jan/2022 – Atual\"."));
            }
        }

        for (Lacuna l : perfil.lacunas()) {
            String quando = l.ateHoje() ? "desde " + rotuloMes(l.inicio() - 1) + ", quando terminou a última experiência"
                    : "entre " + rotuloMes(l.inicio() - 1) + " e " + rotuloMes(l.fim() + 1);
            avisos.add(new Aviso(AvisoTipo.LACUNA, duracao(l.meses()) + " sem experiência registrada " + quando
                    + ". É só informação, o app não penaliza; mas alguns sistemas usam lacunas de 6 meses ou mais para "
                    + "ranquear (estudo Hidden Workers, Harvard Business School)."));
        }
        return avisos;
    }
}
