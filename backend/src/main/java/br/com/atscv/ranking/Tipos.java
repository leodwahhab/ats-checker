package br.com.atscv.ranking;

import br.com.atscv.ranking.LocalParser.Local;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.List;
import java.util.Locale;

/** Tipos do ranqueamento. O JSON é o mesmo do front original (enums em minúsculas, componentes com "tipo"). */
public final class Tipos {
    private Tipos() {}

    /** Um enum cujo valor no JSON é o nome em minúsculas ("nao_atende"). */
    public interface Minusculo {
        String name();

        @JsonValue
        default String json() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    /** Informativo: tecnologia citada nas atividades da vaga; aparece, mas não entra na faixa. */
    public enum ReqTipo implements Minusculo { OBRIGATORIO, DESEJAVEL, INFORMATIVO }

    /** De onde veio a classificação obrigatório/desejável. */
    public enum ReqTipoFonte implements Minusculo { MARCADOR, SECAO, HEURISTICA, PADRAO, USUARIO }

    /** Em que parte da vaga a linha estava. */
    public enum ReqOrigem implements Minusculo { REQUISITOS, DIFERENCIAIS, ATIVIDADES, SEM_SECAO, USUARIO }

    public enum NivelFormacao implements Minusculo { MEDIO, TECNICO, GRADUACAO, POS, MESTRADO, DOUTORADO }

    public enum NivelIdioma implements Minusculo { BASICO, INTERMEDIARIO, AVANCADO, FLUENTE, NATIVO }

    public enum Senioridade implements Minusculo { ESTAGIO, JUNIOR, PLENO, SENIOR, ESPECIALISTA }

    public enum Modelo implements Minusculo { REMOTO, HIBRIDO, PRESENCIAL }

    public enum IdiomaTexto implements Minusculo { PT, EN }

    public enum EliminatoriaTipo implements Minusculo { LOCAL, IDIOMA, FORMACAO, CERTIFICACAO, DISPONIBILIDADE, DOCUMENTO }

    public enum ModoSkill implements Minusculo { TODAS, ALGUMA }

    public enum AreaFormacao implements Minusculo { TI, QUALQUER }

    /** Título de seção da vaga; "stack" é a lista de tecnologias. */
    public enum TipoSecao { OBRIGATORIO, DESEJAVEL, CONTEXTO, STACK, IGNORADA }

    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "tipo")
    @JsonSubTypes({
        @JsonSubTypes.Type(value = CompSkill.class, name = "skill"),
        @JsonSubTypes.Type(value = CompAnos.class, name = "anos"),
        @JsonSubTypes.Type(value = CompFormacao.class, name = "formacao"),
        @JsonSubTypes.Type(value = CompIdioma.class, name = "idioma"),
        @JsonSubTypes.Type(value = CompCargo.class, name = "cargo"),
        @JsonSubTypes.Type(value = CompNaoReconhecido.class, name = "nao_reconhecido"),
    })
    public sealed interface Component
            permits CompSkill, CompAnos, CompFormacao, CompIdioma, CompCargo, CompNaoReconhecido {}

    public record CompSkill(List<String> ids, ModoSkill modo) implements Component {}

    public record CompAnos(int minimo, List<String> skillIds, String familia) implements Component {}

    public record CompFormacao(NivelFormacao nivelMinimo, AreaFormacao area, boolean aceitaCursando)
            implements Component {}

    public record CompIdioma(String idioma, NivelIdioma nivelMinimo) implements Component {}

    public record CompCargo(String familia) implements Component {}

    public record CompNaoReconhecido(List<String> termos) implements Component {}

    public record Requirement(
            String id, String texto, ReqTipo tipo, ReqTipoFonte tipoFonte, ReqOrigem origem,
            List<Component> componentes) {}

    /** Trecho da vaga que costuma virar pergunta de triagem. */
    public record Eliminatoria(String id, EliminatoriaTipo tipo, String rotulo, String trecho, String requisitoId) {}

    public record JobSpec(
            String titulo, String familia, Senioridade senioridade, boolean temSecoes, List<Requirement> requisitos,
            List<String> naoAvaliaveis, List<String> termosNaoReconhecidos, Modelo modelo, Local local,
            List<Eliminatoria> eliminatorias, String afirmativa, IdiomaTexto idioma, String pais) {}

    // ---------- Perfil do CV ----------

    public enum FonteEvidencia implements Minusculo {
        HABILIDADES, EXPERIENCIA, RESUMO, CABECALHO, CERTIFICACOES, PROJETOS, FORMACAO, IDIOMAS, DECLARADO
    }

    /**
     * Trecho do CV que comprova algo.
     *
     * @param explicita na seção Habilidades (explícita) ou em outro lugar do CV (implícita)
     * @param entrada índice da experiência, quando a fonte é uma experiência
     */
    public record Evidence(FonteEvidencia fonte, String rotulo, String trecho, boolean explicita, Integer entrada) {}

    /** Período em meses, com início e fim inclusivos: ago/2024–jul/2026 tem 24 meses. */
    public record IntervaloMeses(int inicio, int fim) {}

    public record Lacuna(int inicio, int fim, int meses, boolean ateHoje) {}

    public record ExperienciaPerfil(
            int indice, String rotulo, String cargo, IntervaloMeses intervalo, boolean atual, boolean estagio,
            String familia, Senioridade senioridade) {}

    public enum SituacaoFormacao implements Minusculo { CONCLUIDO, CURSANDO, INCOMPLETO, DESCONHECIDA }

    public record FormacaoPerfil(
            NivelFormacao nivel, String curso, boolean areaTi, SituacaoFormacao situacao, boolean inferida,
            String descricao) {}

    public enum FonteIdioma { IDIOMAS, RESUMO }

    public record IdiomaPerfil(String idioma, NivelIdioma nivel, FonteIdioma fonte, String trecho) {}

    public enum FonteSenioridade { CARGO, CABECALHO, ANOS }

    /** Família e senioridade de agora. */
    public record Atual(ExperienciaPerfil experiencia, String familia, Senioridade senioridade, FonteSenioridade fonteSenioridade) {}

    public record CvProfile(
            java.util.Map<String, List<Evidence>> skills, int habilidadesExplicitas, List<ExperienciaPerfil> experiencias,
            int mesesTotais, int mesesEstagio, List<Lacuna> lacunas, List<FormacaoPerfil> formacao,
            List<IdiomaPerfil> idiomas, Atual atual, Local local, IdiomaTexto idioma) {}

    // ---------- Resultado ----------

    public enum ReqStatus implements Minusculo { ATENDE, PARCIAL, NAO_ATENDE, NAO_VERIFICAVEL }

    public record ComponentResult(ReqStatus status, String motivo, List<Evidence> evidencias) {}

    public record RequirementResult(
            Requirement requisito, ReqStatus status, String motivo, List<ComponentResult> componentes,
            List<Evidence> evidencias, boolean declarado) {}

    public enum FaixaId implements Minusculo { TOP, MAYBE, NOT }

    public enum DimensaoId implements Minusculo { CARGO, SENIORIDADE, LOCAL }

    public record Dimensao(DimensaoId id, String rotulo, int peso, ReqStatus status, String motivo) {}

    public record EliminatoriaResult(
            String id, EliminatoriaTipo tipo, String rotulo, String trecho, String requisitoId, Boolean resposta,
            String noCv) {}

    public enum AvisoTipo implements Minusculo {
        SO_IMPLICITA, SO_CERTIFICACOES, HABILIDADES_DEMAIS, IDIOMA_CV, LACUNA, SEM_EXPERIENCIA
    }

    public record Aviso(AvisoTipo tipo, String texto) {}

    /** Cobertura de 0 a 1; null quando não há requisitos daquele tipo. */
    public record Cobertura(
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
            Double obrigatorios,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
            Double desejaveis) {}

    public record ExperienciaLida(int mesesTotais, int mesesEstagio, int comData, int semData) {}

    // ---------- Lentes ----------

    public enum LenteId implements Minusculo { NUCLEO, GUPY, LINKEDIN, WORKDAY }

    /** Cor do resultado; "neutro" quando não há nota. */
    public enum Tom implements Minusculo { TOP, MAYBE, NOT, NEUTRO }

    public enum NotaWorkday { A, B, C, D }

    /** Página oficial em que uma regra se baseia. */
    public record FonteDoc(String rotulo, String url) {}

    /** Uma frase e a página oficial que a sustenta. */
    public record ComFonte(String texto, FonteDoc fonte) {}

    public record Alerta(String texto, FonteDoc fonte) {}

    public record LensConfig(
            LenteId id, String nome, String descricao, List<FonteEvidencia> fontes, java.util.Map<String, String> rotulos,
            List<ComFonte> aproximacoes, List<ComFonte> notas, List<FonteDoc> documentacao) {}

    public record ResultadoLente(
            LenteId id, String nome, String descricao, String rotulo, Tom tom, NotaWorkday nota, String indicador,
            List<FonteEvidencia> fontes, List<Alerta> alertas, List<ComFonte> notas, List<ComFonte> aproximacoes,
            List<FonteDoc> documentacao) {}

    public record RankingResult(
            FaixaId faixa, String rotuloFaixa, int numero, String resumo, List<String> comoMelhorar,
            List<RequirementResult> requisitos, Cobertura cobertura, boolean vazio, boolean classificacaoAutomatica,
            List<Dimensao> dimensoes, List<EliminatoriaResult> eliminatorias, List<Aviso> avisos,
            ExperienciaLida experiencia, ResultadoLente lente) {}

    /** O que a leitura do PDF diz sobre o arquivo. */
    public record Arquivo(boolean semTexto, boolean exportLinkedin) {}

    public record RankOptions(
            double limiarDesejaveis, java.util.Map<String, Boolean> declarados, List<Dicionario.SkillDef> skillsExtras,
            java.util.Map<String, Boolean> respostas, java.time.LocalDate hoje, LenteId lente, Arquivo arquivo) {}
}
