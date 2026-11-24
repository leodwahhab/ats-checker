package br.com.atscv.formato;

import static br.com.atscv.comum.Js.S;
import static br.com.atscv.comum.Js.rei;

import br.com.atscv.comum.Js;
import br.com.atscv.formato.Contact.ContactInfo;
import br.com.atscv.formato.Contact.Linkedin;
import br.com.atscv.formato.Layout.LayoutInfo;
import br.com.atscv.formato.Margens.Resultado;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.formato.Modelos.CheckResult;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.formato.Modelos.LanguageEntry;
import br.com.atscv.formato.Modelos.Status;
import br.com.atscv.formato.Modelos.Structured;
import br.com.atscv.formato.Sections.SectionKey;
import br.com.atscv.formato.Structure.Completude;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Análise de formato: o quanto o PDF é legível por um ATS. */
public final class Analyzer {
    private Analyzer() {}

    private record Risco(Pattern padrao, String nome) {}

    private static final List<Risco> RISKY_PRODUCERS = List.of(
            new Risco(rei("canva"), "Canva"),
            new Risco(rei("apache fop"), "exportação do LinkedIn (Apache FOP)"),
            new Risco(rei("photoshop|illustrator|indesign"), "software de design gráfico"));

    private static final String MONTHS = "jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|jan(?:eiro)?|fevereiro"
            + "|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
    private static final Pattern DATE_RE = rei("(\\b(" + MONTHS + ")[a-z]*\\.?" + S + "*(de" + S + "*)?\\d{4}"
            + "|\\b\\d{1,2}/\\d{4}|\\b(19|20)\\d{2}\\b)");
    /** Área de uso privado, símbolos diversos e dingbats, e emojis. */
    private static final Pattern GLYPHS = Pattern.compile("[\\uE000-\\uF8FF\\x{1F300}-\\x{1FAFF}\\u2600-\\u27BF]");
    private static final Pattern SEM_ESPACOS = Pattern.compile("[" + Js.WS_CLASS + "]");
    private static final Pattern LINKEDIN_URL = rei("linkedin\\.com/in/");
    private static final Pattern APACHE_FOP = rei("apache fop");

    private static CheckResult check(String id, String title, int weight, Status status, String detail, String fix,
            List<Integer> itens) {
        return new CheckResult(id, title, status, weight, detail, fix, itens);
    }

    private static double fator(Status s) {
        return switch (s) {
            case PASS -> 1;
            case WARN -> 0.5;
            case FAIL -> 0;
        };
    }

    /** Analisa o documento; `hoje` só decide se uma formação sem status já terminou. */
    public static Analysis analyze(ExtractedDoc doc, LocalDate hoje) {
        List<CheckResult> checks = new ArrayList<>();
        Marcas marcas = new Marcas(doc);

        int chars = SEM_ESPACOS.matcher(doc.text()).replaceAll("").length();
        boolean hasText = (double) chars / doc.numPages() >= 200;
        checks.add(check("text-layer", "Texto selecionável", 30, hasText ? Status.PASS : Status.FAIL,
                hasText ? chars + " caracteres extraídos."
                        : "Quase nenhum texto foi extraído: o PDF parece ser uma imagem (escaneado ou \"imprimir como imagem\").",
                hasText ? null : "Exporte o CV direto do editor (Word/Google Docs) como PDF, sem digitalizar.", null));

        if (!hasText) return finish(doc, checks, Structured.vazio());

        LayoutInfo layout = Layout.detectColumns(doc);
        checks.add(check("columns", "Coluna única", 25, layout.multiColumn() ? Status.FAIL : Status.PASS,
                layout.multiColumn()
                        ? "Indício de múltiplas colunas (" + Math.round(layout.secondaryShare() * 100)
                                + "% do texto na coluna secundária). A ordem de leitura do ATS pode embaralhar o conteúdo."
                        : "Texto em uma única coluna.",
                layout.multiColumn() ? "Use um layout de coluna única, sem barra lateral." : null,
                layout.secondaryItems()));

        Risco risky = RISKY_PRODUCERS.stream().filter(r -> r.padrao().matcher(doc.producer()).find()).findFirst()
                .orElse(null);
        checks.add(check("producer", "Gerador do PDF", 5, risky != null ? Status.WARN : Status.PASS,
                risky != null ? "Gerado por " + risky.nome() + ", que costuma produzir layouts difíceis para ATS."
                        : "Gerador: " + (doc.producer().isEmpty() ? "desconhecido" : doc.producer()) + ".",
                risky != null ? "Refaça em um editor de texto simples e exporte como PDF." : null, null));

        checks.add(check("images", "Sem imagens", 5, doc.imageCount() == 0 ? Status.PASS : Status.WARN,
                doc.imageCount() == 0 ? "Nenhuma imagem encontrada."
                        : doc.imageCount() + " imagem(ns): foto, ícones ou gráficos são ignorados pelo ATS.",
                doc.imageCount() > 0 ? "Remova foto, ícones e barras de habilidade; use texto." : null, null));

        Status pagesStatus = doc.numPages() <= 2 ? Status.PASS : doc.numPages() == 3 ? Status.WARN : Status.FAIL;
        checks.add(check("pages", "Extensão", 5, pagesStatus, doc.numPages() + " página(s).",
                pagesStatus == Status.PASS ? null : "Mantenha em até 2 páginas.", null));

        ContactInfo contact = Contact.detectContact(doc.text());
        List<String> missing = new ArrayList<>();
        if (!contact.email()) missing.add("e-mail");
        if (!contact.phone()) missing.add("telefone");
        if (!contact.location()) missing.add("cidade/UF");
        checks.add(check("contact", "Contato legível", 15,
                missing.isEmpty() ? Status.PASS : missing.size() == 1 ? Status.WARN : Status.FAIL,
                !missing.isEmpty() ? "Não detectado: " + String.join(", ", missing) + "."
                        : "E-mail, telefone e localização detectados.",
                !missing.isEmpty()
                        ? "Coloque os dados de contato como texto simples no topo, não em cabeçalho/rodapé." : null,
                null));

        Linkedin li = contact.linkedin();
        checks.add(check("linkedin", "Link do LinkedIn íntegro", 5, li == Linkedin.OK ? Status.PASS : Status.WARN,
                li == Linkedin.OK ? "Link detectado inteiro."
                        : li == Linkedin.BROKEN ? "O link do LinkedIn aparece partido em duas linhas."
                                : "Link do LinkedIn não encontrado.",
                li == Linkedin.OK ? null : "Mantenha a URL em uma linha só e curta.",
                li == Linkedin.BROKEN ? marcas.localizar("linkedin.com/in/") : null));

        Set<SectionKey> sections = Sections.detectSections(doc.text());
        List<SectionKey> lacking = Sections.REQUIRED.stream().filter(s -> !sections.contains(s)).toList();
        checks.add(check("sections", "Seções padrão", 15,
                lacking.isEmpty() ? Status.PASS : lacking.size() == 1 ? Status.WARN : Status.FAIL,
                !lacking.isEmpty()
                        ? "Não reconhecidas: " + String.join(", ", lacking.stream().map(s -> s.rotulo).toList()) + "."
                        : "Experiência, Formação e Habilidades reconhecidas.",
                !lacking.isEmpty()
                        ? "Use títulos convencionais: Experiência Profissional, Formação Acadêmica, Habilidades." : null,
                null));

        boolean hasDates = DATE_RE.matcher(doc.text()).find();
        checks.add(check("dates", "Datas legíveis", 5, hasDates ? Status.PASS : Status.WARN,
                hasDates ? "Datas encontradas em formato reconhecível." : "Nenhuma data reconhecível.",
                hasDates ? null : "Use \"mm/aaaa\" ou \"Jan 2022 – Atual\" nas experiências.", null));

        Structured structured = Structure.parseStructure(doc.text(), hoje);
        Completude comp = Structure.completeness(structured);
        double ratio = comp.total() > 0 ? (double) comp.filled() / comp.total() : 0;
        checks.add(check("extraction", "Dados estruturados extraídos", 10,
                ratio >= 0.9 ? Status.PASS : ratio >= 0.6 ? Status.WARN : Status.FAIL,
                comp.total() > 0
                        ? structured.experiencia().size() + " experiência(s) e " + structured.formacao().size()
                                + " formação(ões) lidas; " + comp.filled() + " de " + comp.total()
                                + " campos essenciais encontrados."
                        : "Nenhuma experiência ou formação pôde ser lida com cargo, instituição e datas.",
                ratio >= 0.9 ? null
                        : "Escreva cada item com empresa, cargo e período (ex.: \"Analista | Empresa (Jan/2022 – Atual)\").",
                null));

        boolean glyphs = GLYPHS.matcher(doc.text()).find();
        List<Integer> glyphItens = new ArrayList<>();
        if (glyphs) {
            for (int i = 0; i < doc.items().size(); i++) {
                if (GLYPHS.matcher(doc.items().get(i).str()).find()) glyphItens.add(i);
            }
        }
        checks.add(check("glyphs", "Sem símbolos especiais", 5, glyphs ? Status.WARN : Status.PASS,
                glyphs ? "Há ícones ou emojis que viram caracteres estranhos no ATS." : "Nenhum símbolo problemático.",
                glyphs ? "Troque ícones por texto (\"Tel:\", \"E-mail:\")." : null, glyphs ? glyphItens : null));

        // Nível de idioma desenhado (barras, estrelas, bolinhas) não chega ao ATS: só o texto chega.
        List<LanguageEntry> semNivel = structured.idiomas().stream()
                .filter(l -> l.nivel() == null || l.nivel().isEmpty()).toList();
        Status nivelStatus = semNivel.isEmpty() ? Status.PASS
                : semNivel.size() == structured.idiomas().size() ? Status.FAIL : Status.WARN;
        List<Integer> nivelItens = new ArrayList<>();
        for (LanguageEntry l : semNivel) nivelItens.addAll(marcas.localizar(l.idioma(), SectionKey.IDIOMAS));
        checks.add(check("level-graphics", "Gráficos de nível", 5, nivelStatus,
                structured.idiomas().isEmpty() ? "Nenhum idioma foi lido, então não há nível para conferir."
                        : !semNivel.isEmpty()
                                ? "Nível não lido como texto: "
                                        + String.join(", ", semNivel.stream().map(LanguageEntry::idioma).toList())
                                        + ". Se ele está em barras, estrelas ou bolinhas, o robô não lê."
                                : "O nível de cada idioma foi lido como texto.",
                !semNivel.isEmpty() ? "Escreva o nível em texto, por exemplo \"Inglês: intermediário\"." : null,
                nivelItens));

        Resultado margens = Margens.detectarMargens(doc);
        List<String> problemas = new ArrayList<>();
        if (!margens.repetidos().isEmpty()) {
            problemas.add("texto repetido no topo ou no pé das páginas (\""
                    + String.join("\", \"", margens.repetidos().stream().limit(2).toList()) + "\")");
        }
        if (margens.contatoNoRodape()) problemas.add("dados de contato no pé da página");
        checks.add(check("header-footer", "Cabeçalho e rodapé", 5, problemas.isEmpty() ? Status.PASS : Status.WARN,
                !problemas.isEmpty()
                        ? "Parece haver cabeçalho ou rodapé do editor: " + String.join(" e ", problemas)
                                + ". Alguns ATS descartam essas áreas."
                        : "Nada importante fica no cabeçalho ou no rodapé.",
                !problemas.isEmpty() ? "Leve contato e informações importantes para o corpo do documento." : null,
                margens.itens()));

        return finish(doc, checks, structured);
    }

    private static Analysis finish(ExtractedDoc doc, List<CheckResult> checks, Structured structured) {
        int total = checks.stream().mapToInt(CheckResult::weight).sum();
        double got = checks.stream().mapToDouble(c -> c.weight() * fator(c.status())).sum();
        // Sem texto extraível, o resto nem foi avaliado: nota fixa em 0.
        boolean semTexto = checks.stream().anyMatch(c -> c.id().equals("text-layer") && c.status() == Status.FAIL);
        int formatScore = semTexto ? 0 : (int) Math.round(got / total * 100);
        // O export do perfil sai do Apache FOP e traz o link do próprio perfil.
        boolean exportLinkedin = APACHE_FOP.matcher(doc.producer()).find() && LINKEDIN_URL.matcher(doc.text()).find();
        return new Analysis(structured, formatScore, checks, doc.text(), exportLinkedin);
    }
}
