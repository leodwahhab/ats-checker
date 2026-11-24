package br.com.atscv.ranking;

import static br.com.atscv.comum.Js.S;
import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.Normalizar;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Cidade e UF citadas num texto. */
public final class LocalParser {
    private LocalParser() {}

    /** O local lido; `trecho` é a linha de onde ele veio. */
    public record Local(String cidade, String uf, String trecho) {}

    /** Opções: o texto vem depois de um rótulo; aceita cidade conhecida sem UF (só para a vaga). */
    public record Opcoes(boolean rotulado, boolean cidadesConhecidas) {
        public static final Opcoes PADRAO = new Opcoes(false, false);
    }

    private static final List<String> UFS = List.of(
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
            "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO");

    /** Capitais e polos de tecnologia, para vagas que dão só a cidade ("São Paulo, Brazil"). */
    private static final String[][] CIDADES = {
        {"Rio Branco", "AC"}, {"Maceió", "AL"}, {"Macapá", "AP"}, {"Manaus", "AM"}, {"Salvador", "BA"},
        {"Fortaleza", "CE"}, {"Brasília", "DF"}, {"Vitória", "ES"}, {"Goiânia", "GO"}, {"São Luís", "MA"},
        {"Cuiabá", "MT"}, {"Campo Grande", "MS"}, {"Belo Horizonte", "MG"}, {"Belém", "PA"}, {"João Pessoa", "PB"},
        {"Curitiba", "PR"}, {"Recife", "PE"}, {"Teresina", "PI"}, {"Rio de Janeiro", "RJ"}, {"Natal", "RN"},
        {"Porto Alegre", "RS"}, {"Porto Velho", "RO"}, {"Boa Vista", "RR"}, {"Florianópolis", "SC"},
        {"São Paulo", "SP"}, {"Aracaju", "SE"}, {"Palmas", "TO"},
        {"Campinas", "SP"}, {"Barueri", "SP"}, {"Osasco", "SP"}, {"Guarulhos", "SP"}, {"Santo André", "SP"},
        {"São Bernardo do Campo", "SP"}, {"São Caetano do Sul", "SP"}, {"São José dos Campos", "SP"},
        {"Sorocaba", "SP"}, {"Ribeirão Preto", "SP"}, {"Jundiaí", "SP"}, {"Santos", "SP"}, {"São Carlos", "SP"},
        {"Niterói", "RJ"}, {"Uberlândia", "MG"}, {"Juiz de Fora", "MG"}, {"Joinville", "SC"}, {"Blumenau", "SC"},
        {"Londrina", "PR"}, {"Maringá", "PR"}, {"Caxias do Sul", "RS"}, {"São Leopoldo", "RS"},
        {"Campina Grande", "PB"},
    };

    // Palavra com maiúscula ("Paulo", "Embu-Guaçu") e conectores minúsculos ("Rio de Janeiro").
    private static final String PALAVRA = "\\p{Lu}[\\p{L}'’.]*(?:-\\p{Lu}[\\p{L}'’.]*)?";
    private static final String CIDADE = PALAVRA + "(?: (?:d[aeo]s? )?" + PALAVRA + ")*";
    private static final String UF = "(" + String.join("|", UFS) + ")";
    /** "Osasco - SP", "São Paulo/SP", "São Paulo, SP, BR". Sem "|": em "JAVA | GO" não há cidade. */
    private static final Pattern CIDADE_UF =
            Pattern.compile("(?<![\\p{L}])(" + CIDADE + ")" + S + "*[-–—/,]" + S + "*" + UF + "(?![\\p{L}])");
    /** Logo depois de um rótulo: "Local de trabalho: São Paulo - SPjobTypes…" (a Gupy cola texto depois da UF). */
    private static final Pattern CIDADE_UF_ROTULADO =
            Pattern.compile("^" + S + "*(" + CIDADE + ")" + S + "*[-–—/,]" + S + "*" + UF);

    /** Palavras com maiúscula que aparecem antes da cidade sem fazer parte dela. */
    private static final Set<String> NAO_CIDADE = Set.of(
            "hibrido", "hibrida", "remoto", "remota", "presencial", "local", "sede", "escritorio", "vaga", "cidade",
            "modelo", "trabalho", "office", "location", "localizacao", "endereco", "residencia", "brasil", "brazil",
            "atuacao");
    private static final Pattern ARTIGO = Pattern.compile("^d[aeo]s?\\z");

    private static final Pattern CIDADES_RE;
    private static final Map<String, String[]> CIDADE_CONHECIDA = new LinkedHashMap<>();

    static {
        List<String> folded = new ArrayList<>();
        for (String[] c : CIDADES) {
            String f = fold(c[0]);
            folded.add(f);
            CIDADE_CONHECIDA.put(f, c);
        }
        CIDADES_RE = Texto.compilarTermos(folded);
    }

    private static String limparCidade(String bruta) {
        List<String> palavras = new ArrayList<>(List.of(bruta.split(" ", -1)));
        while (!palavras.isEmpty()
                && (NAO_CIDADE.contains(fold(palavras.get(0))) || ARTIGO.matcher(palavras.get(0)).find())) {
            palavras.remove(0);
        }
        String r = String.join(" ", palavras);
        return r.isEmpty() ? null : r;
    }

    /** Cidade e UF citadas no texto; null quando não há. */
    public static Local localDe(String texto) {
        return localDe(texto, Opcoes.PADRAO);
    }

    public static Local localDe(String texto, Opcoes op) {
        String src = Js.trim(Normalizar.nfc(texto));
        Matcher m = null;
        if (op.rotulado()) {
            Matcher r = CIDADE_UF_ROTULADO.matcher(src);
            if (r.find()) m = r;
        }
        if (m == null) {
            Matcher c = CIDADE_UF.matcher(src);
            if (c.find()) m = c;
        }
        if (m != null) return new Local(limparCidade(m.group(1)), m.group(2), src);
        if (op.cidadesConhecidas()) {
            Matcher c = CIDADES_RE.matcher(fold(src));
            if (c.find()) {
                String[] conhecida = CIDADE_CONHECIDA.get(Js.colapsar(c.group()));
                if (conhecida != null) return new Local(conhecida[0], conhecida[1], src);
            }
        }
        return null;
    }

    /** "2x por semana no escritório", "1 ou 2 dias na semana", "com flexibilidade": presencial em parte da semana. */
    private static final Pattern PARTE_DA_SEMANA = Pattern.compile(
            "\\b(\\d+ ?x|uma|duas|tres|\\d+ (ou \\d+ )?dias?|\\d+ vezes) (por|na|a cada) semana\\b|\\bflexibilidade\\b");
    private static final Pattern HIBRIDO = Pattern.compile("\\b(hibrid[oa]s?|hybrid)\\b");
    private static final Pattern PRESENCIAL = Pattern.compile("\\b(presencia(l|is)|on-?site|in-?office)\\b");
    private static final Pattern REMOTO = Pattern.compile(
            "\\b(remot[oa]s?|remote|home[" + Js.WS_CLASS + "-]?office|anywhere|teletrabalho)\\b");

    /** Modelo de trabalho citado no texto (já com fold). Híbrido vence: "hybrid remote model" é híbrido. */
    public static Tipos.Modelo modeloDe(String f) {
        if (HIBRIDO.matcher(f).find()) return Tipos.Modelo.HIBRIDO;
        if (PRESENCIAL.matcher(f).find()) {
            return PARTE_DA_SEMANA.matcher(f).find() ? Tipos.Modelo.HIBRIDO : Tipos.Modelo.PRESENCIAL;
        }
        if (REMOTO.matcher(f).find()) return Tipos.Modelo.REMOTO;
        return null;
    }

    /** "Trabalho híbrido". */
    public static String rotuloModelo(Tipos.Modelo m) {
        return switch (m) {
            case REMOTO -> "remoto";
            case HIBRIDO -> "híbrido";
            case PRESENCIAL -> "presencial";
        };
    }

    /** "A vaga é híbrida". */
    public static String rotuloModeloVaga(Tipos.Modelo m) {
        return switch (m) {
            case REMOTO -> "remota";
            case HIBRIDO -> "híbrida";
            case PRESENCIAL -> "presencial";
        };
    }

    /** "São Paulo - SP", "SP". */
    public static String rotuloLocal(Local l) {
        List<String> partes = new ArrayList<>();
        if (l.cidade() != null && !l.cidade().isEmpty()) partes.add(l.cidade());
        if (l.uf() != null && !l.uf().isEmpty()) partes.add(l.uf());
        return String.join(" - ", partes);
    }
}
