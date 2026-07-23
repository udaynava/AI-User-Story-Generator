# Gap Analysis: Requirements vs. Current Implementation

**Document:** Training Document for AI Developers (AI User Story Generator – Team Introduction Brief)  
**App:** Story Forge (AI User Story Generator)  
**Date:** 2026-05-20

---

## Summary

The current implementation covers the core happy path well — input ingestion, LLM-driven story generation via n8n, and Jira ticket creation are all functional. However, several explicitly required features are missing, the tech stack deviates from the spec in one area, and security/production-readiness gaps exist that should be addressed even for a PoC.

---

## 1. Tech Stack Compliance

| Requirement | Specified | Implemented | Gap |
|---|---|---|---|
| Frontend | React / Next.js | Next.js 16 + React 19 | None |
| Backend / Data | Supabase (Postgres, Auth, **Storage**) | Supabase Postgres + Auth | Supabase Storage not used |
| Workflow Orchestration | n8n | n8n | None |
| LLM Access | Requesty | Requesty (Claude Sonnet 4) | None |
| Integration | Jira REST API | Jira REST API v3 + Agile API | None |
| UI Components | **shadcn/ui** | Raw Tailwind CSS only | shadcn/ui not installed or used |

### Notes

- **shadcn/ui is explicitly required** in the tech stack but is completely absent. The UI is built with raw Tailwind classes. This affects consistency, accessibility, and maintainability.
- **Supabase Storage** is listed in the tech stack for document handling but is not used. Uploaded files are read into memory on the client and sent as text — no persistent file storage occurs.

---

## 2. Input Layer

| Requirement | Status | Notes |
|---|---|---|
| Free text input | Implemented | Textarea with paste support |
| Document upload | Implemented | File picker, reads content client-side into memory |
| Structured form (optional fields) | Implemented | Persona, priority, complexity, options toggles |

### Gaps

- **No file size or type validation on uploads.** The entire file is loaded into memory with no limits. Large files will silently degrade or cause browser crashes.
- **Supabase Storage not used for uploads.** Files are not persisted — if generation fails mid-way, the original document cannot be retrieved.
- The "Recent" and "Templates" buttons visible in the home page toolbar are non-functional stubs with no backing logic.

---

## 3. Processing Layer (n8n + LLM)

| Requirement | Status | Notes |
|---|---|---|
| Pre-process input | Implemented | n8n workflow prepends JIRA history context |
| Extract key entities (actor, goal, value) | Implemented | LLM extracts persona/action/benefit |
| Generate user story | Implemented | "As a… I want… So that…" format enforced |
| Generate acceptance criteria | Implemented | Given/When/Then BDD format |
| Add metadata suggestions | Implemented | Priority, labels, story points, confidence |
| Validate output against guardrails | Partial | Optional validation webhook; fails open if unreachable |

### Gaps

- **Guardrail validation is optional and fails open.** The `/api/generate` endpoint calls `N8N_VALIDATE_URL` but continues if it is unreachable. There is no local fallback validation (e.g., minimum input length, content safety check).
- **No output-side guardrail validation in n8n.** The spec requires validating generated output against guardrails (step 5 in the processing layer). The n8n workflow does not have a post-generation guardrail check node — it only checks whether `story_count > 0`.
- **Batch story regeneration is wired to nowhere.** `N8N_REGENERATE_STORIES_URL` is defined in `.env.local` and referenced in the spec, but there is no API route or UI element that calls it. Only single-story revision (`/api/regenerate-story`) is functional.
- **No local n8n workflow for story revision.** The `N8N_REGENERATE_STORY_URL` webhook is referenced in code but there is no corresponding workflow JSON in the `n8n/` directory (only `generate-stories.json` exists). Story revision will fail unless the workflow is manually set up.

---

## 4. Output Layer

| Requirement | Status | Notes |
|---|---|---|
| Editable user story view | Implemented | StoryCard with inline revision comment |
| Side-by-side comparison (input vs output) | **Not implemented** | Review page shows output only |
| Export: Jira ticket creation | Implemented | Per-story Jira creation in StoryCard |
| Export: JSON / CSV | **Not implemented** | No export functionality exists |

### Gaps

- **Side-by-side input vs. output comparison is a specified requirement and is completely absent.** The review page (`/review/[input_id]`) shows generated stories but never surfaces the original requirement input alongside them. The `raw_text` is stored in `requirement_inputs` but is not fetched or displayed on the review page.
- **No JSON or CSV export.** The spec lists JSON/CSV as a required export option alongside Jira creation. Neither is implemented — there is no download button, no export API route, and no serialization logic.

---

## 5. Jira Integration

| Requirement | Status | Notes |
|---|---|---|
| Create issues | Implemented | `/api/jira/create-issue` with ADF description |
| Assign issue types (Story, Task) | Partial | Only "Story" is used; "Task" type is not selectable |
| Add labels and metadata | Implemented | Labels, priority, story points mapped |
| Map Summary → Story title | Implemented | Title field used as summary |
| Map Description → Full story + criteria | Implemented | ADF builder in `lib/jira.ts` |
| Dry-run mode before ticket creation | **Not implemented** | No preview or confirmation step before issue creation |

### Gaps

- **Dry-run mode is explicitly required and missing.** The spec states "Support dry-run mode before ticket creation." Currently, clicking "Create Jira Ticket" immediately calls the API with no preview or confirmation step. A user cannot see what the Jira ticket will look like before it is created.
- **Issue type is hardcoded to "Story".** The JIRA connections form has a `default_issue_type` field, but the `/api/jira/create-issue` route does not use it from context — and the UI only ever sends `issuetype: { name: "Story" }`. The spec requires supporting both Story and Task types.
- **No JIRA ticket status tracking in the database.** Once a story is pushed to Jira, the `generated_stories` table has no field to record the resulting Jira issue key or URL. There is no way to know which stories have already been pushed, risking duplicate ticket creation.
- **Epic assignment requires manual lookup.** Users must select a JIRA project and then an epic from a dropdown, but there is no validation that an epic is required — stories can be created without an epic, and there is no warning displayed.

---

## 6. Guardrails & Safety

| Requirement | Status | Notes |
|---|---|---|
| Only use information present in input | Partial | LLM prompt instructs this, but not technically enforced |
| Flag missing information instead of guessing | Implemented | `flagged_gaps` array returned and displayed |
| Enforce "As a… I want… So that…" template | Implemented | LLM system prompt enforces this |
| Acceptance criteria must be testable and specific | Partial | Format enforced (BDD), but not validated post-generation |
| Confidence indicators for generated content | Implemented | Confidence score displayed on StoryCard |

### Gaps

- **Confidence score is passive.** It is displayed on each StoryCard but has no functional consequence — there is no filtering, sorting, warning threshold, or block on pushing low-confidence stories to Jira. The spec implies these indicators should guide user decision-making.
- **No hallucination detection mechanism.** The spec explicitly lists "hallucinated requirements" as a safety concern. The only safeguard is prompt wording. There is no post-generation check (e.g., verifying that story content references terms from the source input).

---

## 7. Review & Approval Workflow

| Requirement | Status | Notes |
|---|---|---|
| Basic review/edit workflow | Partial | Users can revise individual stories via comment |
| Approval state tracking | **Not implemented** | No approved/rejected/pending state on stories |

### Gaps

- **No explicit approval/rejection state.** The `generated_stories` table has no `status` or `approved` field. There is no way to mark a story as reviewed and approved before pushing to Jira, which undermines the "human in the loop" intent of the spec.
- **Story revision requires a running n8n instance.** The regeneration workflow has no fallback. If n8n is not running, the revision button will fail silently or show a generic error with no guidance to the user.

---

## 8. Security & Production Readiness

| Issue | Severity | Details |
|---|---|---|
| Authentication not enforced | High | `proxy.ts` middleware has the auth redirect commented out — all routes are publicly accessible without login |
| RLS policies too permissive | High | Supabase schema comment acknowledges "anon_all" policies need tightening before production |
| No file upload size limit | Medium | Uploaded documents are loaded fully into browser memory with no size cap |
| JIRA API tokens stored in plaintext in DB | Medium | `jira_api_token` is labeled as "encrypted in Supabase" in a comment, but this relies on Supabase's at-rest encryption only — tokens are returned in full via the API |
| Middleware matcher includes API routes | Low | `proxy.ts` matcher does not exclude `/api/*`, so every API call triggers session refresh overhead |
| Generic error messages to users | Low | n8n workflow errors do not propagate meaningful context to the frontend |

---

## 9. Technical Assets (Deliverables)

| Required Asset | Status |
|---|---|
| GitHub repository with setup instructions | No README or setup guide exists |
| Sample mock requirement data | No mock data files provided |
| Prompt templates and configurations | n8n workflow JSON exists; no standalone prompt template docs |
| Screenshots or demo recording | Not present in repository |

---

## 10. Priority Summary

### High Priority (blocking correctness or security)
1. **Enable authentication enforcement** — uncomment the middleware auth redirect
2. **Tighten Supabase RLS policies** — replace permissive anon policies with user-scoped rules
3. **Add side-by-side input vs. output view** on the review page (explicit requirement)
4. **Add JSON/CSV export** (explicit requirement)
5. **Add dry-run/preview mode** before Jira ticket creation (explicit requirement)

### Medium Priority (significant feature gaps)
6. **Install shadcn/ui** and migrate core UI components (tech stack requirement)
7. **Add approval state** to `generated_stories` table and review UI
8. **Track Jira issue keys** on stories after creation (prevent duplicates)
9. **Add n8n workflow JSON for story revision** to the repository
10. **Make confidence score actionable** — add a low-confidence warning or filter
11. **Wire up batch story regeneration** or remove the dead environment variable

### Low Priority (polish and completeness)
12. **Add file upload size/type validation**
13. **Use Supabase Storage** for uploaded documents instead of in-memory handling
14. **Support Task issue type** in Jira creation alongside Story
15. **Add a README** with setup instructions, environment variable reference, and n8n import steps
16. **Add sample mock requirement datasets** to the repository
17. **Remove non-functional "Recent" and "Templates" stubs** or implement them
18. **Improve error messaging** — surface n8n/generation errors with actionable guidance
