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
    public record PeriodoLido(Periodo period, int start, int end) {}

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

    public static PeriodoLido findRange(String s) {
        Matcher m = RANGE_RE.matcher(fold(s));
        return m.find() ? new PeriodoLido(periodOf(m, s), m.start(), m.end()) : null;
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

    // ---------- Intervalos de tempo ----------

    private static final Pattern ANO = Pattern.compile("(\\d{4})");
    private static final Pattern MES_NUMERICO = Pattern.compile("^(\\d{1,2})/");

    /** Mês absoluto: ano × 12 + mês (0 a 11). */
    public static int mesDeData(LocalDate d) {
        return d.getYear() * 12 + d.getMonthValue() - 1;
    }

    /**
     * Lê "Agosto/2024", "ago 2024", "agosto de 2024", "08/2024" ou "2024". Ano sozinho vale janeiro no início do
     * período e dezembro no fim. Null quando não há ano.
     */
    public static Integer mesDe(String texto, boolean fimDoPeriodo) {
        String f = Js.trim(fold(texto));
        Matcher ano = ANO.matcher(f);
        if (!ano.find()) return null;
        int nome = -1;
        for (int i = 0; i < MONTH_IDX.size(); i++) {
            if (f.startsWith(MONTH_IDX.get(i))) {
                nome = i;
                break;
            }
        }
        Matcher numero = MES_NUMERICO.matcher(f);
        int mes = nome >= 0 ? nome : numero.find() ? Integer.parseInt(numero.group(1)) - 1 : fimDoPeriodo ? 11 : 0;
        return mes >= 0 && mes <= 11 ? Integer.parseInt(ano.group(1)) * 12 + mes : null;
    }

    /** Intervalo de um período do CV; "Atual" vai até `hoje`. Null quando as datas não fazem sentido. */
    public static Tipos.IntervaloMeses intervaloDe(Periodo p, LocalDate hoje) {
        Integer inicio = mesDe(p.inicio(), false);
        Integer fim = p.atual() ? Integer.valueOf(mesDeData(hoje)) : mesDe(p.fim(), true);
        return inicio != null && fim != null && fim >= inicio ? new Tipos.IntervaloMeses(inicio, fim) : null;
    }

    /** Junta intervalos sobrepostos ou vizinhos: períodos simultâneos contam uma vez só. */
    public static List<Tipos.IntervaloMeses> uniao(List<Tipos.IntervaloMeses> intervalos) {
        List<Tipos.IntervaloMeses> ordenados = new java.util.ArrayList<>(intervalos);
        ordenados.sort(java.util.Comparator.comparingInt(Tipos.IntervaloMeses::inicio));
        List<Tipos.IntervaloMeses> out = new java.util.ArrayList<>();
        for (Tipos.IntervaloMeses i : ordenados) {
            Tipos.IntervaloMeses ultimo = out.isEmpty() ? null : out.get(out.size() - 1);
            if (ultimo != null && i.inicio() <= ultimo.fim() + 1) {
                out.set(out.size() - 1, new Tipos.IntervaloMeses(ultimo.inicio(), Math.max(ultimo.fim(), i.fim())));
            } else {
                out.add(i);
            }
        }
        return out;
    }

    public static int totalMeses(List<Tipos.IntervaloMeses> intervalos) {
        int total = 0;
        for (Tipos.IntervaloMeses i : uniao(intervalos)) total += i.fim() - i.inicio() + 1;
        return total;
    }

    /** Lacunas de pelo menos `minimo` meses entre os intervalos e entre o último e hoje. */
    public static List<Tipos.Lacuna> lacunas(List<Tipos.IntervaloMeses> intervalos, LocalDate hoje, int minimo) {
        List<Tipos.IntervaloMeses> u = uniao(intervalos);
        List<Tipos.Lacuna> out = new java.util.ArrayList<>();
        for (int i = 1; i < u.size(); i++) {
            int meses = u.get(i).inicio() - u.get(i - 1).fim() - 1;
            if (meses >= minimo) out.add(new Tipos.Lacuna(u.get(i - 1).fim() + 1, u.get(i).inicio() - 1, meses, false));
        }
        if (!u.isEmpty()) {
            Tipos.IntervaloMeses ultimo = u.get(u.size() - 1);
            int agora = mesDeData(hoje);
            if (agora - ultimo.fim() >= minimo) out.add(new Tipos.Lacuna(ultimo.fim() + 1, agora, agora - ultimo.fim(), true));
        }
        return out;
    }

    public static List<Tipos.Lacuna> lacunas(List<Tipos.IntervaloMeses> intervalos, LocalDate hoje) {
        return lacunas(intervalos, hoje, 7);
    }

    /** "ago/2024". */
    public static String rotuloMes(int m) {
        return MONTH_IDX.get(Math.floorMod(m, 12)) + "/" + Math.floorDiv(m, 12);
    }

    /** "ago/2024–jul/2026". */
    public static String rotuloIntervalo(Tipos.IntervaloMeses i) {
        return rotuloMes(i.inicio()) + "–" + rotuloMes(i.fim());
    }

    /** "3 anos e 4 meses", "7 meses", "1 ano". */
    public static String duracao(int meses) {
        if (meses <= 0) return "nenhum tempo";
        int anos = meses / 12;
        int resto = meses % 12;
        List<String> partes = new java.util.ArrayList<>();
        if (anos > 0) partes.add(anos + " ano" + (anos > 1 ? "s" : ""));
        if (resto > 0) partes.add(resto + " " + (resto > 1 ? "meses" : "mês"));
        return String.join(" e ", partes);
    }
}
