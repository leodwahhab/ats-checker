package br.com.atscv.servico;

import br.com.atscv.api.Dtos.BuscaDeMarca;
import br.com.atscv.api.Dtos.CvDetalhe;
import br.com.atscv.api.Dtos.CvResumo;
import br.com.atscv.api.ErroApi;
import br.com.atscv.extracao.PdfExtractor;
import br.com.atscv.formato.Analyzer;
import br.com.atscv.formato.Marcas;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.formato.Sections.SectionKey;
import br.com.atscv.formato.TextoPdf;
import br.com.atscv.persistencia.CvRepositorio;
import br.com.atscv.persistencia.CvRepositorio.Registro;
import br.com.atscv.persistencia.CvRepositorio.Resumo;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.List;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/** Recebe os PDFs, lê, analisa o formato e guarda; o mesmo arquivo reenviado não duplica. */
@Service
public class CvServico {

    private final CvRepositorio repo;
    private final JsonMapper json;
    private final Clock clock;
    private final int maxPaginas;

    public CvServico(CvRepositorio repo, JsonMapper json, Clock clock, @Value("${ats.pdf.max-paginas}") int maxPaginas) {
        this.repo = repo;
        this.json = json;
        this.clock = clock;
        this.maxPaginas = maxPaginas;
    }

    private static CvResumo resumo(Resumo r) {
        return new CvResumo(r.id(), r.sha256(), r.nomeArquivo(), r.numPaginas(), r.formatScore(), r.criadoEm());
    }

    private CvDetalhe detalhe(Registro r, boolean jaExistia) {
        ExtractedDoc doc = json.readValue(r.docJson(), ExtractedDoc.class);
        return new CvDetalhe(resumo(r.resumo()), doc, json.readValue(r.analiseJson(), Analysis.class),
                Arrays.stream(TextoPdf.montar(doc.items()).inicios()).boxed().toList(), jaExistia);
    }

    /** Onde cada trecho aparece no PDF: para cada chave, os índices dos trechos (doc.items) que o cobrem. */
    public Map<String, List<Integer>> marcas(long id, List<BuscaDeMarca> buscas) {
        Marcas marcas = new Marcas(detalhe(id).doc());
        Map<String, List<Integer>> out = new LinkedHashMap<>();
        for (BuscaDeMarca b : buscas == null ? List.<BuscaDeMarca>of() : buscas) {
            SectionKey secao = null;
            if (b.secao() != null) {
                try {
                    secao = SectionKey.valueOf(b.secao().toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException e) {
                    throw ErroApi.invalido("Seção desconhecida: " + b.secao());
                }
            }
            out.put(b.chave(), marcas.localizar(b.trecho() == null ? "" : b.trecho(), secao));
        }
        return out;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String nomeLimpo(String nome) {
        String n = nome == null ? "" : nome.replace('\\', '/');
        n = n.substring(n.lastIndexOf('/') + 1).strip();
        if (n.isEmpty()) n = "cv.pdf";
        return n.length() > 200 ? n.substring(0, 200) : n;
    }

    public CvDetalhe enviar(String nomeArquivo, byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw ErroApi.invalido("O arquivo está vazio.");
        if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F') {
            throw new ErroApi(HttpStatus.UNPROCESSABLE_CONTENT, "O arquivo não é um PDF.");
        }
        String hash = sha256(bytes);
        var existente = repo.porHash(hash);
        if (existente.isPresent()) return detalhe(existente.get(), true);

        ExtractedDoc doc;
        try {
            doc = PdfExtractor.extrair(bytes);
        } catch (InvalidPasswordException e) {
            throw new ErroApi(HttpStatus.UNPROCESSABLE_CONTENT, "PDF protegido por senha: remova a senha e envie de novo.");
        } catch (IOException | RuntimeException e) {
            throw new ErroApi(HttpStatus.UNPROCESSABLE_CONTENT, "PDF inválido ou corrompido: não foi possível lê-lo.");
        }
        if (doc.numPages() > maxPaginas) {
            throw new ErroApi(HttpStatus.UNPROCESSABLE_CONTENT,
                    "O PDF tem " + doc.numPages() + " páginas; o máximo é " + maxPaginas + ".");
        }
        Analysis analise = Analyzer.analyze(doc, LocalDate.now(clock));
        long id = repo.inserir(hash, nomeLimpo(nomeArquivo), doc.numPages(), analise.formatScore(), bytes,
                json.writeValueAsString(doc), json.writeValueAsString(analise), Instant.now(clock).toString());
        return detalhe(repo.porId(id).orElseThrow(), false);
    }

    public CvDetalhe detalhe(long id) {
        return detalhe(repo.porId(id).orElseThrow(() -> ErroApi.naoEncontrado("O CV", id)), true);
    }

    public byte[] pdf(long id) {
        return repo.pdf(id).orElseThrow(() -> ErroApi.naoEncontrado("O CV", id));
    }

    public List<CvResumo> listar() {
        return repo.listar().stream().map(CvServico::resumo).toList();
    }

    public void excluir(long id) {
        if (repo.porId(id).isEmpty()) throw ErroApi.naoEncontrado("O CV", id);
        int usos = repo.candidaturasDo(id);
        if (usos > 0) {
            throw new ErroApi(HttpStatus.CONFLICT, "O CV é usado por " + usos + " candidatura(s); exclua-as antes.");
        }
        repo.excluir(id);
    }
}
