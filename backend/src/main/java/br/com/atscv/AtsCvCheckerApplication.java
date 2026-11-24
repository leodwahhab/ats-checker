package br.com.atscv;

import br.com.atscv.calibracao.Comandos;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AtsCvCheckerApplication {
    public static void main(String[] args) throws IOException {
        // O SQLite cria o arquivo do banco, mas não a pasta onde ele fica.
        Files.createDirectories(Path.of("data"));
        SpringApplication app = new SpringApplication(AtsCvCheckerApplication.class);
        // Os comandos (importar, calibrar) rodam e terminam, sem subir o servidor.
        if (args.length > 0 && Comandos.NOMES.contains(args[0])) app.setWebApplicationType(WebApplicationType.NONE);
        app.run(args);
    }
}
