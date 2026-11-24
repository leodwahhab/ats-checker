package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.JsRegex;
import br.com.atscv.ranking.Tipos.Alerta;
import br.com.atscv.ranking.Tipos.Arquivo;
import br.com.atscv.ranking.Tipos.ComponentResult;
import br.com.atscv.ranking.Tipos.CompSkill;
import br.com.atscv.ranking.Tipos.CvProfile;
import br.com.atscv.ranking.Tipos.Eliminatoria;
import br.com.atscv.ranking.Tipos.Evidence;
import br.com.atscv.ranking.Tipos.FaixaId;
import br.com.atscv.ranking.Tipos.FonteDoc;
import br.com.atscv.ranking.Tipos.FonteEvidencia;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.LensConfig;
import br.com.atscv.ranking.Tipos.NotaWorkday;
import br.com.atscv.ranking.Tipos.ReqStatus;
import br.com.atscv.ranking.Tipos.ReqTipo;
import br.com.atscv.ranking.Tipos.RequirementResult;
import br.com.atscv.ranking.Tipos.ResultadoLente;
import br.com.atscv.ranking.Tipos.Senioridade;
import br.com.atscv.ranking.Tipos.Tom;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** As quatro lentes (núcleo, Gupy, LinkedIn, Workday): como cada plataforma apresentaria o resultado. */
public final class Lentes {
    private Lentes() {}

    public static final String VERIFICADO_EM;
    public static final Map<String, FonteDoc> FONTES;
    public static final Map<LenteId, LensConfig> LENTES;

    static {
        try (InputStream in = Lentes.class.getResourceAsStream("/ranking/lentes.json")) {
            JsonMapper mapper = JsonMapper.builder().build();
            JsonNode raiz = mapper.readTree(in);
            VERIFICADO_EM = raiz.get("VERIFICADO_EM").asString();
            FONTES = mapper.readValue(raiz.get("FONTES").toString(), new TypeReference<LinkedHashMap<String, FonteDoc>>() {});
            Map<String, LensConfig> porNome = mapper.readValue(raiz.get("LENTES").toString(),
                    new TypeReference<LinkedHashMap<String, LensConfig>>() {});
            Map<LenteId, LensConfig> lentes = new LinkedHashMap<>();
            for (LensConfig c : porNome.values()) lentes.put(c.id(), c);
            LENTES = lentes;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static FonteDoc f(String nome) {
        return FONTES.get(nome);
    }

    public static final List<LenteId> ORDEM_LENTES = List.of(LenteId.NUCLEO, LenteId.GUPY, LenteId.LINKEDIN, LenteId.WORKDAY);

    private static String rotulo(LensConfig lente, FaixaId faixa) {
        return lente.rotulos().get(faixa.json());
    }

    private static Tom tom(FaixaId f) {
        return switch (f) {
            case TOP -> Tom.TOP;
            case MAYBE -> Tom.MAYBE;
            case NOT -> Tom.NOT;
        };
    }

    /** Peso nas contagens do Workday: parcial vale meio; "?" não conta. */
    private static Double cobertura(List<RequirementResult> rs) {
        if (rs.isEmpty()) return null;
        double soma = 0;
        for (RequirementResult r : rs) soma += Faixa.peso(r.status());
        return soma / rs.size();
    }

    /**
     * Nota do HiredScore no algoritmo legado: A = todos os obrigatórios e a maioria dos desejáveis; B = todos os
     * obrigatórios; C = a maioria dos obrigatórios; D = metade ou menos.
     */
    public static NotaWorkday notaWorkday(List<RequirementResult> rs) {
        List<RequirementResult> obrig = rs.stream().filter(r -> r.requisito().tipo() == ReqTipo.OBRIGATORIO).toList();
        Double desej = cobertura(rs.stream().filter(r -> r.requisito().tipo() == ReqTipo.DESEJAVEL).toList());
        if (obrig.stream().allMatch(r -> r.status() == ReqStatus.ATENDE)) {
            return desej == null || desej > 0.5 ? NotaWorkday.A : NotaWorkday.B;
        }
        Double co = cobertura(obrig);
        return (co == null ? 0 : co) > 0.5 ? NotaWorkday.C : NotaWorkday.D;
    }

    private static String significado(NotaWorkday n) {
        return switch (n) {
            case A -> "todos os obrigatórios e a maioria dos desejáveis";
            case B -> "todos os obrigatórios, mas não a maioria dos desejáveis";
            case C -> "a maioria dos obrigatórios, mas não todos";
            case D -> "metade dos obrigatórios ou menos";
        };
    }

    private static Tom tomDaNota(NotaWorkday n) {
        return switch (n) {
            case A -> Tom.TOP;
            case B, C -> Tom.MAYBE;
            case D -> Tom.NOT;
        };
    }

    private static final Pattern FIM_DE_PONTUACAO = Pattern.compile("[.;:,]+$");

    private static String rotuloDaFonte(FonteEvidencia f) {
        return switch (f) {
            case RESUMO -> "Resumo";
            case CABECALHO -> "Cabeçalho";
            case CERTIFICACOES -> "Certificações";
            case PROJETOS -> "Projetos";
            default -> null;
        };
    }

    /** Os primeiros requisitos entre aspas, sem a pontuação final da linha. */
    private static String citar(List<RequirementResult> rs) {
        List<String> aspas = rs.stream().limit(3)
                .map(r -> "\"" + FIM_DE_PONTUACAO.matcher(r.requisito().texto()).replaceFirst("") + "\"").toList();
        return Texto.lista(aspas) + (rs.size() > 3 ? " e mais " + (rs.size() - 3) : "");
    }

    /**
     * @param faixa faixa pela regra do núcleo, com as fontes do CV que a lente aceita
     * @param requisitosTodasFontes os mesmos requisitos com todas as seções do CV, para mostrar o que a lente deixa de ver
     */
    public record EntradaLente(
            LensConfig lente, FaixaId faixa, List<RequirementResult> requisitos, List<RequirementResult> requisitosTodasFontes,
            JobSpec job, CvProfile perfil, List<Eliminatoria> recusadas, Arquivo arquivo, boolean vazio) {}

    /**
     * @param faixa a faixa depois das regras da lente (o LinkedIn limita vaga de outro país a Maybe)
     * @param comoMelhorar o que a lente acrescenta a "o que impede um resultado melhor"
     */
    public record SaidaLente(ResultadoLente resultado, FaixaId faixa, List<String> comoMelhorar) {}

    /** Montador do resultado de uma lente: o que muda de uma plataforma para outra. */
    private static final class Resultado {
        final LensConfig lente;
        String rotulo;
        Tom tom;
        NotaWorkday nota;
        String indicador;
        final List<Alerta> alertas = new ArrayList<>();

        Resultado(LensConfig lente, FaixaId faixa) {
            this.lente = lente;
            this.rotulo = rotulo(lente, faixa);
            this.tom = tom(faixa);
        }

        void alerta(String texto, FonteDoc fonte) {
            alertas.add(new Alerta(texto, fonte));
        }

        ResultadoLente pronto() {
            return new ResultadoLente(lente.id(), lente.nome(), lente.descricao(), rotulo, tom, nota, indicador, lente.fontes(),
                    alertas, lente.notas(), lente.aproximacoes(), lente.documentacao());
        }
    }

    /** Aplica as particularidades de uma plataforma ao resultado do núcleo. */
    public static SaidaLente aplicarLente(EntradaLente e) {
        Resultado r = new Resultado(e.lente(), e.faixa());
        return switch (e.lente().id()) {
            case GUPY -> gupy(e, r);
            case LINKEDIN -> linkedin(e, r);
            case WORKDAY -> workday(e, r);
            case NUCLEO -> new SaidaLente(r.pronto(), e.faixa(), List.of());
        };
    }

    private static SaidaLente gupy(EntradaLente e, Resultado r) {
        List<RequirementResult> naoAtendidos = e.requisitos().stream()
                .filter(x -> x.requisito().tipo() == ReqTipo.OBRIGATORIO && x.status() == ReqStatus.NAO_ATENDE).toList();
        if (!e.recusadas().isEmpty()) {
            r.alerta("Você respondeu “não” a uma pergunta eliminatória: na Gupy, a eliminação automática acontece justamente "
                    + "nas perguntas eliminatórias que a empresa cadastra.", f("gupyOrdenacao"));
        }
        if (!naoAtendidos.isEmpty()) {
            r.alerta("Obrigatório sem comprovação no CV: " + citar(naoAtendidos) + ". Se a empresa definiu o requisito como "
                    + "obrigatório na Gupy, a reprovação é automática; sem isso, ele só pesa na ordenação.", f("gupyAlgoritmo"));
        }
        // O que o núcleo encontra no CV, mas fora dos campos que a Gupy usa.
        List<RequirementResult> perdidos = new ArrayList<>();
        for (int i = 0; i < e.requisitos().size(); i++) {
            RequirementResult x = e.requisitos().get(i);
            if (Avaliar.ordem(x.status()) > Avaliar.ordem(e.requisitosTodasFontes().get(i).status())
                    && x.requisito().tipo() != ReqTipo.INFORMATIVO) {
                perdidos.add(x);
            }
        }
        if (!perdidos.isEmpty()) {
            Set<String> onde = new LinkedHashSet<>();
            for (RequirementResult x : perdidos) {
                for (Evidence ev : e.requisitosTodasFontes().get(e.requisitos().indexOf(x)).evidencias()) {
                    String rotulo = rotuloDaFonte(ev.fonte());
                    if (rotulo != null) onde.add(rotulo);
                }
            }
            r.alerta(citar(perdidos) + ": o CV comprova só em " + Texto.lista(new ArrayList<>(onde)) + ", "
                    + (onde.size() > 1 ? "seções" : "seção")
                    + " que a ordenação da Gupy não usa. Cite também em Experiência ou Habilidades.", f("gupyOrdenacao"));
        }
        if (e.arquivo().exportLinkedin()) {
            r.alerta("O PDF é um export do LinkedIn, formato que a Gupy diz ler melhor. O score de formato continua apontando "
                    + "as duas colunas, porque outros parsers sofrem com elas.", f("gupyPreenchimento"));
        }
        return new SaidaLente(r.pronto(), e.faixa(), List.of());
    }

    private record Item(boolean atende, boolean explicita) {}

    /** "x de y skills": cada skill pedida (ou grupo de alternativas) conta uma vez. */
    private static int[] skillsEmComum(List<RequirementResult> rs) {
        Map<String, Item> itens = new LinkedHashMap<>();
        for (RequirementResult r : rs) {
            if (r.requisito().tipo() == ReqTipo.INFORMATIVO) continue;
            for (int i = 0; i < r.requisito().componentes().size(); i++) {
                if (!(r.requisito().componentes().get(i) instanceof CompSkill c)) continue;
                String[] ids = c.ids().toArray(String[]::new);
                Arrays.sort(ids);
                String chave = String.join("|", ids);
                ComponentResult res = r.componentes().get(i);
                Item atual = itens.getOrDefault(chave, new Item(false, false));
                boolean atende = res.status() == ReqStatus.ATENDE;
                itens.put(chave, new Item(atual.atende() || atende,
                        atual.explicita() || (atende && res.evidencias().stream().anyMatch(Evidence::explicita))));
            }
        }
        int atende = 0;
        int explicitas = 0;
        for (Item v : itens.values()) {
            if (v.atende()) atende++;
            if (v.explicita()) explicitas++;
        }
        return new int[] {itens.size(), atende, explicitas};
    }

    private static SaidaLente linkedin(EntradaLente e, Resultado r) {
        int[] s = skillsEmComum(e.requisitos());
        if (s[0] > 0) {
            r.indicador = s[1] + " de " + s[0] + " skills da vaga aparecem no CV (" + s[2] + " na seção Habilidades)";
        }
        FaixaId faixa = e.faixa();
        List<String> comoMelhorar = new ArrayList<>();
        String pais = e.job().pais();
        if (pais != null && !pais.isEmpty() && !fold(pais).equals("brasil")) {
            if (faixa == FaixaId.TOP) {
                faixa = FaixaId.MAYBE;
                comoMelhorar.add("Vaga em outro país (" + pais + "): no LinkedIn, o máximo é Maybe");
            }
            r.alerta("A vaga é em " + pais + ": no LinkedIn, quem é de outro país fica no máximo em Maybe. "
                    + "O app considera que você está no Brasil.", f("linkedinHiringPro"));
        }
        if (!e.recusadas().isEmpty()) {
            r.alerta("Você respondeu “não” a uma pergunta eliminatória: no LinkedIn, perguntas de triagem marcadas como "
                    + "obrigatórias podem arquivar a candidatura e enviar a rejeição automaticamente.", f("linkedinTriagem"));
        }
        r.rotulo = rotulo(e.lente(), faixa);
        r.tom = tom(faixa);
        return new SaidaLente(r.pronto(), faixa, comoMelhorar);
    }

    /** Vaga de estágio, trainee ou programa de graduação: no HiredScore, requisição de campus fica sem nota. */
    private static final Pattern CAMPUS = JsRegex.compilar(
            "\\b(estagio|estagiari[oa]|intern(ship)?|trainee|jovem aprendiz|graduate program|campus)\\b");

    private static SaidaLente workday(EntradaLente e, Resultado r) {
        NotaWorkday nota = notaWorkday(e.requisitos());
        String seria = "Se tivesse nota, seria " + nota + " (" + significado(nota) + ").";
        boolean campus = e.job().senioridade() == Senioridade.ESTAGIO
                || CAMPUS.matcher(fold(e.job().titulo() == null ? "" : e.job().titulo())).find();
        String semNota = null;
        if (e.arquivo().semTexto()) {
            semNota = "O currículo não pôde ser lido: o HiredScore não dá nota quando não processa o currículo.";
        } else if (e.vazio()) {
            semNota = "A vaga não tem requisitos lidos: o HiredScore não dá nota a vaga sem descrição.";
        } else if (campus) {
            semNota = "Vaga de estágio ou trainee: requisições de campus/graduate ficam sem nota no HiredScore. " + seria;
        }

        if (semNota != null) {
            r.alerta(semNota, f("workdaySpotlight"));
            r.rotulo = "Sem nota";
            r.tom = Tom.NEUTRO;
            return new SaidaLente(r.pronto(), e.faixa(), List.of());
        }
        if (!e.recusadas().isEmpty()) {
            // Regra do app: "não" numa eliminatória é o pior resultado em todas as lentes.
            r.alerta("Você respondeu “não” a uma pergunta eliminatória: a candidatura tende a ser reprovada antes da nota. "
                    + seria, null);
            r.rotulo = "Reprovado na triagem";
            r.tom = Tom.NOT;
            r.nota = nota;
            return new SaidaLente(r.pronto(), e.faixa(), List.of());
        }
        r.alerta("Nota " + nota + ": " + significado(nota) + ".", f("workdayNotas"));
        r.rotulo = "Nota " + nota;
        r.tom = tomDaNota(nota);
        r.nota = nota;
        return new SaidaLente(r.pronto(), e.faixa(), List.of());
    }

}
