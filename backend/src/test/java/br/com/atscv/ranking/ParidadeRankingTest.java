package br.com.atscv.ranking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import br.com.atscv.Golden;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.ranking.Tipos.Arquivo;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.RankOptions;
import br.com.atscv.ranking.Tipos.RankingResult;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import br.com.atscv.ranking.Tipos.Eliminatoria;
import br.com.atscv.ranking.Tipos.Requirement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;

/**
 * O ranking do Java, para cada CV, vaga e lente, tem de ser idêntico ao do TypeScript original. A entrada é a
 * estrutura do CV e a vaga lida que o próprio TypeScript produziu, o que isola o ranking do resto.
 */
class ParidadeRankingTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 13);

    @TestFactory
    Stream<DynamicTest> rankingIgualAoTypeScript() throws IOException {
        List<Path> arquivos = Golden.arquivos("cvs", ".rank.json");
        assumeTrue(!arquivos.isEmpty(), "sem golden files de CVs (são pessoais e ficam fora do git)");
        Dicionario dict = Dicionario.padrao();
        List<DynamicTest> testes = new ArrayList<>();
        for (Path arquivo : arquivos) {
            String id = arquivo.getFileName().toString().replace(".rank.json", "");
            JsonNode esperado = Golden.ler(arquivo);
            Analysis analise = Golden.JSON.readValue(Golden.ler(Golden.RAIZ.resolve("cvs/" + id + ".analysis.json")).toString(),
                    Analysis.class);
            Arquivo info = new Arquivo(analise.formatScore() == 0, analise.exportLinkedin());
            for (var vaga : esperado.properties()) {
                testes.add(DynamicTest.dynamicTest(id + " × " + vaga.getKey(), () -> {
                    JobSpec job = Golden.JSON.readValue(
                            Golden.ler(Golden.RAIZ.resolve("vagas/" + vaga.getKey() + ".job.json")).toString(), JobSpec.class);
                    for (LenteId lente : LenteId.values()) {
                        RankOptions op = new RankOptions(0.5, Map.of(), List.of(), Map.of(), HOJE, lente, info);
                        RankingResult obtido = Ranking.rank(analise.structured(), job, op, dict);
                        JsonNode atual = Golden.JSON.readTree(Golden.JSON.writeValueAsString(obtido));
                        List<String> diferencas = Golden.diferencas(vaga.getValue().get(lente.json()), atual);
                        assertThat(diferencas).as(lente.json()).isEmpty();
                    }
                }));
            }
        }
        return testes.stream();
    }

    /**
     * Variante gerada pelo TypeScript: limiar de 80%, respostas às eliminatórias alternadas (a primeira "atende") e
     * "tenho" nos requisitos de índice múltiplo de 3. Cobre as opções que o caso base não exercita.
     */
    @TestFactory
    Stream<DynamicTest> rankingComOpcoesIgualAoTypeScript() throws IOException {
        List<Path> arquivos = Golden.arquivos("cvs", ".rankvar.json");
        assumeTrue(!arquivos.isEmpty(), "sem golden files de CVs (são pessoais e ficam fora do git)");
        Dicionario dict = Dicionario.padrao();
        List<DynamicTest> testes = new ArrayList<>();
        for (Path arquivo : arquivos) {
            String id = arquivo.getFileName().toString().replace(".rankvar.json", "");
            JsonNode esperado = Golden.ler(arquivo);
            Analysis analise = Golden.JSON.readValue(Golden.ler(Golden.RAIZ.resolve("cvs/" + id + ".analysis.json")).toString(),
                    Analysis.class);
            Arquivo info = new Arquivo(analise.formatScore() == 0, analise.exportLinkedin());
            for (var vaga : esperado.properties()) {
                testes.add(DynamicTest.dynamicTest(id + " × " + vaga.getKey() + " (opções)", () -> {
                    JobSpec job = Golden.JSON.readValue(
                            Golden.ler(Golden.RAIZ.resolve("vagas/" + vaga.getKey() + ".job.json")).toString(), JobSpec.class);
                    List<Eliminatoria> elim = new ArrayList<>(job.eliminatorias());
                    elim.addAll(Condicoes.eliminatoriasDosRequisitos(job));
                    Map<String, Boolean> respostas = new LinkedHashMap<>();
                    for (int i = 0; i < elim.size(); i++) respostas.put(elim.get(i).id(), i % 2 == 0);
                    Map<String, Boolean> declarados = new LinkedHashMap<>();
                    for (int i = 0; i < job.requisitos().size(); i++) {
                        Requirement r = job.requisitos().get(i);
                        declarados.put(r.id(), i % 3 == 0);
                    }
                    for (LenteId lente : LenteId.values()) {
                        RankOptions op = new RankOptions(0.8, declarados, List.of(), respostas, HOJE, lente, info);
                        RankingResult obtido = Ranking.rank(analise.structured(), job, op, dict);
                        JsonNode atual = Golden.JSON.readTree(Golden.JSON.writeValueAsString(obtido));
                        assertThat(Golden.diferencas(vaga.getValue().get(lente.json()), atual)).as(lente.json()).isEmpty();
                    }
                }));
            }
        }
        return testes.stream();
    }
}
