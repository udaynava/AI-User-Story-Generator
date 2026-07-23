-- ============================================================
-- jira_connections: stores one entry per configured JIRA workspace
-- ============================================================
CREATE TABLE jira_connections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,                          -- display label e.g. "Platform Team"
  jira_domain         TEXT        NOT NULL,                          -- e.g. mycompany.atlassian.net (no protocol)
  jira_email          TEXT        NOT NULL,                          -- Atlassian account email for auth
  jira_api_token      TEXT        NOT NULL,                          -- API token from id.atlassian.com/manage-profile/security/api-tokens
  default_issue_type  TEXT        NOT NULL DEFAULT 'Story',
  story_points_field  TEXT        NOT NULL DEFAULT 'customfield_10016', -- varies per JIRA instance
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS — permissive anon policies (tighten before production)
-- ============================================================
ALTER TABLE jira_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON jira_connections FOR ALL TO anon USING (true) WITH CHECK (true);
