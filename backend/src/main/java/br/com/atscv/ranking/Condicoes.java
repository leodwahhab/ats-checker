package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.JsRegex;
import br.com.atscv.ranking.LocalParser.Local;
import br.com.atscv.ranking.LocalParser.Opcoes;
import br.com.atscv.ranking.Tipos.CompFormacao;
import br.com.atscv.ranking.Tipos.CompIdioma;
import br.com.atscv.ranking.Tipos.Component;
import br.com.atscv.ranking.Tipos.Eliminatoria;
import br.com.atscv.ranking.Tipos.EliminatoriaTipo;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.Modelo;
import br.com.atscv.ranking.Tipos.NivelIdioma;
import br.com.atscv.ranking.Tipos.ReqTipo;
import br.com.atscv.ranking.Tipos.Requirement;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Local, modelo de trabalho, eliminatórias prováveis e vaga afirmativa, lidos do texto da vaga. */
public final class Condicoes {
    private Condicoes() {}

    private static Pattern re(String fonte) {
        return JsRegex.compilar(fonte);
    }

    private static final Pattern ROTULO_LOCAL = re(
            "^(?:local(?:izacao)?(?: d[ae] (?:trabalho|atuacao)(?: da vaga)?)?|location|cidade|sede)\\s*:\\s*");
    private static final Pattern ROTULO_MODELO_LINHA = re(
            "^(?:modelo(?: de (?:trabalho|atuacao))?|work(?:place)? (?:model|type)|regime de trabalho|formato de trabalho)\\s*:\\s*");
    /** Modelo no título, depois de um separador: "Desenvolvedor Java AWS - Híbrido São Paulo". */
    private static final Pattern MODELO_NO_TITULO = re("(?:^|[-–—|(,/]\\s*)(hibrid[oa]|remot[oa]|presencial|hybrid|remote)\\b");
    /** Frases que dizem o modelo no meio do texto: "modelo híbrido", "trabalho 100% remoto", "hybrid model". */
    private static final Pattern FRASE_MODELO = re("\\b(modelo (de trabalho |de atuacao )?(hibrido|remoto|presencial)"
            + "|trabalho (100% )?(hibrido|remoto|presencial)|(100% |totalmente )remot[oa]|hybrid (remote )?(model|work)"
            + "|remote[- ](first|position|role|work)|fully remote|on-?site)\\b");
    private static final Pattern JOB_TYPES = re("jobTypes.*$");
    private static final Pattern COLADO = JsRegex.compilar("(?<=\\p{Ll})\\p{Lu}.*$", "u");
    private static final Pattern ASTERISCOS = re("\\*+");

    /** O que a leitura das condições devolve. */
    public record Resultado(Modelo modelo, Local local, String pais, List<Eliminatoria> eliminatorias, String afirmativa) {}

    /**
     * A Gupy cola texto da interface depois do valor do rótulo ("Modelo de trabalho: HíbridoTrabalho Híbrido
     * íconeHíbrido", "São Paulo - SPjobTypes…"). Só para linhas com rótulo: em texto corrido, "JavaScript" também tem
     * minúscula seguida de maiúscula.
     */
    private static String semColado(String linha) {
        String s = JOB_TYPES.matcher(linha).replaceFirst("");
        return Js.trim(COLADO.matcher(s).replaceFirst(""));
    }

    /** Estado da leitura: o primeiro modelo e o primeiro local achados, e a linha de onde vieram. */
    private static final class Leitura {
        Modelo modelo;
        Local local;
        String linhaModelo;
        String linhaLocal;
        /** Linhas que falam do local, para achar o país quando não há cidade brasileira ("Lisboa, Portugal"). */
        final List<String> sobreLocal = new ArrayList<>();

        void achouModelo(Modelo m, String linha) {
            if (m != null && modelo == null) {
                modelo = m;
                linhaModelo = linha;
            }
        }

        void achouLocal(Local l, String linha) {
            sobreLocal.add(linha);
            if (l != null && local == null) {
                local = l;
                linhaLocal = linha;
            }
        }
    }

    private static final class Rascunho {
        final List<EliminatoriaTipo> tipos = new ArrayList<>();
        final List<String> rotulos = new ArrayList<>();
        final List<String> trechos = new ArrayList<>();

        void add(EliminatoriaTipo tipo, String rotulo, String trecho) {
            for (int i = 0; i < tipos.size(); i++) if (tipos.get(i) == tipo && rotulos.get(i).equals(rotulo)) return;
            tipos.add(tipo);
            rotulos.add(rotulo);
            trechos.add(trecho);
        }

        boolean temLocal() {
            return tipos.contains(EliminatoriaTipo.LOCAL);
        }
    }

    public static Resultado lerCondicoes(List<String> brutas) {
        List<String> linhas = new ArrayList<>();
        for (String l : brutas) {
            String t = Js.trim(ASTERISCOS.matcher(Texto.INICIO.matcher(l).replaceFirst("")).replaceAll(""));
            if (!t.isEmpty()) linhas.add(t);
        }
        Leitura lt = new Leitura();

        // 1. Rótulos: "Local de trabalho: São Paulo - SP", "Modelo de trabalho: Híbrido".
        for (String linha : linhas) {
            String f = fold(linha);
            Matcher rl = ROTULO_LOCAL.matcher(f);
            if (rl.find()) {
                lt.achouLocal(LocalParser.localDe(linha.substring(rl.end()), new Opcoes(true, true)), semColado(linha));
            }
            Matcher rm = ROTULO_MODELO_LINHA.matcher(f);
            if (rm.find()) {
                lt.achouModelo(LocalParser.modeloDe(f.substring(rm.end())), semColado(linha));
                lt.achouLocal(LocalParser.localDe(linha.substring(rm.end()), new Opcoes(false, true)), semColado(linha));
            }
        }
        // 2. Linhas curtas do topo ("Híbrido", "São Paulo, SP, BR").
        for (String linha : linhas.subList(0, Math.min(3, linhas.size()))) {
            // Num título longo, só depois de separador: "Mobile Híbrido" é o tipo de app, não o modelo.
            if (Texto.palavras(linha) <= 4 || MODELO_NO_TITULO.matcher(fold(linha)).find()) {
                lt.achouModelo(LocalParser.modeloDe(fold(linha)), linha);
            }
            if (Texto.palavras(linha) <= 8) lt.achouLocal(LocalParser.localDe(linha, new Opcoes(false, true)), linha);
        }
        // 3. Frases no meio do texto ("modelo presencial com flexibilidade em São Paulo/SP").
        for (String linha : linhas) {
            if (!FRASE_MODELO.matcher(fold(linha)).find()) continue;
            lt.achouModelo(LocalParser.modeloDe(fold(linha)), linha);
            lt.achouLocal(LocalParser.localDe(linha, new Opcoes(false, true)), linha);
        }
        String pais = null;
        if (lt.local != null) {
            pais = "Brasil";
        } else {
            for (var p : Lexicos.PAISES) {
                if (lt.sobreLocal.stream().anyMatch(l -> p.re().matcher(fold(l)).find())) {
                    pais = p.chave();
                    break;
                }
            }
        }

        Rascunho el = new Rascunho();
        if ((lt.modelo == Modelo.HIBRIDO || lt.modelo == Modelo.PRESENCIAL) && lt.local != null) {
            LinkedHashSet<String> partes = new LinkedHashSet<>();
            if (lt.linhaModelo != null) partes.add(lt.linhaModelo);
            if (lt.linhaLocal != null) partes.add(lt.linhaLocal);
            el.add(EliminatoriaTipo.LOCAL,
                    "Trabalho " + LocalParser.rotuloModelo(lt.modelo) + " em " + LocalParser.rotuloLocal(lt.local),
                    String.join(" · ", partes));
        }
        String afirmativa = null;
        for (String linha : linhas) {
            String f = fold(linha);
            if (Lexicos.RESIDENCIA.matcher(f).find() && !el.temLocal()) el.add(EliminatoriaTipo.LOCAL, "Local de residência", linha);
            if (Lexicos.CONTEXTO_DISPONIBILIDADE.matcher(f).find()) {
                for (var d : Lexicos.DISPONIBILIDADE) {
                    if (d.re().matcher(f).find()) el.add(EliminatoriaTipo.DISPONIBILIDADE, d.chave(), linha);
                }
            }
            for (var d : Lexicos.DOCUMENTO) if (d.re().matcher(f).find()) el.add(EliminatoriaTipo.DOCUMENTO, d.chave(), linha);
            if (afirmativa == null && Lexicos.AFIRMATIVA.matcher(f).find() && Lexicos.GRUPO_AFIRMATIVO.matcher(f).find()) {
                afirmativa = linha;
            }
        }

        List<Eliminatoria> out = new ArrayList<>();
        for (int i = 0; i < el.tipos.size(); i++) {
            out.add(new Eliminatoria("v" + (i + 1), el.tipos.get(i), el.rotulos.get(i), el.trechos.get(i), null));
        }
        return new Resultado(lt.modelo, lt.local, pais, out, afirmativa);
    }

    private static String rotuloFormacao(CompFormacao c) {
        String situacao = c.aceitaCursando() ? " completo ou em andamento" : " completo";
        return Lexicos.rotuloFormacao(c.nivelMinimo()) + situacao
                + (c.area() == Tipos.AreaFormacao.TI ? " em TI ou área afim" : "");
    }

    /**
     * Eliminatórias que vêm de requisitos obrigatórios: idioma em nível alto, formação (inclusive período do curso no
     * estágio) e certificação. Mudar o requisito para desejável tira a pergunta.
     */
    public static List<Eliminatoria> eliminatoriasDosRequisitos(JobSpec job) {
        List<Eliminatoria> out = new ArrayList<>();
        for (Requirement r : job.requisitos()) {
            if (r.tipo() != ReqTipo.OBRIGATORIO) continue;
            String f = fold(r.texto());
            for (Component c : r.componentes()) {
                if (c instanceof CompIdioma i
                        && Lexicos.ORDEM_IDIOMA.indexOf(i.nivelMinimo()) >= Lexicos.ORDEM_IDIOMA.indexOf(NivelIdioma.AVANCADO)) {
                    add(out, new Eliminatoria(r.id() + ":idioma", EliminatoriaTipo.IDIOMA,
                            i.idioma() + " " + Lexicos.rotuloIdioma(i.nivelMinimo()) + " ou acima", r.texto(), r.id()));
                }
                if (c instanceof CompFormacao fo) {
                    add(out, new Eliminatoria(r.id() + ":formacao", EliminatoriaTipo.FORMACAO, rotuloFormacao(fo), r.texto(), r.id()));
                }
            }
            if (Lexicos.PERIODO_CURSO.matcher(f).find()) {
                add(out, new Eliminatoria(r.id() + ":periodo", EliminatoriaTipo.FORMACAO,
                        "Período do curso ou previsão de formatura", r.texto(), r.id()));
            }
            if (Lexicos.CERTIFICACAO.matcher(f).find()) {
                add(out, new Eliminatoria(r.id() + ":certificacao", EliminatoriaTipo.CERTIFICACAO, "Certificação exigida",
                        r.texto(), r.id()));
            }
        }
        return out;
    }

    private static void add(List<Eliminatoria> out, Eliminatoria e) {
        boolean repetida = out.stream().anyMatch(x -> x.id().equals(e.id()) || (x.tipo() == e.tipo() && x.rotulo().equals(e.rotulo())));
        if (!repetida) out.add(e);
    }
}
