package br.com.atscv.formato;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import br.com.atscv.extracao.PdfExtractor;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.formato.Modelos.CheckResult;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.formato.Modelos.Status;
import br.com.atscv.formato.Modelos.TextItem;
import br.com.atscv.formato.Sections.SectionKey;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class FormatoTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 13);

    /** Linha de um documento sintético: de cima para baixo na página 1, ou numa posição e página dadas. */
    private record Linha(String str, double y, int page) {}

    private static Linha l(String str) {
        return new Linha(str, Double.NaN, 1);
    }

    private static Linha l(String str, double y, int page) {
        return new Linha(str, y, page);
    }

    /** Documento sintético: cada linha vira um trecho, de cima para baixo. */
    private static ExtractedDoc doc(int numPages, List<Linha> linhas) {
        double y = 760;
        List<TextItem> items = new ArrayList<>();
        for (Linha l : linhas) {
            double yy = Double.isNaN(l.y()) ? (y -= 16) : l.y();
            items.add(new TextItem(l.str(), 72, yy, l.page(), true, l.str().length() * 5.0, 10.0));
        }
        return new ExtractedDoc(numPages, 595, 842.0, "teste", 0, items, TextoPdf.montar(items).text());
    }

    private static ExtractedDoc doc(String... linhas) {
        return doc(1, java.util.Arrays.stream(linhas).map(FormatoTest::l).toList());
    }

    private static CheckResult check(Analysis a, String id) {
        return a.checks().stream().filter(c -> c.id().equals(id)).findFirst().orElseThrow();
    }

    private static ExtractedDoc pdf(String arquivo) throws IOException {
        Path p = Path.of("fixtures", arquivo);
        assumeTrue(Files.exists(p), "PDF pessoal ausente: " + arquivo);
        return PdfExtractor.extrair(Files.readAllBytes(p));
    }

    private static List<String> textos(ExtractedDoc d, List<Integer> indices) {
        return indices.stream().map(i -> d.items().get(i).str()).toList();
    }

    @Nested
    class GraficosDeNivel {
        @Test
        void nivelEscritoEmTextoPassaNosCvsDeReferencia() throws IOException {
            for (String f : List.of("CV_J-2.pdf", "Profile.pdf", "CV_Canva.pdf")) {
                assertThat(check(Analyzer.analyze(pdf(f), HOJE), "level-graphics").status()).as(f).isEqualTo(Status.PASS);
            }
        }

        @Test
        void idiomaSemNivelEmTextoFalhaEApontaOIdiomaNoCv() {
            List<String> linhas = new ArrayList<>(List.of("Nome Sobrenome", "email@exemplo.com", "Experiência",
                    "Dev | Empresa (Jan/2022 – Atual)", "Formação", "Graduação | Faculdade (2018 – 2021)", "Habilidades",
                    "Java", "Idiomas", "Inglês", "Espanhol"));
            for (int i = 0; i < 12; i++) linhas.add("linha de texto para passar do mínimo de caracteres por página");
            ExtractedDoc d = doc(linhas.toArray(String[]::new));

            CheckResult c = check(Analyzer.analyze(d, HOJE), "level-graphics");
            assertThat(c.status()).isEqualTo(Status.FAIL);
            assertThat(c.detail()).contains("Inglês, Espanhol");
            assertThat(textos(d, c.itens())).containsExactly("Inglês", "Espanhol");
        }
    }

    @Nested
    class CabecalhoERodape {
        @Test
        void naoAcusaOsCvsDeReferencia() throws IOException {
            for (String f : List.of("CV_J-2.pdf", "Profile.pdf", "CV_Canva.pdf")) {
                assertThat(check(Analyzer.analyze(pdf(f), HOJE), "header-footer").status()).as(f).isEqualTo(Status.PASS);
            }
        }

        @Test
        void textoRepetidoNoTopoDeDuasPaginasEContatoNoRodape() {
            ExtractedDoc d = doc(2, List.of(
                    l("Nome Sobrenome · Currículo", 820, 1),
                    l("Experiência", 700, 1),
                    l("email@exemplo.com | (11) 91234-5678", 30, 1),
                    l("Nome Sobrenome · Currículo", 820, 2),
                    l("Página 2 de 2", 30, 2)));
            Margens.Resultado m = Margens.detectarMargens(d);
            assertThat(m.repetidos()).containsExactly("Nome Sobrenome · Currículo");
            assertThat(m.contatoNoRodape()).isTrue();
            assertThat(m.itens()).containsExactly(0, 2, 3);
        }
    }

    @Nested
    class LocalizarTrechos {
        @Test
        void achaOTrechoComReticenciasEQuebraDeLinhaProcurandoPrimeiroNaSecaoDaEvidencia() {
            ExtractedDoc d = doc("Resumo", "Trabalho com Java há 2 anos.", "Habilidades", "Java, Spring Boot", "Experiência",
                    "Desenvolvi APIs em Java", "com Spring Boot.");
            Marcas m = new Marcas(d);
            assertThat(textos(d, m.localizar("Java", SectionKey.HABILIDADES))).containsExactly("Java, Spring Boot");
            assertThat(textos(d, m.localizar("Java"))).containsExactly("Trabalho com Java há 2 anos.");
            assertThat(textos(d, m.localizar("…APIs em Java com Spring Boot.", SectionKey.EXPERIENCIA)))
                    .containsExactly("Desenvolvi APIs em Java", "com Spring Boot.");
            assertThat(m.localizar("Kubernetes")).isEmpty();
        }

        @Test
        void achaAEvidenciaRealDeUmCvDeReferencia() throws IOException {
            ExtractedDoc d = pdf("CV_J-2.pdf");
            List<Integer> itens = new Marcas(d).localizar("…com Java e Spring Boot para sistema de controladoria…",
                    SectionKey.EXPERIENCIA);
            assertThat(itens).isNotEmpty();
            assertThat(d.items().get(itens.get(0)).str()).contains("Java e Spring Boot");
        }
    }
}
