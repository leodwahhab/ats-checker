package br.com.atscv;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AtsCvCheckerApplication {
    public static void main(String[] args) throws IOException {
        // O SQLite cria o arquivo do banco, mas não a pasta onde ele fica.
        Files.createDirectories(Path.of("data"));
        SpringApplication.run(AtsCvCheckerApplication.class, args);
    }
}
