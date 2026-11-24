package br.com.atscv.formato;

import br.com.atscv.comum.Js;
import br.com.atscv.formato.Modelos.TextItem;
import java.util.List;

public final class TextoPdf {
    private TextoPdf() {}

    /** O texto e, para cada trecho i, a posição em que ele começa nele. */
    public record Montado(String text, int[] inicios) {}

    /**
     * Junta os trechos na ordem do stream, quebrando a linha quando a posição Y muda, como parsers
     * baseados em layout (pdfminer, Tika) fazem.
     */
    public static Montado montar(List<TextItem> items) {
        StringBuilder text = new StringBuilder();
        int[] inicios = new int[items.size()];
        for (int idx = 0; idx < items.size(); idx++) {
            TextItem it = items.get(idx);
            TextItem prev = idx > 0 ? items.get(idx - 1) : null;
            boolean moved = prev != null && (prev.page() != it.page() || Math.abs(prev.y() - it.y()) > 3);
            if (moved && !terminaEmQuebra(text) && !Js.vazio(it.str())) text.append('\n');
            inicios[idx] = text.length();
            text.append(it.str());
            if (it.hasEOL()) text.append('\n');
        }
        return new Montado(text.toString(), inicios);
    }

    private static boolean terminaEmQuebra(StringBuilder sb) {
        return !sb.isEmpty() && sb.charAt(sb.length() - 1) == '\n';
    }
}
