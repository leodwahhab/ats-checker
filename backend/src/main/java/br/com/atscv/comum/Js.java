package br.com.atscv.comum;

import java.util.regex.Pattern;

/**
 * Equivalências com o JavaScript do front original: o que conta como espaço em branco, trim e
 * regex. O {@code \s} do Java só vê ASCII; o do JavaScript também vê NBSP, BOM e espaços Unicode.
 */
public final class Js {
    private Js() {}

    /** Conteúdo de uma classe de caracteres com os espaços do JavaScript (para usar dentro de [...]). */
    public static final String WS_CLASS = "\\s\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";
    /** Um espaço em branco (substitui {@code \s}). */
    public static final String S = "[" + WS_CLASS + "]";
    /** Um caractere que não é espaço (substitui {@code \S}). */
    public static final String NS = "[^" + WS_CLASS + "]";

    private static final int I = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;

    /** Regex sem distinguir maiúsculas (a flag {@code i} do JavaScript). */
    public static Pattern rei(String regex) {
        return Pattern.compile(regex, I);
    }

    public static Pattern re(String regex) {
        return Pattern.compile(regex);
    }

    private static boolean ws(char c) {
        return Character.isWhitespace(c) || c == ' ' || c == '﻿' || c == ' ' || c == ' ';
    }

    /** {@code String.prototype.trim} do JavaScript. */
    public static String trim(String s) {
        int a = 0;
        int b = s.length();
        while (a < b && ws(s.charAt(a))) a++;
        while (b > a && ws(s.charAt(b - 1))) b--;
        return s.substring(a, b);
    }

    public static boolean vazio(String s) {
        return trim(s).isEmpty();
    }

    /** {@code split('\n')} do JavaScript: mantém as strings vazias do fim. */
    public static String[] linhas(String s) {
        return s.split("\n", -1);
    }

    public static final Pattern ESPACOS = re(S + "+");

    /** {@code s.replace(/\s+/g, ' ')}. */
    public static String colapsar(String s) {
        return ESPACOS.matcher(s).replaceAll(" ");
    }
}
