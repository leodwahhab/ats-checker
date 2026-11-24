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
}
