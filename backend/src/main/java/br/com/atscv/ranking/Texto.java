package br.com.atscv.ranking;

import br.com.atscv.comum.Js;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Utilidades de texto do ranqueamento. */
public final class Texto {
    private Texto() {}

    /** Limites de palavra: o termo não pode estar colado a letra, número ou _. */
    public static final String ANTES = "(?<![\\p{L}\\p{N}_])";
    public static final String DEPOIS = "(?![\\p{L}\\p{N}_])";

    /** Padrão de um termo já normalizado: cada espaço aceita qualquer espaço em branco, inclusive quebra de linha. */
    public static String padraoTermo(String termo) {
        String[] partes = Js.ESPACOS.split(Js.trim(termo), -1);
        List<String> escapadas = new ArrayList<>();
        for (String p : partes) escapadas.add(Pattern.quote(p));
        return String.join(Js.S + "+", escapadas);
    }

    /** Regex que casa qualquer um dos termos (o mais longo primeiro), com limites de palavra. */
    public static Pattern compilarTermos(List<String> termos) {
        List<String> unicos = new ArrayList<>(new LinkedHashSet<>(termos));
        unicos.sort(Comparator.comparingInt(String::length).reversed());
        String alts = unicos.stream().map(Texto::padraoTermo).collect(Collectors.joining("|"));
        return Pattern.compile(ANTES + "(?:" + alts + ")" + DEPOIS);
    }
}
