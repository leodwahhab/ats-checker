package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.JsRegex;
import br.com.atscv.comum.Normalizar;
import br.com.atscv.formato.Modelos.Structured;
import br.com.atscv.ranking.Avaliar.OpcoesAvaliacao;
import br.com.atscv.ranking.Dicionario.SkillDef;
import br.com.atscv.ranking.Lentes.EntradaLente;
import br.com.atscv.ranking.Lentes.SaidaLente;
import br.com.atscv.ranking.Tipos.Arquivo;
import br.com.atscv.ranking.Tipos.CompCargo;
import br.com.atscv.ranking.Tipos.CompFormacao;
import br.com.atscv.ranking.Tipos.CompIdioma;
import br.com.atscv.ranking.Tipos.CompNaoReconhecido;
import br.com.atscv.ranking.Tipos.CompSkill;
import br.com.atscv.ranking.Tipos.Component;
import br.com.atscv.ranking.Tipos.CvProfile;
import br.com.atscv.ranking.Tipos.Dimensao;
import br.com.atscv.ranking.Tipos.Eliminatoria;
import br.com.atscv.ranking.Tipos.EliminatoriaResult;
import br.com.atscv.ranking.Tipos.EliminatoriaTipo;
import br.com.atscv.ranking.Tipos.ExperienciaLida;
import br.com.atscv.ranking.Tipos.FonteEvidencia;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.LensConfig;
import br.com.atscv.ranking.Tipos.ModoSkill;
import br.com.atscv.ranking.Tipos.RankOptions;
import br.com.atscv.ranking.Tipos.RankingResult;
import br.com.atscv.ranking.Tipos.ReqOrigem;
import br.com.atscv.ranking.Tipos.ReqTipo;
import br.com.atscv.ranking.Tipos.ReqTipoFonte;
import br.com.atscv.ranking.Tipos.Requirement;
import br.com.atscv.ranking.Tipos.RequirementResult;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Ponto de entrada do ranqueamento: avalia o CV contra a vaga e edita a leitura da vaga. */
public final class Ranking {
    private Ranking() {}

    private static final Pattern PEDE = Pattern.compile("; a vaga pede .*$");

    /** Opções padrão: núcleo, 50% dos desejáveis, sem respostas. */
    public static RankOptions opcoesPadrao(java.time.LocalDate hoje) {
        return new RankOptions(0.5, Map.of(), List.of(), Map.of(), hoje, LenteId.NUCLEO, new Arquivo(false, false));
    }

    public static RankingResult rank(Structured structured, JobSpec job, RankOptions op, Dicionario dict) {
        CvProfile perfil = Perfil.buildCvProfile(structured, dict, op.hoje() != null ? op.hoje() : java.time.LocalDate.now());
        LensConfig lente = Lentes.LENTES.get(op.lente() != null ? op.lente() : LenteId.NUCLEO);
        Map<String, Boolean> declarados = op.declarados() != null ? op.declarados() : Map.of();
        Map<String, Boolean> respostas = op.respostas() != null ? op.respostas() : Map.of();
        Arquivo arquivo = op.arquivo() != null ? op.arquivo() : new Arquivo(false, false);

        java.util.function.Function<Set<FonteEvidencia>, List<RequirementResult>> avaliar = fontes -> {
            List<RequirementResult> out = new ArrayList<>();
            for (Requirement r : job.requisitos()) {
                out.add(Avaliar.avaliarRequisito(r, perfil, dict, new OpcoesAvaliacao(fontes, declarados.get(r.id()))));
            }
            return out;
        };
        // A lente da Gupy só aceita evidência de Experiência e Habilidades (mais formação e idiomas).
        Set<FonteEvidencia> fontes = lente.fontes() == null ? null : EnumSet.copyOf(lente.fontes());
        List<RequirementResult> requisitos = avaliar.apply(fontes);

        List<Eliminatoria> todas = new ArrayList<>(job.eliminatorias());
        todas.addAll(Condicoes.eliminatoriasDosRequisitos(job));
        List<EliminatoriaResult> eliminatorias = new ArrayList<>();
        for (Eliminatoria e : todas) {
            eliminatorias.add(new EliminatoriaResult(e.id(), e.tipo(), e.rotulo(), e.trecho(), e.requisitoId(),
                    respostas.get(e.id()), noCv(e, perfil, requisitos)));
        }
        List<Dimensao> dimensoes = Dimensoes.calcularDimensoes(perfil, job);
        List<Eliminatoria> recusadas = new ArrayList<>();
        for (Eliminatoria e : todas) if (Boolean.FALSE.equals(respostas.get(e.id()))) recusadas.add(e);
        var nucleo = Faixa.calcularFaixa(requisitos, op.limiarDesejaveis(), dimensoes, recusadas);
        SaidaLente saida = Lentes.aplicarLente(new EntradaLente(lente, nucleo.faixa(), requisitos,
                fontes != null ? avaliar.apply(null) : requisitos, job, perfil, recusadas, arquivo, nucleo.vazio()));

        List<String> comoMelhorar = new ArrayList<>(saida.comoMelhorar());
        comoMelhorar.addAll(nucleo.comoMelhorar());
        int comData = (int) perfil.experiencias().stream().filter(e -> e.intervalo() != null).count();
        return new RankingResult(saida.faixa(), saida.resultado().rotulo(), nucleo.numero(), nucleo.resumo(),
                comoMelhorar.subList(0, Math.min(5, comoMelhorar.size())), requisitos, nucleo.cobertura(), nucleo.vazio(),
                !job.temSecoes() && !job.requisitos().isEmpty(), dimensoes, eliminatorias,
                Avisos.calcularAvisos(perfil, job, requisitos, dict),
                new ExperienciaLida(perfil.mesesTotais(), perfil.mesesEstagio(), comData, perfil.experiencias().size() - comData),
                saida.resultado());
    }

    private static String tipoDoComponente(Component c) {
        return switch (c) {
            case CompSkill s -> "skill";
            case Tipos.CompAnos a -> "anos";
            case CompFormacao f -> "formacao";
            case CompIdioma i -> "idioma";
            case CompCargo g -> "cargo";
            case CompNaoReconhecido n -> "nao_reconhecido";
        };
    }

    /** O que o CV mostra sobre o assunto de uma eliminatória, para o usuário responder com o CV à vista. */
    private static String noCv(Eliminatoria e, CvProfile perfil, List<RequirementResult> requisitos) {
        if (e.tipo() == EliminatoriaTipo.LOCAL) {
            return perfil.local() != null ? "No CV: " + LocalParser.rotuloLocal(perfil.local())
                    : "O CV não tem cidade e UF legíveis";
        }
        RequirementResult r = requisitos.stream().filter(x -> x.requisito().id().equals(e.requisitoId())).findFirst().orElse(null);
        if (r == null) return null;
        String tipo = e.tipo().json();
        int i = -1;
        List<Component> comps = r.requisito().componentes();
        for (int k = 0; k < comps.size(); k++) {
            if (tipoDoComponente(comps.get(k)).equals(tipo)) {
                i = k;
                break;
            }
        }
        // A pergunta já diz o que a vaga pede: fica só o que o CV mostra.
        return PEDE.matcher(i >= 0 ? r.componentes().get(i).motivo() : r.motivo()).replaceFirst("");
    }

    // ---------- Edições do usuário (só em memória) ----------

    private static JobSpec comRequisitos(JobSpec j, List<Requirement> requisitos, List<String> termos) {
        return new JobSpec(j.titulo(), j.familia(), j.senioridade(), j.temSecoes(), requisitos, j.naoAvaliaveis(), termos,
                j.modelo(), j.local(), j.eliminatorias(), j.afirmativa(), j.idioma(), j.pais());
    }

    public static JobSpec alterarTipo(JobSpec job, String id, ReqTipo tipo) {
        List<Requirement> rs = new ArrayList<>();
        for (Requirement r : job.requisitos()) {
            rs.add(r.id().equals(id) ? new Requirement(r.id(), r.texto(), tipo, ReqTipoFonte.USUARIO, r.origem(), r.componentes()) : r);
        }
        return comRequisitos(job, rs, job.termosNaoReconhecidos());
    }

    public static JobSpec removerRequisito(JobSpec job, String id) {
        return comRequisitos(job, job.requisitos().stream().filter(r -> !r.id().equals(id)).toList(), job.termosNaoReconhecidos());
    }

    private static final Pattern ID_USUARIO = Pattern.compile("^u(\\d+)$");

    public static JobSpec adicionarRequisito(JobSpec job, String texto, ReqTipo tipo, Dicionario dict) {
        int max = 0;
        for (Requirement r : job.requisitos()) {
            Matcher m = ID_USUARIO.matcher(r.id());
            if (m.find()) max = Math.max(max, Integer.parseInt(m.group(1)));
        }
        var dec = Requisitos.decompose(texto, dict);
        List<Component> componentes = dec.componentes().isEmpty() ? List.of(new CompNaoReconhecido(List.of())) : dec.componentes();
        List<Requirement> rs = new ArrayList<>(job.requisitos());
        rs.add(new Requirement("u" + (max + 1), texto, tipo, ReqTipoFonte.USUARIO, ReqOrigem.USUARIO, componentes));
        Set<String> termos = new LinkedHashSet<>(job.termosNaoReconhecidos());
        termos.addAll(dec.termosNaoReconhecidos());
        return comRequisitos(job, rs, new ArrayList<>(termos));
    }

    /** Resultado de promover um termo: a vaga atualizada e a skill nova. */
    public record Promocao(JobSpec job, SkillDef skill) {}

    private static final Pattern NAO_ID = Pattern.compile("[^a-z0-9#+.]+");

    /** Transforma um termo não reconhecido em skill: todas as linhas que o citam passam a procurá-lo no CV. */
    public static Promocao promoverTermo(JobSpec job, String termo) {
        String chave = fold(Normalizar.nfc(termo));
        SkillDef skill = new SkillDef("extra:" + NAO_ID.matcher(chave).replaceAll("-"), termo, "ferramenta", List.of(), null, null, null, null);
        Pattern cita = JsRegex.compilar(Texto.ANTES + Texto.padraoTermo(chave) + Texto.DEPOIS, "u");
        List<Requirement> rs = new ArrayList<>();
        for (Requirement r : job.requisitos()) {
            if (!cita.matcher(fold(Normalizar.nfc(r.texto()))).find()) {
                rs.add(r);
                continue;
            }
            // Sai o termo do "?"; um "?" sem termo (linha que nada reconheceu) dá lugar à skill.
            List<Component> componentes = new ArrayList<>();
            for (Component c : r.componentes()) {
                if (!(c instanceof CompNaoReconhecido n)) {
                    componentes.add(c);
                    continue;
                }
                List<String> resto = n.termos().stream().filter(t -> !fold(Normalizar.nfc(t)).equals(chave)).toList();
                if (!resto.isEmpty()) componentes.add(new CompNaoReconhecido(resto));
            }
            boolean jaTem = componentes.stream().anyMatch(c -> c instanceof CompSkill s && s.ids().contains(skill.id()));
            if (jaTem) {
                rs.add(r);
                continue;
            }
            componentes.add(new CompSkill(List.of(skill.id()), ModoSkill.TODAS));
            rs.add(new Requirement(r.id(), r.texto(), r.tipo(), r.tipoFonte(), r.origem(), componentes));
        }
        List<String> termos = job.termosNaoReconhecidos().stream().filter(t -> !fold(Normalizar.nfc(t)).equals(chave)).toList();
        return new Promocao(comRequisitos(job, rs, termos), skill);
    }

    // ---------- Termos da vaga ausentes do CV ----------

    private static final Set<String> STOPWORDS = new java.util.HashSet<>(java.util.Arrays.asList(("a o as os um uma uns umas de da do das dos em na no nas nos por para com sem sobre entre ate ao aos "
            + "e ou mas que se como mais menos muito muita ser ter ha tem sao foi sera estar vaga vagas empresa "
            + "equipe time area anos ano experiencia conhecimento conhecimentos desejavel diferencial requisitos "
            + "atividades responsabilidades beneficios buscamos procuramos profissional trabalho trabalhar "
            + "nivel superior ensino completo sera seu sua seus suas nosso nossa nossos nossas voce nos "
            + "the and of to in for with").split(" ")));

    private record Token(String raiz, String palavra) {}

    private static final Pattern SEP = JsRegex.compilar("[\\s,;:()/\\\\|•·–—\"'!?]+");
    private static final Pattern PONTOS_NAS_PONTAS = Pattern.compile("^[.\\-]+|[.\\-]+\\z");
    private static final Pattern DOT_NET = JsRegex.compilar("^\\.net", "i");
    private static final Pattern SO_DIGITOS = Pattern.compile("^\\d+\\z");

    /** Stemming leve para PT-BR: só plural e sufixos -ção/-ções. */
    private static String stem(String w) {
        if (w.length() > 5 && w.endsWith("coes")) return w.substring(0, w.length() - 4) + "cao";
        if (w.length() > 4 && w.endsWith("ns")) return w.substring(0, w.length() - 2) + "m";
        if (w.length() > 4 && w.endsWith("es")) return w.substring(0, w.length() - 2);
        if (w.length() > 3 && w.endsWith("s")) return w.substring(0, w.length() - 1);
        return w;
    }

    /** Mantém tokens técnicos como c#, c++, node.js, .net. */
    private static List<Token> tokens(String text) {
        List<Token> out = new ArrayList<>();
        for (String raw : SEP.split(Normalizar.nfc(text), -1)) {
            String palavra = PONTOS_NAS_PONTAS.matcher(raw).replaceAll(r ->
                    r.group().equals(".") && r.start() == 0 && DOT_NET.matcher(raw).find() ? Matcher.quoteReplacement(r.group()) : "");
            String n = Normalizar.norm(palavra);
            if (n.length() < 2 || STOPWORDS.contains(n) || SO_DIGITOS.matcher(n).find()) continue;
            out.add(new Token(stem(n), palavra.toLowerCase(Locale.ROOT)));
        }
        return out;
    }

    private static final Pattern QUEBRA = JsRegex.compilar("\\r?\\n");
    private static final Pattern TERMINA_EM_VERBO = JsRegex.compilar("(ar|er|ir|ando|endo|indo|amos|emos|imos)$");

    /**
     * Lista secundária: palavras da vaga que não aparecem no CV, fora as já cobertas pelo dicionário. Não é critério
     * documentado das plataformas; serve só para revisar.
     */
    public static List<String> termosAusentes(String cvText, String jobText, Dicionario dict, int max) {
        List<String> linhas = new ArrayList<>();
        for (String l : QUEBRA.split(Normalizar.nfc(jobText), -1)) {
            if (Vaga.tituloDeSecao(l, dict) == null && !Lexicos.IGNORAR_LINHA.matcher(fold(Js.trim(l))).find()
                    && !Lexicos.SOFT_SKILLS.matcher(fold(l)).find()) {
                linhas.add(l);
            }
        }
        String vaga = String.join("\n", linhas);
        char[] chars = vaga.toCharArray();
        for (var m : dict.find(vaga)) for (int i = m.start(); i < m.end(); i++) chars[i] = ' ';
        Set<String> noCv = new LinkedHashSet<>();
        for (Token t : tokens(cvText)) noCv.add(t.raiz());
        record Contagem(String palavra, int n) {}
        Map<String, Contagem> contagem = new LinkedHashMap<>();
        for (Token t : tokens(new String(chars))) {
            String f = fold(t.palavra());
            // Verbos (infinitivo, gerúndio, "estamos") descrevem a rotina, não competências.
            boolean verbo = f.length() >= 4 && TERMINA_EM_VERBO.matcher(f).find();
            if (noCv.contains(t.raiz()) || f.length() < 4 || verbo || Lexicos.PALAVRAS_GENERICAS.contains(f)) continue;
            Contagem atual = contagem.get(t.raiz());
            contagem.put(t.raiz(), new Contagem(atual != null ? atual.palavra() : t.palavra(), (atual != null ? atual.n() : 0) + 1));
        }
        List<Contagem> ordenadas = new ArrayList<>(contagem.values());
        java.text.Collator collator = java.text.Collator.getInstance(Locale.forLanguageTag("pt-BR"));
        ordenadas.sort((a, b) -> b.n() != a.n() ? Integer.compare(b.n(), a.n()) : collator.compare(a.palavra(), b.palavra()));
        return ordenadas.stream().limit(max).map(Contagem::palavra).toList();
    }

    public static List<String> termosAusentes(String cvText, String jobText, Dicionario dict) {
        return termosAusentes(cvText, jobText, dict, 15);
    }

}
