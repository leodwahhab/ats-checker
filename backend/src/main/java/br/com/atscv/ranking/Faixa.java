package br.com.atscv.ranking;

import br.com.atscv.ranking.Tipos.Cobertura;
import br.com.atscv.ranking.Tipos.Dimensao;
import br.com.atscv.ranking.Tipos.Eliminatoria;
import br.com.atscv.ranking.Tipos.FaixaId;
import br.com.atscv.ranking.Tipos.ReqStatus;
import br.com.atscv.ranking.Tipos.ReqTipo;
import br.com.atscv.ranking.Tipos.RequirementResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Faixa do núcleo (regra do assistente de vagas do LinkedIn) e o número secundário de 0 a 100. */
public final class Faixa {
    private Faixa() {}

    public static final Map<FaixaId, String> ROTULO_FAIXA = Map.of(
            FaixaId.TOP, "Alta aderência (Top fit)",
            FaixaId.MAYBE, "Aderência parcial (Maybe)",
            FaixaId.NOT, "Não atende (Not fit)");

    /** Peso de cada status nas coberturas: ✓ = 1, ◐ = 0,5, ✗ e ? = 0. */
    static double peso(ReqStatus s) {
        return switch (s) {
            case ATENDE -> 1;
            case PARCIAL -> 0.5;
            case NAO_ATENDE, NAO_VERIFICAVEL -> 0;
        };
    }

    private static String pct(double x) {
        return Math.round(x * 100) + "%";
    }

    private static Double cobertura(List<RequirementResult> rs) {
        if (rs.isEmpty()) return null;
        double soma = 0;
        for (RequirementResult r : rs) soma += peso(r.status());
        return soma / rs.size();
    }

    /** O que a faixa devolve; a lente e o ranking completam o resto. */
    public record Resultado(
            FaixaId faixa, String rotuloFaixa, int numero, String resumo, List<String> comoMelhorar, Cobertura cobertura,
            boolean vazio) {}

    /**
     * Not fit se falta algum obrigatório ou uma eliminatória foi respondida com "não"; Top fit se todos os obrigatórios
     * são atendidos e a cobertura dos desejáveis chega ao limiar; Maybe nos demais casos.
     */
    public static Resultado calcularFaixa(List<RequirementResult> rs, double limiar, List<Dimensao> dimensoes,
            List<? extends Eliminatoria> recusadas) {
        List<RequirementResult> obrig = rs.stream().filter(r -> r.requisito().tipo() == ReqTipo.OBRIGATORIO).toList();
        List<RequirementResult> desej = rs.stream().filter(r -> r.requisito().tipo() == ReqTipo.DESEJAVEL).toList();
        Double cobObrig = cobertura(obrig);
        Double cobDesej = cobertura(desej);

        List<RequirementResult> falharam = obrig.stream().filter(r -> r.status() == ReqStatus.NAO_ATENDE).toList();
        List<RequirementResult> pendentes = obrig.stream()
                .filter(r -> r.status() == ReqStatus.PARCIAL || r.status() == ReqStatus.NAO_VERIFICAVEL).toList();
        boolean desejAbaixo = cobDesej != null && cobDesej < limiar;
        FaixaId faixa = !falharam.isEmpty() || !recusadas.isEmpty() ? FaixaId.NOT
                : !pendentes.isEmpty() || desejAbaixo ? FaixaId.MAYBE : FaixaId.TOP;

        // Número secundário: obrigatórios 50, desejáveis 25, cargo 10, senioridade 10, local 5. O que não tem dado sai
        // do cálculo e o peso é redistribuído.
        double pesoTotal = 0;
        double soma = 0;
        if (cobObrig != null) {
            pesoTotal += 50;
            soma += 50 * cobObrig;
        }
        if (cobDesej != null) {
            pesoTotal += 25;
            soma += 25 * cobDesej;
        }
        for (Dimensao d : dimensoes) {
            if (d.status() == ReqStatus.NAO_VERIFICAVEL) continue;
            pesoTotal += d.peso();
            soma += d.peso() * peso(d.status());
        }
        int numero = pesoTotal > 0 ? (int) Math.round(soma / pesoTotal * 100) : 0;

        long atendidos = obrig.stream().filter(r -> r.status() == ReqStatus.ATENDE).count();
        String resumo = (!obrig.isEmpty()
                ? "Atende " + atendidos + " de " + obrig.size() + " obrigatório" + (obrig.size() > 1 ? "s" : "")
                : "Nenhum obrigatório identificado")
                + (!desej.isEmpty() ? " e " + pct(cobDesej) + " dos desejáveis." : ".");

        List<String> comoMelhorar = new ArrayList<>();
        for (Eliminatoria e : recusadas) {
            comoMelhorar.add("Você respondeu que não atende \"" + e.rotulo()
                    + "\": numa pergunta eliminatória, a plataforma provavelmente reprova automaticamente");
        }
        for (RequirementResult r : falharam) comoMelhorar.add("Obrigatório não atendido: \"" + r.requisito().texto() + "\"");
        for (RequirementResult r : pendentes) {
            comoMelhorar.add(r.status() == ReqStatus.PARCIAL
                    ? "Obrigatório só parcial: \"" + r.requisito().texto() + "\""
                    : "Obrigatório não verificável: \"" + r.requisito().texto() + "\". Responda \"tenho\" ou \"não tenho\"");
        }
        if (falharam.isEmpty() && pendentes.isEmpty() && recusadas.isEmpty() && desejAbaixo) {
            comoMelhorar.add("Desejáveis: " + pct(cobDesej) + " atendidos; para Top fit é preciso " + pct(limiar));
            desej.stream().filter(r -> r.status() != ReqStatus.ATENDE).limit(3)
                    .forEach(r -> comoMelhorar.add("Desejável que falta: \"" + r.requisito().texto() + "\""));
        }

        return new Resultado(faixa, ROTULO_FAIXA.get(faixa), numero, resumo,
                comoMelhorar.subList(0, Math.min(5, comoMelhorar.size())), new Cobertura(cobObrig, cobDesej),
                // Informativos (tecnologias das atividades) não entram na faixa.
                obrig.size() + desej.size() == 0);
    }
}
