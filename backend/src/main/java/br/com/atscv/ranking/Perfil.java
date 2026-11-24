package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.JsRegex;
import br.com.atscv.comum.Normalizar;
import br.com.atscv.formato.Modelos.CertificationEntry;
import br.com.atscv.formato.Modelos.EducationEntry;
import br.com.atscv.formato.Modelos.ExperienceEntry;
import br.com.atscv.formato.Modelos.LanguageEntry;
import br.com.atscv.formato.Modelos.SkillGroup;
import br.com.atscv.formato.Modelos.Structured;
import br.com.atscv.ranking.Dicionario.SkillMatch;
import br.com.atscv.ranking.LocalParser.Local;
import br.com.atscv.ranking.Tipos.Atual;
import br.com.atscv.ranking.Tipos.CvProfile;
import br.com.atscv.ranking.Tipos.Evidence;
import br.com.atscv.ranking.Tipos.ExperienciaPerfil;
import br.com.atscv.ranking.Tipos.FonteEvidencia;
import br.com.atscv.ranking.Tipos.FonteIdioma;
import br.com.atscv.ranking.Tipos.FonteSenioridade;
import br.com.atscv.ranking.Tipos.FormacaoPerfil;
import br.com.atscv.ranking.Tipos.IdiomaPerfil;
import br.com.atscv.ranking.Tipos.IntervaloMeses;
import br.com.atscv.ranking.Tipos.NivelFormacao;
import br.com.atscv.ranking.Tipos.NivelIdioma;
import br.com.atscv.ranking.Tipos.Senioridade;
import br.com.atscv.ranking.Tipos.SituacaoFormacao;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * O que o ranqueamento sabe do CV, usando só o que o parser extraiu. Habilidades é a fonte explícita de skills;
 * experiência, resumo, cabeçalho, certificações, projetos e formação são implícitas.
 */
public final class Perfil {
    private Perfil() {}

    private static final Pattern APRENDIZ = JsRegex.compilar("\\baprendiz\\b");
    private static final Pattern CONCLUIDO = JsRegex.compilar("^conclu");
    private static final Pattern CURSANDO = JsRegex.compilar("andamento|cursando");
    private static final Pattern INCOMPLETO = JsRegex.compilar("incompleto|trancado|interrompido");

    /** Quem registra as evidências de skills no perfil. */
    private static final class Registro {
        final Map<String, List<Evidence>> skills = new LinkedHashMap<>();
        final Dicionario dict;

        Registro(Dicionario dict) {
            this.dict = dict;
        }

        List<String> registrar(String texto, FonteEvidencia fonte, String rotulo, boolean explicita, Integer entrada) {
            if (texto == null || texto.isEmpty()) return List.of();
            String src = Normalizar.nfc(texto);
            List<SkillMatch> ms = dict.find(src);
            List<String> ids = new ArrayList<>();
            for (SkillMatch m : ms) {
                List<Evidence> lista = skills.computeIfAbsent(m.id(), k -> new ArrayList<>());
                String t = Texto.trecho(src, m.start(), m.end());
                boolean existe = lista.stream().anyMatch(e -> e.rotulo().equals(rotulo) && e.trecho().equals(t)
                        && Objects.equals(e.entrada(), entrada));
                if (!existe) lista.add(new Evidence(fonte, rotulo, t, explicita, entrada));
                ids.add(m.id());
            }
            return ids;
        }
    }

    private static boolean tem(String s) {
        return s != null && !s.isEmpty();
    }

    public static CvProfile buildCvProfile(Structured s, Dicionario dict, LocalDate hoje) {
        Registro reg = new Registro(dict);

        // Skills listadas em Habilidades, sem contar o nome das categorias ("Back-end: Java, …").
        Set<String> listadas = new LinkedHashSet<>();
        for (SkillGroup g : s.habilidades()) {
            boolean geral = g.categoria().equals("Geral");
            String rotulo = geral ? "Habilidades" : "Habilidades · " + g.categoria();
            if (!geral) reg.registrar(g.categoria(), FonteEvidencia.HABILIDADES, rotulo, true, null);
            for (String item : g.itens()) listadas.addAll(reg.registrar(item, FonteEvidencia.HABILIDADES, rotulo, true, null));
        }

        for (int i = 0; i < s.experiencia().size(); i++) {
            ExperienceEntry e = s.experiencia().get(i);
            String nome = e.empresa() != null ? e.empresa() : e.cargo() != null ? e.cargo() : "item " + (i + 1);
            String rotulo = "Experiência · " + nome;
            reg.registrar(e.cargo(), FonteEvidencia.EXPERIENCIA, rotulo, false, i);
            reg.registrar(e.resumo(), FonteEvidencia.EXPERIENCIA, rotulo, false, i);
            for (String r : e.responsabilidades()) reg.registrar(r, FonteEvidencia.EXPERIENCIA, rotulo, false, i);
            reg.registrar(e.tecnologias(), FonteEvidencia.EXPERIENCIA, rotulo, false, i);
        }

        reg.registrar(s.resumo(), FonteEvidencia.RESUMO, "Resumo", false, null);
        for (String l : s.cabecalho()) reg.registrar(l, FonteEvidencia.CABECALHO, "Cabeçalho", false, null);
        // Links do contato: "github.com/usuario" comprova GitHub.
        for (String l : s.contato()) reg.registrar(l, FonteEvidencia.CABECALHO, "Contato", false, null);
        for (CertificationEntry c : s.certificacoes()) {
            List<String> partes = new ArrayList<>();
            if (tem(c.nome())) partes.add(c.nome());
            if (tem(c.emissor())) partes.add(c.emissor());
            reg.registrar(String.join(" | ", partes), FonteEvidencia.CERTIFICACOES, "Certificações", false, null);
        }
        for (String l : s.projetos()) reg.registrar(l, FonteEvidencia.PROJETOS, "Projetos", false, null);
        for (EducationEntry f : s.formacao()) reg.registrar(f.curso(), FonteEvidencia.FORMACAO, "Formação", false, null);

        // ---------- Tempo de experiência ----------
        List<ExperienciaPerfil> experiencias = new ArrayList<>();
        for (int i = 0; i < s.experiencia().size(); i++) {
            ExperienceEntry e = s.experiencia().get(i);
            Senioridade senioridade = e.cargo() != null && !e.cargo().isEmpty() ? Cargos.senioridadeDe(e.cargo()) : null;
            boolean estagio = senioridade == Senioridade.ESTAGIO
                    || APRENDIZ.matcher(fold(e.cargo() == null ? "" : e.cargo())).find();
            experiencias.add(new ExperienciaPerfil(i,
                    e.empresa() != null ? e.empresa() : e.cargo() != null ? e.cargo() : "item " + (i + 1), e.cargo(),
                    e.periodo() != null ? Datas.intervaloDe(e.periodo(), hoje) : null,
                    e.periodo() != null && e.periodo().atual(), estagio,
                    e.cargo() != null && !e.cargo().isEmpty() ? Cargos.familiaDe(e.cargo()) : null, senioridade));
        }
        List<ExperienciaPerfil> comData = experiencias.stream().filter(e -> e.intervalo() != null).toList();
        List<IntervaloMeses> intervalos = comData.stream().map(ExperienciaPerfil::intervalo).toList();
        int mesesTotais = Datas.totalMeses(intervalos);
        int mesesEstagio = mesesTotais - Datas.totalMeses(
                comData.stream().filter(e -> !e.estagio()).map(ExperienciaPerfil::intervalo).toList());

        // A experiência mais recente; sem datas, vale a primeira da lista (os CVs costumam começar pela atual).
        ExperienciaPerfil recente = null;
        if (!comData.isEmpty()) {
            recente = comData.get(0);
            for (int i = 1; i < comData.size(); i++) {
                ExperienciaPerfil b = comData.get(i);
                IntervaloMeses x = recente.intervalo();
                IntervaloMeses y = b.intervalo();
                if (y.fim() > x.fim() || (y.fim() == x.fim() && y.inicio() > x.inicio())) recente = b;
            }
        } else if (!experiencias.isEmpty()) {
            recente = experiencias.get(0);
        }
        String cabecalho = String.join(" · ", s.cabecalho());
        Senioridade senioridade = null;
        FonteSenioridade fonteSenioridade = null;
        if (recente != null && recente.senioridade() != null) {
            senioridade = recente.senioridade();
            fonteSenioridade = FonteSenioridade.CARGO;
        } else if (Cargos.senioridadeDe(cabecalho) != null) {
            senioridade = Cargos.senioridadeDe(cabecalho);
            fonteSenioridade = FonteSenioridade.CABECALHO;
        } else if (!comData.isEmpty()) {
            senioridade = senioridadePorTempo(mesesTotais);
            fonteSenioridade = FonteSenioridade.ANOS;
        }

        List<FormacaoPerfil> formacao = new ArrayList<>();
        for (EducationEntry f : s.formacao()) formacao.addAll(formacaoDoCv(f));

        // Só "Cidade - UF": um nome próprio solto no topo pode ser o do candidato.
        Local local = null;
        List<String> linhasDeLocal = new ArrayList<>(s.contato());
        linhasDeLocal.addAll(s.cabecalho());
        for (String l : linhasDeLocal) {
            local = LocalParser.localDe(l);
            if (local != null) break;
        }

        List<String> partesIdioma = new ArrayList<>();
        if (tem(s.resumo())) partesIdioma.add(s.resumo());
        partesIdioma.addAll(s.cabecalho().stream().filter(Perfil::tem).toList());
        for (ExperienceEntry e : s.experiencia()) {
            if (tem(e.cargo())) partesIdioma.add(e.cargo());
            if (tem(e.resumo())) partesIdioma.add(e.resumo());
            partesIdioma.addAll(e.responsabilidades().stream().filter(Perfil::tem).toList());
        }

        String familiaAtual = recente != null && recente.familia() != null ? recente.familia() : Cargos.familiaDe(cabecalho);
        return new CvProfile(reg.skills, listadas.size(), experiencias, mesesTotais, mesesEstagio,
                Datas.lacunas(intervalos, hoje), formacao, idiomasDoCv(s),
                new Atual(recente, familiaAtual, senioridade, fonteSenioridade), local,
                Texto.idiomaDoTexto(String.join("\n", partesIdioma)));
    }

    /**
     * Aproximação de mercado: júnior até 2 anos, pleno de 2 a 5, sênior acima disso. O estágio conta no tempo.
     */
    private static Senioridade senioridadePorTempo(int meses) {
        if (meses < 24) return Senioridade.JUNIOR;
        return meses <= 60 ? Senioridade.PLENO : Senioridade.SENIOR;
    }

    private static NivelFormacao nivelDoParser(String fold) {
        return switch (fold) {
            case "doutorado" -> NivelFormacao.DOUTORADO;
            case "mestrado" -> NivelFormacao.MESTRADO;
            case "pos-graduacao" -> NivelFormacao.POS;
            case "graduacao" -> NivelFormacao.GRADUACAO;
            case "tecnico" -> NivelFormacao.TECNICO;
            case "ensino medio" -> NivelFormacao.MEDIO;
            default -> null;
        };
    }

    private static List<FormacaoPerfil> formacaoDoCv(EducationEntry f) {
        if (f.nivel().equals("Intercâmbio")) return List.of();
        String status = fold(f.status() == null ? "" : f.status());
        SituacaoFormacao situacao = CONCLUIDO.matcher(status).find() ? SituacaoFormacao.CONCLUIDO
                : CURSANDO.matcher(status).find() ? SituacaoFormacao.CURSANDO
                        : INCOMPLETO.matcher(status).find() ? SituacaoFormacao.INCOMPLETO : SituacaoFormacao.DESCONHECIDA;
        List<String> partes = new ArrayList<>();
        if (!f.nivel().equals("Não identificado") && tem(f.nivel())) partes.add(f.nivel());
        if (tem(f.curso())) partes.add(f.curso());
        if (tem(f.instituicao())) partes.add(f.instituicao());
        if (tem(f.status())) partes.add(f.status());
        return List.of(new FormacaoPerfil(nivelDoParser(fold(f.nivel())), f.curso(),
                Lexicos.AREA_TI_CURSO.matcher(fold(f.curso() == null ? "" : f.curso())).find(), situacao,
                f.statusInferido(), String.join(" · ", partes)));
    }

    private static NivelIdioma nivelIdioma(String f) {
        for (var par : Lexicos.NIVEIS_IDIOMA) if (par.re().matcher(f).find()) return par.chave();
        return null;
    }

    private static List<IdiomaPerfil> idiomasDoCv(Structured s) {
        List<IdiomaPerfil> out = new ArrayList<>();
        for (LanguageEntry l : s.idiomas()) {
            String nome = l.idioma();
            for (var par : Lexicos.IDIOMAS) {
                if (par.re().matcher(fold(l.idioma())).find()) {
                    nome = par.chave();
                    break;
                }
            }
            List<String> partes = new ArrayList<>();
            if (tem(l.idioma())) partes.add(l.idioma());
            if (tem(l.nivel())) partes.add(l.nivel());
            out.add(new IdiomaPerfil(nome, nivelIdioma(fold(l.nivel() == null ? "" : l.nivel())), FonteIdioma.IDIOMAS,
                    String.join(" · ", partes)));
        }
        // Sem seção Idiomas, o resumo pode dizer "inglês avançado (TOEIC B2)".
        String resumo = Normalizar.nfc(s.resumo() == null ? "" : s.resumo());
        String f = fold(resumo);
        for (var par : Lexicos.IDIOMAS) {
            String idioma = par.chave();
            if (out.stream().anyMatch(l -> l.idioma().equals(idioma))) continue;
            Matcher m = par.re().matcher(f);
            if (!m.find()) continue;
            int fim = m.end();
            NivelIdioma nivel = nivelIdioma(f.substring(fim, Math.min(f.length(), fim + 40)));
            if (nivel == null) nivel = nivelIdioma(f.substring(Math.max(0, m.start() - 25), m.start()));
            out.add(new IdiomaPerfil(idioma, nivel, FonteIdioma.RESUMO, Texto.trecho(resumo, m.start(), fim, 80)));
        }
        return out;
    }

}
