package br.com.atscv.api;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

/** PDF de teste gerado em código: uma linha de texto por item, de cima para baixo, em colunas únicas. */
public final class PdfSintetico {
    private PdfSintetico() {}

    public static byte[] gerar(List<String> linhas, int paginas) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var fonte = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            for (int p = 0; p < paginas; p++) {
                PDPage pagina = new PDPage();
                doc.addPage(pagina);
                try (PDPageContentStream cs = new PDPageContentStream(doc, pagina)) {
                    float y = 790;
                    for (String l : linhas) {
                        cs.beginText();
                        cs.setFont(fonte, 11);
                        cs.newLineAtOffset(50, y);
                        cs.showText(l);
                        cs.endText();
                        y -= 16;
                    }
                }
            }
            doc.save(out);
            return out.toByteArray();
        }
    }

    /** Um currículo curto de desenvolvedor Java, com as seções que um ATS espera. */
    public static byte[] curriculoJava() throws IOException {
        return gerar(List.of(
                "Maria Teste", "Desenvolvedora Java Junior",
                "(11) 91234-5678 | maria.teste@exemplo.com | linkedin.com/in/maria-teste | Osasco - SP",
                "RESUMO PROFISSIONAL",
                "Desenvolvedora com 2 anos de experiencia em Java e Spring Boot, construindo APIs REST.",
                "HABILIDADES",
                "Back-end: Java, Spring Boot, PostgreSQL, Docker",
                "Ferramentas: Git, JUnit",
                "EXPERIENCIA PROFISSIONAL",
                "Desenvolvedora Java | Empresa Exemplo (Jan/2023 - Atual)",
                "- Desenvolvi APIs REST em Java com Spring Boot e PostgreSQL.",
                "- Escrevi testes automatizados com JUnit.",
                "FORMACAO ACADEMICA",
                "Analise e Desenvolvimento de Sistemas | Faculdade Exemplo (2020 - 2022)",
                "IDIOMAS", "Ingles: intermediario"), 1);
    }
}
