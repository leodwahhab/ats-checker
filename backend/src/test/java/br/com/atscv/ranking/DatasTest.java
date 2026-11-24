package br.com.atscv.ranking;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.atscv.formato.Modelos.Periodo;
import br.com.atscv.ranking.Tipos.IntervaloMeses;
import br.com.atscv.ranking.Tipos.Lacuna;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class DatasTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 13);

    private static int mes(int ano, int m) {
        return ano * 12 + (m - 1);
    }

    @Test
    void leMesPorExtensoAbreviadoNumericoEAnoSozinho() {
        assertThat(Datas.mesDe("Agosto/2024", false)).isEqualTo(mes(2024, 8));
        assertThat(Datas.mesDe("janeiro de 2026", false)).isEqualTo(mes(2026, 1));
        assertThat(Datas.mesDe("mar. 2023", false)).isEqualTo(mes(2023, 3));
        assertThat(Datas.mesDe("08/2024", false)).isEqualTo(mes(2024, 8));
        // Ano sozinho: janeiro no início do período, dezembro no fim.
        assertThat(Datas.mesDe("2021", false)).isEqualTo(mes(2021, 1));
        assertThat(Datas.mesDe("2021", true)).isEqualTo(mes(2021, 12));
        assertThat(Datas.mesDe("sem data", false)).isNull();
    }

    @Test
    void intervaloIncluiOsDoisMesesEAtualVaiAteHoje() {
        IntervaloMeses i = Datas.intervaloDe(new Periodo("Agosto/2024", "Julho/2026", false), HOJE);
        assertThat(Datas.totalMeses(List.of(i))).isEqualTo(24);
        assertThat(Datas.rotuloIntervalo(i)).isEqualTo("ago/2024–jul/2026");
        assertThat(Datas.intervaloDe(new Periodo("Jan/2026", "Atual", true), HOJE))
                .isEqualTo(new IntervaloMeses(mes(2026, 1), mes(2026, 10)));
        assertThat(Datas.intervaloDe(new Periodo("Jan/2026", "Jan/2025", false), HOJE)).isNull();
    }

    @Test
    void periodosSobrepostosOuVizinhosContamUmaVez() {
        IntervaloMeses a = new IntervaloMeses(mes(2023, 4), mes(2024, 7));
        IntervaloMeses b = new IntervaloMeses(mes(2024, 8), mes(2026, 7));
        IntervaloMeses sobreposto = new IntervaloMeses(mes(2025, 1), mes(2025, 6));
        assertThat(Datas.uniao(List.of(b, a, sobreposto))).containsExactly(new IntervaloMeses(mes(2023, 4), mes(2026, 7)));
        assertThat(Datas.totalMeses(List.of(a, b, sobreposto))).isEqualTo(40);
    }

    @Test
    void lacunasDeSeteMesesOuMaisEntreExperienciasEAteHoje() {
        IntervaloMeses a = new IntervaloMeses(mes(2020, 1), mes(2020, 12));
        IntervaloMeses seisMeses = new IntervaloMeses(mes(2021, 7), mes(2022, 6));
        IntervaloMeses oitoMeses = new IntervaloMeses(mes(2023, 3), mes(2025, 12));
        assertThat(Datas.lacunas(List.of(a, seisMeses, oitoMeses), HOJE)).containsExactly(
                new Lacuna(mes(2022, 7), mes(2023, 2), 8, false),
                new Lacuna(mes(2026, 1), mes(2026, 10), 10, true));
        assertThat(Datas.lacunas(List.of(new IntervaloMeses(mes(2024, 1), mes(2026, 7))), HOJE)).isEmpty();
    }

    @Test
    void duracaoPorExtenso() {
        assertThat(Datas.duracao(40)).isEqualTo("3 anos e 4 meses");
        assertThat(Datas.duracao(24)).isEqualTo("2 anos");
        assertThat(Datas.duracao(13)).isEqualTo("1 ano e 1 mês");
        assertThat(Datas.duracao(7)).isEqualTo("7 meses");
        assertThat(Datas.duracao(0)).isEqualTo("nenhum tempo");
    }
}
