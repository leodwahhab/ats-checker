package br.com.atscv.comum;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public final class Normalizar {
    private Normalizar() {}

    private static final Pattern MARCAS = Pattern.compile("[\\u0300-\\u036f]");

    /** Minúsculas, sem acentos, espaços colapsados. */
    public static String norm(String s) {
        String semAcento = MARCAS.matcher(Normalizer.normalize(s, Normalizer.Form.NFD)).replaceAll("");
        return Js.trim(Js.colapsar(semAcento.toLowerCase(Locale.ROOT)));
    }

    /**
     * Minúsculas e sem acento, preservando o comprimento: a posição de cada caractere vale também
     * para o texto original (que deve estar em NFC).
     */
    public static String fold(String s) {
        StringBuilder out = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch < 128) {
                out.append(ch >= 'A' && ch <= 'Z' ? (char) (ch + 32) : ch);
                continue;
            }
            String f = MARCAS.matcher(Normalizer.normalize(String.valueOf(ch), Normalizer.Form.NFD)).replaceAll("")
                    .toLowerCase(Locale.ROOT);
            if (f.length() == 1) out.append(f);
            else out.append(ch);
        }
        return out.toString();
    }

    public static String nfc(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFC);
    }
}
