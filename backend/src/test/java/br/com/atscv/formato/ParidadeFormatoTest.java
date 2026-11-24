package br.com.atscv.formato;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import br.com.atscv.Golden;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;

/**
 * A análise de formato do Java, a partir do mesmo `ExtractedDoc` que o pdf.js produziu, tem de ser idêntica à do
 * TypeScript original (golden files gerados por `GERAR_GOLDEN=1` no front-end).
 */
class ParidadeFormatoTest {

    @TestFactory
    Stream<DynamicTest> analiseIgualAoTypeScript() throws IOException {
        List<Path> docs = Golden.arquivos("cvs", ".doc.json");
        assumeTrue(!docs.isEmpty(), "sem golden files de CVs (são pessoais e ficam fora do git)");
        return docs.stream().map(doc -> DynamicTest.dynamicTest(doc.getFileName().toString(), () -> {
            String id = doc.getFileName().toString().replace(".doc.json", "");
            ExtractedDoc extraido = Golden.JSON.readValue(Golden.ler(doc).toString(), ExtractedDoc.class);
            Analysis obtida = Analyzer.analyze(extraido, LocalDate.now());
            JsonNode esperado = Golden.ler(Golden.RAIZ.resolve("cvs/" + id + ".analysis.json"));
            JsonNode atual = Golden.JSON.readTree(Golden.JSON.writeValueAsString(obtida));
            assertThat(Golden.diferencas(esperado, atual)).isEmpty();
        }));
    }
}
