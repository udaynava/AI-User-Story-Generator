import { after } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchJiraHistory } from '@/lib/jira'

export async function POST(request: Request) {
  const {
    input,
    personas,
    priority,
    complexity,
    story_options,
    jira_connection_id,
    jira_project_key,
    jira_epic_key,
    sprint_name,
  } = await request.json()

  if (!input?.trim()) {
    return Response.json({ error: 'Input is required' }, { status: 400 })
  }

  const rawText = input.trim()

  // Local pre-validation: reject inputs that are clearly too short or trivial
  const wordCount = rawText.split(/\s+/).filter(Boolean).length
  if (rawText.length < 20 || wordCount < 5) {
    return Response.json(
      { error: 'Input is too short. Please provide a meaningful business requirement (at least a few sentences).' },
      { status: 400 }
    )
  }

  // LLM-based validation via n8n
  const validateUrl = process.env.N8N_VALIDATE_URL
  if (validateUrl) {
    try {
      const validateRes = await fetch(validateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: rawText,
          requesty_api_key: process.env.REQUESTY_API_KEY,
        }),
      })
      const validateData = await validateRes.json()
      // Handle both {valid: false, reason: "..."} object and "rejected" string formats
      const isRejected =
        validateData?.valid === false ||
        validateData === 'rejected' ||
        validateData?.status === 'rejected'
      if (isRejected) {
        return Response.json(
          { error: validateData?.reason || validateData?.message || 'Input validation failed. Please provide a clear business requirement.' },
          { status: 400 }
        )
      }
    } catch {
      // If validation webhook is unreachable, fall through to generation
    }
  }

  const { data: reqData, error: reqError } = await supabase
    .from('requirement_inputs')
    .insert({ raw_text: rawText, status: 'pending' })
    .select('id')
    .single()

  if (reqError) {
    console.log('requirement_inputs insert error:', reqError)
    return Response.json({ error: reqError.message }, { status: 500 })
  }

  const { data: runData, error: runError } = await supabase
    .from('generation_runs')
    .insert({ input_id: reqData.id, status: 'pending' })
    .select('id')
    .single()

  if (runError) {
    console.log('generation_runs insert error:', runError)
    return Response.json({ error: runError.message }, { status: 500 })
  }

  // Optionally fetch JIRA project history to pass as context
  let jiraHistory: string | null = null
  if (jira_connection_id && jira_project_key) {
    const { data: conn } = await supabase
      .from('jira_connections')
      .select('jira_domain, jira_email, jira_api_token')
      .eq('id', jira_connection_id)
      .single()

    if (conn) {
      jiraHistory = await fetchJiraHistory(
        conn.jira_domain,
        conn.jira_email,
        conn.jira_api_token,
        jira_project_key
      ).catch(() => null)
    }
  }

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
  if (!n8nWebhookUrl) {
    return Response.json({ error: 'N8N_WEBHOOK_URL is not configured' }, { status: 500 })
  }

  after(async () => {
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_id: reqData.id,
        run_id: runData.id,
        raw_text: rawText,
        // Context options
        personas: personas ?? [],
        priority: priority ?? null,
        complexity: complexity ?? 50,
        story_options: story_options ?? {},
        // Jira context
        jira_history: jiraHistory,
        jira_epic_key: jira_epic_key ?? null,
        sprint_name: sprint_name ?? null,
        // Infrastructure
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        requesty_api_key: process.env.REQUESTY_API_KEY,
      }),
    })
  })

  return Response.json({ success: true, input_id: reqData.id, run_id: runData.id })
}
