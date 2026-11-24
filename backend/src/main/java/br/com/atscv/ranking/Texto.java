package br.com.atscv.ranking;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.JsRegex;
import br.com.atscv.comum.Normalizar;
import br.com.atscv.ranking.Tipos.IdiomaTexto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
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

    /** Marcadores no começo de uma linha da vaga: bullets, numeração, emoji ("🔍 O Que Procuramos"). */
    public static final Pattern INICIO = JsRegex.compilar(
            "^(?:[\\s\\p{Extended_Pictographic}\\x{FE0F}\\x{200D}#*•●▪◦·▸✓✔➤→>\\-–—]+|\\d{1,2}[.)]\\s+)+", "u");

    private static final Pattern LETRAS = Pattern.compile("\\p{L}+");

    /** Português ou inglês, pela contagem de palavras comuns. Null quando o texto é curto demais. */
    public static IdiomaTexto idiomaDoTexto(String texto) {
        int pt = 0;
        int en = 0;
        Matcher m = LETRAS.matcher(Normalizar.fold(Normalizar.nfc(texto)));
        while (m.find()) {
            String p = m.group();
            if (Lexicos.PALAVRAS_PT.contains(p)) pt++;
            else if (Lexicos.PALAVRAS_EN.contains(p)) en++;
        }
        if (pt + en < 15) return null;
        return en > pt ? IdiomaTexto.EN : IdiomaTexto.PT;
    }

    /** "Docker", "Docker e AWS", "Docker, AWS e Kafka". */
    public static String lista(List<String> xs) {
        if (xs.size() > 1) return String.join(", ", xs.subList(0, xs.size() - 1)) + " e " + xs.get(xs.size() - 1);
        return xs.isEmpty() ? null : xs.get(0);
    }

    /** Trecho de até `max` caracteres em volta de [start, end), cortado em limite de palavra. */
    public static String trecho(String texto, int start, int end, int max) {
        if (texto.length() <= max) return limpo(texto);
        int folga = Math.max(0, (int) Math.floor((max - (end - start)) / 2.0));
        int a = Math.max(0, start - folga);
        int b = Math.min(texto.length(), end + folga);
        if (a > 0) {
            int espaco = texto.indexOf(' ', a);
            if (espaco >= 0 && espaco < start) a = espaco + 1;
        }
        if (b < texto.length()) {
            int espaco = texto.lastIndexOf(' ', b);
            if (espaco > end) b = espaco;
        }
        return (a > 0 ? "…" : "") + limpo(texto.substring(a, b)) + (b < texto.length() ? "…" : "");
    }

    public static String trecho(String texto, int start, int end) {
        return trecho(texto, start, end, 120);
    }

    private static String limpo(String s) {
        return Js.trim(Js.colapsar(s));
    }

    /** Número de palavras separadas por espaço. */
    public static int palavras(String s) {
        int n = 0;
        for (String p : Js.ESPACOS.split(s, -1)) if (!p.isEmpty()) n++;
        return n;
    }
}
