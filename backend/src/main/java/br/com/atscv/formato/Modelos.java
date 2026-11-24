package br.com.atscv.formato;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.List;

/** Tipos de dados da leitura do PDF e da análise de formato (mesmo JSON do front original). */
public final class Modelos {
    private Modelos() {}

    /** Trecho de texto do PDF com posição, em pontos. */
    public record TextItem(String str, double x, double y, int page, boolean hasEOL, Double w, Double h) {}

    public record ExtractedDoc(
            int numPages, double pageWidth, Double pageHeight, String producer, int imageCount,
            List<TextItem> items, String text) {}

    public enum Status {
        PASS("pass"), WARN("warn"), FAIL("fail");

        private final String json;

        Status(String json) {
            this.json = json;
        }

        @JsonValue
        public String json() {
            return json;
        }
    }

    public record CheckResult(
            String id, String title, Status status, int weight, String detail, String fix, List<Integer> itens) {}

    public record Periodo(String inicio, String fim, boolean atual) {}

    public record ExperienceEntry(
            String cargo, String empresa, Periodo periodo, String local, String resumo,
            List<String> responsabilidades, String tecnologias) {}

    public record EducationEntry(
            String nivel, String curso, String instituicao, String status, boolean statusInferido, Periodo periodo) {}

    public record CertificationEntry(String nome, String emissor, String data) {}

    public record LanguageEntry(String idioma, String nivel) {}

    public record SkillGroup(String categoria, List<String> itens) {}

    public record Structured(
            List<ExperienceEntry> experiencia, List<EducationEntry> formacao, List<CertificationEntry> certificacoes,
            List<LanguageEntry> idiomas, List<SkillGroup> habilidades, String resumo, List<String> cabecalho,
            List<String> contato, List<String> projetos) {

        public static Structured vazio() {
            return new Structured(List.of(), List.of(), List.of(), List.of(), List.of(), null,
                    List.of(), List.of(), List.of());
        }
    }

    public record Analysis(
            Structured structured, int formatScore, List<CheckResult> checks, String robotText, boolean exportLinkedin) {}
}
