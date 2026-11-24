package br.com.atscv.persistencia;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Candidaturas guardadas: o CV enviado, a vaga, o que o usuário editou, a previsão da época e o resultado real. */
@Repository
public class CandidaturaRepositorio {

    /** Os campos de uma candidatura, como estão no banco; os JSONs ainda em texto. */
    public record Linha(
            Long id, long cvId, String vagaTexto, String plataforma, String empresa, String cargo, String mes, String data,
            String resultado, String etapa, String observacoes, Integer diasAteResposta, String perguntasJson,
            String estadoJson, String snapshotJson, String faixa, String rotuloFaixa, Integer numero, String versaoRegras,
            String criadoEm, String atualizadoEm, String origem) {

        public Linha comId(long novo) {
            return new Linha(novo, cvId, vagaTexto, plataforma, empresa, cargo, mes, data, resultado, etapa, observacoes,
                    diasAteResposta, perguntasJson, estadoJson, snapshotJson, faixa, rotuloFaixa, numero, versaoRegras,
                    criadoEm, atualizadoEm, origem);
        }
    }

    private static final String COLUNAS = """
            id, cv_id, vaga_texto, plataforma, empresa, cargo, mes, data, resultado, etapa, observacoes, dias_ate_resposta,
            perguntas_json, estado_json, snapshot_json, faixa, rotulo_faixa, numero, versao_regras, criado_em, atualizado_em, origem""";

    private final JdbcClient jdbc;

    public CandidaturaRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static Linha linha(java.sql.ResultSet rs) throws java.sql.SQLException {
        int dias = rs.getInt("dias_ate_resposta");
        Integer diasAte = rs.wasNull() ? null : dias;
        int numero = rs.getInt("numero");
        Integer num = rs.wasNull() ? null : numero;
        return new Linha(rs.getLong("id"), rs.getLong("cv_id"), rs.getString("vaga_texto"), rs.getString("plataforma"),
                rs.getString("empresa"), rs.getString("cargo"), rs.getString("mes"), rs.getString("data"),
                rs.getString("resultado"), rs.getString("etapa"), rs.getString("observacoes"), diasAte,
                rs.getString("perguntas_json"), rs.getString("estado_json"), rs.getString("snapshot_json"),
                rs.getString("faixa"), rs.getString("rotulo_faixa"), num, rs.getString("versao_regras"),
                rs.getString("criado_em"), rs.getString("atualizado_em"), rs.getString("origem"));
    }

    public List<Linha> listar() {
        return jdbc.sql("SELECT " + COLUNAS + " FROM candidatura ORDER BY mes DESC, id DESC").query((rs, i) -> linha(rs)).list();
    }

    public Optional<Linha> porId(long id) {
        return jdbc.sql("SELECT " + COLUNAS + " FROM candidatura WHERE id = :id").param("id", id)
                .query((rs, i) -> linha(rs)).optional();
    }

    public long inserir(Linha l) {
        return jdbc.sql("""
                INSERT INTO candidatura (cv_id, vaga_texto, plataforma, empresa, cargo, mes, data, resultado, etapa,
                    observacoes, dias_ate_resposta, perguntas_json, estado_json, snapshot_json, faixa, rotulo_faixa, numero,
                    versao_regras, criado_em, atualizado_em, origem)
                VALUES (:cv, :vaga, :plataforma, :empresa, :cargo, :mes, :data, :resultado, :etapa, :obs, :dias, :perguntas,
                    :estado, :snapshot, :faixa, :rotulo, :numero, :versao, :criado, :atualizado, :origem) RETURNING id""")
                .param("cv", l.cvId()).param("vaga", l.vagaTexto()).param("plataforma", l.plataforma())
                .param("empresa", l.empresa()).param("cargo", l.cargo()).param("mes", l.mes()).param("data", l.data())
                .param("resultado", l.resultado()).param("etapa", l.etapa()).param("obs", l.observacoes())
                .param("dias", l.diasAteResposta()).param("perguntas", l.perguntasJson()).param("estado", l.estadoJson())
                .param("snapshot", l.snapshotJson()).param("faixa", l.faixa()).param("rotulo", l.rotuloFaixa())
                .param("numero", l.numero()).param("versao", l.versaoRegras()).param("criado", l.criadoEm())
                .param("atualizado", l.atualizadoEm()).param("origem", l.origem()).query(Long.class).single();
    }

    /** Atualiza tudo menos a data de criação. Devolve quantas linhas mudaram. */
    public int atualizar(long id, Linha l) {
        return jdbc.sql("""
                UPDATE candidatura SET cv_id = :cv, vaga_texto = :vaga, plataforma = :plataforma, empresa = :empresa,
                    cargo = :cargo, mes = :mes, data = :data, resultado = :resultado, etapa = :etapa, observacoes = :obs,
                    dias_ate_resposta = :dias, perguntas_json = :perguntas, estado_json = :estado, snapshot_json = :snapshot,
                    faixa = :faixa, rotulo_faixa = :rotulo, numero = :numero, versao_regras = :versao,
                    atualizado_em = :atualizado
                WHERE id = :id""")
                .param("id", id).param("cv", l.cvId()).param("vaga", l.vagaTexto()).param("plataforma", l.plataforma())
                .param("empresa", l.empresa()).param("cargo", l.cargo()).param("mes", l.mes()).param("data", l.data())
                .param("resultado", l.resultado()).param("etapa", l.etapa()).param("obs", l.observacoes())
                .param("dias", l.diasAteResposta()).param("perguntas", l.perguntasJson()).param("estado", l.estadoJson())
                .param("snapshot", l.snapshotJson()).param("faixa", l.faixa()).param("rotulo", l.rotuloFaixa())
                .param("numero", l.numero()).param("versao", l.versaoRegras()).param("atualizado", l.atualizadoEm()).update();
    }

    public Optional<Linha> porOrigem(String origem) {
        return jdbc.sql("SELECT " + COLUNAS + " FROM candidatura WHERE origem = :o").param("o", origem)
                .query((rs, i) -> linha(rs)).optional();
    }

    public int excluir(long id) {
        return jdbc.sql("DELETE FROM candidatura WHERE id = :id").param("id", id).update();
    }
}
