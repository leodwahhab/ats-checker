package br.com.atscv.api;

import br.com.atscv.api.Dtos.CvDetalhe;
import br.com.atscv.api.Dtos.CvResumo;
import br.com.atscv.api.Dtos.PedidoMarcas;
import br.com.atscv.servico.CvServico;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Currículos: enviar o PDF, listar, ler o que foi extraído e baixar o arquivo. */
@RestController
@RequestMapping("/api/cvs")
public class CvController {

    private final CvServico cvs;

    public CvController(CvServico cvs) {
        this.cvs = cvs;
    }

    /** Envia um PDF. 201 quando é novo; 200 quando o mesmo arquivo já tinha sido enviado. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CvDetalhe> enviar(@RequestParam("arquivo") MultipartFile arquivo) throws IOException {
        CvDetalhe d = cvs.enviar(arquivo.getOriginalFilename(), arquivo.getBytes());
        return ResponseEntity.status(d.jaExistia() ? HttpStatus.OK : HttpStatus.CREATED).body(d);
    }

    @GetMapping
    public List<CvResumo> listar() {
        return cvs.listar();
    }

    @GetMapping("/{id}")
    public CvDetalhe detalhe(@PathVariable long id) {
        return cvs.detalhe(id);
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable long id) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).body(cvs.pdf(id));
    }

    /** Onde cada trecho de evidência aparece no PDF, para a prévia marcar. */
    @PostMapping("/{id}/marcas")
    public Map<String, List<Integer>> marcas(@PathVariable long id, @RequestBody PedidoMarcas p) {
        return cvs.marcas(id, p.buscas());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable long id) {
        cvs.excluir(id);
    }
}
