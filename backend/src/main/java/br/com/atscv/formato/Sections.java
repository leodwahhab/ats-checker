package br.com.atscv.formato;

import static br.com.atscv.comum.Normalizar.norm;

import br.com.atscv.comum.Js;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Reconhece os títulos de seção do CV e divide o texto por seção. */
public final class Sections {
    private Sections() {}

    public enum SectionKey {
        EXPERIENCIA("Experiência"), FORMACAO("Formação"), HABILIDADES("Habilidades"), RESUMO("Resumo"),
        IDIOMAS("Idiomas"), CERTIFICACOES("Certificações"), PROJETOS("Projetos"),
        /** Título que encerra a seção anterior mas não interessa (contato, publicações...). */
        STOP("");

        public final String rotulo;

        SectionKey(String rotulo) {
            this.rotulo = rotulo;
        }
    }

    private static final Map<SectionKey, List<String>> TITLES = new LinkedHashMap<>();

    static {
        TITLES.put(SectionKey.EXPERIENCIA, List.of("experiencia", "experiencia profissional", "experiencias",
                "historico profissional", "experiencia de trabalho"));
        TITLES.put(SectionKey.FORMACAO, List.of("formacao", "formacao academica", "educacao", "escolaridade",
                "formacao e cursos"));
        TITLES.put(SectionKey.HABILIDADES, List.of("habilidades", "competencias", "principais competencias", "skills",
                "conhecimentos", "habilidades tecnicas", "competencias tecnicas", "tecnologias", "stack"));
        TITLES.put(SectionKey.RESUMO, List.of("resumo", "resumo profissional", "sobre", "sobre mim", "perfil",
                "perfil profissional", "objetivo", "apresentacao"));
        TITLES.put(SectionKey.IDIOMAS, List.of("idiomas", "languages", "linguas"));
        TITLES.put(SectionKey.CERTIFICACOES, List.of("certificacoes", "certificados", "certifications", "cursos",
                "cursos e certificacoes", "cursos e certificados"));
        TITLES.put(SectionKey.PROJETOS, List.of("projetos", "projetos pessoais", "portfolio", "artigos e projetos"));
    }

    /** Títulos de contato: encerram a seção anterior e não entram em nenhuma, mas o contato é lido à parte. */
    private static final List<String> CONTATO = List.of("contato", "contatos", "contact", "dados pessoais",
            "informacoes de contato", "informacoes pessoais", "links", "redes sociais");
    private static final List<String> STOPPERS;

    static {
        List<String> s = new ArrayList<>(CONTATO);
        s.addAll(List.of("publications", "publicacoes", "premios", "honors awards", "voluntariado", "referencias"));
        STOPPERS = s;
    }

    public static final List<SectionKey> REQUIRED =
            List.of(SectionKey.EXPERIENCIA, SectionKey.FORMACAO, SectionKey.HABILIDADES);

    private static final Pattern NAO_LETRA = Pattern.compile("[^a-z ]");

    private static String chaveDeTitulo(String raw) {
        return Js.trim(Js.colapsar(NAO_LETRA.matcher(norm(raw)).replaceAll("")));
    }

    /** Títulos de seção são linhas curtas; compara a linha normalizada com a lista. Null se não for título. */
    public static SectionKey headingKey(String raw) {
        String line = chaveDeTitulo(raw);
        if (line.isEmpty() || line.split(" ", -1).length > 5) return null;
        for (Map.Entry<SectionKey, List<String>> e : TITLES.entrySet()) {
            if (e.getValue().contains(line)) return e.getKey();
        }
        return STOPPERS.contains(line) ? SectionKey.STOP : null;
    }

    public static Set<SectionKey> detectSections(String text) {
        Set<SectionKey> found = EnumSet.noneOf(SectionKey.class);
        for (String raw : Js.linhas(text)) {
            SectionKey k = headingKey(raw);
            if (k != null && k != SectionKey.STOP) found.add(k);
        }
        return found;
    }

    /** Linhas antes do primeiro título reconhecido (nome, título profissional, contato). */
    public static List<String> preambulo(String text) {
        List<String> out = new ArrayList<>();
        for (String raw : Js.linhas(text)) {
            String line = Js.trim(raw);
            if (line.isEmpty()) continue;
            if (headingKey(line) != null) break;
            out.add(line);
        }
        return out;
    }

    /**
     * Linhas sob títulos de contato ("Contato", "Redes sociais"). Em CVs de duas colunas (export do
     * LinkedIn, Canva) o contato fica numa seção assim, e não no topo.
     */
    public static List<String> linhasDeContato(String text) {
        List<String> out = new ArrayList<>();
        boolean dentro = false;
        for (String raw : Js.linhas(text)) {
            String line = Js.trim(raw);
            if (line.isEmpty()) continue;
            if (headingKey(line) != null) {
                dentro = CONTATO.contains(chaveDeTitulo(line));
                continue;
            }
            if (dentro) out.add(line);
        }
        return out;
    }

    /** Divide o texto em linhas por seção. Linhas antes do primeiro título são descartadas. */
    public static Map<SectionKey, List<String>> sectionize(String text) {
        Map<SectionKey, List<String>> out = new EnumMap<>(SectionKey.class);
        SectionKey current = null;
        for (String raw : Js.linhas(text)) {
            String line = Js.trim(raw);
            if (line.isEmpty()) continue;
            SectionKey k = headingKey(line);
            if (k != null) {
                current = k == SectionKey.STOP ? null : k;
                if (current != null) out.computeIfAbsent(current, x -> new ArrayList<>());
                continue;
            }
            if (current != null) out.get(current).add(line);
        }
        return out;
    }
}
