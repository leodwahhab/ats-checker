package br.com.atscv.api;

import br.com.atscv.api.Dtos.PedidoRanking;
import br.com.atscv.ranking.Lentes;
import br.com.atscv.ranking.Tipos.FonteDoc;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.LensConfig;
import br.com.atscv.ranking.Tipos.RankingResult;
import br.com.atscv.servico.CvServico;
import br.com.atscv.servico.RankingServico;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Ranking de um CV contra uma vaga. Não grava nada: o estado da vaga vem no pedido. */
@RestController
@RequestMapping("/api")
public class RankingController {

    private final RankingServico ranking;
    private final CvServico cvs;

    public RankingController(RankingServico ranking, CvServico cvs) {
        this.ranking = ranking;
        this.cvs = cvs;
    }

    @PostMapping("/ranking")
    public RankingResult ranquear(@RequestBody PedidoRanking p) {
        return ranking.ranquear(cvs.detalhe(p.cvId()).analise(), p.estado());
    }

    /** As lentes e as páginas oficiais em que se baseiam. */
    public record Lente(String verificadoEm, List<LenteId> ordem, Map<LenteId, LensConfig> lentes, Map<String, FonteDoc> fontes) {}

    @GetMapping("/lentes")
    public Lente lentes() {
        return new Lente(Lentes.VERIFICADO_EM, Lentes.ORDEM_LENTES, Lentes.LENTES, Lentes.FONTES);
    }
}
