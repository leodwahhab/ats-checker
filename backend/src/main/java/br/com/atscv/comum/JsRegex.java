package br.com.atscv.comum;

import java.util.regex.Pattern;

/**
 * Traduz o código-fonte de uma regex do JavaScript para o Java, para os léxicos exportados do front original
 * rodarem como estão: o espaço em branco com os espaços do JavaScript, o cifrão só no fim do texto, a barra
 * escapada, o escape Unicode com chaves e as propriedades Unicode.
 */
public final class JsRegex {
    private JsRegex() {}

    public static Pattern compilar(String fonte, String flags) {
        int f = 0;
        if (flags.contains("i")) f |= Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
        if (flags.contains("s")) f |= Pattern.DOTALL;
        if (flags.contains("m")) f |= Pattern.MULTILINE;
        return Pattern.compile(traduzir(fonte, flags.contains("m")), f);
    }

    public static Pattern compilar(String fonte) {
        return compilar(fonte, "");
    }

    static String traduzir(String src, boolean multilinha) {
        StringBuilder out = new StringBuilder();
        boolean emClasse = false;
        for (int i = 0; i < src.length(); i++) {
            char c = src.charAt(i);
            if (c == '\\' && i + 1 < src.length()) {
                char n = src.charAt(++i);
                switch (n) {
                    case 's' -> out.append(emClasse ? Js.WS_CLASS : Js.S);
                    case 'S' -> {
                        if (emClasse) throw new IllegalArgumentException("\\S dentro de classe: " + src);
                        out.append(Js.NS);
                    }
                    case '/' -> out.append('/');
                    case 'u' -> {
                        if (i + 1 < src.length() && src.charAt(i + 1) == '{') {
                            int fim = src.indexOf('}', i);
                            out.append("\\x{").append(src, i + 2, fim).append('}');
                            i = fim;
                        } else {
                            out.append("\\u");
                        }
                    }
                    case 'p', 'P' -> {
                        int fim = src.indexOf('}', i);
                        String nome = src.substring(i + 2, fim);
                        out.append('\\').append(n).append('{').append(propriedade(nome)).append('}');
                        i = fim;
                    }
                    default -> out.append('\\').append(n);
                }
                continue;
            }
            if (emClasse) {
                if (c == ']') emClasse = false;
                if (c == '[' || (c == '&' && i + 1 < src.length() && src.charAt(i + 1) == '&')) out.append('\\');
                out.append(c);
                continue;
            }
            switch (c) {
                case '[' -> {
                    emClasse = true;
                    out.append(c);
                    if (i + 1 < src.length() && src.charAt(i + 1) == '^') out.append(src.charAt(++i));
                }
                case '$' -> out.append(multilinha ? "$" : "\\z");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    private static String propriedade(String nome) {
        return switch (nome) {
            case "Extended_Pictographic" -> "IsExtended_Pictographic";
            default -> nome;
        };
    }
}
