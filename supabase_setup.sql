-- =====================================================
-- Scopus Base Manager - Supabase/Postgres setup
-- =====================================================
-- This script creates the complete database structure used by the app:
-- extensions, tables, indexes, search trigger, consolidated view, RLS
-- policies, staging table and optional bulk-processing RPC.
--
-- It intentionally does not truncate data. For a clean reinstall, clear the
-- tables manually in Supabase before importing again.

-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =====================================================
-- MAIN TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS autor (
  id BIGINT PRIMARY KEY,
  nome TEXT NOT NULL,
  nome_completo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artigo (
  id BIGSERIAL PRIMARY KEY,
  scopus_id BIGINT UNIQUE,
  titulo TEXT NOT NULL,
  resumo TEXT,
  ano INTEGER NOT NULL,
  source_title TEXT,
  source TEXT,
  cited_by INTEGER NOT NULL DEFAULT 0,
  doi TEXT,
  doi_normalizado TEXT GENERATED ALWAYS AS (lower(trim(doi))) STORED,
  link TEXT,
  issn VARCHAR(9),
  isbn VARCHAR(17),
  coden VARCHAR(20),
  linguagem VARCHAR(20),
  document_type VARCHAR(50),
  search_vector tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ano CHECK (ano >= 1800 AND ano <= EXTRACT(YEAR FROM NOW()) + 1),
  CONSTRAINT chk_cited_by CHECK (cited_by >= 0)
);

CREATE TABLE IF NOT EXISTS palavra_chave (
  id BIGSERIAL PRIMARY KEY,
  palavra TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_palavra_tipo CHECK (tipo IN ('author', 'index'))
);

CREATE TABLE IF NOT EXISTS referencia (
  id BIGSERIAL PRIMARY KEY,
  raw_reference TEXT NOT NULL,
  titulo TEXT,
  ano INTEGER,
  doi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS open_access_tipo (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);

-- =====================================================
-- RELATIONSHIP TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS artigo_autor (
  artigo_id BIGINT NOT NULL REFERENCES artigo(id) ON DELETE CASCADE,
  autor_id BIGINT NOT NULL REFERENCES autor(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artigo_id, autor_id)
);

CREATE TABLE IF NOT EXISTS artigo_palavra_chave (
  artigo_id BIGINT NOT NULL REFERENCES artigo(id) ON DELETE CASCADE,
  palavra_chave_id BIGINT NOT NULL REFERENCES palavra_chave(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artigo_id, palavra_chave_id)
);

CREATE TABLE IF NOT EXISTS artigo_referencia (
  artigo_id BIGINT NOT NULL REFERENCES artigo(id) ON DELETE CASCADE,
  referencia_id BIGINT NOT NULL REFERENCES referencia(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artigo_id, referencia_id)
);

CREATE TABLE IF NOT EXISTS artigo_open_access (
  artigo_id BIGINT NOT NULL REFERENCES artigo(id) ON DELETE CASCADE,
  open_access_tipo_id BIGINT NOT NULL REFERENCES open_access_tipo(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artigo_id, open_access_tipo_id)
);

-- =====================================================
-- STAGING TABLE FOR OPTIONAL BULK IMPORTS
-- =====================================================

CREATE TABLE IF NOT EXISTS staging_import (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- UNIQUE INDEXES
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_artigo_doi_normalizado
ON artigo (doi_normalizado)
WHERE doi_normalizado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_palavra_tipo
ON palavra_chave (lower(palavra), tipo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referencia_raw_reference
ON referencia (raw_reference);

-- =====================================================
-- SEARCH INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_artigo_search_vector
ON artigo
USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_artigo_titulo_trgm
ON artigo
USING GIN (titulo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_autor_nome_trgm
ON autor
USING GIN (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_autor_nome_completo_trgm
ON autor
USING GIN (nome_completo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_referencia_raw_trgm
ON referencia
USING GIN(raw_reference gin_trgm_ops);

-- =====================================================
-- CLASSIC AND RELATIONAL INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_artigo_ano ON artigo(ano);
CREATE INDEX IF NOT EXISTS idx_artigo_cited_by ON artigo(cited_by DESC);
CREATE INDEX IF NOT EXISTS idx_artigo_scopus_id ON artigo(scopus_id);
CREATE INDEX IF NOT EXISTS idx_artigo_source_title ON artigo(source_title);
CREATE INDEX IF NOT EXISTS idx_artigo_document_type ON artigo(document_type);
CREATE INDEX IF NOT EXISTS idx_artigo_linguagem ON artigo(linguagem);
CREATE INDEX IF NOT EXISTS idx_artigo_issn ON artigo(issn);
CREATE INDEX IF NOT EXISTS idx_artigo_doi ON artigo(doi_normalizado);

CREATE INDEX IF NOT EXISTS idx_artigo_autor_autor ON artigo_autor(autor_id);
CREATE INDEX IF NOT EXISTS idx_artigo_palavra_palavra ON artigo_palavra_chave(palavra_chave_id);
CREATE INDEX IF NOT EXISTS idx_artigo_referencia_referencia ON artigo_referencia(referencia_id);
CREATE INDEX IF NOT EXISTS idx_artigo_oa_tipo ON artigo_open_access(open_access_tipo_id);

CREATE INDEX IF NOT EXISTS idx_referencia_doi ON referencia(doi);
CREATE INDEX IF NOT EXISTS idx_referencia_ano ON referencia(ano);
CREATE INDEX IF NOT EXISTS idx_staging_session ON staging_import(session_id);

-- =====================================================
-- SEARCH VECTOR TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION artigo_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector(
      'english',
      coalesce(NEW.titulo, '') || ' ' || coalesce(NEW.resumo, '')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artigo_search_vector ON artigo;

CREATE TRIGGER trg_artigo_search_vector
BEFORE INSERT OR UPDATE
ON artigo
FOR EACH ROW
EXECUTE FUNCTION artigo_search_vector_update();

-- Backfill existing rows after installing the trigger.
UPDATE artigo
SET search_vector = to_tsvector('english', coalesce(titulo, '') || ' ' || coalesce(resumo, ''))
WHERE search_vector IS NULL;

-- =====================================================
-- CONSOLIDATED READ VIEW
-- =====================================================

CREATE OR REPLACE VIEW vw_artigos_completos AS
SELECT
  a.id,
  a.scopus_id,
  a.titulo,
  a.resumo,
  a.ano,
  a.source_title,
  a.source,
  a.cited_by,
  a.doi,
  a.link,
  a.issn,
  a.isbn,
  a.coden,
  a.linguagem,
  a.document_type,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT au.nome), NULL) AS autores,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT pc.palavra), NULL) AS palavras_chave,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT oat.nome), NULL) AS open_access_tipos
FROM artigo a
LEFT JOIN artigo_autor aa ON aa.artigo_id = a.id
LEFT JOIN autor au ON au.id = aa.autor_id
LEFT JOIN artigo_palavra_chave apc ON apc.artigo_id = a.id
LEFT JOIN palavra_chave pc ON pc.id = apc.palavra_chave_id
LEFT JOIN artigo_open_access aoa ON aoa.artigo_id = a.id
LEFT JOIN open_access_tipo oat ON oat.id = aoa.open_access_tipo_id
GROUP BY a.id;

-- =====================================================
-- OPTIONAL STAGING/BULK PROCESSING RPC
-- =====================================================
-- The current UI parses and normalizes CSV data in the browser, then writes
-- directly through Supabase JS. This RPC is kept for larger server-side or
-- staging-based imports.

CREATE OR REPLACE FUNCTION process_staging_data(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  SELECT payload INTO v_payload
  FROM staging_import
  WHERE session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payload IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO artigo (
    scopus_id,
    titulo,
    resumo,
    ano,
    source_title,
    source,
    cited_by,
    doi,
    link,
    issn,
    isbn,
    coden,
    linguagem,
    document_type
  )
  SELECT DISTINCT ON (scopus_id)
    scopus_id,
    titulo,
    resumo,
    ano,
    source_title,
    source,
    cited_by,
    doi,
    link,
    issn,
    isbn,
    coden,
    linguagem,
    document_type
  FROM jsonb_to_recordset(coalesce(v_payload->'artigo', '[]'::jsonb)) AS x(
    scopus_id BIGINT,
    titulo TEXT,
    resumo TEXT,
    ano INT,
    source_title TEXT,
    source TEXT,
    cited_by INT,
    doi TEXT,
    link TEXT,
    issn TEXT,
    isbn TEXT,
    coden TEXT,
    linguagem TEXT,
    document_type TEXT
  )
  WHERE scopus_id IS NOT NULL AND titulo IS NOT NULL AND ano IS NOT NULL
  ORDER BY scopus_id, cited_by DESC NULLS LAST
  ON CONFLICT (scopus_id) DO UPDATE
  SET
    titulo = EXCLUDED.titulo,
    resumo = COALESCE(EXCLUDED.resumo, artigo.resumo),
    ano = EXCLUDED.ano,
    source_title = COALESCE(EXCLUDED.source_title, artigo.source_title),
    source = COALESCE(EXCLUDED.source, artigo.source),
    cited_by = GREATEST(EXCLUDED.cited_by, artigo.cited_by),
    doi = COALESCE(EXCLUDED.doi, artigo.doi),
    link = COALESCE(EXCLUDED.link, artigo.link),
    issn = COALESCE(EXCLUDED.issn, artigo.issn),
    isbn = COALESCE(EXCLUDED.isbn, artigo.isbn),
    coden = COALESCE(EXCLUDED.coden, artigo.coden),
    linguagem = COALESCE(EXCLUDED.linguagem, artigo.linguagem),
    document_type = COALESCE(EXCLUDED.document_type, artigo.document_type);

  INSERT INTO autor (id, nome, nome_completo)
  SELECT DISTINCT id, nome, nome_completo
  FROM jsonb_to_recordset(coalesce(v_payload->'autor', '[]'::jsonb)) AS x(
    id BIGINT,
    nome TEXT,
    nome_completo TEXT
  )
  WHERE id IS NOT NULL AND nome IS NOT NULL
  ON CONFLICT (id) DO NOTHING;

  CREATE TEMP TABLE tmp_keywords (
    temp_id INT,
    palavra TEXT,
    tipo TEXT,
    real_id BIGINT
  ) ON COMMIT DROP;

  INSERT INTO tmp_keywords (temp_id, palavra, tipo)
  SELECT temp_id, palavra, tipo
  FROM jsonb_to_recordset(coalesce(v_payload->'palavra_chave', '[]'::jsonb)) AS x(
    temp_id INT,
    palavra TEXT,
    tipo TEXT
  )
  WHERE palavra IS NOT NULL AND tipo IN ('author', 'index');

  CREATE INDEX idx_tmp_kw_temp_id ON tmp_keywords(temp_id);
  CREATE INDEX idx_tmp_kw_palavra ON tmp_keywords(lower(palavra), tipo);
  ANALYZE tmp_keywords;

  INSERT INTO palavra_chave (palavra, tipo)
  SELECT DISTINCT palavra, tipo
  FROM tmp_keywords
  ON CONFLICT (lower(palavra), tipo) DO NOTHING;

  UPDATE tmp_keywords t
  SET real_id = p.id
  FROM palavra_chave p
  WHERE lower(t.palavra) = lower(p.palavra)
    AND t.tipo = p.tipo;

  CREATE TEMP TABLE tmp_refs (
    temp_id INT,
    raw_reference TEXT,
    titulo TEXT,
    ano INT,
    doi TEXT,
    real_id BIGINT
  ) ON COMMIT DROP;

  INSERT INTO tmp_refs (temp_id, raw_reference, titulo, ano, doi)
  SELECT temp_id, raw_reference, titulo, ano, doi
  FROM jsonb_to_recordset(coalesce(v_payload->'referencia', '[]'::jsonb)) AS x(
    temp_id INT,
    raw_reference TEXT,
    titulo TEXT,
    ano INT,
    doi TEXT
  )
  WHERE raw_reference IS NOT NULL AND btrim(raw_reference) <> '';

  CREATE INDEX idx_tmp_refs_temp_id ON tmp_refs(temp_id);
  CREATE INDEX idx_tmp_refs_raw ON tmp_refs(raw_reference);
  ANALYZE tmp_refs;

  INSERT INTO referencia (raw_reference, titulo, ano, doi)
  SELECT DISTINCT ON (raw_reference)
    raw_reference,
    titulo,
    ano,
    doi
  FROM tmp_refs
  ORDER BY raw_reference, (titulo IS NOT NULL) DESC, (ano IS NOT NULL) DESC, (doi IS NOT NULL) DESC
  ON CONFLICT (raw_reference) DO UPDATE
  SET
    titulo = COALESCE(EXCLUDED.titulo, referencia.titulo),
    ano = COALESCE(EXCLUDED.ano, referencia.ano),
    doi = COALESCE(EXCLUDED.doi, referencia.doi);

  UPDATE tmp_refs t
  SET real_id = r.id
  FROM referencia r
  WHERE t.raw_reference = r.raw_reference;

  CREATE TEMP TABLE tmp_open_access (
    temp_id INT,
    nome TEXT,
    real_id BIGINT
  ) ON COMMIT DROP;

  INSERT INTO tmp_open_access (temp_id, nome)
  SELECT temp_id, nome
  FROM jsonb_to_recordset(coalesce(v_payload->'open_access_tipo', '[]'::jsonb)) AS x(
    temp_id INT,
    nome TEXT
  )
  WHERE nome IS NOT NULL AND btrim(nome) <> '';

  CREATE INDEX idx_tmp_oa_temp_id ON tmp_open_access(temp_id);
  CREATE INDEX idx_tmp_oa_nome ON tmp_open_access(nome);
  ANALYZE tmp_open_access;

  INSERT INTO open_access_tipo (nome)
  SELECT DISTINCT nome
  FROM tmp_open_access
  ON CONFLICT (nome) DO NOTHING;

  UPDATE tmp_open_access t
  SET real_id = oat.id
  FROM open_access_tipo oat
  WHERE t.nome = oat.nome;

  INSERT INTO artigo_autor (artigo_id, autor_id)
  SELECT DISTINCT a.id, x.autor_id
  FROM jsonb_to_recordset(coalesce(v_payload->'artigo_autor', '[]'::jsonb)) AS x(
    temp_scopus_id BIGINT,
    autor_id BIGINT
  )
  JOIN artigo a ON a.scopus_id = x.temp_scopus_id
  WHERE x.autor_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO artigo_palavra_chave (artigo_id, palavra_chave_id)
  SELECT DISTINCT a.id, tk.real_id
  FROM jsonb_to_recordset(coalesce(v_payload->'artigo_palavra_chave', '[]'::jsonb)) AS x(
    temp_scopus_id BIGINT,
    temp_kw_id INT
  )
  JOIN artigo a ON a.scopus_id = x.temp_scopus_id
  JOIN tmp_keywords tk ON tk.temp_id = x.temp_kw_id
  WHERE tk.real_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO artigo_referencia (artigo_id, referencia_id)
  SELECT DISTINCT a.id, tr.real_id
  FROM jsonb_to_recordset(coalesce(v_payload->'artigo_referencia', '[]'::jsonb)) AS x(
    temp_scopus_id BIGINT,
    temp_ref_id INT
  )
  JOIN artigo a ON a.scopus_id = x.temp_scopus_id
  JOIN tmp_refs tr ON tr.temp_id = x.temp_ref_id
  WHERE tr.real_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO artigo_open_access (artigo_id, open_access_tipo_id)
  SELECT DISTINCT a.id, toa.real_id
  FROM jsonb_to_recordset(coalesce(v_payload->'artigo_open_access', '[]'::jsonb)) AS x(
    temp_scopus_id BIGINT,
    temp_oa_id INT
  )
  JOIN artigo a ON a.scopus_id = x.temp_scopus_id
  JOIN tmp_open_access toa ON toa.temp_id = x.temp_oa_id
  WHERE toa.real_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  DELETE FROM staging_import WHERE session_id = p_session_id;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY AND PUBLIC DEMO POLICIES
-- =====================================================
-- These policies make the demo app easy to run with a public Supabase key.
-- Review them before using this project with private or multi-user data.

ALTER TABLE autor ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo ENABLE ROW LEVEL SECURITY;
ALTER TABLE palavra_chave ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_access_tipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo_autor ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo_palavra_chave ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo_referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo_open_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read autor" ON autor;
CREATE POLICY "Public read autor" ON autor FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert autor" ON autor;
CREATE POLICY "Public insert autor" ON autor FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update autor" ON autor;
CREATE POLICY "Public update autor" ON autor FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete autor" ON autor;
CREATE POLICY "Public delete autor" ON autor FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read artigo" ON artigo;
CREATE POLICY "Public read artigo" ON artigo FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert artigo" ON artigo;
CREATE POLICY "Public insert artigo" ON artigo FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update artigo" ON artigo;
CREATE POLICY "Public update artigo" ON artigo FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete artigo" ON artigo;
CREATE POLICY "Public delete artigo" ON artigo FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read palavra_chave" ON palavra_chave;
CREATE POLICY "Public read palavra_chave" ON palavra_chave FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert palavra_chave" ON palavra_chave;
CREATE POLICY "Public insert palavra_chave" ON palavra_chave FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update palavra_chave" ON palavra_chave;
CREATE POLICY "Public update palavra_chave" ON palavra_chave FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete palavra_chave" ON palavra_chave;
CREATE POLICY "Public delete palavra_chave" ON palavra_chave FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read referencia" ON referencia;
CREATE POLICY "Public read referencia" ON referencia FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert referencia" ON referencia;
CREATE POLICY "Public insert referencia" ON referencia FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update referencia" ON referencia;
CREATE POLICY "Public update referencia" ON referencia FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete referencia" ON referencia;
CREATE POLICY "Public delete referencia" ON referencia FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read open_access_tipo" ON open_access_tipo;
CREATE POLICY "Public read open_access_tipo" ON open_access_tipo FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert open_access_tipo" ON open_access_tipo;
CREATE POLICY "Public insert open_access_tipo" ON open_access_tipo FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update open_access_tipo" ON open_access_tipo;
CREATE POLICY "Public update open_access_tipo" ON open_access_tipo FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete open_access_tipo" ON open_access_tipo;
CREATE POLICY "Public delete open_access_tipo" ON open_access_tipo FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read artigo_autor" ON artigo_autor;
CREATE POLICY "Public read artigo_autor" ON artigo_autor FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert artigo_autor" ON artigo_autor;
CREATE POLICY "Public insert artigo_autor" ON artigo_autor FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update artigo_autor" ON artigo_autor;
CREATE POLICY "Public update artigo_autor" ON artigo_autor FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete artigo_autor" ON artigo_autor;
CREATE POLICY "Public delete artigo_autor" ON artigo_autor FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read artigo_palavra_chave" ON artigo_palavra_chave;
CREATE POLICY "Public read artigo_palavra_chave" ON artigo_palavra_chave FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert artigo_palavra_chave" ON artigo_palavra_chave;
CREATE POLICY "Public insert artigo_palavra_chave" ON artigo_palavra_chave FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update artigo_palavra_chave" ON artigo_palavra_chave;
CREATE POLICY "Public update artigo_palavra_chave" ON artigo_palavra_chave FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete artigo_palavra_chave" ON artigo_palavra_chave;
CREATE POLICY "Public delete artigo_palavra_chave" ON artigo_palavra_chave FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read artigo_referencia" ON artigo_referencia;
CREATE POLICY "Public read artigo_referencia" ON artigo_referencia FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert artigo_referencia" ON artigo_referencia;
CREATE POLICY "Public insert artigo_referencia" ON artigo_referencia FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update artigo_referencia" ON artigo_referencia;
CREATE POLICY "Public update artigo_referencia" ON artigo_referencia FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete artigo_referencia" ON artigo_referencia;
CREATE POLICY "Public delete artigo_referencia" ON artigo_referencia FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public read artigo_open_access" ON artigo_open_access;
CREATE POLICY "Public read artigo_open_access" ON artigo_open_access FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public insert artigo_open_access" ON artigo_open_access;
CREATE POLICY "Public insert artigo_open_access" ON artigo_open_access FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public update artigo_open_access" ON artigo_open_access;
CREATE POLICY "Public update artigo_open_access" ON artigo_open_access FOR UPDATE TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete artigo_open_access" ON artigo_open_access;
CREATE POLICY "Public delete artigo_open_access" ON artigo_open_access FOR DELETE TO public USING (true);
