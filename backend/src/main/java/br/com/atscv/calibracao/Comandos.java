package br.com.atscv.calibracao;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Comandos de linha de comando, sem subir o servidor:
 * <pre>
 * mvn spring-boot:run "-Dspring-boot.run.arguments=importar --pasta=fixtures/candidaturas"
 * mvn spring-boot:run "-Dspring-boot.run.arguments=calibrar --saida=data/relatorio-calibracao.md"
 * </pre>
 */
@Component
public class Comandos implements ApplicationRunner {

    public static final List<String> NOMES = List.of("importar", "calibrar");

    private final Importador importador;
    private final Calibracao calibracao;

    public Comandos(Importador importador, Calibracao calibracao) {
        this.importador = importador;
        this.calibracao = calibracao;
    }

    private static String opcao(ApplicationArguments args, String nome, String padrao) {
        List<String> valores = args.getOptionValues(nome);
        return valores == null || valores.isEmpty() ? padrao : valores.get(0);
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        List<String> comando = args.getNonOptionArgs();
        if (comando.isEmpty() || !NOMES.contains(comando.get(0))) return;
        switch (comando.get(0)) {
            case "importar" -> importar(Path.of(opcao(args, "pasta", "fixtures/candidaturas")));
            case "calibrar" -> calibrar(Path.of(opcao(args, "saida", "data/relatorio-calibracao.md")));
            default -> { }
        }
    }

    private void importar(Path pasta) throws IOException {
        var r = importador.importar(pasta);
        System.out.println("Importadas: " + r.importadas().size() + "; já estavam no banco: " + r.jaImportadas().size()
                + "; ignoradas por erro: " + r.ignoradas().size());
        r.ignoradas().forEach((nome, erros) -> System.out.println("  - " + nome + ": " + String.join("; ", erros)));
    }

    private void calibrar(Path saida) throws IOException {
        String relatorio = calibracao.relatorio();
        if (saida.getParent() != null) Files.createDirectories(saida.getParent());
        Files.writeString(saida, relatorio);
        System.out.println("Relatório gravado em " + saida.toAbsolutePath());
    }
}
