-- Currículos enviados para análise: o PDF fica no próprio banco, identificado pelo hash (reenviar o mesmo arquivo
-- não duplica).
CREATE TABLE cv (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sha256        TEXT    NOT NULL UNIQUE,
    nome_arquivo  TEXT    NOT NULL,
    num_paginas   INTEGER NOT NULL,
    format_score  INTEGER NOT NULL,
    pdf           BLOB    NOT NULL,
    doc_json      TEXT    NOT NULL,
    analise_json  TEXT    NOT NULL,
    criado_em     TEXT    NOT NULL
);

-- Uma candidatura: o CV enviado, a vaga, o que o usuário editou, a previsão da época e o resultado real.
CREATE TABLE candidatura (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id              INTEGER NOT NULL REFERENCES cv (id),
    vaga_texto         TEXT    NOT NULL,
    plataforma         TEXT,
    empresa            TEXT,
    cargo              TEXT,
    mes                TEXT,
    data               TEXT,
    resultado          TEXT    NOT NULL DEFAULT 'sem_retorno',
    etapa              TEXT,
    observacoes        TEXT,
    dias_ate_resposta  INTEGER,
    perguntas_json     TEXT    NOT NULL DEFAULT '[]',
    estado_json        TEXT    NOT NULL DEFAULT '{}',
    snapshot_json      TEXT,
    faixa              TEXT,
    rotulo_faixa       TEXT,
    numero             INTEGER,
    versao_regras      TEXT,
    criado_em          TEXT    NOT NULL,
    atualizado_em      TEXT    NOT NULL
);

CREATE INDEX candidatura_cv ON candidatura (cv_id);
