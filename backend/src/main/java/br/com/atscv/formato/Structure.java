package br.com.atscv.formato;

import static br.com.atscv.comum.Js.S;
import static br.com.atscv.comum.Js.rei;
import static br.com.atscv.comum.Normalizar.fold;
import static br.com.atscv.ranking.Datas.DATE_RE;
import static br.com.atscv.ranking.Datas.RANGE_RE;
import static br.com.atscv.ranking.Datas.endDate;
import static br.com.atscv.ranking.Datas.findRange;
import static br.com.atscv.ranking.Datas.periodOf;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.Normalizar;
import br.com.atscv.formato.Modelos.CertificationEntry;
import br.com.atscv.formato.Modelos.EducationEntry;
import br.com.atscv.formato.Modelos.ExperienceEntry;
import br.com.atscv.formato.Modelos.LanguageEntry;
import br.com.atscv.formato.Modelos.Periodo;
import br.com.atscv.formato.Modelos.SkillGroup;
import br.com.atscv.formato.Modelos.Structured;
import br.com.atscv.formato.Sections.SectionKey;
import br.com.atscv.ranking.Datas.Intervalo;
import br.com.atscv.ranking.LocalParser;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Lê o texto do CV como dados estruturados (experiência, formação, habilidades...). */
public final class Structure {
    private Structure() {}

    private static final Pattern BULLET_RE = Js.re("^[●•▸·\\-–*◦▪]" + S + "*");
    private static final Pattern DURATION_RE =
            rei("^\\d+" + S + "*(anos?|mes(?:es)?)(" + S + "+\\d+" + S + "*mes(?:es)?)?\\z");
    private static final Pattern CONTATO_RE = rei(
            "@|https?:|www\\.|linkedin|github|\\(?\\d{2}\\)?" + S + "?9?\\d{4}[-" + Js.WS_CLASS + "]?\\d{4}");
    private static final Pattern PAGE_RE = Pattern.compile("Page \\d+ of \\d+");

    public static String cleanText(String text) {
        // "Page 2 of 4" do export do LinkedIn vem colado ao conteúdo seguinte.
        return PAGE_RE.matcher(Normalizar.nfc(text)).replaceAll("\n");
    }

    private static final Pattern TIDY_VAZIO = Js.re("\\(" + S + "*\\)");
    private static final Pattern TIDY_DURACAO = rei("\\(" + S + "*\\d+" + S + "*(?:anos?|mes(?:es)?)(?:" + S + "+\\d+"
            + S + "*mes(?:es)?)?" + S + "*\\)");
    private static final Pattern TIDY_INICIO = Js.re("^[" + Js.WS_CLASS + "·•)\\-–|,:(]+");
    private static final Pattern TIDY_FIM = Js.re("[" + Js.WS_CLASS + "·•\\-–|,:(]+\\z");

    static String tidy(String s) {
        String r = TIDY_VAZIO.matcher(s).replaceAll("");
        r = TIDY_DURACAO.matcher(r).replaceAll("");
        r = TIDY_INICIO.matcher(r).replaceFirst("");
        r = TIDY_FIM.matcher(r).replaceFirst("");
        return Js.trim(Js.colapsar(r));
    }

    private static boolean bullet(String s) {
        return BULLET_RE.matcher(s).find();
    }

    private static String semBullet(String s) {
        return BULLET_RE.matcher(s).replaceFirst("");
    }

    private static String ou(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    // ---------- Experiência ----------

    private static final Pattern FIM_PONTUACAO = Js.re("[.,;:]\\z");

    private static boolean companyLike(String s) {
        return s.length() > 1 && s.length() <= 45 && s.split(" ", -1).length <= 6 && !FIM_PONTUACAO.matcher(s).find()
                && !bullet(s) && findRange(s) == null && !DURATION_RE.matcher(s).find();
    }

    private record Cabeca(String cargo, String empresa, Periodo periodo) {}

    private static final Pattern LOCAL_LINHA = Js.re("^[\\p{L}][\\p{L} .'-]+," + S + "*[\\p{L} .'-]+(," + S
            + "*[\\p{L} .'-]+)?\\z");
    private static final Pattern FIM_LOCAL = Js.re("[.:;]\\z");
    private static final Pattern TEC = rei("^(principais" + S + "+)?(tecnologias|stack|ferramentas)" + S + "*:");
    private static final Pattern ATE_DOIS_PONTOS = Js.re("^[^:]*:" + S + "*");

    public static List<ExperienceEntry> parseExperience(List<String> lines) {
        List<Integer> anchors = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) if (findRange(lines.get(i)) != null) anchors.add(i);
        List<Integer> starts = new ArrayList<>();
        List<Cabeca> heads = new ArrayList<>();
        String lastCompany = null;

        for (int i : anchors) {
            String linha = lines.get(i);
            Intervalo r = findRange(linha);
            String rest = tidy(linha.substring(0, r.start()) + " " + linha.substring(r.end()));
            int floor = (starts.isEmpty() ? -1 : anchors.get(starts.size() - 1)) + 1;
            String cargo = null;
            String empresa = null;
            int start = i;

            if (rest.contains("|")) {
                String[] p = rest.split("\\|", -1);
                cargo = ou(tidy(p[0]));
                empresa = ou(tidy(p[1]));
            } else if (rest.length() > 3) {
                cargo = rest;
            } else if (i - 1 >= floor) {
                cargo = lines.get(i - 1);
                start = i - 1;
                String cand = i - 2 >= 0 ? lines.get(i - 2) : null;
                boolean temCand = cand != null && !cand.isEmpty();
                if (i - 2 >= floor && temCand && DURATION_RE.matcher(cand).find() && i - 3 >= floor) {
                    empresa = lines.get(i - 3);
                    start = i - 3;
                } else if (i - 2 >= floor && temCand && companyLike(cand)) {
                    empresa = cand;
                    start = i - 2;
                } else {
                    empresa = lastCompany;
                }
            }
            if (empresa != null && !empresa.isEmpty()) lastCompany = empresa;
            starts.add(start);
            heads.add(new Cabeca(cargo, empresa, r.period()));
        }

        List<ExperienceEntry> out = new ArrayList<>();
        for (int n = 0; n < anchors.size(); n++) {
            int anchor = anchors.get(n);
            int end = n + 1 < anchors.size() ? starts.get(n + 1) : lines.size();
            List<String> body = new ArrayList<>(end > anchor + 1 ? lines.subList(anchor + 1, end) : List.of());
            Cabeca h = heads.get(n);
            List<String> responsabilidades = new ArrayList<>();
            String local = null;

            if (!body.isEmpty()) {
                String b0 = body.get(0);
                if (b0.length() <= 60 && LOCAL_LINHA.matcher(b0).find() && !FIM_LOCAL.matcher(b0).find()) {
                    local = body.remove(0);
                }
            }
            List<String> summary = new ArrayList<>();
            List<String> techBuf = null;
            for (String line : body) {
                if (TEC.matcher(fold(line)).find()) {
                    techBuf = new ArrayList<>(List.of(ATE_DOIS_PONTOS.matcher(line).replaceFirst("")));
                } else if (techBuf != null) {
                    techBuf.add(line);
                } else if (bullet(line)) {
                    responsabilidades.add(semBullet(line));
                } else if (!responsabilidades.isEmpty()) {
                    int last = responsabilidades.size() - 1;
                    responsabilidades.set(last, responsabilidades.get(last) + " " + line);
                } else {
                    summary.add(line);
                }
            }
            out.add(new ExperienceEntry(h.cargo(), h.empresa(), h.periodo(), local,
                    summary.isEmpty() ? null : String.join(" ", summary), responsabilidades,
                    techBuf == null ? null : String.join(" ", techBuf)));
        }
        return out;
    }

    // ---------- Formação ----------

    private static final Pattern STATUS_RE = rei("\\(" + S + "*(conclu[ií]d[oa]|em andamento|cursando|incompleto|trancado"
            + "|interrompido)" + S + "*\\)");
    private static final Pattern CST = rei("^curso superior de tecnologia( \\(cst\\))?,?" + S + "*");
    private static final Pattern NIVEL_NO_CURSO = rei("^(gradua[çc][aã]o|t[eé]cnic[oa]|p[oó]s-?gradua[çc][aã]o|mestrado"
            + "|doutorado)" + S + "+(em|de)" + S + "+");

    private static String levelOf(String s) {
        String f = fold(s);
        if (Js.re("intercambio|mobilidade estudantil").matcher(f).find()) return "Intercâmbio";
        if (Js.re("doutorado").matcher(f).find()) return "Doutorado";
        if (Js.re("mestrado").matcher(f).find()) return "Mestrado";
        if (Js.re("\\bmba\\b|pos-?graduacao|especializacao").matcher(f).find()) return "Pós-graduação";
        if (Js.re("tecnic[oa]\\b").matcher(f).find()) return "Técnico";
        if (Js.re("graduacao|bacharel|tecnologo|superior de tecnologia|licenciatura").matcher(f).find()) return "Graduação";
        if (Js.re("ensino medio|ensino secundario").matcher(f).find()) return "Ensino Médio";
        return "Não identificado";
    }

    public static List<EducationEntry> parseEducation(List<String> lines, LocalDate hoje) {
        String blob = String.join("\n", lines);
        List<EducationEntry> entries = new ArrayList<>();
        String folded = fold(blob);
        Matcher m = RANGE_RE.matcher(folded);
        int cursor = 0;
        while (m.find()) {
            String segment = blob.substring(cursor, m.start());
            cursor = m.end();
            Periodo period = periodOf(m, blob);

            Matcher st = STATUS_RE.matcher(segment);
            String statusText = st.find() ? st.group(1) : null;
            String seg = STATUS_RE.matcher(segment).replaceFirst("");
            List<String> segLines = new ArrayList<>();
            for (String l : Js.linhas(seg)) {
                String t = tidy(l);
                if (!t.isEmpty()) segLines.add(t);
            }
            if (segLines.isEmpty()) continue;

            String curso;
            String instituicao = null;
            String joined = String.join(" ", segLines);
            if (joined.contains("|")) {
                String[] p = joined.split("\\|", -1);
                curso = tidy(p[0]);
                instituicao = tidy(p[1]);
            } else if (segLines.size() > 1) {
                instituicao = segLines.get(0);
                curso = String.join(" ", segLines.subList(1, segLines.size()));
            } else {
                curso = segLines.get(0);
            }

            String nivel = levelOf(curso == null ? "" : curso);
            if (curso != null && !curso.isEmpty()) {
                String c = CST.matcher(curso).replaceFirst("");
                c = NIVEL_NO_CURSO.matcher(c).replaceFirst("");
                curso = tidy(c);
            }

            String status = null;
            boolean inferido = false;
            LocalDate end = endDate(period);
            if (statusText != null) {
                status = statusText.substring(0, 1).toUpperCase() + statusText.substring(1).toLowerCase();
            } else if (period.atual()) {
                status = "Em andamento";
                inferido = true;
            } else if (end != null) {
                status = end.isAfter(hoje) ? "Em andamento" : "Concluído";
                inferido = true;
            }
            entries.add(new EducationEntry(nivel, curso, instituicao, status, inferido, period));
        }
        return entries;
    }

    // ---------- Certificações, idiomas, habilidades ----------

    private static final Pattern CONNECTOR_END = rei("\\b(ao|a|de|do|da|dos|das|com|e|em|no|na|para|o|os)\\z");
    private static final Pattern COMECA_MINUSCULA = Js.re("^[a-zà-ú]");
    // O TypeScript original tinha /^(utilizando|usando|com|em|para)<BACKSPACE>/i, com um caractere de controle no
    // lugar do \b: a condição nunca valeu. Mantida desligada para não mudar a leitura das certificações.

    public static List<CertificationEntry> parseCertifications(List<String> lines) {
        List<String> items = new ArrayList<>();
        for (String raw : lines) {
            boolean isBullet = bullet(raw);
            String line = semBullet(raw);
            String prev = items.isEmpty() ? null : items.get(items.size() - 1);
            if (prev != null && !prev.isEmpty() && !isBullet
                    && (COMECA_MINUSCULA.matcher(line).find() || CONNECTOR_END.matcher(prev).find())) {
                items.set(items.size() - 1, prev + " " + line);
            } else {
                items.add(line);
            }
        }
        List<CertificationEntry> out = new ArrayList<>();
        for (String it : items) {
            Matcher dm = DATE_RE.matcher(fold(it));
            int ini = -1;
            int fim = -1;
            while (dm.find()) {
                ini = dm.start();
                fim = dm.end();
            }
            String data = ini >= 0 ? it.substring(ini, fim) : null;
            String noDate = tidy(ini >= 0 ? it.substring(0, ini) + it.substring(fim) : it);
            String[] p = noDate.split("\\|", -1);
            String nome = tidy(p[0]);
            String emissor = p.length > 1 ? ou(tidy(p[1])) : null;
            out.add(new CertificationEntry(nome, emissor, data));
        }
        return out;
    }

    private static final Pattern LANGS = rei("^(portugu[êe]s|ingl[êe]s|espanhol|franc[êe]s|alem[ãa]o|italiano|japon[êe]s"
            + "|mandarim|chin[êe]s|libras)\\b");
    private static final Pattern NIVEL_ENTRE_PARENTESES = Js.re("^" + S + "*\\(([^)]*)\\)" + S + "*\\z");
    private static final Pattern BARRA = Js.re(S + "*\\|" + S + "*");

    public static List<LanguageEntry> parseLanguages(List<String> lines) {
        List<LanguageEntry> out = new ArrayList<>();
        for (String l : lines) {
            String sem = semBullet(l);
            Matcher m = LANGS.matcher(sem);
            if (!m.find()) continue;
            String rest = sem.substring(m.group().length());
            rest = NIVEL_ENTRE_PARENTESES.matcher(rest).replaceFirst("$1");
            rest = BARRA.matcher(rest).replaceAll(" · ");
            out.add(new LanguageEntry(m.group(), ou(tidy(rest))));
        }
        return out;
    }

    private static final Pattern PONTO_FINAL = Js.re("\\.\\z");

    private static List<String> splitTopLevel(String s) {
        List<String> parts = new ArrayList<>();
        int depth = 0;
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == '(') depth++;
            if (ch == ')') depth = Math.max(0, depth - 1);
            if (depth == 0 && ",;·•|".indexOf(ch) >= 0) {
                parts.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(ch);
            }
        }
        parts.add(cur.toString());
        List<String> out = new ArrayList<>();
        for (String x : parts) {
            String t = Js.trim(PONTO_FINAL.matcher(x).replaceFirst(""));
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    private static final Pattern CATEGORIA = Js.re("^([^:()]{2,40}):" + S + "*(.*)\\z");
    private static final Pattern TERMINA_EM_VIRGULA = Js.re("[,(]\\z");

    public static List<SkillGroup> parseSkills(List<String> lines) {
        List<String> categorias = new ArrayList<>();
        List<List<String>> itens = new ArrayList<>();
        String bufCategoria = null;
        StringBuilder bufTexto = null;

        for (String raw : lines) {
            String line = semBullet(raw);
            Matcher m = CATEGORIA.matcher(line);
            if (m.find()) {
                if (bufCategoria != null) {
                    categorias.add(bufCategoria);
                    itens.add(splitTopLevel(bufTexto.toString()));
                }
                bufCategoria = Js.trim(m.group(1));
                bufTexto = new StringBuilder(m.group(2));
            } else if (bufCategoria != null && TERMINA_EM_VIRGULA.matcher(Js.trim(bufTexto.toString())).find()) {
                bufTexto.append(' ').append(line);
            } else {
                if (bufCategoria != null) {
                    categorias.add(bufCategoria);
                    itens.add(splitTopLevel(bufTexto.toString()));
                }
                bufCategoria = null;
                bufTexto = null;
                // Itens soltos, um por linha, ficam no mesmo grupo.
                int last = categorias.size() - 1;
                if (last >= 0 && categorias.get(last).equals("Geral")) {
                    itens.get(last).addAll(splitTopLevel(line));
                } else {
                    bufCategoria = "Geral";
                    bufTexto = new StringBuilder(line);
                }
            }
        }
        if (bufCategoria != null) {
            categorias.add(bufCategoria);
            itens.add(splitTopLevel(bufTexto.toString()));
        }
        List<SkillGroup> groups = new ArrayList<>();
        for (int i = 0; i < categorias.size(); i++) groups.add(new SkillGroup(categorias.get(i), itens.get(i)));
        return groups;
    }

    public static Structured parseStructure(String rawText, LocalDate hoje) {
        String text = cleanText(rawText);
        Map<SectionKey, List<String>> sections = Sections.sectionize(text);
        List<String> pre = Sections.preambulo(text);
        List<String> resumo = sections.getOrDefault(SectionKey.RESUMO, List.of());
        List<String> contato = new ArrayList<>();
        for (String l : pre) if (CONTATO_RE.matcher(l).find()) contato.add(l);
        for (String l : Sections.linhasDeContato(text)) {
            if (CONTATO_RE.matcher(l).find() || LocalParser.localDe(l) != null) contato.add(l);
        }
        List<String> cabecalho = new ArrayList<>();
        for (String l : pre) if (!CONTATO_RE.matcher(l).find()) cabecalho.add(l);
        return new Structured(
                parseExperience(sections.getOrDefault(SectionKey.EXPERIENCIA, List.of())),
                parseEducation(sections.getOrDefault(SectionKey.FORMACAO, List.of()), hoje),
                parseCertifications(sections.getOrDefault(SectionKey.CERTIFICACOES, List.of())),
                parseLanguages(sections.getOrDefault(SectionKey.IDIOMAS, List.of())),
                parseSkills(sections.getOrDefault(SectionKey.HABILIDADES, List.of())),
                resumo.isEmpty() ? null : ou(String.join(" ", resumo)),
                cabecalho, contato, sections.getOrDefault(SectionKey.PROJETOS, List.of()));
    }

    /** Campos essenciais preenchidos e esperados, em experiência e formação. */
    public record Completude(int filled, int total) {}

    public static Completude completeness(Structured s) {
        int filled = 0;
        int total = 0;
        for (ExperienceEntry e : s.experiencia()) {
            boolean[] campos = {
                e.cargo() != null && !e.cargo().isEmpty(), e.empresa() != null && !e.empresa().isEmpty(),
                e.periodo() != null,
                !e.responsabilidades().isEmpty() || (e.resumo() != null && !e.resumo().isEmpty()),
            };
            total += campos.length;
            for (boolean c : campos) if (c) filled++;
        }
        for (EducationEntry e : s.formacao()) {
            boolean[] campos = {
                e.curso() != null && !e.curso().isEmpty(), e.instituicao() != null && !e.instituicao().isEmpty(),
                e.periodo() != null, e.status() != null && !e.status().isEmpty(), !e.nivel().equals("Não identificado"),
            };
            total += campos.length;
            for (boolean c : campos) if (c) filled++;
        }
        return new Completude(filled, total);
    }
}
