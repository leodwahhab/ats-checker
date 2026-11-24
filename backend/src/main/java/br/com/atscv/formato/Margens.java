package br.com.atscv.formato;

import static br.com.atscv.comum.Js.S;
import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.formato.Modelos.TextItem;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/** Cabeçalho e rodapé do editor: parte dos ATS descarta essas áreas. */
public final class Margens {
    private Margens() {}

    /**
     * @param repetidos textos que se repetem no topo ou no pé de duas ou mais páginas
     * @param contatoNoRodape há e-mail, telefone ou LinkedIn no pé da página
     */
    public record Resultado(List<String> repetidos, boolean contatoNoRodape, List<Integer> itens) {}

    /** Número de página ("1", "Página 1 de 2", "Page 1 of 3"): não leva informação para o ATS. */
    private static final Pattern NUMERO_PAGINA =
            Pattern.compile("^(pagina|pag\\.?|page)?" + S + "*#" + S + "*((de|of|/)" + S + "*#)?\\z");
    private static final Pattern CONTATO = Js.rei("@|linkedin\\.com|\\(?\\d{2}\\)?" + S + "?9?\\d{4}[-" + Js.WS_CLASS
            + ".]?\\d{4}");
    private static final Pattern DIGITOS = Pattern.compile("\\d+");

    private static final class Linha {
        boolean topo;
        int page;
        final List<Integer> itens = new ArrayList<>();
    }

    private static final class Grupo {
        String texto;
        final Set<Integer> paginas = new TreeSet<>();
        final List<Integer> itens = new ArrayList<>();
    }

    /**
     * Faixa de 8% da altura no topo e no pé de cada página. Parte dos ATS descarta o que o editor coloca em
     * cabeçalho e rodapé, então contato ou dados que só existem ali podem se perder.
     */
    public static Resultado detectarMargens(ExtractedDoc doc) {
        Double altura = doc.pageHeight();
        if (altura == null || altura == 0) return new Resultado(List.of(), false, List.of());
        double faixa = altura * 0.08;

        // Junta os trechos da mesma linha: "Page 1 of 3" costuma vir em quatro pedaços.
        Map<String, Linha> linhas = new LinkedHashMap<>();
        List<TextItem> items = doc.items();
        for (int i = 0; i < items.size(); i++) {
            TextItem it = items.get(i);
            if (Js.vazio(it.str())) continue;
            boolean topo = it.y() > altura - faixa;
            if (!topo && it.y() >= faixa) continue;
            String chave = it.page() + ":" + Math.round(it.y() / 3);
            Linha l = linhas.get(chave);
            if (l == null) {
                l = new Linha();
                l.topo = topo;
                l.page = it.page();
                linhas.put(chave, l);
            }
            l.itens.add(i);
        }

        Map<String, Grupo> paginas = new LinkedHashMap<>();
        List<Integer> rodape = new ArrayList<>();
        for (Linha l : linhas.values()) {
            List<String> partes = new ArrayList<>();
            for (int i : l.itens) partes.add(Js.trim(items.get(i).str()));
            String texto = Js.colapsar(String.join(" ", partes));
            if (!l.topo && CONTATO.matcher(texto).find()) rodape.addAll(l.itens);
            String forma = DIGITOS.matcher(fold(texto)).replaceAll("#");
            if (NUMERO_PAGINA.matcher(forma).find()) continue;
            String chave = (l.topo ? "t" : "p") + ":" + forma;
            Grupo g = paginas.computeIfAbsent(chave, k -> {
                Grupo novo = new Grupo();
                novo.texto = texto;
                return novo;
            });
            g.paginas.add(l.page);
            g.itens.addAll(l.itens);
        }

        List<Grupo> grupos = paginas.values().stream().filter(g -> g.paginas.size() >= 2).toList();
        Set<Integer> todos = new TreeSet<>();
        for (Grupo g : grupos) todos.addAll(g.itens);
        todos.addAll(rodape);
        return new Resultado(grupos.stream().map(g -> g.texto).toList(), !rodape.isEmpty(), new ArrayList<>(todos));
    }
}
