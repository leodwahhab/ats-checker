package br.com.atscv.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
class ApiTest {

    private static final String VAGA = """
            Desenvolvedor Java Junior
            Requisitos
            - Java e Spring Boot
            - PostgreSQL
            - Experiencia com Docker
            Diferenciais
            - Kubernetes
            """;

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;

    @BeforeEach
    void limpar() {
        jdbc.sql("DELETE FROM candidatura").update();
        jdbc.sql("DELETE FROM cv").update();
    }

    private JsonNode corpo(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private MvcResult enviarCv(byte[] pdf, int statusEsperado) throws Exception {
        var arquivo = new MockMultipartFile("arquivo", "cv.pdf", "application/pdf", pdf);
        return mvc.perform(multipart("/api/cvs").file(arquivo)).andExpect(status().is(statusEsperado)).andReturn();
    }

    private long cvId() throws Exception {
        return corpo(enviarCv(PdfSintetico.curriculoJava(), 201)).get("cv").get("id").asLong();
    }

    @Test
    void enviaOPdfELeAAnalise() throws Exception {
        JsonNode cv = corpo(enviarCv(PdfSintetico.curriculoJava(), 201));
        assertThat(cv.get("cv").get("numPaginas").asInt()).isEqualTo(1);
        assertThat(cv.get("analise").get("formatScore").asInt()).isPositive();
        assertThat(cv.get("doc").get("items").size()).isPositive();
        assertThat(cv.get("jaExistia").asBoolean()).isFalse();
        assertThat(cv.get("analise").get("structured").get("experiencia").size()).isEqualTo(1);
    }

    @Test
    void mesmoArquivoReenviadoNaoDuplica() throws Exception {
        byte[] pdf = PdfSintetico.curriculoJava();
        long primeiro = corpo(enviarCv(pdf, 201)).get("cv").get("id").asLong();
        JsonNode segundo = corpo(enviarCv(pdf, 200));
        assertThat(segundo.get("cv").get("id").asLong()).isEqualTo(primeiro);
        assertThat(segundo.get("jaExistia").asBoolean()).isTrue();
        mvc.perform(get("/api/cvs")).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void baixaOPdfGuardado() throws Exception {
        byte[] pdf = PdfSintetico.curriculoJava();
        long id = corpo(enviarCv(pdf, 201)).get("cv").get("id").asLong();
        byte[] baixado = mvc.perform(get("/api/cvs/" + id + "/pdf")).andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF)).andReturn().getResponse().getContentAsByteArray();
        assertThat(baixado).isEqualTo(pdf);
    }

    @Test
    void rejeitaArquivosQueNaoSaoPdf() throws Exception {
        MvcResult r = enviarCv("isto não é um pdf".getBytes(StandardCharsets.UTF_8), 422);
        assertThat(r.getResponse().getContentType()).contains("problem+json");
        assertThat(corpo(r).get("detail").asString()).isEqualTo("O arquivo não é um PDF.");
    }

    @Test
    void rejeitaPdfCorrompidoEPdfComPaginasDemais() throws Exception {
        byte[] quebrado = "%PDF-1.4 lixo sem estrutura".getBytes(StandardCharsets.UTF_8);
        assertThat(corpo(enviarCv(quebrado, 422)).get("detail").asString()).startsWith("PDF inválido");
        byte[] muitasPaginas = PdfSintetico.gerar(List.of("Pagina"), 11);
        assertThat(corpo(enviarCv(muitasPaginas, 422)).get("detail").asString()).contains("11 páginas").contains("máximo é 10");
    }

    @Test
    void leAVagaERanqueiaOCv() throws Exception {
        long cvId = cvId();
        MvcResult lida = mvc.perform(post("/api/vagas/ler").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("texto", VAGA)))).andExpect(status().isOk()).andReturn();
        JsonNode job = corpo(lida);
        assertThat(job.get("requisitos").size()).isGreaterThanOrEqualTo(4);
        assertThat(job.get("senioridade").asString()).isEqualTo("junior");

        String pedido = json.writeValueAsString(java.util.Map.of("cvId", cvId, "job", job, "lente", "gupy"));
        JsonNode r = corpo(mvc.perform(post("/api/ranking").contentType(MediaType.APPLICATION_JSON).content(pedido))
                .andExpect(status().isOk()).andReturn());
        assertThat(r.get("lente").get("id").asString()).isEqualTo("gupy");
        assertThat(r.get("requisitos").size()).isEqualTo(job.get("requisitos").size());
        assertThat(r.get("faixa").asString()).isIn("top", "maybe", "not");
    }

    @Test
    void editaALeituraDaVaga() throws Exception {
        JsonNode job = corpo(mvc.perform(post("/api/vagas/ler").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("texto", VAGA)))).andReturn());
        String primeiroId = job.get("requisitos").get(0).get("id").asString();
        String pedido = json.writeValueAsString(java.util.Map.of("job", job, "acao", "alterar_tipo", "id", primeiroId,
                "tipo", "desejavel"));
        JsonNode editado = corpo(mvc.perform(post("/api/vagas/editar").contentType(MediaType.APPLICATION_JSON).content(pedido))
                .andExpect(status().isOk()).andReturn()).get("job");
        assertThat(editado.get("requisitos").get(0).get("tipo").asString()).isEqualTo("desejavel");
        assertThat(editado.get("requisitos").get(0).get("tipoFonte").asString()).isEqualTo("usuario");
    }

    @Test
    void guardaAcandidaturaComAPrevisaoDaEpocaEAtualizaOResultado() throws Exception {
        long cvId = cvId();
        var entrada = new java.util.LinkedHashMap<String, Object>();
        entrada.put("cvId", cvId);
        entrada.put("vagaTexto", VAGA);
        entrada.put("plataforma", "Gupy");
        entrada.put("empresa", "acme");
        entrada.put("cargo", "dev java jr");
        entrada.put("mes", "2026-11");
        MvcResult criada = mvc.perform(post("/api/candidaturas").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(entrada))).andExpect(status().isCreated()).andReturn();
        JsonNode c = corpo(criada);
        long id = c.get("id").asLong();
        assertThat(c.get("resultado").asString()).isEqualTo("sem_retorno");
        assertThat(c.get("plataforma").asString()).isEqualTo("gupy");
        assertThat(c.get("snapshot").get("faixa").asString()).isIn("top", "maybe", "not");
        assertThat(c.get("versaoRegras").asString()).isNotBlank();
        assertThat(c.get("estado").get("job").get("requisitos").size()).isPositive();

        entrada.put("resultado", "passou_triagem");
        entrada.put("etapa", "entrevista RH");
        entrada.put("diasAteResposta", 3);
        JsonNode atualizada = corpo(mvc.perform(put("/api/candidaturas/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(entrada))).andExpect(status().isOk()).andReturn());
        assertThat(atualizada.get("resultado").asString()).isEqualTo("passou_triagem");
        assertThat(atualizada.get("criadoEm").asString()).isEqualTo(c.get("criadoEm").asString());

        mvc.perform(get("/api/candidaturas")).andExpect(jsonPath("$[0].resultado").value("passou_triagem"))
                .andExpect(jsonPath("$[0].empresa").value("acme"));

        // O CV em uso não pode ser excluído; depois da candidatura, pode.
        mvc.perform(delete("/api/cvs/" + cvId)).andExpect(status().isConflict());
        mvc.perform(delete("/api/candidaturas/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/candidaturas/" + id)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/cvs/" + cvId)).andExpect(status().isNoContent());
    }

    @Test
    void validaOsCamposDaCandidatura() throws Exception {
        long cvId = cvId();
        var ruim = new java.util.LinkedHashMap<String, Object>();
        ruim.put("cvId", cvId);
        ruim.put("vagaTexto", VAGA);
        ruim.put("resultado", "talvez");
        mvc.perform(post("/api/candidaturas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(ruim)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("inválido")));
        ruim.put("resultado", "reprovado");
        ruim.put("mes", "2026-13");
        mvc.perform(post("/api/candidaturas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(ruim)))
                .andExpect(status().isBadRequest());
        ruim.put("mes", "2026-11");
        ruim.put("cvId", 9999);
        mvc.perform(post("/api/candidaturas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(ruim)))
                .andExpect(status().isNotFound());
    }

    @Test
    void expoAsLentes() throws Exception {
        mvc.perform(get("/api/lentes")).andExpect(status().isOk()).andExpect(jsonPath("$.ordem.length()").value(4))
                .andExpect(jsonPath("$.lentes.gupy.nome").value("Gupy"));
    }
}
