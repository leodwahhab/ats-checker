package br.com.atscv.ranking;

import static br.com.atscv.ranking.Datas.duracao;
import static br.com.atscv.ranking.Datas.rotuloIntervalo;
import static br.com.atscv.ranking.Datas.totalMeses;

import br.com.atscv.ranking.Cargos.Comparacao;
import br.com.atscv.ranking.Tipos.CompAnos;
import br.com.atscv.ranking.Tipos.CompCargo;
import br.com.atscv.ranking.Tipos.CompFormacao;
import br.com.atscv.ranking.Tipos.CompIdioma;
import br.com.atscv.ranking.Tipos.CompNaoReconhecido;
import br.com.atscv.ranking.Tipos.CompSkill;
import br.com.atscv.ranking.Tipos.Component;
import br.com.atscv.ranking.Tipos.ComponentResult;
import br.com.atscv.ranking.Tipos.CvProfile;
import br.com.atscv.ranking.Tipos.Evidence;
import br.com.atscv.ranking.Tipos.ExperienciaPerfil;
import br.com.atscv.ranking.Tipos.FonteEvidencia;
import br.com.atscv.ranking.Tipos.FormacaoPerfil;
import br.com.atscv.ranking.Tipos.FonteIdioma;
import br.com.atscv.ranking.Tipos.IdiomaPerfil;
import br.com.atscv.ranking.Tipos.ModoSkill;
import br.com.atscv.ranking.Tipos.ReqStatus;
import br.com.atscv.ranking.Tipos.Requirement;
import br.com.atscv.ranking.Tipos.RequirementResult;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Avalia cada requisito da vaga contra o perfil do CV: atende, parcial, não atende ou não verificável. */
public final class Avaliar {
    private Avaliar() {}

    /** Do melhor para o pior. Numa linha com vários componentes, vale o pior. */
    static int ordem(ReqStatus s) {
        return switch (s) {
            case ATENDE -> 0;
            case PARCIAL -> 1;
            case NAO_VERIFICAVEL -> 2;
            case NAO_ATENDE -> 3;
        };
    }

    /**
     * @param fontes fontes que a lente aceita como evidência; null = todas valem
     * @param declarado resposta do usuário para um requisito "?": tenho (true) ou não tenho (false); null = sem resposta
     */
    public record OpcoesAvaliacao(Set<FonteEvidencia> fontes, Boolean declarado) {
        public static final OpcoesAvaliacao NENHUMA = new OpcoesAvaliacao(null, null);
    }

    private static String onde(List<Evidence> ev) {
        Set<String> rotulos = new LinkedHashSet<>();
        for (Evidence e : ev) rotulos.add(e.rotulo());
        return String.join(", ", rotulos.stream().limit(3).toList());
    }

    private record Comprovante(String id, List<Evidence> ev) {}

    public static RequirementResult avaliarRequisito(Requirement req, CvProfile perfil, Dicionario dict, OpcoesAvaliacao op) {
        Contexto ctx = new Contexto(req, perfil, dict, op);
        List<ComponentResult> componentes = new ArrayList<>();
        for (Component c : req.componentes()) componentes.add(ctx.componente(c));

        ComponentResult resultado = componentes.isEmpty()
                ? new ComponentResult(ReqStatus.NAO_VERIFICAVEL, "Requisito sem conteúdo reconhecível", List.of())
                : pior(componentes);
        // Lista de 3+ skills em que só uma falta ("Design Patterns, POO, SOLID, KISS…"): parcial, não ✗.
        List<ComponentResult> faltando = componentes.stream().filter(c -> c.status() == ReqStatus.NAO_ATENDE).toList();
        long skills = req.componentes().stream().filter(c -> c instanceof CompSkill).count();
        ReqStatus status = resultado.status();
        String motivo = resultado.motivo();
        if (status == ReqStatus.NAO_ATENDE && skills >= 3 && faltando.size() == 1
                && req.componentes().get(componentes.indexOf(faltando.get(0))) instanceof CompSkill
                && componentes.stream().allMatch(c -> c.status() == ReqStatus.ATENDE || c == faltando.get(0))) {
            status = ReqStatus.PARCIAL;
            motivo = "Atende quase toda a lista; falta um item · " + motivo;
        }
        Map<String, Evidence> unicas = new LinkedHashMap<>();
        for (Evidence e : resultado.evidencias()) unicas.put(e.rotulo() + "|" + e.trecho(), e);
        List<Evidence> evidenciasUnicas = new ArrayList<>(unicas.values());

        if (status == ReqStatus.NAO_VERIFICAVEL && op.declarado() != null) {
            boolean tenho = op.declarado();
            List<Evidence> ev = new ArrayList<>();
            ev.add(new Evidence(FonteEvidencia.DECLARADO, "Declarado por você", tenho ? "tenho" : "não tenho", false, null));
            ev.addAll(evidenciasUnicas);
            return new RequirementResult(req, tenho ? ReqStatus.ATENDE : ReqStatus.NAO_ATENDE,
                    (tenho ? "Você declarou que atende" : "Você declarou que não atende") + " · " + motivo, componentes, ev, true);
        }
        return new RequirementResult(req, status, motivo, componentes, evidenciasUnicas, false);
    }

    /** Junta componentes: o status é o pior; motivos e evidências se acumulam. */
    private static ComponentResult pior(List<ComponentResult> rs) {
        ReqStatus status = ReqStatus.ATENDE;
        for (ComponentResult r : rs) if (ordem(r.status()) > ordem(status)) status = r.status();
        List<Evidence> ev = new ArrayList<>();
        for (ComponentResult r : rs) ev.addAll(r.evidencias());
        return new ComponentResult(status, String.join(" · ", rs.stream().map(ComponentResult::motivo).toList()), ev);
    }

    private static ComponentResult melhor(List<ComponentResult> rs) {
        ComponentResult m = rs.get(0);
        for (ComponentResult b : rs) if (ordem(b.status()) < ordem(m.status())) m = b;
        return m;
    }

    private static Evidence evidenciaDe(ExperienciaPerfil e) {
        List<String> partes = new ArrayList<>();
        if (e.cargo() != null && !e.cargo().isEmpty()) partes.add(e.cargo());
        if (e.intervalo() != null) partes.add(rotuloIntervalo(e.intervalo()));
        return new Evidence(FonteEvidencia.EXPERIENCIA, "Experiência · " + e.rotulo(), String.join(" · ", partes), false,
                e.indice());
    }

    /** Experiências com data que citam a skill, ou uma skill que a implica (PostgreSQL conta para SQL). */
    public static List<ExperienciaPerfil> experienciasCom(String id, CvProfile perfil, Dicionario dict) {
        Set<Integer> indices = new LinkedHashSet<>();
        List<String> ids = new ArrayList<>(List.of(id));
        ids.addAll(dict.implicadoPor(id));
        for (String x : ids) {
            for (Evidence e : perfil.skills().getOrDefault(x, List.of())) {
                if (e.fonte() == FonteEvidencia.EXPERIENCIA && e.entrada() != null) indices.add(e.entrada());
            }
        }
        return perfil.experiencias().stream().filter(e -> e.intervalo() != null && indices.contains(e.indice())).toList();
    }

    private static int mesesDe(List<ExperienciaPerfil> exps) {
        return totalMeses(exps.stream().map(ExperienciaPerfil::intervalo).toList());
    }

    /** Contexto de uma avaliação: o requisito, o perfil, o dicionário e as opções da lente. */
    private static final class Contexto {
        final Requirement req;
        final CvProfile perfil;
        final Dicionario dict;
        final OpcoesAvaliacao op;

        Contexto(Requirement req, CvProfile perfil, Dicionario dict, OpcoesAvaliacao op) {
            this.req = req;
            this.perfil = perfil;
            this.dict = dict;
            this.op = op;
        }

        List<Evidence> evidencias(String id) {
            return perfil.skills().getOrDefault(id, List.of()).stream()
                    .filter(e -> op.fontes() == null || op.fontes().contains(e.fonte())).toList();
        }

        /** Skills do CV que comprovam `id`, diretamente ou por implicação (PostgreSQL comprova SQL). */
        List<Comprovante> comprovantes(String id) {
            List<String> ids = new ArrayList<>(List.of(id));
            ids.addAll(dict.implicadoPor(id));
            List<Comprovante> out = new ArrayList<>();
            for (String x : ids) {
                List<Evidence> ev = evidencias(x);
                if (!ev.isEmpty()) out.add(new Comprovante(x, ev));
            }
            return out;
        }

        ComponentResult skill(String id) {
            String rotulo = dict.rotulo(id);
            List<Comprovante> achados = comprovantes(id);
            if (!achados.isEmpty()) {
                Comprovante primeiro = achados.get(0);
                List<Comprovante> outros = achados.subList(1, achados.size());
                boolean direto = primeiro.id().equals(id);
                List<String> partes = new ArrayList<>();
                partes.add(direto ? onde(primeiro.ev())
                        : "implícito por " + dict.rotulo(primeiro.id()) + " (" + onde(primeiro.ev()) + ")");
                List<String> extras = outros.stream().limit(2).map(x -> dict.rotulo(x.id()) + " (" + onde(x.ev()) + ")").toList();
                if (!extras.isEmpty()) partes.add((direto ? "implícito também por" : "e por") + " " + String.join(", ", extras));
                List<Evidence> ev = new ArrayList<>();
                for (Comprovante c : achados) ev.addAll(c.ev());
                return new ComponentResult(ReqStatus.ATENDE, rotulo + ": " + String.join("; ", partes), ev);
            }
            for (String rel : dict.relacionadas(id)) {
                List<Comprovante> c = comprovantes(rel);
                if (!c.isEmpty()) {
                    Comprovante achado = c.get(0);
                    return new ComponentResult(ReqStatus.PARCIAL, rotulo + ": não encontrado, mas o CV cita "
                            + dict.rotulo(achado.id()) + " (" + onde(achado.ev()) + "), que é relacionado", achado.ev());
                }
            }
            // Lente com fontes restritas (Gupy): o CV cita a skill, mas numa seção que a plataforma não usa.
            List<Evidence> fora = new ArrayList<>();
            if (op.fontes() != null) {
                List<String> ids = new ArrayList<>(List.of(id));
                ids.addAll(dict.implicadoPor(id));
                for (String x : ids) fora.addAll(perfil.skills().getOrDefault(x, List.of()));
            }
            if (!fora.isEmpty()) {
                return new ComponentResult(ReqStatus.NAO_ATENDE,
                        rotulo + ": o CV cita só em " + onde(fora) + ", seção que esta plataforma não usa", List.of());
            }
            return new ComponentResult(ReqStatus.NAO_ATENDE, rotulo + ": não encontrado no que foi lido do CV", List.of());
        }

        ComponentResult componente(Component c) {
            return switch (c) {
                case CompSkill s -> {
                    List<ComponentResult> rs = s.ids().stream().map(this::skill).toList();
                    if (s.modo() == ModoSkill.TODAS) yield pior(rs);
                    ComponentResult m = melhor(rs);
                    if (m.status() != ReqStatus.NAO_ATENDE) yield m;
                    yield new ComponentResult(ReqStatus.NAO_ATENDE,
                            "Nenhum de: " + String.join(", ", s.ids().stream().map(dict::rotulo).toList()), List.of());
                }
                case CompAnos a -> anos(a);
                case CompFormacao f -> formacao(f);
                case CompIdioma i -> idioma(i);
                case CompCargo cg -> cargo(cg);
                case CompNaoReconhecido n -> new ComponentResult(ReqStatus.NAO_VERIFICAVEL,
                        !n.termos().isEmpty()
                                ? String.join(", ", n.termos().stream().map(t -> "\"" + t + "\"").toList()) + " "
                                        + (n.termos().size() > 1 ? "não estão" : "não está") + " no dicionário"
                                : "Requisito não reconhecido automaticamente: confirme se você atende",
                        List.of());
            };
        }

        /**
         * Anos de experiência: ✓ atinge o mínimo; ◐ falta até 1 ano, para mínimos de 2 anos ou mais; ✗ falta mais que
         * isso. Com skills na linha, conta o tempo das experiências que citam a skill.
         */
        ComponentResult anos(CompAnos c) {
            String pedido = "a vaga pede " + c.minimo() + "+ " + (c.minimo() > 1 ? "anos" : "ano");
            List<ExperienciaPerfil> comData = perfil.experiencias().stream().filter(e -> e.intervalo() != null).toList();
            if (comData.isEmpty()) {
                return new ComponentResult(ReqStatus.NAO_ATENDE,
                        "Tempo de experiência: nenhuma experiência com período legível foi lida do CV; " + pedido, List.of());
            }

            String rotulo;
            List<ExperienciaPerfil> exps;
            List<CompSkill> skills = req.componentes().stream().filter(x -> x instanceof CompSkill)
                    .map(x -> (CompSkill) x).toList();
            if (!skills.isEmpty()) {
                // "Java e Spring Boot": vale a skill com menos tempo; "Java ou Kotlin": a com mais.
                record Opcao(String id, List<ExperienciaPerfil> exps) {}
                List<Opcao> porGrupo = new ArrayList<>();
                for (CompSkill g : skills) {
                    List<Opcao> opcoes = new ArrayList<>(g.ids().stream()
                            .map(id -> new Opcao(id, experienciasCom(id, perfil, dict))).toList());
                    opcoes.sort(Comparator.comparingInt(o -> mesesDe(o.exps())));
                    porGrupo.add(g.modo() == ModoSkill.ALGUMA ? opcoes.get(opcoes.size() - 1) : opcoes.get(0));
                }
                Opcao limitante = porGrupo.get(0);
                for (Opcao b : porGrupo) if (mesesDe(b.exps()) < mesesDe(limitante.exps())) limitante = b;
                final Opcao lim = limitante;
                boolean empate = porGrupo.stream().allMatch(g -> mesesDe(g.exps()) == mesesDe(lim.exps()));
                rotulo = porGrupo.size() == 1 || empate
                        ? Texto.lista(porGrupo.stream().map(g -> dict.rotulo(g.id())).toList())
                        : dict.rotulo(limitante.id()) + " (a skill da linha com menos tempo)";
                exps = limitante.exps();
            } else if (c.familia() != null) {
                String r = Cargos.ROTULO_FAMILIA.get(c.familia());
                rotulo = "Experiência como " + (r != null ? r : c.familia());
                exps = comData.stream().filter(e -> e.familia() != null
                        && Cargos.compararFamilia(e.familia(), c.familia()) == Comparacao.ATENDE).toList();
            } else {
                rotulo = "Experiência profissional";
                exps = comData;
            }

            int meses = mesesDe(exps);
            int minimo = c.minimo() * 12;
            ReqStatus status = meses >= minimo ? ReqStatus.ATENDE
                    : c.minimo() >= 2 && minimo - meses <= 12 ? ReqStatus.PARCIAL : ReqStatus.NAO_ATENDE;
            String onde = String.join("; ", exps.stream().limit(3).map(e -> e.rotulo() + ", " + rotuloIntervalo(e.intervalo())).toList());
            int estagio = mesesDe(exps) - mesesDe(exps.stream().filter(e -> !e.estagio()).toList());
            List<String> partes = new ArrayList<>();
            partes.add(rotulo + ": " + duracao(meses) + (onde.isEmpty() ? "" : " (" + onde + ")"));
            if (estagio > 0) partes.add("inclui " + duracao(estagio) + " de estágio");
            // A experiência que não cita a skill não conta: diz qual, para o candidato saber o que escrever.
            List<ExperienciaPerfil> fora = comData.stream().filter(e -> !exps.contains(e)).limit(2).toList();
            if (!skills.isEmpty() && !fora.isEmpty()) {
                List<String> nomes = fora.stream().map(e -> e.cargo() != null && !e.cargo().isEmpty()
                        ? e.cargo() + " (" + e.rotulo() + ")" : e.rotulo()).toList();
                partes.add(Texto.lista(nomes) + " não " + (fora.size() > 1 ? "citam" : "cita") + " "
                        + ANTES_DO_PARENTESE.matcher(rotulo).replaceFirst(""));
            }
            return new ComponentResult(status, String.join("; ", partes) + "; " + pedido,
                    exps.stream().map(Avaliar::evidenciaDe).toList());
        }

        /** Formação: ✓ nível e situação atendidos; ◐ cursando quando a vaga pede completo; ? área ou situação não lida. */
        ComponentResult formacao(CompFormacao c) {
            String pedido = Lexicos.rotuloFormacao(c.nivelMinimo()) + (c.aceitaCursando() ? " completo ou em andamento" : " completo")
                    + (c.area() == Tipos.AreaFormacao.TI ? " em TI ou área afim" : "");
            if (perfil.formacao().isEmpty()) {
                return new ComponentResult(ReqStatus.NAO_ATENDE,
                        "Formação: nenhuma formação com curso e período legíveis foi lida do CV; a vaga pede " + pedido, List.of());
            }
            List<ComponentResult> rs = new ArrayList<>();
            for (FormacaoPerfil f : perfil.formacao()) rs.add(avaliarFormacao(c, f, pedido));
            return melhor(rs);
        }

        private ComponentResult avaliarFormacao(CompFormacao c, FormacaoPerfil f, String pedido) {
            List<Evidence> ev = List.of(new Evidence(FonteEvidencia.FORMACAO, "Formação", f.descricao(), false, null));
            java.util.function.BiFunction<ReqStatus, String, ComponentResult> r = (status, motivo) ->
                    new ComponentResult(status, "Formação: " + f.descricao() + ": " + motivo + "; a vaga pede " + pedido, ev);
            if (f.nivel() == null) return r.apply(ReqStatus.NAO_VERIFICAVEL, "o nível do curso não foi identificado");
            if (Lexicos.ORDEM_FORMACAO.indexOf(f.nivel()) < Lexicos.ORDEM_FORMACAO.indexOf(c.nivelMinimo())) {
                return semEvidencia(r.apply(ReqStatus.NAO_ATENDE, "nível abaixo do pedido"));
            }
            if (c.area() == Tipos.AreaFormacao.TI && !f.areaTi()) {
                return r.apply(ReqStatus.NAO_VERIFICAVEL, "não reconheci o curso como da área de TI; confirme se a vaga aceita");
            }
            return switch (f.situacao()) {
                case CONCLUIDO -> r.apply(ReqStatus.ATENDE, f.inferida() ? "concluído (pela data de término)" : "concluído");
                case CURSANDO -> c.aceitaCursando() ? r.apply(ReqStatus.ATENDE, "em andamento") : r.apply(ReqStatus.PARCIAL, "em andamento");
                case INCOMPLETO -> semEvidencia(r.apply(ReqStatus.NAO_ATENDE, "incompleto ou trancado"));
                case DESCONHECIDA -> r.apply(ReqStatus.NAO_VERIFICAVEL, "o CV não diz se o curso foi concluído");
            };
        }

        private static ComponentResult semEvidencia(ComponentResult c) {
            return new ComponentResult(c.status(), c.motivo(), List.of());
        }

        /** Idioma: ✓ nível igual ou acima; ◐ um nível abaixo; ✗ ausente ou dois abaixo; ? nível não lido. */
        ComponentResult idioma(CompIdioma c) {
            String pedido = "a vaga pede " + Lexicos.rotuloIdioma(c.nivelMinimo());
            // Na Gupy, só a seção Idiomas: o resumo não preenche o campo de idiomas do perfil.
            IdiomaPerfil l = perfil.idiomas().stream().filter(x -> x.idioma().equals(c.idioma())
                    && (op.fontes() == null || op.fontes().contains(x.fonte() == FonteIdioma.IDIOMAS
                            ? FonteEvidencia.IDIOMAS : FonteEvidencia.RESUMO))).findFirst().orElse(null);
            if (l == null) return new ComponentResult(ReqStatus.NAO_ATENDE, c.idioma() + ": não aparece no CV; " + pedido, List.of());
            boolean doIdiomas = l.fonte() == FonteIdioma.IDIOMAS;
            List<Evidence> ev = List.of(new Evidence(doIdiomas ? FonteEvidencia.IDIOMAS : FonteEvidencia.RESUMO,
                    doIdiomas ? "Idiomas" : "Resumo", l.trecho(), doIdiomas, null));
            if (l.nivel() == null) {
                return new ComponentResult(ReqStatus.NAO_VERIFICAVEL, c.idioma() + ": o CV não informa o nível; " + pedido, ev);
            }
            int diferenca = Lexicos.ORDEM_IDIOMA.indexOf(l.nivel()) - Lexicos.ORDEM_IDIOMA.indexOf(c.nivelMinimo());
            ReqStatus status = diferenca >= 0 ? ReqStatus.ATENDE : diferenca == -1 ? ReqStatus.PARCIAL : ReqStatus.NAO_ATENDE;
            return new ComponentResult(status, c.idioma() + ": " + Lexicos.rotuloIdioma(l.nivel()) + " no CV; " + pedido, ev);
        }

        /** Cargo anterior: ✓ mesma família; ◐ família vizinha (full stack ↔ back-end); ✗ outra. */
        ComponentResult cargo(CompCargo c) {
            String rotuloFamilia = Cargos.ROTULO_FAMILIA.get(c.familia());
            String pedido = rotuloFamilia != null ? rotuloFamilia : c.familia();
            List<ComponentResult> rs = new ArrayList<>();
            for (ExperienciaPerfil e : perfil.experiencias()) {
                if (e.familia() == null) continue;
                Comparacao cmp = Cargos.compararFamilia(e.familia(), c.familia());
                ReqStatus status = cmp == Comparacao.ATENDE ? ReqStatus.ATENDE
                        : cmp == Comparacao.PARCIAL ? ReqStatus.PARCIAL : ReqStatus.NAO_ATENDE;
                String cargoLido = e.cargo() + " (" + e.rotulo() + ")";
                rs.add(new ComponentResult(status,
                        status == ReqStatus.ATENDE ? "Experiência como " + pedido + ": " + cargoLido
                                : "Experiência como " + pedido + ": o mais próximo é " + cargoLido,
                        status == ReqStatus.NAO_ATENDE ? List.of() : List.of(evidenciaDe(e))));
            }
            ComponentResult r = rs.isEmpty() ? null : melhor(rs);
            if (r != null && r.status() != ReqStatus.NAO_ATENDE) return r;
            return new ComponentResult(ReqStatus.NAO_ATENDE,
                    !perfil.experiencias().isEmpty()
                            ? "Experiência como " + pedido + ": nenhum cargo lido do CV é dessa área"
                            : "Experiência como " + pedido + ": nenhuma experiência foi lida do CV",
                    List.of());
        }
    }

    private static final Pattern ANTES_DO_PARENTESE = Pattern.compile(" \\(.*$");

}
