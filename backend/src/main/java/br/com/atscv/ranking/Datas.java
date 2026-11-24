package br.com.atscv.ranking;

import static br.com.atscv.comum.Js.S;
import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.formato.Modelos.Periodo;
import java.time.LocalDate;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Leitura de datas e períodos do CV. Os padrões rodam sobre texto com fold (minúsculas, sem acento). */
public final class Datas {
    private Datas() {}

    private static final String MONTH =
            "(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?"
                    + "|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)";
    private static final String DATE = "(?:" + MONTH + "\\.?" + S + "*(?:de" + S + "+|[/.\\-]" + S + "*)?\\d{4}(?!\\d)"
            + "|\\d{1,2}/\\d{4}(?!\\d)|(?<![\\d/])(?:19|20)\\d{2}(?!\\d))";
    private static final String NOW = "(?:atual|presente|hoje|current|present|em andamento|atualmente)";
    private static final Pattern NOW_RE = Js.rei("^" + NOW + "\\z");
    private static final List<String> MONTH_IDX =
            List.of("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez");

    public static final Pattern RANGE_RE = Js.rei(
            "(" + DATE + ")(?:" + S + "*[-–—]" + S + "*|" + S + "+(?:a|ate)" + S + "+)(" + DATE + "|" + NOW + ")");
    public static final Pattern DATE_RE = Js.rei(DATE);

    /** Um período achado numa linha, com a posição do trecho nela. */
    public record Intervalo(Periodo period, int start, int end) {}

    /** Converte um match de RANGE_RE (feito sobre o texto com fold) no período do texto original. */
    public static Periodo periodOf(Matcher m, String original) {
        int fimDoMatch = m.end();
        String fim = limpar(original.substring(fimDoMatch - m.group(2).length(), fimDoMatch));
        String inicio = limpar(original.substring(m.start(), m.start() + m.group(1).length()));
        return new Periodo(inicio, fim, NOW_RE.matcher(fold(fim)).find());
    }

    private static String limpar(String x) {
        return Js.trim(Js.colapsar(x));
    }

    public static Intervalo findRange(String s) {
        Matcher m = RANGE_RE.matcher(fold(s));
        return m.find() ? new Intervalo(periodOf(m, s), m.start(), m.end()) : null;
    }

    /** Último dia do mês de término; null quando o período é atual ou a data não foi entendida. */
    public static LocalDate endDate(Periodo p) {
        if (p.atual()) return null;
        String f = fold(p.fim());
        Matcher ano = Pattern.compile("(\\d{4})").matcher(f);
        if (!ano.find()) return null;
        int year = Integer.parseInt(ano.group(1));
        int mi = -1;
        for (int i = 0; i < MONTH_IDX.size(); i++) {
            if (f.startsWith(MONTH_IDX.get(i))) {
                mi = i;
                break;
            }
        }
        Matcher num = Pattern.compile("^(\\d{1,2})/").matcher(f);
        int month = mi >= 0 ? mi : num.find() ? Integer.parseInt(num.group(1)) - 1 : 11;
        // Dia 0 do mês seguinte: o último dia do mês (como o Date do JavaScript, que aceita meses fora de 0..11).
        return LocalDate.of(year, 1, 1).plusMonths(month + 1L).minusDays(1);
    }
}
