package br.com.atscv.formato;

import static br.com.atscv.comum.Js.S;
import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.Normalizar;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.formato.Modelos.TextItem;
import br.com.atscv.formato.Sections.SectionKey;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Localiza no PDF (por índice de trecho) o que a análise quer apontar no CV. */
public final class Marcas {
    private final ExtractedDoc doc;
    /** Texto do PDF em minúsculas e sem acento, com o mesmo comprimento do original. */
    private final String folded;
    private final int[] inicios;
    /** Trecho do texto ocupado por cada seção do CV. */
    private final Map<SectionKey, List<int[]>> secoes = new EnumMap<>(SectionKey.class);

    public Marcas(ExtractedDoc doc) {
        this.doc = doc;
        TextoPdf.Montado montado = TextoPdf.montar(doc.items());
        String text = montado.text();
        this.inicios = montado.inicios();
        SectionKey atual = null;
        int atualIni = 0;
        int pos = 0;
        for (String linha : Js.linhas(text)) {
            SectionKey k = Sections.headingKey(linha);
            if (k != null) {
                fechar(atual, atualIni, pos);
                atual = k == SectionKey.STOP ? null : k;
                atualIni = pos;
            }
            pos += linha.length() + 1;
        }
        fechar(atual, atualIni, text.length());
        // Sem normalizar para NFC: o texto dobrado precisa manter as posições de `inicios`.
        this.folded = fold(text);
    }

    private void fechar(SectionKey key, int ini, int fim) {
        if (key != null) secoes.computeIfAbsent(key, k -> new ArrayList<>()).add(new int[] {ini, fim});
    }

    private static final Pattern SEPARADOR = Pattern.compile("(?:" + S + "+|" + S + "*[•▪●◦·]" + S + "*)");

    /** Palavras do trecho na ordem, aceitando quebra de linha e marcador de lista entre elas. */
    private static Pattern padrao(String trecho) {
        List<String> palavras = new ArrayList<>();
        for (String p : Js.ESPACOS.split(fold(Normalizar.nfc(trecho)), -1)) if (!p.isEmpty()) palavras.add(Pattern.quote(p));
        if (palavras.isEmpty()) return null;
        return Pattern.compile(String.join(SEPARADOR.pattern(), palavras));
    }

    private int[] buscar(String trecho, List<int[]> faixas) {
        String[] palavras = Js.ESPACOS.split(trecho, -1);
        // Trecho longo que não aparece inteiro (linhas juntadas de outro jeito): tenta o começo e o fim.
        List<String> tentativas = new ArrayList<>();
        tentativas.add(trecho);
        if (palavras.length > 8) {
            tentativas.add(String.join(" ", List.of(palavras).subList(0, 6)));
            tentativas.add(String.join(" ", List.of(palavras).subList(palavras.length - 6, palavras.length)));
        }
        for (String t : tentativas) {
            Pattern re = padrao(t);
            if (re == null) continue;
            for (int[] f : faixas) {
                if (f[0] > folded.length()) continue;
                Matcher m = re.matcher(folded);
                if (m.find(f[0]) && m.end() <= f[1]) return new int[] {m.start(), m.end()};
            }
        }
        return null;
    }

    /** Índices dos trechos do PDF que cobrem o intervalo [ini, fim) do texto. */
    private List<Integer> itensEntre(int ini, int fim) {
        List<Integer> out = new ArrayList<>();
        List<TextItem> items = doc.items();
        for (int i = 0; i < items.size(); i++) {
            TextItem it = items.get(i);
            int a = inicios[i];
            if (!Js.vazio(it.str()) && a < fim && a + it.str().length() > ini) out.add(i);
        }
        return out;
    }

    private static final Pattern RETICENCIAS = Pattern.compile("…|\\.\\.\\.");

    /** Onde um trecho do CV aparece no PDF; a busca começa pela seção de onde a evidência veio. */
    public List<Integer> localizar(String trecho, SectionKey secao) {
        List<int[]> todo = List.of(new int[] {0, folded.length()});
        List<int[]> faixas = todo;
        if (secao != null && secoes.containsKey(secao)) {
            faixas = new ArrayList<>(secoes.get(secao));
            faixas.addAll(todo);
        }
        TreeSet<Integer> out = new TreeSet<>();
        for (String bruto : RETICENCIAS.split(trecho, -1)) {
            String parte = Js.trim(bruto);
            if (parte.length() < 2) continue;
            int[] achado = buscar(parte, faixas);
            if (achado != null) out.addAll(itensEntre(achado[0], achado[1]));
        }
        return new ArrayList<>(out);
    }

    public List<Integer> localizar(String trecho) {
        return localizar(trecho, null);
    }
}
