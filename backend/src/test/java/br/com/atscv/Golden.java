package br.com.atscv;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.annotation.JsonInclude;

/** Acesso aos golden files (saída do TypeScript original) e comparação deles com a do Java. */
public final class Golden {
    private Golden() {}

    public static final Path RAIZ = Path.of("src/test/resources/golden");
    public static final Path FIXTURES = Path.of("fixtures");

    public static final ObjectMapper JSON = JsonMapper.builder()
            .changeDefaultPropertyInclusion(v -> JsonInclude.Value.construct(JsonInclude.Include.NON_NULL,
                    JsonInclude.Include.NON_NULL))
            .build();

    public static boolean existe(String subdir) {
        return Files.isDirectory(RAIZ.resolve(subdir));
    }

    public static List<Path> arquivos(String subdir, String sufixo) throws IOException {
        if (!existe(subdir)) return List.of();
        try (Stream<Path> s = Files.list(RAIZ.resolve(subdir))) {
            return s.filter(p -> p.getFileName().toString().endsWith(sufixo)).sorted().toList();
        }
    }

    public static JsonNode ler(Path p) throws IOException {
        return JSON.readTree(Files.readString(p));
    }

    /** Diferenças entre o esperado (TypeScript) e o obtido (Java); números comparados pelo valor. */
    public static List<String> diferencas(JsonNode esperado, JsonNode obtido) {
        List<String> out = new ArrayList<>();
        comparar("$", esperado, obtido, out);
        return out;
    }

    private static void comparar(String caminho, JsonNode a, JsonNode b, List<String> out) {
        if (out.size() >= 25) return;
        if (a == null || b == null) {
            if (a != b) out.add(caminho + ": esperado=" + a + " obtido=" + b);
            return;
        }
        if (a.isNumber() && b.isNumber()) {
            double x = a.doubleValue();
            double y = b.doubleValue();
            if (Math.abs(x - y) > 1e-6 * Math.max(1, Math.abs(x))) out.add(caminho + ": esperado=" + x + " obtido=" + y);
        } else if (a.isObject() && b.isObject()) {
            for (var e : a.properties()) comparar(caminho + "." + e.getKey(), e.getValue(), b.get(e.getKey()), out);
            for (var e : b.properties()) {
                if (!a.has(e.getKey())) out.add(caminho + "." + e.getKey() + ": não esperado, obtido=" + e.getValue());
            }
        } else if (a.isArray() && b.isArray()) {
            if (a.size() != b.size()) out.add(caminho + ": esperado " + a.size() + " itens, obtido " + b.size());
            for (int i = 0; i < Math.min(a.size(), b.size()); i++) comparar(caminho + "[" + i + "]", a.get(i), b.get(i), out);
        } else if (!a.equals(b)) {
            out.add(caminho + ": esperado=" + a + " obtido=" + b);
        }
    }
}
