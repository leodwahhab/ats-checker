package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.ranking.Cargos.Comparacao;
import br.com.atscv.ranking.Tipos.CvProfile;
import br.com.atscv.ranking.Tipos.Dimensao;
import br.com.atscv.ranking.Tipos.DimensaoId;
import br.com.atscv.ranking.Tipos.ExperienciaPerfil;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.Modelo;
import br.com.atscv.ranking.Tipos.ReqStatus;
import br.com.atscv.ranking.Tipos.Senioridade;
import java.util.List;
import java.util.Objects;

/** Dimensões do número secundário. Sem dado de um dos lados, a dimensão sai do número. */
public final class Dimensoes {
    private Dimensoes() {}

    public static List<Dimensao> calcularDimensoes(CvProfile perfil, JobSpec job) {
        return List.of(cargo(perfil, job), senioridade(perfil, job), local(perfil, job));
    }

    private static String familia(String id) {
        String r = Cargos.ROTULO_FAMILIA.get(id);
        return r != null ? r : id;
    }

    private static ReqStatus status(Comparacao c) {
        return switch (c) {
            case ATENDE -> ReqStatus.ATENDE;
            case PARCIAL -> ReqStatus.PARCIAL;
            case NAO_ATENDE -> ReqStatus.NAO_ATENDE;
        };
    }

    private static Dimensao cargo(CvProfile perfil, JobSpec job) {
        if (job.familia() == null) {
            return d(DimensaoId.CARGO, "Cargo", 10, ReqStatus.NAO_VERIFICAVEL,
                    "A vaga não deixa claro a área do cargo (título ausente ou genérico).");
        }
        String cv = perfil.atual().familia();
        if (cv == null) {
            return d(DimensaoId.CARGO, "Cargo", 10, ReqStatus.NAO_VERIFICAVEL,
                    "Não deu para identificar a área do seu cargo atual no CV.");
        }
        ExperienciaPerfil exp = perfil.atual().experiencia();
        String onde = exp != null && exp.familia() != null ? exp.cargo() + " · " + exp.rotulo() : "cabeçalho do CV";
        ReqStatus status = status(Cargos.compararFamilia(cv, job.familia()));
        String motivo = "Seu cargo atual é de " + familia(cv) + " (" + onde + "); a vaga é de " + familia(job.familia()) + ".";
        if (status == ReqStatus.NAO_ATENDE) {
            // Uma experiência anterior na área conta como parcial.
            ExperienciaPerfil anterior = perfil.experiencias().stream()
                    .filter(e -> e != exp && e.familia() != null
                            && Cargos.compararFamilia(e.familia(), job.familia()) != Comparacao.NAO_ATENDE)
                    .findFirst().orElse(null);
            if (anterior != null) {
                status = ReqStatus.PARCIAL;
                motivo += " Você já atuou na área: " + anterior.cargo() + " (" + anterior.rotulo() + ").";
            }
        }
        return d(DimensaoId.CARGO, "Cargo", 10, status, motivo);
    }

    private static Dimensao senioridade(CvProfile perfil, JobSpec job) {
        if (job.senioridade() == null) {
            return d(DimensaoId.SENIORIDADE, "Senioridade", 10, ReqStatus.NAO_VERIFICAVEL, "A vaga não informa a senioridade.");
        }
        Senioridade cv = perfil.atual().senioridade();
        if (cv == null) {
            return d(DimensaoId.SENIORIDADE, "Senioridade", 10, ReqStatus.NAO_VERIFICAVEL,
                    "Não deu para identificar a sua senioridade no CV: nem no cargo, nem no cabeçalho, nem pelo tempo de experiência.");
        }
        int diferenca = Cargos.ORDEM_SENIORIDADE.indexOf(cv) - Cargos.ORDEM_SENIORIDADE.indexOf(job.senioridade());
        ReqStatus status = diferenca >= 0 ? ReqStatus.ATENDE : diferenca == -1 ? ReqStatus.PARCIAL : ReqStatus.NAO_ATENDE;
        Tipos.FonteSenioridade fs = perfil.atual().fonteSenioridade();
        String fonte = fs == Tipos.FonteSenioridade.CARGO
                ? "pelo cargo \"" + (perfil.atual().experiencia() == null ? null : perfil.atual().experiencia().cargo()) + "\""
                : fs == Tipos.FonteSenioridade.CABECALHO ? "pelo cabeçalho do CV"
                        : "por " + Datas.duracao(perfil.mesesTotais())
                                + " de experiência, estágio incluído (aproximação: júnior até 2 anos, pleno até 5)";
        return d(DimensaoId.SENIORIDADE, "Senioridade", 10, status, "Seu CV indica " + Cargos.ROTULO_SENIORIDADE.get(cv)
                + " (" + fonte + "); a vaga é " + Cargos.ROTULO_SENIORIDADE.get(job.senioridade()) + ".");
    }

    private static Dimensao local(CvProfile perfil, JobSpec job) {
        if (job.modelo() == Modelo.REMOTO) return d(DimensaoId.LOCAL, "Local e modelo", 5, ReqStatus.ATENDE, "A vaga é remota.");
        if (job.local() == null) {
            return d(DimensaoId.LOCAL, "Local e modelo", 5, ReqStatus.NAO_VERIFICAVEL,
                    job.modelo() != null ? "A vaga é " + LocalParser.rotuloModeloVaga(job.modelo()) + " e não informa o local."
                            : "A vaga não informa local nem modelo de trabalho.");
        }
        String vaga = job.modelo() != null
                ? "A vaga é " + LocalParser.rotuloModeloVaga(job.modelo()) + " em " + LocalParser.rotuloLocal(job.local())
                : "A vaga é em " + LocalParser.rotuloLocal(job.local()) + " (modelo de trabalho não informado)";
        if (perfil.local() == null) {
            return d(DimensaoId.LOCAL, "Local e modelo", 5, ReqStatus.NAO_VERIFICAVEL,
                    vaga + ", mas o CV não tem cidade e UF legíveis (ex.: \"Osasco - SP\").");
        }
        String cv = LocalParser.rotuloLocal(perfil.local());
        // Mesma UF atende, com ou sem a mesma cidade.
        if (!Objects.equals(perfil.local().uf(), job.local().uf())) {
            return d(DimensaoId.LOCAL, "Local e modelo", 5, ReqStatus.NAO_ATENDE, vaga + "; o CV diz " + cv + ".");
        }
        boolean mesmaCidade = job.local().cidade() == null || job.local().cidade().isEmpty()
                || fold(perfil.local().cidade() == null ? "" : perfil.local().cidade()).equals(fold(job.local().cidade()));
        return d(DimensaoId.LOCAL, "Local e modelo", 5, ReqStatus.ATENDE, vaga + "; o CV diz " + cv + (mesmaCidade ? "" : " (mesma UF)") + ".");
    }

    private static Dimensao d(DimensaoId id, String rotulo, int peso, ReqStatus status, String motivo) {
        return new Dimensao(id, rotulo, peso, status, motivo);
    }
}
