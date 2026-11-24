package br.com.atscv.persistencia;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Currículos guardados: o PDF e o que se leu dele, identificados pelo hash do arquivo. */
@Repository
public class CvRepositorio {

    /** Um CV sem o PDF nem os JSONs (para listas). */
    public record Resumo(long id, String sha256, String nomeArquivo, int numPaginas, int formatScore, String criadoEm) {}

    /** Um CV completo, sem o PDF (que sai à parte). */
    public record Registro(Resumo resumo, String docJson, String analiseJson) {}

    private final JdbcClient jdbc;

    public CvRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static Resumo resumo(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Resumo(rs.getLong("id"), rs.getString("sha256"), rs.getString("nome_arquivo"), rs.getInt("num_paginas"),
                rs.getInt("format_score"), rs.getString("criado_em"));
    }

    public Optional<Registro> porHash(String sha256) {
        return jdbc.sql("SELECT id, sha256, nome_arquivo, num_paginas, format_score, criado_em, doc_json, analise_json FROM cv WHERE sha256 = :h")
                .param("h", sha256)
                .query((rs, i) -> new Registro(resumo(rs), rs.getString("doc_json"), rs.getString("analise_json"))).optional();
    }

    public Optional<Registro> porId(long id) {
        return jdbc.sql("SELECT id, sha256, nome_arquivo, num_paginas, format_score, criado_em, doc_json, analise_json FROM cv WHERE id = :id")
                .param("id", id)
                .query((rs, i) -> new Registro(resumo(rs), rs.getString("doc_json"), rs.getString("analise_json"))).optional();
    }

    public Optional<byte[]> pdf(long id) {
        return jdbc.sql("SELECT pdf FROM cv WHERE id = :id").param("id", id).query((rs, i) -> rs.getBytes("pdf")).optional();
    }

    public List<Resumo> listar() {
        return jdbc.sql("SELECT id, sha256, nome_arquivo, num_paginas, format_score, criado_em FROM cv ORDER BY id DESC")
                .query((rs, i) -> resumo(rs)).list();
    }

    public long inserir(String sha256, String nomeArquivo, int numPaginas, int formatScore, byte[] pdf, String docJson,
            String analiseJson, String criadoEm) {
        return jdbc.sql("""
                INSERT INTO cv (sha256, nome_arquivo, num_paginas, format_score, pdf, doc_json, analise_json, criado_em)
                VALUES (:sha, :nome, :paginas, :nota, :pdf, :doc, :analise, :criado) RETURNING id""")
                .param("sha", sha256).param("nome", nomeArquivo).param("paginas", numPaginas).param("nota", formatScore)
                .param("pdf", pdf).param("doc", docJson).param("analise", analiseJson).param("criado", criadoEm)
                .query(Long.class).single();
    }

    public int excluir(long id) {
        return jdbc.sql("DELETE FROM cv WHERE id = :id").param("id", id).update();
    }

    public int candidaturasDo(long id) {
        return jdbc.sql("SELECT COUNT(*) FROM candidatura WHERE cv_id = :id").param("id", id).query(Integer.class).single();
    }
}
