package br.com.atscv.api;

import br.com.atscv.api.Dtos.PedidoEdicao;
import br.com.atscv.api.Dtos.PedidoLeitura;
import br.com.atscv.api.Dtos.PedidoTermos;
import br.com.atscv.api.Dtos.ResultadoEdicao;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.servico.CvServico;
import br.com.atscv.servico.RankingServico;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Vagas: ler o texto colado, editar a leitura e listar termos que o CV não cita. */
@RestController
@RequestMapping("/api/vagas")
public class VagaController {

    private final RankingServico ranking;
    private final CvServico cvs;

    public VagaController(RankingServico ranking, CvServico cvs) {
        this.ranking = ranking;
        this.cvs = cvs;
    }

    @PostMapping("/ler")
    public JobSpec ler(@RequestBody PedidoLeitura p) {
        return ranking.lerVaga(p.texto(), p.extras());
    }

    @PostMapping("/editar")
    public ResultadoEdicao editar(@RequestBody PedidoEdicao p) {
        return ranking.editar(p);
    }

    @PostMapping("/termos-ausentes")
    public List<String> termosAusentes(@RequestBody PedidoTermos p) {
        return ranking.termosAusentes(cvs.detalhe(p.cvId()).analise(), p.texto(), p.extras());
    }
}
