package br.com.atscv.servico;

import br.com.atscv.api.Dtos.Candidatura;
import br.com.atscv.api.Dtos.CandidaturaEntrada;
import br.com.atscv.api.Dtos.CandidaturaResumo;
import br.com.atscv.api.Dtos.EstadoDaVaga;
import br.com.atscv.api.Dtos.Pergunta;
import br.com.atscv.api.ErroApi;
import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.persistencia.CandidaturaRepositorio;
import br.com.atscv.persistencia.CandidaturaRepositorio.Linha;
import br.com.atscv.ranking.Tipos.RankingResult;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Candidaturas: o CV enviado, a vaga, as edições do usuário, a previsão da época e o resultado real. */
@Service
public class CandidaturaServico {

    public static final List<String> PLATAFORMAS = List.of("gupy", "linkedin", "workday", "inhire", "greenhouse", "outra");
    public static final List<String> RESULTADOS = List.of("passou_triagem", "reprovado", "sem_retorno");

    private static final Pattern MES = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");
    private static final Pattern DATA = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$");

    private final CandidaturaRepositorio repo;
    private final CvServico cvs;
    private final RankingServico ranking;
    private final JsonMapper json;
    private final Clock clock;

    public CandidaturaServico(CandidaturaRepositorio repo, CvServico cvs, RankingServico ranking, JsonMapper json, Clock clock) {
        this.repo = repo;
        this.cvs = cvs;
        this.ranking = ranking;
        this.json = json;
        this.clock = clock;
    }

    private static String vazioParaNulo(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    /** Valida os campos e monta a linha do banco, com a previsão calculada agora. */
    private Linha montar(CandidaturaEntrada e, String criadoEm) {
        if (e.vagaTexto() == null || e.vagaTexto().isBlank()) throw ErroApi.invalido("O texto da vaga está vazio.");
        String plataforma = vazioParaNulo(e.plataforma());
        if (plataforma != null) plataforma = plataforma.toLowerCase();
        if (plataforma != null && !PLATAFORMAS.contains(plataforma)) {
            throw ErroApi.invalido("Plataforma \"" + plataforma + "\" desconhecida; use " + String.join(", ", PLATAFORMAS) + ".");
        }
        String resultado = vazioParaNulo(e.resultado()) == null ? "sem_retorno" : e.resultado().strip();
        if (!RESULTADOS.contains(resultado)) {
            throw ErroApi.invalido("Resultado \"" + resultado + "\" inválido; use " + String.join(", ", RESULTADOS) + ".");
        }
        String mes = vazioParaNulo(e.mes());
        String data = vazioParaNulo(e.data());
        if (data != null && !DATA.matcher(data).matches()) throw ErroApi.invalido("A data deve ser AAAA-MM-DD.");
        if (mes != null && !MES.matcher(mes).matches()) throw ErroApi.invalido("O mês deve ser AAAA-MM.");
        if (data != null && mes != null && !data.startsWith(mes)) throw ErroApi.invalido("A data não bate com o mês.");
        if (mes == null && data != null) mes = data.substring(0, 7);
        if (e.diasAteResposta() != null && e.diasAteResposta() < 0) throw ErroApi.invalido("Os dias até a resposta não podem ser negativos.");

        Analysis analise = cvs.detalhe(e.cvId()).analise();
        EstadoDaVaga estado = e.estado() == null ? new EstadoDaVaga(null, null, null, null, null, null) : e.estado();
        if (estado.job() == null) {
            estado = new EstadoDaVaga(ranking.lerVaga(e.vagaTexto(), estado.extras()), estado.declarados(), estado.respostas(),
                    estado.extras(), estado.limiar(), estado.lente());
        }
        RankingResult snapshot = ranking.ranquear(analise, estado);
        String agora = Instant.now(clock).toString();
        List<Pergunta> perguntas = e.perguntas() == null ? List.of() : e.perguntas();
        return new Linha(null, e.cvId(), e.vagaTexto(), plataforma, vazioParaNulo(e.empresa()), vazioParaNulo(e.cargo()), mes,
                data, resultado, vazioParaNulo(e.etapa()), vazioParaNulo(e.observacoes()), e.diasAteResposta(),
                json.writeValueAsString(perguntas), json.writeValueAsString(estado), json.writeValueAsString(snapshot),
                snapshot.faixa().json(), snapshot.rotuloFaixa(), snapshot.numero(), Regras.VERSAO,
                criadoEm != null ? criadoEm : agora, agora, vazioParaNulo(e.origem()));
    }

    private Candidatura paraDto(Linha l) {
        return new Candidatura(l.id(), l.cvId(), l.vagaTexto(), l.plataforma(), l.empresa(), l.cargo(), l.mes(), l.data(),
                l.resultado(), l.etapa(), l.observacoes(), l.diasAteResposta(),
                json.readValue(l.perguntasJson(), new TypeReference<List<Pergunta>>() {}),
                json.readValue(l.estadoJson(), EstadoDaVaga.class),
                l.snapshotJson() == null ? null : json.readValue(l.snapshotJson(), RankingResult.class), l.versaoRegras(),
                l.criadoEm(), l.atualizadoEm(), l.origem());
    }

    public Candidatura criar(CandidaturaEntrada e) {
        Linha l = montar(e, null);
        return paraDto(l.comId(repo.inserir(l)));
    }

    public Candidatura obter(long id) {
        return paraDto(repo.porId(id).orElseThrow(() -> ErroApi.naoEncontrado("A candidatura", id)));
    }

    public Candidatura atualizar(long id, CandidaturaEntrada e) {
        Linha atual = repo.porId(id).orElseThrow(() -> ErroApi.naoEncontrado("A candidatura", id));
        Linha nova = montar(e, atual.criadoEm());
        repo.atualizar(id, nova);
        return obter(id);
    }

    public void excluir(long id) {
        if (repo.excluir(id) == 0) throw ErroApi.naoEncontrado("A candidatura", id);
    }

    public List<CandidaturaResumo> listar() {
        return repo.listar().stream().map(l -> new CandidaturaResumo(l.id(), l.cvId(), l.plataforma(), l.empresa(), l.cargo(),
                l.mes(), l.resultado(), l.etapa(), l.faixa(), l.rotuloFaixa(), l.numero(), l.criadoEm())).toList();
    }
}
