package br.com.atscv.ranking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import br.com.atscv.Golden;
import br.com.atscv.ranking.Tipos.JobSpec;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;

/** A leitura de cada vaga em Java tem de ser idêntica à do TypeScript original (golden files). */
class ParidadeVagaTest {

    private static final Path VAGAS = Golden.FIXTURES.resolve("vagas");

    private static String slug(String arquivo) {
        return arquivo.replaceAll("\\.(pdf|txt)$", "").replaceAll("[^\\w.-]+", "_");
    }

    /** O texto da vaga que gerou o golden file: sintéticas e reais em fixtures/vagas, candidaturas em fixtures/candidaturas. */
    private static Path textoDe(String id) throws IOException {
        if (id.startsWith("candidaturas/")) {
            return Golden.FIXTURES.resolve("candidaturas").resolve(id.substring("candidaturas/".length())).resolve("vaga.txt");
        }
        String sub = id.substring(0, id.indexOf('/'));
        String nome = id.substring(id.indexOf('/') + 1);
        try (Stream<Path> s = Files.list(VAGAS.resolve(sub))) {
            return s.filter(p -> p.getFileName().toString().endsWith(".txt"))
                    .filter(p -> slug(p.getFileName().toString()).equals(nome)).findFirst().orElseThrow();
        }
    }

    private static List<String> ids() throws IOException {
        List<String> ids = new ArrayList<>();
        for (String sub : List.of("sinteticas", "reais", "candidaturas")) {
            for (Path p : Golden.arquivos("vagas/" + sub, ".job.json")) {
                ids.add(sub + "/" + p.getFileName().toString().replace(".job.json", ""));
            }
        }
        return ids;
    }

    @TestFactory
    Stream<DynamicTest> vagaLidaIgualAoTypeScript() throws IOException {
        List<String> ids = ids();
        assumeTrue(!ids.isEmpty(), "sem golden files de vagas");
        Dicionario dict = Dicionario.padrao();
        return ids.stream().map(id -> DynamicTest.dynamicTest(id, () -> {
            Path texto = textoDe(id);
            assumeTrue(Files.exists(texto), "texto da vaga ausente: " + texto);
            JobSpec obtido = Vaga.parseJob(Files.readString(texto), dict);
            JsonNode esperado = Golden.ler(Golden.RAIZ.resolve("vagas/" + id + ".job.json"));
            JsonNode atual = Golden.JSON.readTree(Golden.JSON.writeValueAsString(obtido));
            assertThat(Golden.diferencas(esperado, atual)).isEmpty();
        }));
    }
}
