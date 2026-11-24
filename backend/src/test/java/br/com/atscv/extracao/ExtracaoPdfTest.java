package br.com.atscv.extracao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import br.com.atscv.Golden;
import br.com.atscv.formato.Analyzer;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.formato.Modelos.CheckResult;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;

/**
 * O PDFBox não vai produzir os mesmos trechos que o pdf.js, mas tem de chegar à mesma leitura: mesmo texto
 * (ignorando espaços), mesmas páginas, imagens e gerador, e a mesma nota e resultado em cada checagem.
 */
class ExtracaoPdfTest {

    private static Path pdfDe(String id) {
        if (id.startsWith("candidaturas_")) {
            return Golden.FIXTURES.resolve("candidaturas").resolve(id.substring("candidaturas_".length())).resolve("cv.pdf");
        }
        return Golden.FIXTURES.resolve(id + ".pdf");
    }

    private static String semEspacos(String s) {
        return s.replaceAll("[\\s\\u00A0]+", "");
    }

    @TestFactory
    Stream<DynamicTest> extracaoChegaAoMesmoResultado() throws IOException {
        List<Path> docs = Golden.arquivos("cvs", ".doc.json");
        assumeTrue(!docs.isEmpty(), "sem golden files de CVs (são pessoais e ficam fora do git)");
        return docs.stream().map(doc -> DynamicTest.dynamicTest(doc.getFileName().toString(), () -> {
            String id = doc.getFileName().toString().replace(".doc.json", "");
            Path pdf = pdfDe(id);
            assumeTrue(Files.exists(pdf), "PDF ausente: " + pdf);

            ExtractedDoc esperado = Golden.JSON.readValue(Golden.ler(doc).toString(), ExtractedDoc.class);
            ExtractedDoc obtido = PdfExtractor.extrair(Files.readAllBytes(pdf));

            List<String> problemas = new ArrayList<>();
            if (esperado.numPages() != obtido.numPages()) problemas.add("páginas");
            if (esperado.imageCount() != obtido.imageCount()) {
                problemas.add("imagens: esperado " + esperado.imageCount() + ", obtido " + obtido.imageCount());
            }
            if (!esperado.producer().equals(obtido.producer())) {
                problemas.add("gerador: esperado '" + esperado.producer() + "', obtido '" + obtido.producer() + "'");
            }
            if (Math.abs(esperado.pageWidth() - obtido.pageWidth()) > 0.5) problemas.add("largura da página");
            if (!semEspacos(esperado.text()).equals(semEspacos(obtido.text()))) {
                problemas.add("texto diferente:\n  esperado=" + trecho(esperado.text()) + "\n  obtido  =" + trecho(obtido.text()));
            }

            Analysis ts = Golden.JSON.readValue(Golden.ler(Golden.RAIZ.resolve("cvs/" + id + ".analysis.json")).toString(),
                    Analysis.class);
            Analysis java = Analyzer.analyze(obtido, LocalDate.now());
            if (ts.formatScore() != java.formatScore()) {
                problemas.add("nota de formato: esperado " + ts.formatScore() + ", obtido " + java.formatScore());
            }
            for (int i = 0; i < Math.min(ts.checks().size(), java.checks().size()); i++) {
                CheckResult a = ts.checks().get(i);
                CheckResult b = java.checks().get(i);
                if (a.status() != b.status()) problemas.add("checagem " + a.id() + ": " + a.status() + " → " + b.status());
            }
            JsonNode a = Golden.JSON.readTree(Golden.JSON.writeValueAsString(ts.structured()));
            JsonNode b = Golden.JSON.readTree(Golden.JSON.writeValueAsString(java.structured()));
            problemas.addAll(Golden.diferencas(a, b).stream().limit(5).map(d -> "estrutura " + d).toList());

            assertThat(problemas).as(id).isEmpty();
        }));
    }

    private static String trecho(String s) {
        String limpo = s.replaceAll("\\s+", " ");
        return limpo.length() > 200 ? limpo.substring(0, 200) + "…" : limpo;
    }
}
