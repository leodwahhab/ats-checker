package br.com.atscv.ranking;

import static br.com.atscv.comum.Normalizar.fold;

import br.com.atscv.comum.Js;
import br.com.atscv.comum.JsRegex;
import br.com.atscv.comum.Normalizar;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.json.JsonMapper;

/** Dicionário de skills: acha tecnologias num texto e sabe o que implica o quê (PostgreSQL → SQL). */
public final class Dicionario {

    /**
     * Uma skill do dicionário.
     *
     * @param implica quem tem esta skill também tem estas
     * @param relacionadas skills próximas: contam como parcial
     * @param regex padrão próprio, sensível a maiúsculas, para grafias ambíguas (Go, R, C)
     * @param conceito conceito amplo (containers, back-end): comprovado por quem o implica, mas não ponte de parcial
     */
    public record SkillDef(
            String id, String rotulo, String categoria, List<String> aliases, List<String> implica,
            List<String> relacionadas, String regex, Boolean conceito) {

        public SkillDef {
            aliases = aliases == null ? List.of() : aliases;
        }
    }

    /** Grafia que vale por mais de uma skill: "testes unitários e de integração". */
    public record Combinacao(String grafia, List<String> ids) {}

    public record SkillMatch(String id, int start, int end) {}

    private record Proprio(String id, Pattern re) {}

    public final Map<String, SkillDef> defs;
    private final Map<String, List<String>> porAlias;
    private final Pattern principal;
    private final List<Proprio> proprios = new ArrayList<>();
    private final Map<String, List<String>> implicadoPor = new LinkedHashMap<>();
    private final Map<String, Set<String>> relacionadas = new LinkedHashMap<>();

    private static String chave(String s) {
        return Js.trim(Js.colapsar(fold(Normalizar.nfc(s))));
    }

    public Dicionario(List<SkillDef> lista, List<Combinacao> combinacoes) {
        this.defs = new LinkedHashMap<>();
        for (SkillDef d : lista) defs.put(d.id(), d);
        for (SkillDef d : lista) {
            for (String ref : concat(d.implica(), d.relacionadas())) conferir(d.id(), ref);
        }
        for (Combinacao c : combinacoes) for (String id : c.ids()) conferir(c.grafia(), id);

        porAlias = new LinkedHashMap<>();
        for (SkillDef d : lista) {
            List<String> termos = new ArrayList<>();
            if (d.regex() == null) termos.add(d.rotulo());
            termos.addAll(d.aliases());
            for (String t : termos) registrar(t, List.of(d.id()));
        }
        for (Combinacao c : combinacoes) registrar(c.grafia(), c.ids());

        // Em cada posição a alternativa mais longa vence: "spring boot" antes de "spring".
        List<String> chaves = new ArrayList<>(porAlias.keySet());
        chaves.sort(Comparator.comparingInt(String::length).reversed());
        List<String> alternativas = chaves.stream().map(Texto::padraoTermo).toList();
        principal = Pattern.compile(Texto.ANTES + "(?:" + String.join("|", alternativas) + ")" + Texto.DEPOIS);
        for (SkillDef d : lista) if (d.regex() != null) proprios.add(new Proprio(d.id(), JsRegex.compilar(d.regex(), "u")));

        Map<String, Set<String>> implica = new LinkedHashMap<>();
        for (SkillDef d : lista) implica.put(d.id(), fecho(d.id()));
        for (var e : implica.entrySet()) {
            for (String alvo : e.getValue()) implicadoPor.computeIfAbsent(alvo, k -> new ArrayList<>()).add(e.getKey());
        }
        for (SkillDef d : lista) {
            for (String r : orVazio(d.relacionadas())) {
                ligar(d.id(), r);
                ligar(r, d.id());
            }
            // A vaga pede Spring Boot e o CV tem Spring: parcial. Conceitos amplos não entram, senão qualquer
            // linguagem viraria parcial de qualquer outra.
            for (String alvo : implica.get(d.id())) {
                SkillDef a = defs.get(alvo);
                if (a == null || !Boolean.TRUE.equals(a.conceito())) ligar(d.id(), alvo);
            }
        }
    }

    private static List<String> orVazio(List<String> l) {
        return l == null ? List.of() : l;
    }

    private static List<String> concat(List<String> a, List<String> b) {
        List<String> out = new ArrayList<>(orVazio(a));
        out.addAll(orVazio(b));
        return out;
    }

    private void conferir(String origem, String ref) {
        if (!defs.containsKey(ref)) {
            throw new IllegalStateException("\"" + origem + "\" referencia \"" + ref + "\", que não está no dicionário");
        }
    }

    private void registrar(String termo, List<String> ids) {
        String k = chave(termo);
        if (k.isEmpty()) return;
        List<String> atual = porAlias.get(k);
        if (atual != null && !String.join(",", atual).equals(String.join(",", ids))) {
            throw new IllegalStateException("Grafia \"" + termo + "\" aparece em \"" + atual + "\" e em \"" + ids + "\"");
        }
        porAlias.put(k, ids);
    }

    private Set<String> fecho(String id) {
        Set<String> visto = new LinkedHashSet<>();
        List<String> pilha = new ArrayList<>(orVazio(defs.get(id).implica()));
        while (!pilha.isEmpty()) {
            String x = pilha.remove(pilha.size() - 1);
            if (x.equals(id) || visto.contains(x)) continue;
            visto.add(x);
            SkillDef d = defs.get(x);
            if (d != null) pilha.addAll(orVazio(d.implica()));
        }
        return visto;
    }

    private void ligar(String a, String b) {
        relacionadas.computeIfAbsent(a, k -> new LinkedHashSet<>()).add(b);
    }

    /** Skills citadas no texto, em ordem. As posições valem para `texto` (que deve estar em NFC). */
    public List<SkillMatch> find(String texto) {
        List<SkillMatch> out = new ArrayList<>();
        Matcher m = principal.matcher(fold(texto));
        while (m.find()) {
            for (String id : porAlias.getOrDefault(Js.colapsar(m.group()), List.of())) {
                out.add(new SkillMatch(id, m.start(), m.end()));
            }
        }
        for (Proprio p : proprios) {
            Matcher pm = p.re().matcher(texto);
            while (pm.find()) {
                int start = pm.start();
                int end = pm.end();
                boolean sobrepoe = out.stream().anyMatch(o -> start < o.end() && end > o.start());
                if (!sobrepoe) out.add(new SkillMatch(p.id(), start, end));
            }
        }
        // Ordem estável: grafias combinadas mantêm a ordem das skills.
        out.sort(Comparator.comparingInt(SkillMatch::start));
        return out;
    }

    public String rotulo(String id) {
        SkillDef d = defs.get(id);
        return d == null ? id : d.rotulo();
    }

    /** Skills que implicam `id`, direta ou indiretamente (PostgreSQL implica SQL). */
    public List<String> implicadoPor(String id) {
        return implicadoPor.getOrDefault(id, List.of());
    }

    /** Skills que contam como parcial para `id`. */
    public List<String> relacionadas(String id) {
        return new ArrayList<>(relacionadas.getOrDefault(id, Set.of()));
    }

    // ---------- Dicionário padrão ----------

    private record Arquivo(List<SkillDef> skills, List<List<Object>> combinacoes) {}

    private static Dicionario base;

    /** O dicionário de tecnologia (sem skills extras). */
    public static synchronized Dicionario padrao() {
        if (base == null) base = com(List.of());
        return base;
    }

    /** O dicionário de tecnologia mais os termos que o usuário promoveu a skill. */
    public static Dicionario com(List<SkillDef> extras) {
        if (extras.isEmpty() && base != null) return base;
        Arquivo a = arquivo();
        List<SkillDef> todas = new ArrayList<>(a.skills());
        todas.addAll(extras);
        List<Combinacao> combinacoes = new ArrayList<>();
        for (List<Object> c : a.combinacoes()) {
            @SuppressWarnings("unchecked")
            List<String> ids = (List<String>) c.get(1);
            combinacoes.add(new Combinacao((String) c.get(0), ids));
        }
        return new Dicionario(todas, combinacoes);
    }

    private static Arquivo arquivo() {
        try (InputStream in = Dicionario.class.getResourceAsStream("/ranking/skills.json")) {
            return JsonMapper.builder().build().readValue(in, Arquivo.class);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

}
