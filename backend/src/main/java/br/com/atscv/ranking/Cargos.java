package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Normalizar;
import br.com.atscv.ranking.Tipos.Senioridade;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Família do cargo (back-end, front-end...) e senioridade, lidas de um título de vaga ou de experiência. */
public final class Cargos {
    private Cargos() {}

    private record Entrada<T>(T id, Pattern re) {}

    private static final List<Entrada<String>> FAMILIAS = new ArrayList<>();
    private static final List<Entrada<Senioridade>> SENIORIDADES = new ArrayList<>();
    public static final Map<String, String> ROTULO_FAMILIA = new LinkedHashMap<>();
    public static final Map<Senioridade, String> ROTULO_SENIORIDADE = new LinkedHashMap<>();

    static {
        try (InputStream in = Cargos.class.getResourceAsStream("/ranking/cargos.json")) {
            JsonNode raiz = JsonMapper.builder().build().readTree(in);
            for (JsonNode f : raiz.get("familias")) {
                String id = f.get(0).asString();
                ROTULO_FAMILIA.put(id, f.get(1).asString());
                FAMILIAS.add(new Entrada<>(id, Texto.compilarTermos(normalizar(f.get(2)))));
            }
            for (JsonNode s : raiz.get("senioridades")) {
                Senioridade id = Senioridade.valueOf(s.get(0).asString().toUpperCase(Locale.ROOT));
                ROTULO_SENIORIDADE.put(id, s.get(1).asString());
                SENIORIDADES.add(new Entrada<>(id, Texto.compilarTermos(normalizar(s.get(2)))));
            }
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static List<String> normalizar(JsonNode termos) {
        List<String> out = new ArrayList<>();
        for (JsonNode t : termos) out.add(fold(Normalizar.nfc(t.asString())));
        return out;
    }

    public static final List<Senioridade> ORDEM_SENIORIDADE =
            List.of(Senioridade.ESTAGIO, Senioridade.JUNIOR, Senioridade.PLENO, Senioridade.SENIOR, Senioridade.ESPECIALISTA);

    private static final Pattern GENERO = Pattern.compile("\\((?:a|o|as|os|e)\\)|/(?:a|o)\\b");
    private static final Pattern PL_SQL = Pattern.compile("\\bpl\\s*/?\\s*sql\\b");

    /** Tira marcadores de gênero: "Engenheiro(a)", "Dev(a)", "Desenvolvedor/a". */
    private static String semGenero(String texto) {
        return GENERO.matcher(fold(Normalizar.nfc(texto))).replaceAll("");
    }

    /** Família do cargo citada no texto (um título de vaga ou de experiência); null se nenhuma. */
    public static String familiaDe(String texto) {
        String f = semGenero(texto);
        for (Entrada<String> e : FAMILIAS) if (e.re().matcher(f).find()) return e.id();
        return null;
    }

    public static Senioridade senioridadeDe(String texto) {
        // "PL" é pleno ("Desenvolvedor Back End PL"), mas "PL/SQL" é linguagem.
        String f = PL_SQL.matcher(semGenero(texto)).replaceAll(" ");
        for (Entrada<Senioridade> e : SENIORIDADES) if (e.re().matcher(f).find()) return e.id();
        return null;
    }

    /** Famílias de quem programa: atendem uma vaga genérica de desenvolvimento. */
    private static final Set<String> DEV = Set.of("backend", "frontend", "fullstack", "mobile", "desenvolvimento");

    /** Famílias vizinhas contam como parcial, nos dois sentidos; só especialidades da mesma área, a de programação. */
    private static final List<String[]> VIZINHAS = List.of(
            new String[] {"fullstack", "backend"}, new String[] {"fullstack", "frontend"},
            new String[] {"frontend", "mobile"}, new String[] {"desenvolvimento", "backend"},
            new String[] {"desenvolvimento", "frontend"}, new String[] {"desenvolvimento", "fullstack"},
            new String[] {"desenvolvimento", "mobile"});

    public enum Comparacao { ATENDE, PARCIAL, NAO_ATENDE }

    /** Compara a família do CV com a pedida: atende, parcial (vizinha) ou não atende. */
    public static Comparacao compararFamilia(String cv, String pedida) {
        if (cv.equals(pedida)) return Comparacao.ATENDE;
        // Quem é back-end, front-end ou mobile atende uma vaga de "desenvolvimento" sem especialidade.
        if (pedida.equals("desenvolvimento") && DEV.contains(cv)) return Comparacao.ATENDE;
        for (String[] v : VIZINHAS) {
            if ((v[0].equals(cv) && v[1].equals(pedida)) || (v[0].equals(pedida) && v[1].equals(cv))) {
                return Comparacao.PARCIAL;
            }
        }
        return Comparacao.NAO_ATENDE;
    }
}
