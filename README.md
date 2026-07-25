# Story Forge — AI User Story Generator

Story Forge turns raw feature descriptions (pasted text or uploaded documents) into structured, ready-to-groom user stories, and pushes them straight into Jira.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + React 19, Tailwind CSS
- **Backend / Data:** Supabase (Postgres + Auth)
- **Workflow Orchestration:** n8n
- **LLM Access:** Requesty (Claude Sonnet 4)
- **Integrations:** Jira REST API v3 + Agile API

## Features

- Paste free-form text or upload a document as input for story generation
- Optional structured form (persona, priority, complexity, toggles) to guide generation
- AI-generated user stories with a review/edit step before sending to Jira
- Jira integration: connect a Jira site, pick a project/epic/sprint, and create issues directly
- Supabase-backed authentication and persistence

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth)
- An n8n instance running the workflows in [`n8n/generate-stories.json`](./n8n/generate-stories.json)
- A Requesty API key for LLM access
- A Jira Cloud site with API access (for the Jira integration)

### Environment variables

Create a `.env.local` file in the project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
N8N_WEBHOOK_URL=
N8N_VALIDATE_URL=
N8N_REGENERATE_STORIES_URL=
N8N_REGENERATE_STORY_URL=
N8N_SSRF_PROTECTION_ENABLED=
REQUESTY_API_KEY=
```

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

### Database setup

Apply the Supabase schema files in [`supabase/`](./supabase):

- `schema.sql` — core tables
- `schema_jira.sql` — Jira connections/integration tables

## Project Structure

```
app/
  page.tsx                 # Main input/generation page
  jira/                     # Jira connection management UI
  review/[input_id]/        # Story review & edit UI
  auth/, login/             # Supabase auth flow
  api/                      # Route handlers (generate, regenerate, Jira proxying)
components/                 # Shared UI components
lib/                        # Supabase and Jira client helpers
n8n/                        # n8n workflow export(s) used for story generation
supabase/                   # SQL schema files
Docs/                       # Design notes, competitive analysis, workflow docs
```

## Docs

See [`GAP_ANALYSIS.md`](./GAP_ANALYSIS.md) for a comparison of requirements vs. current implementation, and [`Docs/`](./Docs) for additional design and workflow documentation.
