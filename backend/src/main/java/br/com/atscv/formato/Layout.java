package br.com.atscv.formato;

import br.com.atscv.comum.Js;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.formato.Modelos.TextItem;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Detecta indício de múltiplas colunas pela posição X dos trechos. */
public final class Layout {
    private Layout() {}

    /**
     * @param secondaryShare fração dos trechos de texto que começam na coluna secundária
     * @param secondaryItems índices dos trechos da coluna secundária (para marcar no CV)
     */
    public record LayoutInfo(boolean multiColumn, double secondaryShare, List<Integer> secondaryItems) {}

    private static long faixaX(double x) {
        return Math.round(x / 20) * 20;
    }

    /**
     * Heurística: agrupa a posição X dos trechos em faixas de 20pt. Se existem duas faixas dominantes separadas
     * por >= 25% da largura da página e a menor concentra >= 15% dos trechos, há indício de múltiplas colunas.
     */
    public static LayoutInfo detectColumns(ExtractedDoc doc) {
        TreeMap<Long, Integer> buckets = new TreeMap<>();
        int total = 0;
        for (TextItem it : doc.items()) {
            if (Js.trim(it.str()).length() < 3) continue;
            buckets.merge(faixaX(it.x()), 1, Integer::sum);
            total++;
        }
        if (total == 0) return new LayoutInfo(false, 0, List.of());

        double minGap = doc.pageWidth() * 0.25;
        int best = 0;
        Long secundaria = null;
        for (Map.Entry<Long, Integer> e : buckets.entrySet()) {
            long x = e.getKey();
            int count = e.getValue();
            // Maior faixa à esquerda que esteja a pelo menos minGap de distância.
            Map.Entry<Long, Integer> left = null;
            for (Map.Entry<Long, Integer> l : buckets.entrySet()) {
                if (x - l.getKey() >= minGap && (left == null || l.getValue() > left.getValue())) left = l;
            }
            if (left == null) continue;
            int menor = Math.min(count, left.getValue());
            if (menor > best) {
                best = menor;
                secundaria = count <= left.getValue() ? x : left.getKey();
            }
        }
        double share = (double) best / total;
        boolean multiColumn = share >= 0.15;
        List<Integer> secondaryItems = new ArrayList<>();
        if (multiColumn && secundaria != null) {
            List<TextItem> items = doc.items();
            for (int i = 0; i < items.size(); i++) {
                TextItem it = items.get(i);
                if (Js.trim(it.str()).length() >= 3 && faixaX(it.x()) == secundaria) secondaryItems.add(i);
            }
        }
        return new LayoutInfo(multiColumn, share, secondaryItems);
    }
}
