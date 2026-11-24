package br.com.atscv.servico;

import br.com.atscv.api.Dtos.EstadoDaVaga;
import br.com.atscv.api.Dtos.PedidoEdicao;
import br.com.atscv.api.Dtos.ResultadoEdicao;
import br.com.atscv.api.ErroApi;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.ranking.Dicionario;
import br.com.atscv.ranking.Dicionario.SkillDef;
import br.com.atscv.ranking.Ranking;
import br.com.atscv.ranking.Tipos.Arquivo;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.RankOptions;
import br.com.atscv.ranking.Tipos.RankingResult;
import br.com.atscv.ranking.Vaga;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Lê vagas, edita a leitura e ranqueia um CV contra uma vaga. Não guarda nada. */
@Service
public class RankingServico {

    private final Clock clock;

    public RankingServico(Clock clock) {
        this.clock = clock;
    }

    private static Dicionario dicionario(List<SkillDef> extras) {
        return extras == null || extras.isEmpty() ? Dicionario.padrao() : Dicionario.com(extras);
    }

    public JobSpec lerVaga(String texto, List<SkillDef> extras) {
        if (texto == null || texto.isBlank()) throw ErroApi.invalido("O texto da vaga está vazio.");
        return Vaga.parseJob(texto, dicionario(extras));
    }

    public ResultadoEdicao editar(PedidoEdicao p) {
        if (p.job() == null || p.acao() == null) throw ErroApi.invalido("Informe a vaga e a ação.");
        Dicionario dict = dicionario(p.extras());
        return switch (p.acao()) {
            case ALTERAR_TIPO -> {
                if (p.id() == null || p.tipo() == null) throw ErroApi.invalido("Informe o requisito e o novo tipo.");
                yield new ResultadoEdicao(Ranking.alterarTipo(p.job(), p.id(), p.tipo()), null);
            }
            case REMOVER -> {
                if (p.id() == null) throw ErroApi.invalido("Informe o requisito a remover.");
                yield new ResultadoEdicao(Ranking.removerRequisito(p.job(), p.id()), null);
            }
            case ADICIONAR -> {
                if (p.texto() == null || p.texto().isBlank() || p.tipo() == null) {
                    throw ErroApi.invalido("Informe o texto e o tipo do requisito.");
                }
                yield new ResultadoEdicao(Ranking.adicionarRequisito(p.job(), p.texto(), p.tipo(), dict), null);
            }
            case PROMOVER -> {
                if (p.termo() == null || p.termo().isBlank()) throw ErroApi.invalido("Informe o termo a promover.");
                var promocao = Ranking.promoverTermo(p.job(), p.termo());
                yield new ResultadoEdicao(promocao.job(), promocao.skill());
            }
        };
    }

    public List<String> termosAusentes(Analysis analise, String textoDaVaga, List<SkillDef> extras) {
        return Ranking.termosAusentes(analise.robotText(), textoDaVaga, dicionario(extras));
    }

    public RankingResult ranquear(Analysis analise, EstadoDaVaga e) {
        if (e.job() == null) throw ErroApi.invalido("Informe a vaga lida.");
        Dicionario dict = dicionario(e.extras());
        RankOptions op = new RankOptions(e.limiar() != null ? e.limiar() : 0.5,
                e.declarados() != null ? e.declarados() : Map.of(), e.extras() != null ? e.extras() : List.of(),
                e.respostas() != null ? e.respostas() : Map.of(), LocalDate.now(clock),
                e.lente() != null ? e.lente() : LenteId.NUCLEO,
                new Arquivo(analise.formatScore() == 0, analise.exportLinkedin()));
        return Ranking.rank(analise.structured(), e.job(), op, dict);
    }
}
