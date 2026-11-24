package br.com.atscv.api;

import br.com.atscv.formato.Modelos.Analysis;
import br.com.atscv.formato.Modelos.ExtractedDoc;
import br.com.atscv.ranking.Dicionario.SkillDef;
import br.com.atscv.ranking.Tipos.JobSpec;
import br.com.atscv.ranking.Tipos.LenteId;
import br.com.atscv.ranking.Tipos.Minusculo;
import br.com.atscv.ranking.Tipos.RankingResult;
import br.com.atscv.ranking.Tipos.ReqTipo;
import java.util.List;
import java.util.Map;

/** Corpos de pedido e de resposta da API. */
public final class Dtos {
    private Dtos() {}

    public record CvResumo(long id, String sha256, String nomeArquivo, int numPaginas, int formatScore, String criadoEm) {}

    /** O CV, o que se leu do PDF (trechos com posição, para a prévia) e a análise de formato. */
    public record CvDetalhe(CvResumo cv, ExtractedDoc doc, Analysis analise, boolean jaExistia) {}

    /** Tudo o que o usuário mexe numa vaga; vive só em memória até virar uma candidatura. */
    public record EstadoDaVaga(
            JobSpec job, Map<String, Boolean> declarados, Map<String, Boolean> respostas, List<SkillDef> extras, Double limiar,
            LenteId lente) {}

    public record PedidoLeitura(String texto, List<SkillDef> extras) {}

    public enum Acao implements Minusculo { ALTERAR_TIPO, REMOVER, ADICIONAR, PROMOVER }

    /** Uma edição da vaga: alterar o tipo de um requisito, remover, adicionar ou promover um termo a skill. */
    public record PedidoEdicao(JobSpec job, Acao acao, String id, ReqTipo tipo, String texto, String termo, List<SkillDef> extras) {}

    public record ResultadoEdicao(JobSpec job, SkillDef skill) {}

    public record PedidoTermos(long cvId, String texto, List<SkillDef> extras) {}

    public record PedidoRanking(
            long cvId, JobSpec job, Map<String, Boolean> declarados, Map<String, Boolean> respostas, List<SkillDef> extras,
            Double limiar, LenteId lente) {

        public EstadoDaVaga estado() {
            return new EstadoDaVaga(job, declarados, respostas, extras, limiar, lente);
        }
    }

    public record Pergunta(String pergunta, String resposta) {}

    public record CandidaturaEntrada(
            long cvId, String vagaTexto, String plataforma, String empresa, String cargo, String mes, String data,
            String resultado, String etapa, String observacoes, Integer diasAteResposta, List<Pergunta> perguntas,
            EstadoDaVaga estado, String origem) {}

    public record Candidatura(
            long id, long cvId, String vagaTexto, String plataforma, String empresa, String cargo, String mes, String data,
            String resultado, String etapa, String observacoes, Integer diasAteResposta, List<Pergunta> perguntas,
            EstadoDaVaga estado, RankingResult snapshot, String versaoRegras, String criadoEm, String atualizadoEm, String origem) {}

    public record CandidaturaResumo(
            long id, long cvId, String plataforma, String empresa, String cargo, String mes, String resultado, String etapa,
            String faixa, String rotuloFaixa, Integer numero, String criadoEm) {}
}
