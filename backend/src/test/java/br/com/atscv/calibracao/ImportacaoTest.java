package br.com.atscv.calibracao;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

@SpringBootTest
class ImportacaoTest {

    @Autowired Importador importador;
    @Autowired Calibracao calibracao;
    @Autowired JdbcClient jdbc;

    @BeforeEach
    void limpar() {
        jdbc.sql("DELETE FROM candidatura").update();
        jdbc.sql("DELETE FROM cv").update();
    }

    private static void caso(Path raiz, String nome, String meta, byte[] pdf) throws IOException {
        Path pasta = Files.createDirectories(raiz.resolve(nome));
        Files.writeString(pasta.resolve("meta.json"), meta);
        Files.writeString(pasta.resolve("vaga.txt"), "Desenvolvedor Java Junior\nRequisitos\n- Java e Spring Boot\n- PostgreSQL\n");
        Files.write(pasta.resolve("cv.pdf"), pdf);
    }

    private static byte[] pdf() throws IOException {
        return br.com.atscv.api.PdfSintetico.curriculoJava();
    }

    @Test
    void importaAsPastasEPulaAsInvalidasEAsJaImportadas(@TempDir Path raiz) throws IOException {
        byte[] pdf = pdf();
        caso(raiz, "2026-09-gupy-acme-dev-java-jr", "{ \"resultado\": \"passou_triagem\", \"etapa\": \"triagem\", \"data\": \"2026-09-15\" }", pdf);
        caso(raiz, "2026-10-linkedin-beta-backend", "{ \"resultado\": \"reprovado\", \"dias_ate_resposta\": 2, "
                + "\"perguntas\": [{ \"pergunta\": \"Você mora em SP?\", \"resposta\": \"sim\" }] }", pdf);
        caso(raiz, "2026-10-linkedin-quebrada-dev", "{ \"resultado\": \"talvez\" }", pdf);
        Files.createDirectories(raiz.resolve("_modelo"));

        var r = importador.importar(raiz);
        assertThat(r.importadas()).containsExactly("2026-09-gupy-acme-dev-java-jr", "2026-10-linkedin-beta-backend");
        assertThat(r.ignoradas()).containsOnlyKeys("2026-10-linkedin-quebrada-dev");
        assertThat(r.ignoradas().get("2026-10-linkedin-quebrada-dev").get(0)).contains("inválido");

        // Importar de novo não duplica; o mesmo PDF nas duas pastas vira um CV só.
        var de_novo = importador.importar(raiz);
        assertThat(de_novo.importadas()).isEmpty();
        assertThat(de_novo.jaImportadas()).hasSize(2);
        assertThat(jdbc.sql("SELECT COUNT(*) FROM cv").query(Integer.class).single()).isEqualTo(1);
        assertThat(jdbc.sql("SELECT COUNT(*) FROM candidatura").query(Integer.class).single()).isEqualTo(2);
        assertThat(jdbc.sql("SELECT data FROM candidatura WHERE origem = '2026-09-gupy-acme-dev-java-jr'")
                .query(String.class).single()).isEqualTo("2026-09-15");
    }

    @Test
    void geraORelatorioDeCalibracaoAPartirDoBanco(@TempDir Path raiz) throws IOException {
        caso(raiz, "2026-09-gupy-acme-dev-java-jr", "{ \"resultado\": \"passou_triagem\" }", pdf());
        importador.importar(raiz);
        String relatorio = calibracao.relatorio();
        assertThat(relatorio).contains("# Relatório de calibração", "1 candidatura", "### 2026-09-gupy-acme-dev-java-jr",
                "- **Real:** passou na triagem · Gupy · set/2026", "Gupy: Aderência");
    }

}
