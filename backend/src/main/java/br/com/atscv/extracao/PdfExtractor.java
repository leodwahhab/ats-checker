package br.com.atscv.extracao;

import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.formato.Modelos.TextItem;
import br.com.atscv.formato.TextoPdf;
import java.io.IOException;
import java.io.Writer;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.contentstream.PDFStreamEngine;
import org.apache.pdfbox.contentstream.operator.Operator;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

/**
 * Lê o PDF como um parser de ATS: os trechos de texto na ordem do stream, com posição, mais a contagem de
 * imagens. Substitui a extração que o front fazia com o pdf.js.
 */
public final class PdfExtractor {
    private PdfExtractor() {}

    /** Distância (em fração do corpo da fonte) a partir da qual há um espaço entre dois glifos sem espaço no PDF. */
    private static final double ESPACO = 0.2;
    /** Distância (em corpos de fonte) a partir da qual dois glifos já são trechos separados (colunas, tabelas). */
    private static final double SEPARA = 3.0;

    /** @throws IOException PDF inválido, corrompido ou protegido por senha */
    public static ExtractedDoc extrair(byte[] pdf) throws IOException {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDRectangle primeira = doc.getNumberOfPages() > 0 ? doc.getPage(0).getCropBox() : new PDRectangle(595, 842);
            Coletor coletor = new Coletor();
            coletor.getText(doc);
            List<TextItem> items = coletor.montar();

            int imagens = 0;
            for (PDPage page : doc.getPages()) {
                ContadorDeImagens c = new ContadorDeImagens();
                c.processPage(page);
                imagens += c.total;
            }

            PDDocumentInformation info = doc.getDocumentInformation();
            String producer = info == null ? "" : info.getProducer() != null ? info.getProducer()
                    : info.getCreator() != null ? info.getCreator() : "";
            return new ExtractedDoc(doc.getNumberOfPages(), primeira.getWidth(), (double) primeira.getHeight(), producer,
                    imagens, items, TextoPdf.montar(items).text());
        }
    }

    private record Glifo(int page, String texto, double x, double y, double largura, double corpo, PDFont fonte) {}

    /** Recebe cada glifo na ordem em que o PDF os desenha, sem reordenar por posição. */
    private static final class Coletor extends PDFTextStripper {
        private final List<Glifo> glifos = new ArrayList<>();

        Coletor() throws IOException {
            setSortByPosition(false);
        }

        @Override
        public String getText(PDDocument doc) throws IOException {
            writeText(doc, Writer.nullWriter());
            return "";
        }

        @Override
        protected void processTextPosition(TextPosition t) {
            float alturaPagina = getCurrentPage().getCropBox().getHeight();
            glifos.add(new Glifo(getCurrentPageNo(), t.getUnicode(), t.getXDirAdj(), alturaPagina - t.getYDirAdj(),
                    t.getWidthDirAdj(), t.getFontSizeInPt(), t.getFont()));
        }

        /** Agrupa os glifos em trechos: muda a linha, a fonte, ou há um vazio grande. */
        List<TextItem> montar() {
            List<TextItem> out = new ArrayList<>();
            StringBuilder str = new StringBuilder();
            Glifo ini = null;
            Glifo ult = null;
            double fim = 0;
            for (Glifo g : glifos) {
                // Dois espaços seguidos (o PDF repete o glifo de espaço ao trocar de fonte) valem um só, como no pdf.js.
                if (ult != null && g.texto().isBlank() && ult.texto().isBlank()) continue;
                boolean novo = ult == null;
                boolean espaco = false;
                if (!novo) {
                    double gap = g.x() - fim;
                    boolean outraLinha = g.page() != ult.page() || Math.abs(g.y() - ult.y()) > 1;
                    boolean outraFonte = g.fonte() != ult.fonte() || Math.abs(g.corpo() - ult.corpo()) > 0.01;
                    novo = outraLinha || outraFonte || gap > SEPARA * g.corpo() || gap < -g.corpo();
                    espaco = !novo && gap > ESPACO * g.corpo() && !g.texto().isBlank()
                            && !str.isEmpty() && !Character.isWhitespace(str.charAt(str.length() - 1));
                    if (novo) {
                        boolean eol = outraLinha;
                        out.add(item(ini, str.toString(), fim - ini.x(), eol));
                        str.setLength(0);
                    }
                }
                if (novo) ini = g;
                if (espaco) str.append(' ');
                str.append(g.texto());
                ult = g;
                fim = g.x() + g.largura();
            }
            if (ini != null) out.add(item(ini, str.toString(), fim - ini.x(), false));
            return out;
        }

        private static TextItem item(Glifo ini, String str, double largura, boolean eol) {
            return new TextItem(str, ini.x(), ini.y(), ini.page(), eol, largura, ini.corpo());
        }
    }

    /** Conta os desenhos de imagem (inclusive dentro de formulários), como o paintImageXObject do pdf.js. */
    private static final class ContadorDeImagens extends PDFStreamEngine {
        int total;

        @Override
        protected void processOperator(Operator operator, List<COSBase> operands) throws IOException {
            if ("Do".equals(operator.getName()) && !operands.isEmpty() && operands.get(0) instanceof COSName nome) {
                PDXObject x = getResources().getXObject(nome);
                if (x instanceof PDImageXObject) total++;
                else if (x instanceof PDFormXObject form) showForm(form);
                return;
            }
            super.processOperator(operator, operands);
        }
    }
}
