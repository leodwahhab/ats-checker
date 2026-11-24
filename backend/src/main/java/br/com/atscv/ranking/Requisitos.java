package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.JsRegex;
import br.com.atscv.comum.Normalizar;
import br.com.atscv.ranking.Dicionario.SkillMatch;
import br.com.atscv.ranking.Tipos.AreaFormacao;
import br.com.atscv.ranking.Tipos.CompAnos;
import br.com.atscv.ranking.Tipos.CompCargo;
import br.com.atscv.ranking.Tipos.CompFormacao;
import br.com.atscv.ranking.Tipos.CompIdioma;
import br.com.atscv.ranking.Tipos.CompNaoReconhecido;
import br.com.atscv.ranking.Tipos.CompSkill;
import br.com.atscv.ranking.Tipos.Component;
import br.com.atscv.ranking.Tipos.ModoSkill;
import br.com.atscv.ranking.Tipos.NivelFormacao;
import br.com.atscv.ranking.Tipos.NivelIdioma;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Decompõe uma linha da vaga em componentes verificáveis (skills, anos, formação, idioma, cargo). */
public final class Requisitos {
    private Requisitos() {}

    /**
     * @param termosNaoReconhecidos termos com cara de tecnologia que não estão no dicionário
     * @param soft a linha é só comportamental (comunicação, proatividade...)
     */
    public record Decomposicao(List<Component> componentes, List<String> termosNaoReconhecidos, boolean soft) {}

    private static final Set<String> STOP = Set.of("a", "o", "as", "os", "e", "ou", "de", "da", "do", "das", "dos", "em", "na",
            "no", "nas", "nos", "com", "para", "por", "um", "uma", "ao", "aos", "and", "or", "with", "the", "of", "in", "to",
            "for");

    private static Pattern re(String fonte) {
        return JsRegex.compilar(fonte);
    }

    private static Pattern reu(String fonte) {
        return JsRegex.compilar(fonte, "u");
    }

    public static Decomposicao decompose(String linha, Dicionario dict) {
        String src = expandirPrefixos(Normalizar.nfc(linha), dict);
        String f = fold(src);
        List<SkillMatch> matches = dict.find(src);
        List<Component> componentes = new ArrayList<>(gruposDeSkills(src, f, rotuloRedundante(src, matches, dict)));

        Matcher anos = Lexicos.ANOS.matcher(f);
        if (anos.find()) {
            List<String> skillIds = ids(matches);
            componentes.add(new CompAnos(Integer.parseInt(anos.group(1)), skillIds,
                    skillIds.isEmpty() ? Cargos.familiaDe(src) : null));
        }

        Component formacao = formacaoDe(f);
        if (formacao != null) componentes.add(formacao);

        for (var par : Lexicos.IDIOMAS) {
            if (!par.re().matcher(f).find()) continue;
            NivelIdioma nivel = NivelIdioma.INTERMEDIARIO;
            for (var n : Lexicos.NIVEIS_IDIOMA) {
                if (n.re().matcher(f).find()) {
                    nivel = n.chave();
                    break;
                }
            }
            componentes.add(new CompIdioma(par.chave(), nivel));
        }

        Matcher cargo = Lexicos.COMO_CARGO.matcher(f);
        String familia = cargo.find() ? Cargos.familiaDe(cargo.group()) : null;
        if (familia != null) componentes.add(new CompCargo(familia));

        // Numa lista "qualquer uma de…", os termos desconhecidos são só mais alternativas.
        List<String> termos = qualquerUma(src, f) && !matches.isEmpty() ? List.of() : termosDesconhecidos(src, matches);
        if (!termos.isEmpty()) componentes.add(new CompNaoReconhecido(termos));

        List<Component> unicos = new ArrayList<>(new LinkedHashSet<>(componentes));
        return new Decomposicao(unicos, termos, unicos.isEmpty() && Lexicos.SOFT_SKILLS.matcher(f).find());
    }

    private static List<String> ids(List<SkillMatch> ms) {
        Set<String> out = new LinkedHashSet<>();
        for (SkillMatch m : ms) out.add(m.id());
        return new ArrayList<>(out);
    }

    private static final Pattern ROTULO = re("^([^:]{2,40}):\\s*\\S");

    /**
     * "Mensageria: Kafka / RabbitMQ", "Cloud: AWS": o rótulo é só a categoria dos itens. Quando um item já comprova
     * o rótulo (Kafka implica mensageria), o rótulo sai e vale o que vem depois dos dois pontos.
     */
    private static List<SkillMatch> rotuloRedundante(String src, List<SkillMatch> matches, Dicionario dict) {
        Matcher rotulo = ROTULO.matcher(src);
        if (!rotulo.find()) return matches;
        int fim = rotulo.group(1).length();
        Set<String> depois = new LinkedHashSet<>();
        for (SkillMatch m : matches) if (m.start() > fim) depois.add(m.id());
        List<SkillMatch> out = new ArrayList<>();
        for (SkillMatch m : matches) {
            boolean implicaDepois = dict.implicadoPor(m.id()).stream().anyMatch(depois::contains);
            if (m.end() > fim || !implicaDepois) out.add(m);
        }
        return out;
    }

    private static final Pattern PREFIXO = reu("(\\p{L}[\\p{L}\\p{N}.#+-]*)\\s*\\(([^()]{1,80})\\)");
    private static final Pattern SEPARA_ITENS = re("\\s*(?:[,;/]|\\s(?:e|ou|and|or)\\s)\\s*");

    /**
     * "Spring (Boot, Cloud)" vira "Spring Boot, Spring Cloud" quando a combinação é uma skill diferente do item
     * sozinho. "AWS (SQS, S3)" fica como está: SQS já é SQS sozinho.
     */
    private static String expandirPrefixos(String src, Dicionario dict) {
        Matcher m = PREFIXO.matcher(src);
        return m.replaceAll(r -> {
            String todo = r.group();
            String prefixo = r.group(1);
            String dentro = r.group(2);
            String base = unica(prefixo, dict);
            if (base == null) return Matcher.quoteReplacement(todo);
            List<String> itens = new ArrayList<>();
            for (String x : SEPARA_ITENS.split(dentro, -1)) {
                String t = Js.trim(x);
                if (!t.isEmpty()) itens.add(t);
            }
            boolean expandiu = false;
            List<String> novos = new ArrayList<>();
            for (String item : itens) {
                String combinado = unica(prefixo + " " + item, dict);
                if (combinado != null && !combinado.equals(base) && !combinado.equals(unica(item, dict))) {
                    expandiu = true;
                    novos.add(prefixo + " " + item);
                } else {
                    novos.add(item);
                }
            }
            return Matcher.quoteReplacement(expandiu ? String.join(", ", novos) : todo);
        });
    }

    private static String unica(String texto, Dicionario dict) {
        List<SkillMatch> ms = dict.find(texto);
        return ms.size() == 1 && ms.get(0).start() == 0 && ms.get(0).end() == texto.length() ? ms.get(0).id() : null;
    }

    private enum Separador { VIRGULA, E, OU, BARRA, EXEMPLO, QUEBRA }

    /** "X, como A", "X (ex.: A", "X, preferencialmente A", "X (A": A é exemplo/alternativa de X. */
    private static final Pattern EXEMPLO = re("^\\s*,?\\s*(?:\\(\\s*)?(?:ex(?:emplos?)?\\.?|e\\.?\\s?g\\.?|i\\.?\\s?e\\.?|como"
            + "|tais como|por exemplo|incluindo|including|especialmente|principalmente|preferencialmente|preferably"
            + "|such as|like)\\s*[:,]?\\s*$|^\\s*\\(\\s*$");
    private static final Set<String> CONECTORES = Set.of("e", "ou", "and", "or", "&");
    /** Palavras que podem ficar entre itens de uma lista sem quebrá-la: "ou outra ferramenta de". */
    private static final Set<String> ENCHIMENTO = Set.of(
            "outra", "outro", "outras", "outros", "other", "others", "ferramenta", "ferramentas", "tools", "framework",
            "frameworks", "tecnologia", "tecnologias", "linguagem", "linguagens", "similar", "similares", "equivalente",
            "equivalentes", "qualquer", "arquitetura", "arquiteturas", "plataforma", "plataformas", "ambiente", "ambientes",
            "banco", "bancos", "servicos", "conceitos", "praticas", "metodologia", "metodologias", "de", "do", "da", "dos",
            "das", "em", "a", "o", "as", "os", "um", "uma");
    private static final Pattern SO_VIRGULAS = re("^[,;]*$");
    private static final Pattern SIMBOLOS = re("[,;/()]");

    private static Separador separador(String entre) {
        if (EXEMPLO.matcher(entre).find()) return Separador.EXEMPLO;
        String t = Js.trim(entre);
        if (t.equals("/")) return Separador.BARRA;
        if (SO_VIRGULAS.matcher(t).find()) return Separador.VIRGULA;
        List<String> palavras = new ArrayList<>();
        for (String p : Js.ESPACOS.split(SIMBOLOS.matcher(t).replaceAll(" "), -1)) if (!p.isEmpty()) palavras.add(p);
        if (!palavras.stream().allMatch(p -> CONECTORES.contains(p) || ENCHIMENTO.contains(p))) return Separador.QUEBRA;
        if (palavras.stream().anyMatch(p -> p.equals("ou") || p.equals("or")) || t.contains("/")) return Separador.OU;
        if (palavras.stream().anyMatch(p -> p.equals("e") || p.equals("and") || p.equals("&"))) return Separador.E;
        return Separador.QUEBRA;
    }

    private static final class Grupo {
        final List<SkillMatch> itens = new ArrayList<>();
        /** Os itens são alternativas (basta um). */
        boolean ou;
        /** O grupo é "skill + exemplos": a lista de exemplos continua enquanto houver conectores. */
        boolean exemplos;
    }

    private static final Pattern CERTIFICACOES_NO_INICIO = re("^\\s*certificac(ao|oes)|^\\s*certificad[oa]s?\\b");
    private static final Pattern PELO_MENOS_UMA = re("\\b(alguma d[ao]s|uma d[ao]s|uma ou mais|um ou mais|pelo menos (uma?|um)"
            + "|ao menos (uma?|um)|qualquer uma|at least one|one or more|any of)\\b");

    /**
     * Linhas em que qualquer item basta: "pelo menos uma de A, B, C" (sem parênteses, que já agrupam sozinhos) e
     * listas de certificações.
     */
    private static boolean qualquerUma(String src, String f) {
        if (CERTIFICACOES_NO_INICIO.matcher(f).find()) return true;
        return !src.contains("(") && PELO_MENOS_UMA.matcher(f).find();
    }

    private static final Pattern LISTA_DO_FIM = re("^\\s*,?\\s*(ou|or)\\s+(outr[oa]s?|similar(es)?|equivalentes?|semelhantes"
            + "|afins|frameworks? similares|ferramentas? similares)\\b");

    private static boolean dentroDeParenteses(String src, int pos) {
        int abre = 0;
        int fecha = 0;
        for (int i = 0; i < pos; i++) {
            if (src.charAt(i) == '(') abre++;
            else if (src.charAt(i) == ')') fecha++;
        }
        return abre > fecha;
    }

    /**
     * Agrupa as skills da linha. "A, B ou C" vira um grupo "alguma"; "A, B e C" viram componentes separados (todas).
     * Exemplos ("X, como A ou B", "X (A, B)") entram no grupo de X. "A/B" liga só o par.
     */
    private static List<Component> gruposDeSkills(String src, String f, List<SkillMatch> matches) {
        if (matches.isEmpty()) return List.of();
        if (qualquerUma(src, f)) return List.of(new CompSkill(ids(matches), ModoSkill.ALGUMA));

        List<Grupo> grupos = new ArrayList<>();
        for (int i = 0; i < matches.size(); i++) {
            SkillMatch m = matches.get(i);
            if (i == 0) {
                novo(grupos, m);
                continue;
            }
            SkillMatch anterior = matches.get(i - 1);
            // Grafia combinada ("testes unitários e de integração"): cada skill é exigida à parte.
            if (m.start() == anterior.start() && m.end() == anterior.end()) {
                novo(grupos, m);
                continue;
            }
            Grupo g = grupos.get(grupos.size() - 1);
            String entre = f.substring(anterior.end(), m.start());
            boolean dentro = dentroDeParenteses(src, m.start());
            boolean mesmoNivel = dentro == dentroDeParenteses(src, anterior.start()) && !SIMBOLOS_PAR.matcher(entre).find();
            Separador sep = separador(entre);

            if (sep == Separador.EXEMPLO) {
                g = isolarUltima(grupos, g);
                g.itens.add(m);
                g.ou = true;
                g.exemplos = true;
            } else if (mesmoNivel && dentro) {
                // Itens dentro do mesmo parêntese são alternativas.
                g.itens.add(m);
                g.ou = true;
            } else if (g.exemplos && mesmoNivel && sep != Separador.QUEBRA) {
                g.itens.add(m);
            } else if (sep == Separador.BARRA && mesmoNivel) {
                g = isolarUltima(grupos, g);
                g.itens.add(m);
                g.ou = true;
            } else if (sep == Separador.OU && mesmoNivel) {
                g.itens.add(m);
                g.ou = true;
            } else if (sep == Separador.VIRGULA && mesmoNivel && !g.ou) {
                g.itens.add(m);
            } else {
                // Quebra, "e", ou vírgula depois de um "ou" ("Java/Kotlin, Spring Boot" pede Spring Boot à parte).
                novo(grupos, m);
            }
        }

        // "JUnit, Mockito ou similares": a lista do fim vira alternativa.
        String depois = f.substring(matches.get(matches.size() - 1).end());
        if (LISTA_DO_FIM.matcher(depois).find()) grupos.get(grupos.size() - 1).ou = true;

        List<Component> out = new ArrayList<>();
        for (Grupo g : grupos) {
            List<String> lista = ids(g.itens);
            if (g.ou && lista.size() > 1) out.add(new CompSkill(lista, ModoSkill.ALGUMA));
            else for (String id : lista) out.add(new CompSkill(List.of(id), ModoSkill.TODAS));
        }
        return out;
    }

    private static final Pattern SIMBOLOS_PAR = re("[()]");

    private static Grupo novo(List<Grupo> grupos, SkillMatch m) {
        Grupo g = new Grupo();
        g.itens.add(m);
        grupos.add(g);
        return g;
    }

    /** Tira a última skill de uma lista "e" para um grupo só dela (que vai receber exemplos ou um par A/B). */
    private static Grupo isolarUltima(List<Grupo> grupos, Grupo g) {
        if (g.itens.size() < 2 || g.ou) return g;
        return novo(grupos, g.itens.remove(g.itens.size() - 1));
    }

    private static final Pattern CURSANDO = re("\\bcursando\\b");

    private static Component formacaoDe(String f) {
        List<NivelFormacao> niveis = new ArrayList<>();
        for (var par : Lexicos.NIVEIS_FORMACAO) if (par.re().matcher(f).find()) niveis.add(par.chave());
        boolean cursando = Lexicos.ACEITA_CURSANDO.matcher(f).find();
        if (niveis.isEmpty() && !CURSANDO.matcher(f).find()) return null;
        NivelFormacao minimo = NivelFormacao.GRADUACAO;
        if (!niveis.isEmpty()) {
            minimo = niveis.get(0);
            for (NivelFormacao n : niveis) {
                if (Lexicos.ORDEM_FORMACAO.indexOf(n) < Lexicos.ORDEM_FORMACAO.indexOf(minimo)) minimo = n;
            }
        }
        return new CompFormacao(minimo, Lexicos.AREA_TI.matcher(f).find() ? AreaFormacao.TI : AreaFormacao.QUALQUER, cursando);
    }

    private static final Pattern PARENTESES = re("\\([^()]*\\)");
    private static final Pattern PALAVRA = reu("[\\p{L}\\p{N}][\\p{L}\\p{N}#+.\\-]*");
    private static final Pattern QUEBRA_DE_TERMO = re("[,;:()!?/]|\\.\\s");
    private static final Pattern FIM_DE_FRASE = re("[.:!?]\\s*$");
    private static final Pattern PONTUACAO_FINAL = re("[.\\-]+$");
    private static final Pattern VERSAO = JsRegex.compilar("^(?:v?\\d+(?:\\.\\d+)*\\+?|\\d+x)$", "i");
    private static final Pattern DUAS_MAIUSCULAS = reu("\\p{Lu}.*\\p{Lu}");
    private static final Pattern SIMBOLO_TECNICO = re("[#+]");
    private static final Pattern DIGITO = re("\\d");
    private static final Pattern LETRA = reu("\\p{L}");
    private static final Pattern COMECA_MAIUSCULA = reu("^\\p{Lu}");
    private static final Pattern ITEM_DE_LISTA = reu("^\\s*(?:[,;/)]|$|(?:e|ou|and|or)\\s+(?:,|\\p{Lu}))");
    private static final Pattern SUFIXO_DE_SUBSTANTIVO = re("(cao|coes|dade|dades|mento|mentos|encia|ancia|ismo|ivo|iva)$");

    /**
     * Palavras com cara de termo técnico que o dicionário não reconheceu: com maiúscula no meio da frase (Quarkus,
     * Protheus), em caixa alta (ADVPL) ou com número/símbolo (K8s).
     */
    private static List<String> termosDesconhecidos(String src, List<SkillMatch> matches) {
        char[] chars = src.toCharArray();
        for (SkillMatch m : matches) for (int i = m.start(); i < m.end(); i++) chars[i] = ',';
        String texto = new String(chars);
        // Parênteses que já têm uma skill reconhecida são lista de exemplos: "(IDoc, RFC, APIs)".
        List<int[]> exemplos = new ArrayList<>();
        Matcher p = PARENTESES.matcher(src);
        while (p.find()) {
            int a = p.start();
            int b = p.end();
            if (matches.stream().anyMatch(m -> m.start() >= a && m.end() <= b)) exemplos.add(new int[] {a, b});
        }

        List<String> termos = new ArrayList<>();
        List<String> atual = new ArrayList<>();
        int fim = 0;
        boolean inicioDeFrase = true;
        Matcher m = PALAVRA.matcher(texto);
        while (m.find()) {
            String entre = texto.substring(fim, m.start());
            if (QUEBRA_DE_TERMO.matcher(entre).find()) fechar(termos, atual);
            if (fim == 0 || FIM_DE_FRASE.matcher(entre).find()) inicioDeFrase = true;
            String palavra = PONTUACAO_FINAL.matcher(m.group()).replaceFirst("");
            String chave = fold(palavra);
            // Versões ("v4+", "8+") e frequência ("2x por semana") não são termos.
            boolean versao = VERSAO.matcher(palavra).find();
            boolean tecnico = DUAS_MAIUSCULAS.matcher(palavra).find() || SIMBOLO_TECNICO.matcher(palavra).find()
                    || (DIGITO.matcher(palavra).find() && LETRA.matcher(palavra).find());
            boolean maiuscula = COMECA_MAIUSCULA.matcher(palavra).find();
            // No início da frase, a maiúscula só conta se a palavra for item de lista ("Quarkus, Java…") e não tiver
            // cara de substantivo comum ("Inovação", "Resiliência").
            boolean itemDeLista = ITEM_DE_LISTA.matcher(texto.substring(m.end())).find()
                    && (!matches.isEmpty() || !SUFIXO_DE_SUBSTANTIVO.matcher(chave).find());
            int pos = m.start();
            boolean emExemplo = exemplos.stream().anyMatch(e -> pos > e[0] && pos < e[1]);
            boolean candidato = palavra.length() > 1 && LETRA.matcher(palavra).find() && !versao && !emExemplo
                    && !STOP.contains(chave) && !Lexicos.PALAVRAS_GENERICAS.contains(chave)
                    && !Lexicos.SOFT_SKILLS.matcher(chave).find()
                    && (tecnico || (maiuscula && (!inicioDeFrase || itemDeLista)));
            if (candidato) atual.add(palavra);
            else fechar(termos, atual);
            inicioDeFrase = false;
            fim = m.end();
        }
        fechar(termos, atual);
        return new ArrayList<>(new LinkedHashSet<>(termos));
    }

    private static void fechar(List<String> termos, List<String> atual) {
        if (!atual.isEmpty()) termos.add(String.join(" ", atual));
        atual.clear();
    }
}
