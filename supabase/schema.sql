-- ============================================================
-- requirement_inputs: raw pasted text + lifecycle status
-- ============================================================
CREATE TABLE requirement_inputs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text   TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- keep updated_at current on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER requirement_inputs_updated_at
  BEFORE UPDATE ON requirement_inputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- generation_runs: one row per LLM invocation, tracks tokens
-- ============================================================
CREATE TABLE generation_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  input_id          UUID        NOT NULL REFERENCES requirement_inputs(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'completed', 'error')),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  model_used        TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- generated_stories: LLM output, one row per story
-- ============================================================
CREATE TABLE generated_stories (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  input_id             UUID        NOT NULL REFERENCES requirement_inputs(id) ON DELETE CASCADE,
  title                TEXT        NOT NULL,
  persona              TEXT,
  action               TEXT,
  benefit              TEXT,
  acceptance_criteria  JSONB       NOT NULL DEFAULT '[]',
  priority             TEXT        NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('high', 'medium', 'low')),
  story_points         INTEGER,
  labels               TEXT[]      NOT NULL DEFAULT '{}',
  source_excerpt       TEXT,
  confidence           FLOAT,
  flagged_gaps         TEXT[]      NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Realtime — let the frontend subscribe to status changes
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE requirement_inputs;

-- ============================================================
-- RLS — permissive anon policies (tighten before production)
-- ============================================================
ALTER TABLE requirement_inputs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_stories   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON requirement_inputs  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON generation_runs     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON generated_stories   FOR ALL TO anon USING (true) WITH CHECK (true);
