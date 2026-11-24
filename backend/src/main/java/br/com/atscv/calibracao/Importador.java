package br.com.atscv.calibracao;

import br.com.atscv.api.Dtos.CandidaturaEntrada;
import br.com.atscv.persistencia.CandidaturaRepositorio;
import br.com.atscv.servico.CandidaturaServico;
import br.com.atscv.servico.CvServico;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Importa as pastas de candidaturas (fixtures/candidaturas) para o banco. É seguro rodar de novo: uma pasta já
 * importada (pelo nome) é pulada.
 */
@Component
public class Importador {

    /** O que a importação fez com cada pasta. */
    public record Resultado(List<String> importadas, List<String> jaImportadas, Map<String, List<String>> ignoradas) {}

    private final CvServico cvs;
    private final CandidaturaServico candidaturas;
    private final CandidaturaRepositorio repo;

    public Importador(CvServico cvs, CandidaturaServico candidaturas, CandidaturaRepositorio repo) {
        this.cvs = cvs;
        this.candidaturas = candidaturas;
        this.repo = repo;
    }

    public Resultado importar(Path raiz) throws IOException {
        List<String> importadas = new ArrayList<>();
        List<String> jaImportadas = new ArrayList<>();
        Map<String, List<String>> ignoradas = new LinkedHashMap<>();
        for (CasoDePasta caso : CasoDePasta.listarCasos(raiz)) {
            if (!caso.erros().isEmpty()) {
                ignoradas.put(caso.nome(), caso.erros());
                continue;
            }
            if (repo.porOrigem(caso.nome()).isPresent()) {
                jaImportadas.add(caso.nome());
                continue;
            }
            long cvId = cvs.enviar(caso.nome() + ".pdf", Files.readAllBytes(caso.pasta().resolve("cv.pdf"))).cv().id();
            candidaturas.criar(new CandidaturaEntrada(cvId, Files.readString(caso.pasta().resolve("vaga.txt")),
                    caso.plataforma(), caso.empresa(), caso.cargo(), caso.mesTexto(), caso.dataTexto(), caso.resultado(),
                    caso.etapa(), caso.observacoes(), caso.diasAteResposta(), caso.perguntas(), null, caso.nome()));
            importadas.add(caso.nome());
        }
        return new Resultado(importadas, jaImportadas, ignoradas);
    }
}
