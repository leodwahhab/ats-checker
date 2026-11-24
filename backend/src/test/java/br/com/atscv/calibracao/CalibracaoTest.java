package br.com.atscv.calibracao;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.atscv.api.Dtos.Candidatura;
import br.com.atscv.api.Dtos.Pergunta;
import br.com.atscv.calibracao.Calibracao.Avaliacao;
import br.com.atscv.formato.Modelos.SkillGroup;
import br.com.atscv.formato.Modelos.Structured;
import br.com.atscv.ranking.Dicionario;
import br.com.atscv.ranking.Lentes;
import br.com.atscv.ranking.Ranking;
import br.com.atscv.ranking.Tipos.Arquivo;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.RankOptions;
import br.com.atscv.ranking.Tipos.RankingResult;
import br.com.atscv.ranking.Vaga;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CalibracaoTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 13);

    @Test
    void oNomeDaPastaTrazMesPlataformaEmpresaECargo() {
        var n = CasoDePasta.lerNome("2026-09-linkedin-acme-dev-backend-jr");
        assertThat(n.ano()).isEqualTo(2026);
        assertThat(n.mes()).isEqualTo(9);
        assertThat(n.plataforma()).isEqualTo("linkedin");
        assertThat(n.empresa()).isEqualTo("acme");
        assertThat(n.cargo()).isEqualTo("dev backend jr");
        assertThat(n.erros()).isEmpty();
        assertThat(CasoDePasta.lerNome("2026-09-indeed-acme-dev").erros().get(0)).contains("plataforma \"indeed\" desconhecida");
        assertThat(CasoDePasta.lerNome("Acme dev java").erros().get(0)).contains("não segue");
    }

    @Test
    void metaJsonSoOResultadoEObrigatorioEOQueFicouDoModeloContaComoVazio() {
        var vazio = CasoDePasta.lerMeta("{ \"resultado\": \"reprovado\", \"data\": \"AAAA-MM-DD\", \"plataforma\": \"gupy\" }");
        assertThat(vazio.resultado()).isEqualTo("reprovado");
        assertThat(vazio.erros()).isEmpty();
        assertThat(vazio.avisos()).isEmpty();
        var comData = CasoDePasta.lerMeta("{ \"resultado\": \"reprovado\", \"data\": \"2026-09-15\", \"dias_ate_resposta\": 0 }");
        assertThat(comData.dia()).isEqualTo(15);
        assertThat(comData.diasAteResposta()).isZero();
        assertThat(CasoDePasta.lerMeta("{ \"resultado\": reprovado\" }").erros().get(0)).contains("não é um JSON válido");
        assertThat(CasoDePasta.lerMeta("{ \"resultado\": \"aprovado\" }").erros().get(0)).contains("resultado \"aprovado\" inválido");
        assertThat(CasoDePasta.lerMeta("{}").erros().get(0)).contains("falta \"resultado\"");
    }

    private static Avaliacao avaliacao(String resultado, String vaga, List<Pergunta> perguntas) {
        Structured cv = new Structured(List.of(), List.of(), List.of(), List.of(),
                List.of(new SkillGroup("Geral", List.of("Java"))), null, List.of(), List.of(), List.of());
        Dicionario dict = Dicionario.padrao();
        JobSpec job = Vaga.parseJob(vaga, dict);
        Map<LenteId, RankingResult> porLente = new EnumMap<>(LenteId.class);
        for (LenteId id : Lentes.ORDEM_LENTES) {
            porLente.put(id, Ranking.rank(cv, job, new RankOptions(0.5, Map.of(), List.of(), Map.of(), HOJE, id,
                    new Arquivo(false, false)), dict));
        }
        Candidatura caso = new Candidatura(1, 1, vaga, "linkedin", null, null, null, null, resultado, null, null, null, perguntas,
                null, null, null, null, null, null);
        return new Avaliacao(caso, "cv.pdf", 100, job, porLente);
    }

    @Test
    void destaquesPrevisaoQueContradizOResultadoEPerguntasDoFormulario() {
        assertThat(Calibracao.destaques(avaliacao("passou_triagem", "Dev\nRequisitos\n- Java\n- Kubernetes", List.of())).get(0))
                .startsWith("Passou na triagem, mas a lente LinkedIn deu \"Not a fit\"");
        assertThat(Calibracao.destaques(avaliacao("reprovado", "Dev\nRequisitos\n- Java", List.of())).get(0))
                .startsWith("Reprovado, mas a lente LinkedIn deu \"Top fit\"");
        assertThat(Calibracao.destaques(avaliacao("sem_retorno", "Dev\nRequisitos\n- Java\nModelo híbrido em São Paulo - SP",
                List.of(new Pergunta("Você tem CNH?", "sim"))))).containsExactly(
                "Perguntas que o app não previu: \"Você tem CNH?\".",
                "Previstas que não viraram pergunta: Trabalho híbrido em São Paulo - SP.");
    }

    @Test
    void relatorioTemResumoParaRevisarECasos() {
        String r = Calibracao.gerarRelatorio(List.of(avaliacao("reprovado", "Dev\nRequisitos\n- Java", List.of())), HOJE);
        assertThat(r).contains("# Relatório de calibração", "Gerado em 13/10/2026", "| reprovado (1) | 1 | 0 | 0 | 0 |",
                "## Para revisar", "## Casos", "- **Real:** reprovado · LinkedIn");
    }
}
