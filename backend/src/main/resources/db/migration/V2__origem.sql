-- Pasta de onde a candidatura foi importada (fixtures/candidaturas/AAAA-MM-plataforma-empresa-cargo): importar de novo não duplica.
ALTER TABLE candidatura ADD COLUMN origem TEXT;
CREATE UNIQUE INDEX candidatura_origem ON candidatura (origem) WHERE origem IS NOT NULL;
