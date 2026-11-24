package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;
import static br.com.atscv.ranking.Texto.palavras;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.JsRegex;
import br.com.atscv.comum.Normalizar;
import br.com.atscv.ranking.Requisitos.Decomposicao;
import br.com.atscv.ranking.Tipos.CompNaoReconhecido;
import br.com.atscv.ranking.Tipos.CompSkill;
import br.com.atscv.ranking.Tipos.Component;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.ReqOrigem;
import br.com.atscv.ranking.Tipos.ReqTipo;
import br.com.atscv.ranking.Tipos.ReqTipoFonte;
import br.com.atscv.ranking.Tipos.Requirement;
import br.com.atscv.ranking.Tipos.Senioridade;
import br.com.atscv.ranking.Tipos.TipoSecao;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Lê o texto de uma vaga: título, seções, requisitos (obrigatórios, desejáveis, informativos) e condições. */
public final class Vaga {
    private Vaga() {}

    private static Pattern re(String fonte) {
        return JsRegex.compilar(fonte);
    }

    private static Pattern reu(String fonte) {
        return JsRegex.compilar(fonte, "u");
    }

    private static final Pattern INVISIVEIS = re("[\\u200B-\\u200D\\u2060\\uFEFF]");
    private static final Pattern EMOJI_NO_INICIO = reu("^\\p{Extended_Pictographic}");
    private static final Pattern ASTERISCOS = re("\\*+");
    private static final Pattern TITULO_COM_RESTO = re("^([^:]{2,80}):\\s*(.*)$");
    private static final Pattern NAO_ALFANUMERICO = re("[^a-z0-9+# ]");
    private static final Pattern INSTITUCIONAL = re("^(sobre|about|why|who is|conheca)\\b");
    private static final Pattern TERMINA_EM_PONTO = re("\\.$");

    /** @param resto texto depois de "Título:" na mesma linha */
    public record TituloDeSecao(TipoSecao tipo, String resto) {}

    /** Uma linha é título de seção quando é curta, casa com o léxico e não cita nenhum requisito. */
    public static TituloDeSecao tituloDeSecao(String linha, Dicionario dict) {
        String semInvisiveis = Js.trim(INVISIVEIS.matcher(linha).replaceAll(""));
        boolean comEmoji = EMOJI_NO_INICIO.matcher(semInvisiveis).find();
        String raw = Js.trim(ASTERISCOS.matcher(Texto.INICIO.matcher(semInvisiveis).replaceFirst("")).replaceAll(""));
        Matcher m = TITULO_COM_RESTO.matcher(raw);
        boolean temDoisPontos = m.find();
        String cabeca = temDoisPontos ? m.group(1) : raw;
        String f = Js.trim(Js.colapsar(NAO_ALFANUMERICO.matcher(fold(cabeca)).replaceAll(" ")));
        // Títulos com emoji ou do tipo "Sobre a área de…" podem ser um pouco mais longos.
        boolean institucional = comEmoji || INSTITUCIONAL.matcher(f).find();
        int n = palavras(f);
        if (f.isEmpty() || n > (institucional ? 12 : 7)) return null;
        if (!temDoisPontos && TERMINA_EM_PONTO.matcher(raw).find()) return null;
        List<Component> componentes = Requisitos.decompose(cabeca, dict).componentes();
        if (componentes.stream().anyMatch(c -> !(c instanceof CompNaoReconhecido))) return null;
        // Termo desconhecido indica conteúdo ("Desejável conhecimento do Ecomex"), salvo em títulos bem curtos
        // ("REQUISITOS E QUALIFICAÇÕES") ou institucionais ("Who is Equifax?").
        if (!componentes.isEmpty() && n > 3 && !institucional) return null;
        for (var s : Lexicos.SECOES) {
            if (s.re().matcher(f).find()) return new TituloDeSecao(s.chave(), temDoisPontos ? Js.trim(m.group(2)) : "");
        }
        return null;
    }

    private static ReqTipo marcadorDaLinha(String f) {
        if (Lexicos.MARCADOR_DESEJAVEL.matcher(f).find()) return ReqTipo.DESEJAVEL;
        if (Lexicos.MARCADOR_OBRIGATORIO.matcher(f).find()) return ReqTipo.OBRIGATORIO;
        return null;
    }

    private static final Pattern BULLETS_COLADOS = reu("(?:^|[;:.]\\s*|\\s)-\\s+\\p{Lu}");
    private static final Pattern SEPARADOR_COLADO =
            reu(";\\s*(?:-\\s+)?|(?<=[.:!?])\\s+(?:-\\s+)?(?=\\p{Lu})|\\s+-\\s+(?=\\p{Lu})");
    private static final Pattern SEPARADOR_SIMPLES = reu(";\\s+|(?<=\\.)\\s+(?=\\p{Lu})");

    /**
     * Parágrafos longos viram uma frase por requisito. A cópia do LinkedIn às vezes junta a vaga numa linha só, com
     * títulos e bullets no meio: "…produtivo. Requisitos e Qualificações: - Ensino…; - Experiência…".
     */
    static List<String> dividir(String linha) {
        if (linha.length() <= 160) return List.of(linha);
        // Lista colada ("…: - Item; - Item"): quebra também nos bullets e depois dos títulos.
        Matcher b = BULLETS_COLADOS.matcher(linha);
        int colados = 0;
        while (b.find()) colados++;
        Pattern separador = colados >= 2 ? SEPARADOR_COLADO : SEPARADOR_SIMPLES;
        List<String> out = new ArrayList<>();
        for (String s : separador.split(linha, -1)) {
            String t = Js.trim(s);
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    private static final Pattern FIM_COM_PONTUACAO = re("[?!]$");

    /**
     * Texto institucional ou prosa: só nomes próprios sem cara de requisito, ou parágrafo longo que só cita tempo
     * ("A Acme é especialista em… com 6 anos de experiência no mercado").
     */
    private static boolean descartavel(List<Component> componentes, String limpo, String f, int n) {
        if (componentes.stream().allMatch(c -> c instanceof CompNaoReconhecido)) {
            return FIM_COM_PONTUACAO.matcher(limpo).find() || n > 20 || Lexicos.IGNORAR_LINHA.matcher(f).find()
                    || (n > 4 && !Lexicos.PARECE_REQUISITO.matcher(f).find());
        }
        return n > 30 && componentes.stream().allMatch(c -> !(c instanceof CompSkill) && !(c instanceof Tipos.CompFormacao)
                && !(c instanceof Tipos.CompIdioma));
    }

    private static final Pattern TITULO_VAGA = JsRegex.compilar("^vaga\\s*[:\\-–]\\s*", "i");
    private static final Pattern ABREVIACAO = JsRegex.compilar("\\b(jr|sr|pl)\\.$", "i");
    private static final Pattern QUEBRA_DE_LINHA = re("\\r?\\n");
    private static final Pattern DOIS_PONTOS_FINAL = re(":$");

    /** Estado da leitura de uma vaga. */
    private static final class Leitor {
        final Dicionario dict;
        final boolean temSecoes;
        final List<Requirement> requisitos = new ArrayList<>();
        final List<String> naoAvaliaveis = new ArrayList<>();
        final Set<String> termos = new LinkedHashSet<>();
        TipoSecao secao;

        Leitor(Dicionario dict, boolean temSecoes) {
            this.dict = dict;
            this.temSecoes = temSecoes;
        }

        void processar(String pedaco, ReqTipo marcadorSecao) {
            String limpo = Js.trim(Texto.INICIO.matcher(pedaco).replaceFirst(""));
            if (limpo.length() < 2) return;
            String f = fold(limpo);
            // Sem título de seção, numa vaga que tem seções, o texto solto é contexto (apresentação, stack).
            TipoSecao efetiva = secao != null ? secao : temSecoes ? TipoSecao.CONTEXTO : null;
            // A lista de tecnologias é contexto quando a vaga tem requisitos; sem eles, ela é o requisito.
            if (efetiva == TipoSecao.STACK) efetiva = temSecoes ? TipoSecao.CONTEXTO : null;
            if (efetiva == TipoSecao.IGNORADA) return;

            Decomposicao dec = Requisitos.decompose(limpo, dict);
            List<Component> componentes = new ArrayList<>(dec.componentes());
            int n = palavras(limpo);
            if (componentes.isEmpty()) {
                if (dec.soft()) {
                    if (efetiva != TipoSecao.CONTEXTO && n <= 25) naoAvaliaveis.add(limpo);
                    return;
                }
                // Rótulo ("Com certeza tem que ter:"), modelo de trabalho, benefícios.
                if (DOIS_PONTOS_FINAL.matcher(limpo).find() || Lexicos.IGNORAR_LINHA.matcher(f).find()) return;
            }

            ReqTipo marcador = marcadorSecao != null ? marcadorSecao : marcadorDaLinha(f);
            // "Desenvolver e manter…", mesmo listado em Requisitos, é atividade: só as tecnologias, como informativas.
            if (efetiva != TipoSecao.CONTEXTO && marcador == null && Lexicos.VERBO_ATIVIDADE.matcher(f).find()) {
                efetiva = TipoSecao.CONTEXTO;
            }
            ReqTipo tipo;
            ReqTipoFonte tipoFonte;
            ReqOrigem origem;
            if (efetiva == TipoSecao.OBRIGATORIO || efetiva == TipoSecao.DESEJAVEL) {
                if (componentes.isEmpty()) {
                    // Sem nada reconhecível: só fica se tiver cara de requisito ("Noção de boas práticas…").
                    if (FIM_COM_PONTUACAO.matcher(limpo).find() || n > 14 || (n > 5 && !Lexicos.PARECE_REQUISITO.matcher(f).find())) return;
                    componentes.add(new CompNaoReconhecido(List.of()));
                } else if (descartavel(componentes, limpo, f, n)) {
                    // Só nomes próprios sem cara de requisito ("Na Neppo, você irá…", "Auxílio Creche…") ou prosa.
                    return;
                }
                tipo = marcador != null ? marcador : efetiva == TipoSecao.OBRIGATORIO ? ReqTipo.OBRIGATORIO : ReqTipo.DESEJAVEL;
                tipoFonte = marcador != null ? ReqTipoFonte.MARCADOR : ReqTipoFonte.SECAO;
                origem = efetiva == TipoSecao.OBRIGATORIO ? ReqOrigem.REQUISITOS : ReqOrigem.DIFERENCIAIS;
            } else if (efetiva == TipoSecao.CONTEXTO) {
                // Atividades: só as tecnologias citadas, como informativas (não entram na faixa).
                componentes = new ArrayList<>(componentes.stream().filter(c -> c instanceof CompSkill).toList());
                if (componentes.isEmpty()) return;
                tipo = marcador != null ? marcador : ReqTipo.INFORMATIVO;
                tipoFonte = marcador != null ? ReqTipoFonte.MARCADOR : ReqTipoFonte.SECAO;
                origem = ReqOrigem.ATIVIDADES;
            } else {
                if (componentes.isEmpty() || descartavel(componentes, limpo, f, n)) return;
                if (marcador != null) {
                    tipo = marcador;
                    tipoFonte = ReqTipoFonte.MARCADOR;
                } else if (Lexicos.HEURISTICA_OBRIGATORIO.matcher(f).find()) {
                    tipo = ReqTipo.OBRIGATORIO;
                    tipoFonte = ReqTipoFonte.HEURISTICA;
                } else {
                    tipo = ReqTipo.DESEJAVEL;
                    tipoFonte = ReqTipoFonte.PADRAO;
                }
                origem = ReqOrigem.SEM_SECAO;
            }
            requisitos.add(new Requirement("r" + (requisitos.size() + 1), limpo, tipo, tipoFonte, origem, componentes));
            for (Component c : componentes) if (c instanceof CompNaoReconhecido nr) termos.addAll(nr.termos());
        }
    }

    public static JobSpec parseJob(String texto, Dicionario dict) {
        List<String> linhas = new ArrayList<>();
        for (String l : QUEBRA_DE_LINHA.split(INVISIVEIS.matcher(Normalizar.nfc(texto)).replaceAll(""), -1)) {
            String t = Js.trim(l);
            if (!t.isEmpty()) linhas.add(t);
        }
        List<TituloDeSecao> titulos = new ArrayList<>();
        for (String l : linhas) titulos.add(tituloDeSecao(l, dict));

        String titulo = null;
        int inicio = 0;
        String primeira = linhas.isEmpty() ? null : linhas.get(0);
        // Ponto final indica frase, salvo abreviação de senioridade ("Engenheiro de Software Jr.").
        if (primeira != null && titulos.get(0) == null && palavras(primeira) <= 16
                && (!TERMINA_EM_PONTO.matcher(primeira).find() || ABREVIACAO.matcher(primeira).find())
                && (Cargos.familiaDe(primeira) != null || Cargos.senioridadeDe(primeira) != null)) {
            titulo = TITULO_VAGA.matcher(primeira).replaceFirst("");
            inicio = 1;
        }

        // Linha longa vira pedaços, e um pedaço também pode ser título de seção ("Requisitos e Qualificações:").
        // Linha que já começa com título ("Certificações desejáveis: A, B ou C") continua inteira.
        List<String> entradas = new ArrayList<>();
        List<TituloDeSecao> entradaTitulos = new ArrayList<>();
        for (int k = 0; k < linhas.size() - inicio; k++) {
            String linha = linhas.get(inicio + k);
            TituloDeSecao t = titulos.get(inicio + k);
            List<String> pedacos = t != null ? List.of(linha) : dividir(linha);
            if (pedacos.size() > 1) {
                for (String p : pedacos) {
                    entradas.add(p);
                    entradaTitulos.add(tituloDeSecao(p, dict));
                }
            } else {
                entradas.add(linha);
                entradaTitulos.add(t);
            }
        }
        // Só títulos "puros" (sem texto depois dos dois pontos) contam como estrutura da vaga.
        boolean temSecoes = entradaTitulos.stream().anyMatch(t -> t != null && t.resto().isEmpty()
                && (t.tipo() == TipoSecao.OBRIGATORIO || t.tipo() == TipoSecao.DESEJAVEL));

        Leitor leitor = new Leitor(dict, temSecoes);
        for (int k = 0; k < entradas.size(); k++) {
            String linha = entradas.get(k);
            TituloDeSecao t = entradaTitulos.get(k);
            ReqTipo marcadorSecao = null;
            if (t != null) {
                if (t.resto().isEmpty()) {
                    leitor.secao = t.tipo();
                    continue;
                }
                // "Diferencial: Airflow" no meio da lista marca só esta linha (e a linha inteira é lida, para
                // "Certificações desejáveis: …" continuar sendo uma lista de certificações); "Benefícios: VR" troca de seção.
                if (t.tipo() == TipoSecao.OBRIGATORIO || t.tipo() == TipoSecao.DESEJAVEL) {
                    marcadorSecao = t.tipo() == TipoSecao.OBRIGATORIO ? ReqTipo.OBRIGATORIO : ReqTipo.DESEJAVEL;
                } else {
                    leitor.secao = t.tipo();
                    linha = t.resto();
                }
            }
            for (String pedaco : dividir(linha)) leitor.processar(pedaco, marcadorSecao);
        }

        // Sem título, o cargo pode estar na apresentação: "Estamos em busca de uma pessoa Desenvolvedora Full Stack Júnior".
        String apresentacao = titulo != null ? null : cargoNaApresentacao(linhas);
        Senioridade senioridade;
        if (titulo != null) {
            senioridade = Cargos.senioridadeDe(titulo);
        } else {
            senioridade = Cargos.senioridadeDe(apresentacao == null ? "" : apresentacao);
            if (senioridade == null) senioridade = Cargos.senioridadeDe(String.join(" ", linhas.subList(0, Math.min(3, linhas.size()))));
        }
        Condicoes.Resultado c = Condicoes.lerCondicoes(linhas);
        // Pelos requisitos: o texto institucional pode estar em outro idioma ("Who is Equifax?").
        var idioma = Texto.idiomaDoTexto(String.join("\n", leitor.requisitos.stream().map(Requirement::texto).toList()));
        if (idioma == null) idioma = Texto.idiomaDoTexto(texto);
        return new JobSpec(titulo, Cargos.familiaDe(titulo != null ? titulo : apresentacao != null ? apresentacao : ""),
                senioridade, temSecoes, leitor.requisitos, leitor.naoAvaliaveis, new ArrayList<>(leitor.termos), c.modelo(),
                c.local(), c.eliminatorias(), c.afirmativa(), idioma, c.pais());
    }

    private static final Pattern BUSCA = re("\\b(?:buscamos|procuramos|contratamos|estamos (?:em busca de|buscando|procurando|contratando)"
            + "|we ?(?:'|’)?re (?:looking for|hiring)|we are (?:looking for|hiring))\\s+(?:um\\(a\\)\\s+|uma?\\s+|an?\\s+|o\\(a\\)\\s+)?"
            + "(?:pessoa\\s+)?([^,.;:!]{3,80}?)(?=\\s+(?:para|que|to|who|with|com|em|no|na)\\b|[,.;:!]|$)");

    private static String cargoNaApresentacao(List<String> linhas) {
        for (String linha : linhas.subList(0, Math.min(25, linhas.size()))) {
            Matcher m = BUSCA.matcher(fold(linha));
            if (m.find() && (Cargos.familiaDe(m.group(1)) != null || Cargos.senioridadeDe(m.group(1)) != null)) return m.group(1);
        }
        return null;
    }
}
