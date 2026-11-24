package br.com.atscv.calibracao;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.api.Dtos.Candidatura;
import br.com.atscv.api.Dtos.CandidaturaResumo;
import br.com.atscv.api.Dtos.CvDetalhe;
import br.com.atscv.api.Dtos.Pergunta;
import br.com.atscv.comum.JsRegex;
import br.com.atscv.ranking.Cargos;
import br.com.atscv.ranking.Dicionario;
import br.com.atscv.ranking.LocalParser;
import br.com.atscv.ranking.Lentes;
import br.com.atscv.ranking.Ranking;
import br.com.atscv.ranking.Tipos.Arquivo;
import br.com.atscv.ranking.Tipos.EliminatoriaTipo;
import br.com.atscv.ranking.Tipos.FaixaId;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.RankOptions;
import br.com.atscv.ranking.Tipos.RankingResult;
import br.com.atscv.ranking.Tipos.ReqStatus;
import br.com.atscv.ranking.Tipos.ReqTipo;
import br.com.atscv.ranking.Tipos.RequirementResult;
import br.com.atscv.ranking.Vaga;
import br.com.atscv.servico.CandidaturaServico;
import br.com.atscv.servico.CvServico;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Calibração: compara o que o app previu com o que aconteceu de verdade. Lê as candidaturas do banco, ranqueia cada
 * CV com a vaga e as regras de hoje (sem as edições do usuário) nas quatro lentes e gera um relatório em Markdown.
 */
@Component
public class Calibracao {

    /** A lente que simula a plataforma onde a candidatura foi enviada. */
    static LenteId lenteDaPlataforma(String plataforma) {
        return switch (plataforma == null ? "outra" : plataforma) {
            case "gupy" -> LenteId.GUPY;
            case "linkedin" -> LenteId.LINKEDIN;
            case "workday" -> LenteId.WORKDAY;
            default -> LenteId.NUCLEO;
        };
    }

    /** Uma candidatura avaliada com as regras de hoje. */
    public record Avaliacao(Candidatura caso, String cv, int formato, JobSpec job, Map<LenteId, RankingResult> porLente) {

        LenteId lente() {
            return lenteDaPlataforma(caso.plataforma());
        }

        RankingResult resultado() {
            return porLente.get(lente());
        }
    }

    private static final Map<String, String> NOME_PLATAFORMA = Map.of(
            "gupy", "Gupy", "linkedin", "LinkedIn", "workday", "Workday", "inhire", "InHire", "greenhouse", "Greenhouse",
            "outra", "outra plataforma");
    private static final Map<String, String> NOME_RESULTADO = Map.of(
            "passou_triagem", "passou na triagem", "reprovado", "reprovado", "sem_retorno", "sem retorno");
    private static final List<String> MESES = List.of("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez");

    private record Assunto(EliminatoriaTipo tipo, Pattern re) {}

    /** Palavras que indicam o assunto de uma pergunta do formulário, para comparar com as eliminatórias previstas. */
    private static final List<Assunto> ASSUNTO = List.of(
            new Assunto(EliminatoriaTipo.LOCAL, JsRegex.compilar("\\b(resid\\w*|mora\\w*|cidade|hibrid\\w*|presencia\\w*|deslocamento|escritorio|mudanca)\\b")),
            new Assunto(EliminatoriaTipo.IDIOMA, JsRegex.compilar("\\b(ingles|english|espanhol|idioma|fluente|fluencia)\\b")),
            new Assunto(EliminatoriaTipo.FORMACAO, JsRegex.compilar("\\b(formacao|graduacao|superior|faculdade|curso|semestre|formatura|diploma)\\b")),
            new Assunto(EliminatoriaTipo.DISPONIBILIDADE, JsRegex.compilar(
                    "\\b(disponibilidade|viage\\w*|plantao|sobreaviso|turno\\w*|fins? de semana|finais de semana|inicio imediato)\\b")),
            new Assunto(EliminatoriaTipo.DOCUMENTO, JsRegex.compilar("\\b(cnh|habilitacao|veiculo|autorizacao|visto|passaporte)\\b")),
            new Assunto(EliminatoriaTipo.CERTIFICACAO, JsRegex.compilar("\\b(certificac\\w*|certificad\\w*)\\b")));

    private static final Pattern PONTUACAO_FINAL = Pattern.compile("[.;:,]+$");
    private static final Pattern CAUDA_DO_INDICADOR = Pattern.compile(" da vaga aparecem no CV.*$");

    private static String aspas(String t) {
        return "\"" + PONTUACAO_FINAL.matcher(t).replaceFirst("") + "\"";
    }

    private static String faixaCurta(FaixaId f) {
        return switch (f) {
            case TOP -> "Top fit";
            case MAYBE -> "Maybe";
            case NOT -> "Not fit";
        };
    }

    /** Casos em que a previsão contradiz o que aconteceu: são eles que guiam os ajustes. */
    public static List<String> destaques(Avaliacao a) {
        LenteId lente = a.lente();
        RankingResult r = a.resultado();
        String nome = Lentes.LENTES.get(lente).nome();
        List<String> out = new ArrayList<>();
        if (r.vazio()) {
            out.add("Nenhum requisito foi lido na vaga: confira se o vaga.txt tem o texto completo (às vezes o anúncio é só "
                    + "um modelo, com \"(requirement 1)\").");
            return out;
        }
        if ("passou_triagem".equals(a.caso().resultado()) && r.faixa() == FaixaId.NOT) {
            out.add("Passou na triagem, mas a lente " + nome + " deu \"" + r.lente().rotulo()
                    + "\": confira se os obrigatórios marcados como não atendidos foram lidos certo.");
        }
        if ("reprovado".equals(a.caso().resultado()) && r.faixa() == FaixaId.TOP) {
            out.add("Reprovado, mas a lente " + nome + " deu \"" + r.lente().rotulo() + "\": o corte veio de algo que o app "
                    + "não vê (pergunta do formulário, concorrência, decisão humana) ou de um requisito lido errado.");
        }
        if (!a.caso().perguntas().isEmpty()) {
            Set<EliminatoriaTipo> previstas = new LinkedHashSet<>();
            r.eliminatorias().forEach(e -> previstas.add(e.tipo()));
            List<String> naoPrevistas = new ArrayList<>();
            Set<EliminatoriaTipo> perguntados = new LinkedHashSet<>();
            for (Pergunta p : a.caso().perguntas()) {
                List<EliminatoriaTipo> tipos = ASSUNTO.stream().filter(x -> x.re().matcher(fold(p.pergunta())).find())
                        .map(Assunto::tipo).toList();
                perguntados.addAll(tipos);
                if (!tipos.isEmpty() && tipos.stream().noneMatch(previstas::contains)) naoPrevistas.add(aspas(p.pergunta()));
            }
            if (!naoPrevistas.isEmpty()) out.add("Perguntas que o app não previu: " + String.join("; ", naoPrevistas) + ".");
            List<String> semPergunta = r.eliminatorias().stream().filter(e -> !perguntados.contains(e.tipo()))
                    .map(e -> e.rotulo()).toList();
            if (!semPergunta.isEmpty()) out.add("Previstas que não viraram pergunta: " + String.join("; ", semPergunta) + ".");
        }
        return out;
    }

    private static String resumoDasLentes(Avaliacao a) {
        if (a.porLente().get(LenteId.NUCLEO).vazio()) return "sem requisitos lidos, sem faixa";
        List<String> partes = new ArrayList<>();
        for (LenteId id : Lentes.ORDEM_LENTES) {
            RankingResult r = a.porLente().get(id);
            if (id == LenteId.NUCLEO) partes.add("Núcleo " + faixaCurta(r.faixa()) + " (" + r.numero() + ")");
            else if (id == LenteId.LINKEDIN && r.lente().indicador() != null) {
                partes.add("LinkedIn " + r.lente().rotulo() + ", " + CAUDA_DO_INDICADOR.matcher(r.lente().indicador()).replaceFirst(""));
            } else partes.add(Lentes.LENTES.get(id).nome() + ": " + r.lente().rotulo());
        }
        return String.join(" · ", partes);
    }

    private static String vagaLida(JobSpec job) {
        List<String> partes = new ArrayList<>();
        partes.add(job.titulo() != null ? aspas(job.titulo()) : "sem título reconhecido");
        if (job.familia() != null) partes.add(Cargos.ROTULO_FAMILIA.getOrDefault(job.familia(), job.familia()));
        if (job.senioridade() != null) partes.add(Cargos.ROTULO_SENIORIDADE.get(job.senioridade()));
        if (job.modelo() != null && job.local() != null) {
            partes.add(LocalParser.rotuloModelo(job.modelo()) + " em " + LocalParser.rotuloLocal(job.local()));
        } else if (job.modelo() != null) {
            partes.add(LocalParser.rotuloModelo(job.modelo()));
        } else if (job.local() != null) {
            partes.add(LocalParser.rotuloLocal(job.local()));
        }
        return String.join(" · ", partes);
    }

    private static String nomeDoCaso(Candidatura c) {
        if (c.origem() != null) return c.origem();
        return (c.mes() == null ? "" : c.mes() + "-") + (c.plataforma() == null ? "" : c.plataforma() + "-")
                + (c.empresa() == null ? "" : c.empresa()) + (c.cargo() == null ? "" : "-" + c.cargo().replace(' ', '-'));
    }

    private static List<String> secaoDoCaso(Avaliacao a) {
        Candidatura caso = a.caso();
        RankingResult r = a.resultado();
        String lente = Lentes.LENTES.get(a.lente()).nome();
        List<RequirementResult> obrig = r.requisitos().stream().filter(x -> x.requisito().tipo() == ReqTipo.OBRIGATORIO).toList();
        String quando = "";
        if (caso.mes() != null) {
            String[] ym = caso.mes().split("-");
            String dia = caso.data() != null ? Integer.parseInt(caso.data().substring(8)) + "/" : "";
            quando = dia + MESES.get(Integer.parseInt(ym[1]) - 1) + "/" + ym[0];
        }
        List<String> real = new ArrayList<>();
        if (caso.resultado() != null) real.add(NOME_RESULTADO.get(caso.resultado()));
        if (caso.plataforma() != null) real.add(NOME_PLATAFORMA.get(caso.plataforma()));
        if (!quando.isEmpty()) real.add(quando);
        if (caso.etapa() != null) real.add("etapa: " + caso.etapa());
        if (caso.diasAteResposta() != null) {
            real.add("resposta em " + caso.diasAteResposta() + " dia" + (caso.diasAteResposta() == 1 ? "" : "s"));
        }
        List<String> linhas = new ArrayList<>();
        linhas.add("### " + nomeDoCaso(caso));
        linhas.add("");
        linhas.add("- **Real:** " + String.join(" · ", real));
        linhas.add("- **CV:** " + a.cv() + " (formato " + a.formato() + "/100)");
        linhas.add("- **Vaga lida:** " + vagaLida(a.job()));
        linhas.add("- **App:** " + resumoDasLentes(a));
        lista(linhas, "Obrigatórios não atendidos", lente,
                obrig.stream().filter(x -> x.status() == ReqStatus.NAO_ATENDE).map(x -> aspas(x.requisito().texto())).toList());
        lista(linhas, "Obrigatórios parciais ou \"?\"", lente, obrig.stream()
                .filter(x -> x.status() == ReqStatus.PARCIAL || x.status() == ReqStatus.NAO_VERIFICAVEL)
                .map(x -> aspas(x.requisito().texto())).toList());
        if (!a.job().termosNaoReconhecidos().isEmpty()) {
            linhas.add("- **Termos fora do dicionário:** " + String.join(", ", a.job().termosNaoReconhecidos()));
        }
        if (!r.eliminatorias().isEmpty()) {
            linhas.add("- **Perguntas previstas:** " + String.join("; ", r.eliminatorias().stream().map(e -> e.rotulo()).toList()));
        }
        if (!caso.perguntas().isEmpty()) {
            linhas.add("- **Perguntas reais:** " + String.join("; ", caso.perguntas().stream()
                    .map(p -> aspas(p.pergunta()) + " → " + (p.resposta().isEmpty() ? "?" : p.resposta())).toList()));
        }
        if (caso.observacoes() != null) linhas.add("- **Observações:** " + caso.observacoes());
        for (String d : destaques(a)) linhas.add("- ⚠ " + d);
        linhas.add("");
        return linhas;
    }

    private static void lista(List<String> linhas, String titulo, String lente, List<String> itens) {
        if (!itens.isEmpty()) linhas.add("- **" + titulo + "** (lente " + lente + "): " + String.join("; ", itens));
    }

    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Relatório de calibração em Markdown. */
    public static String gerarRelatorio(List<Avaliacao> avaliacoes, LocalDate geradoEm) {
        long conhecidos = avaliacoes.stream()
                .filter(a -> a.caso().resultado() != null && !a.caso().resultado().equals("sem_retorno")).count();
        List<String> linhas = new ArrayList<>();
        linhas.add("# Relatório de calibração");
        linhas.add("");
        linhas.add("Gerado em " + DATA_BR.format(geradoEm) + " por `calibrar`, com " + avaliacoes.size() + " candidatura"
                + (avaliacoes.size() == 1 ? "" : "s") + " (" + conhecidos + " com resultado conhecido). "
                + "Cada caso é lido na lente da plataforma em que foi enviado.");
        linhas.add("");
        if (avaliacoes.size() < 20) {
            linhas.add("> Com menos de 20 casos, o relatório serve para achar erros de leitura e de regra, não para medir "
                    + "acerto (seção 10 do plano).");
            linhas.add("");
        }

        linhas.add("## Resumo");
        linhas.add("");
        linhas.add("| Resultado real | Top fit | Maybe | Not fit | Sem requisitos lidos |");
        linhas.add("|---|---|---|---|---|");
        for (String res : List.of("passou_triagem", "reprovado", "sem_retorno")) {
            List<Avaliacao> casos = avaliacoes.stream().filter(a -> res.equals(a.caso().resultado())).toList();
            List<Avaliacao> comFaixa = casos.stream().filter(a -> !a.resultado().vazio()).toList();
            Map<FaixaId, Long> conta = new EnumMap<>(FaixaId.class);
            for (FaixaId f : FaixaId.values()) {
                conta.put(f, comFaixa.stream().filter(a -> a.resultado().faixa() == f).count());
            }
            linhas.add("| " + NOME_RESULTADO.get(res) + " (" + casos.size() + ") | " + conta.get(FaixaId.TOP) + " | "
                    + conta.get(FaixaId.MAYBE) + " | " + conta.get(FaixaId.NOT) + " | " + (casos.size() - comFaixa.size()) + " |");
        }
        linhas.add("");
        linhas.add("Faixa pela regra do núcleo, com as fontes do CV e as regras da lente de cada plataforma.");
        linhas.add("");

        List<Avaliacao> revisar = avaliacoes.stream().filter(a -> !destaques(a).isEmpty()).toList();
        linhas.add("## Para revisar");
        linhas.add("");
        if (!revisar.isEmpty()) {
            for (Avaliacao a : revisar) linhas.add("- **" + nomeDoCaso(a.caso()) + "**: " + String.join(" ", destaques(a)));
        } else {
            linhas.add("Nenhum caso em que a previsão contradiz o resultado.");
        }
        linhas.add("");

        linhas.add("## Casos");
        linhas.add("");
        for (Avaliacao a : avaliacoes) linhas.addAll(secaoDoCaso(a));
        return String.join("\n", linhas).stripTrailing() + "\n";
    }

    private final CandidaturaServico candidaturas;
    private final CvServico cvs;
    private final Clock clock;

    public Calibracao(CandidaturaServico candidaturas, CvServico cvs, Clock clock) {
        this.candidaturas = candidaturas;
        this.cvs = cvs;
        this.clock = clock;
    }

    /** Avalia todas as candidaturas guardadas com as regras de hoje, nas quatro lentes. */
    public List<Avaliacao> avaliar() {
        Dicionario dict = Dicionario.padrao();
        List<Avaliacao> out = new ArrayList<>();
        List<CandidaturaResumo> todas = candidaturas.listar();
        // Do mais antigo para o mais novo, como no relatório original (ordenado pelo nome da pasta).
        for (CandidaturaResumo resumo : todas.stream().sorted((x, y) -> Long.compare(x.id(), y.id())).toList()) {
            Candidatura c = candidaturas.obter(resumo.id());
            CvDetalhe cv = cvs.detalhe(c.cvId());
            JobSpec job = Vaga.parseJob(c.vagaTexto(), dict);
            Arquivo arquivo = new Arquivo(cv.analise().formatScore() == 0, cv.analise().exportLinkedin());
            Map<LenteId, RankingResult> porLente = new EnumMap<>(LenteId.class);
            for (LenteId id : Lentes.ORDEM_LENTES) {
                porLente.put(id, Ranking.rank(cv.analise().structured(), job,
                        new RankOptions(0.5, Map.of(), List.of(), Map.of(), LocalDate.now(clock), id, arquivo), dict));
            }
            out.add(new Avaliacao(c, cv.cv().nomeArquivo() + " (" + cv.cv().sha256().substring(0, 8) + ")",
                    cv.analise().formatScore(), job, porLente));
        }
        return out;
    }

    public String relatorio() {
        return gerarRelatorio(avaliar(), LocalDate.now(clock));
    }
}
