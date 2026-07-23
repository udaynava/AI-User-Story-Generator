⏺ Here's a full breakdown of every node — what it receives, what it does, and what it passes forward.

  ---
  Flow overview

  Webhook → Set Processing → Set Run Running → Prepare Prompt → Call Requesty LLM → Parse Response → Has Stories?
                                                                                                           │ true
                                                                                                 Insert Stories → Set Completed → Set Run
  Completed
                                                                                                           │ false
                                                                                                 Set Error → Set Run Error

  ---
  Node-by-node

  ---
  1. Webhook

  Type: Webhook trigger — POST /webhook/generate-stories

  Input: HTTP POST from the Next.js /api/generate route.
  {
    "input_id": "uuid",
    "run_id": "uuid",
    "raw_text": "The user pasted requirements text",
    "jira_history": "PROJ-1: User login [Story, Done]\n...",  // or null
    "supabase_url": "https://xxx.supabase.co",
    "supabase_key": "sb_...",
    "requesty_api_key": "rqsty-sk-..."
  }

  What it does: Receives the request and immediately responds 200 OK back to Next.js (responseMode: onReceived). The rest of the workflow runs
   asynchronously — Next.js doesn't wait for it.

  Output to next node: The full body above, available throughout the workflow as $('Webhook').item.json.body.*.

  ---
  2. Set Processing

  Type: HTTP Request — PATCH to Supabase

  Input: The webhook body (uses $json.body.input_id and $('Webhook').item.json.body.supabase_*).

  What it does: Updates the requirement_inputs row to status = 'processing'. This is what the frontend's Realtime subscription picks up to
  know the workflow has started.

  Output: Supabase returns 204 No Content (because of Prefer: return=minimal). The node passes this through — downstream nodes ignore it and
  reference the Webhook directly.

  ---
  3. Set Run Running

  Type: HTTP Request — PATCH to Supabase

  Input: run_id from the webhook body.

  What it does: Updates the generation_runs row to status = 'running' and stamps started_at with the current ISO timestamp. This is the audit
  trail for how long the LLM call took.

  Output: Same 204 No Content passthrough.

  ---
  4. Prepare Prompt

  Type: Code (JavaScript)

  Input: Reads raw_text and jira_history directly from the Webhook body.

  What it does:
  // Truncates raw_text to 15,000 chars (LLM token safety)
  // If jira_history exists, appends it under a clear header:
  //
  // ---
  // EXISTING PROJECT STORIES FOR CONTEXT:
  // PROJ-1: User login [Story, Done]
  // PROJ-2: ...

  Output:
  { "userContent": "the full assembled string to send to the LLM" }

  This is the only node that conditionally changes what the LLM sees. When jira_history is null (checkbox not ticked), userContent is just the
   raw text.

  ---
  5. Call Requesty LLM

  Type: HTTP Request — POST to https://router.requesty.ai/v1/chat/completions

  Input: $('Prepare Prompt').item.json.userContent for the user message. requesty_api_key from the webhook body for the Bearer token.

  What it does: Calls Claude Sonnet 4 via the Requesty router with:
  - A system prompt that instructs the LLM to output only a JSON object with a stories[] array, and not to duplicate anything from the JIRA
  history if present
  - A user message containing the assembled userContent
  - max_tokens: 8192, timeout: 120s

  Output: Full OpenAI-compatible response object:
  {
    "choices": [{ "message": { "content": "{\"stories\": [...]}" } }],
    "usage": { "prompt_tokens": 450, "completion_tokens": 1200 },
    "model": "anthropic/claude-sonnet-4-20250514"
  }

  ---
  6. Parse Response

  Type: Code (JavaScript)

  Input: The LLM response from the previous node ($input.first().json). Also re-reads input_id from the Webhook body to stamp each story row.

  What it does:
  1. Extracts choices[0].message.content
  2. Strips any accidental markdown fences (```json) the LLM might have added
  3. JSON.parse() the content
  4. Maps each story from the LLM's schema to the generated_stories table schema — validating priority values, defaulting nulls
  5. Captures prompt_tokens, completion_tokens, model for the audit log

  Output (success):
  {
    "stories": [ { "input_id": "...", "title": "...", ... } ],
    "story_count": 5,
    "token_usage": { "prompt_tokens": 450, "completion_tokens": 1200, "model": "..." },
    "error": null
  }

  Output (parse failure):
  {
    "stories": [],
    "story_count": 0,
    "token_usage": null,
    "error": "Failed to parse LLM response: ..."
  }

  ---
  7. Has Stories?

  Type: IF condition

  Input: $json.story_count from Parse Response.

  What it does: Checks story_count > 0.
  - True branch → Insert Stories (success path)
  - False branch → Set Error (failure path — parse failed or LLM returned empty)

  ---
  8a. Insert Stories (success path)

  Type: HTTP Request — POST to Supabase

  Input: The full stories array from Parse Response.

  What it does: Bulk-inserts all story rows into generated_stories in a single PostgREST request by sending a JSON array. Each row already has
   input_id stamped from Parse Response.

  Output: 201 Created from Supabase.

  ---
  8b. Set Completed (success path)

  Type: HTTP Request — PATCH to Supabase

  Input: input_id from the Webhook body.

  What it does: Updates requirement_inputs.status = 'completed'. This is the signal the frontend's Realtime subscription is waiting for — when
   this fires, the review page fetches and displays the stories.

  Output: 204 No Content.

  ---
  8c. Set Run Completed (success path)

  Type: HTTP Request — PATCH to Supabase

  Input: run_id from Webhook body. Token counts and model name from Parse Response's token_usage.

  What it does: Closes out the generation_runs audit row with status = 'completed', prompt_tokens, completion_tokens, model_used, and
  completed_at. This is your cost tracking / observability record.

  Output: 204 No Content. End of the success path.

  ---
  9a. Set Error (failure path)

  Type: HTTP Request — PATCH to Supabase

  Input: input_id from the Webhook body.

  What it does: Updates requirement_inputs.status = 'error'. The frontend's Realtime subscription picks this up and shows the error state to
  the user.

  Output: 204 No Content.

  ---
  9b. Set Run Error (failure path)

  Type: HTTP Request — PATCH to Supabase

  Input: run_id from Webhook body. error string from Parse Response.

  What it does: Closes out the generation_runs row with status = 'error', error_message (the parse failure reason), and completed_at. End of
  the failure path.

  Output: 204 No Content.

  ---
  Data that travels the whole workflow (always from Webhook)

  Every node reaches back to $('Webhook').item.json.body.* for supabase_url, supabase_key, requesty_api_key, input_id, and run_id. None of
  these are passed forward through intermediate nodes — they're pulled directly from the original trigger, which is why the Webhook node is
  referenced by name in nearly every expression.