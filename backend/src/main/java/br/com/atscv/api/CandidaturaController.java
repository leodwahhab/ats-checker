package br.com.atscv.api;

import br.com.atscv.api.Dtos.Candidatura;
import br.com.atscv.api.Dtos.CandidaturaEntrada;
import br.com.atscv.api.Dtos.CandidaturaResumo;
import br.com.atscv.servico.CandidaturaServico;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Histórico de candidaturas. */
@RestController
@RequestMapping("/api/candidaturas")
public class CandidaturaController {

    private final CandidaturaServico candidaturas;

    public CandidaturaController(CandidaturaServico candidaturas) {
        this.candidaturas = candidaturas;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Candidatura criar(@RequestBody CandidaturaEntrada e) {
        return candidaturas.criar(e);
    }

    @GetMapping
    public List<CandidaturaResumo> listar() {
        return candidaturas.listar();
    }

    @GetMapping("/{id}")
    public Candidatura obter(@PathVariable long id) {
        return candidaturas.obter(id);
    }

    @PutMapping("/{id}")
    public Candidatura atualizar(@PathVariable long id, @RequestBody CandidaturaEntrada e) {
        return candidaturas.atualizar(id, e);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable long id) {
        candidaturas.excluir(id);
    }
}
