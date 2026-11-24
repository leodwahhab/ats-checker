package br.com.atscv.ranking;

import br.com.atscv.comum.JsRegex;
import br.com.atscv.ranking.Tipos.NivelFormacao;
import br.com.atscv.ranking.Tipos.NivelIdioma;
import br.com.atscv.ranking.Tipos.TipoSecao;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Léxicos do ranqueamento (títulos de seção, marcadores, níveis de idioma...). Os dados vêm de
 * {@code ranking/lexicos.json}, exportado do dicionário original; todos os padrões rodam sobre texto com fold.
 */
public final class Lexicos {
    private Lexicos() {}

    /** Um padrão com o nome (ou rótulo) ao qual ele pertence. */
    public record Par<T>(T chave, Pattern re) {}

    private static final JsonNode RAIZ = carregar("/ranking/lexicos.json");

    private static JsonNode carregar(String recurso) {
        try (InputStream in = Lexicos.class.getResourceAsStream(recurso)) {
            if (in == null) throw new IllegalStateException("Recurso ausente: " + recurso);
            return JsonMapper.builder().build().readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Pattern padrao(JsonNode n) {
        return JsRegex.compilar(n.get("$re").asString(), n.get("flags").asString());
    }

    private static Pattern padrao(String nome) {
        return padrao(RAIZ.get(nome));
    }

    private static <T> List<Par<T>> pares(String nome, java.util.function.Function<String, T> chave) {
        List<Par<T>> out = new ArrayList<>();
        for (JsonNode par : RAIZ.get(nome)) out.add(new Par<>(chave.apply(par.get(0).asString()), padrao(par.get(1))));
        return out;
    }

    private static List<String> lista(String nome) {
        List<String> out = new ArrayList<>();
        for (JsonNode n : RAIZ.get(nome)) out.add(n.asString());
        return out;
    }

    private static Set<String> conjunto(String nome) {
        Set<String> out = new LinkedHashSet<>();
        for (JsonNode n : RAIZ.get(nome).get("$set")) out.add(n.asString());
        return out;
    }

    private static Map<String, String> mapa(String nome) {
        Map<String, String> out = new LinkedHashMap<>();
        for (var e : RAIZ.get(nome).properties()) out.put(e.getKey(), e.getValue().asString());
        return out;
    }

    public static NivelIdioma nivelIdioma(String s) {
        return NivelIdioma.valueOf(s.toUpperCase(Locale.ROOT));
    }

    public static NivelFormacao nivelFormacao(String s) {
        return NivelFormacao.valueOf(s.toUpperCase(Locale.ROOT));
    }

    /** Títulos de seção da vaga. A ordem importa: "requisitos desejáveis" é desejável. */
    public static final List<Par<TipoSecao>> SECOES = pares("SECOES", s -> TipoSecao.valueOf(s.toUpperCase(Locale.ROOT)));

    public static final Pattern MARCADOR_DESEJAVEL = padrao("MARCADOR_DESEJAVEL");
    public static final Pattern MARCADOR_OBRIGATORIO = padrao("MARCADOR_OBRIGATORIO");
    public static final Pattern HEURISTICA_OBRIGATORIO = padrao("HEURISTICA_OBRIGATORIO");
    public static final Pattern SOFT_SKILLS = padrao("SOFT_SKILLS");
    public static final Pattern PARECE_REQUISITO = padrao("PARECE_REQUISITO");
    public static final Pattern IGNORAR_LINHA = padrao("IGNORAR_LINHA");
    public static final Pattern ANOS = padrao("ANOS");
    public static final List<Par<String>> IDIOMAS = pares("IDIOMAS", s -> s);
    public static final List<NivelIdioma> ORDEM_IDIOMA = lista("ORDEM_IDIOMA").stream().map(Lexicos::nivelIdioma).toList();
    public static final Map<String, String> ROTULO_IDIOMA = mapa("ROTULO_IDIOMA");
    public static final List<Par<NivelIdioma>> NIVEIS_IDIOMA = pares("NIVEIS_IDIOMA", Lexicos::nivelIdioma);
    public static final List<Par<NivelFormacao>> NIVEIS_FORMACAO = pares("NIVEIS_FORMACAO", Lexicos::nivelFormacao);
    public static final List<NivelFormacao> ORDEM_FORMACAO =
            lista("ORDEM_FORMACAO").stream().map(Lexicos::nivelFormacao).toList();
    public static final Map<String, String> ROTULO_FORMACAO = mapa("ROTULO_FORMACAO");
    public static final Pattern AREA_TI_CURSO = padrao("AREA_TI_CURSO");
    public static final Pattern PERIODO_CURSO = padrao("PERIODO_CURSO");
    public static final Pattern ACEITA_CURSANDO = padrao("ACEITA_CURSANDO");
    public static final Pattern AREA_TI = padrao("AREA_TI");
    public static final Pattern COMO_CARGO = padrao("COMO_CARGO");
    public static final Set<String> PALAVRAS_GENERICAS = conjunto("PALAVRAS_GENERICAS");
    public static final Pattern RESIDENCIA = padrao("RESIDENCIA");
    public static final List<Par<String>> DISPONIBILIDADE = pares("DISPONIBILIDADE", s -> s);
    public static final Pattern CONTEXTO_DISPONIBILIDADE = padrao("CONTEXTO_DISPONIBILIDADE");
    public static final List<Par<String>> DOCUMENTO = pares("DOCUMENTO", s -> s);
    public static final Pattern CERTIFICACAO = padrao("CERTIFICACAO");
    public static final Pattern AFIRMATIVA = padrao("AFIRMATIVA");
    public static final Pattern GRUPO_AFIRMATIVO = padrao("GRUPO_AFIRMATIVO");
    public static final Set<String> PALAVRAS_PT = conjunto("PALAVRAS_PT");
    public static final Set<String> PALAVRAS_EN = conjunto("PALAVRAS_EN");
    public static final Pattern VERBO_ATIVIDADE = padrao("VERBO_ATIVIDADE");
    /** Países que aparecem no local de vagas, para a regra de vaga em outro país do LinkedIn. */
    public static final List<Par<String>> PAISES = pares("PAISES", s -> s);

    public static String rotuloFormacao(NivelFormacao n) {
        return ROTULO_FORMACAO.get(n.json());
    }

    public static String rotuloIdioma(NivelIdioma n) {
        return ROTULO_IDIOMA.get(n.json());
    }
}
