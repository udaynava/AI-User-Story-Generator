import { supabase } from '@/lib/supabase'
import { jiraAuthHeader, buildAdfDescription } from '@/lib/jira'

export async function POST(request: Request) {
  const { story_id, connection_id, project_key } = await request.json()

  if (!story_id || !connection_id || !project_key) {
    return Response.json({ error: 'story_id, connection_id and project_key are required' }, { status: 400 })
  }

  const [{ data: conn, error: connErr }, { data: story, error: storyErr }] = await Promise.all([
    supabase.from('jira_connections').select('*').eq('id', connection_id).single(),
    supabase.from('generated_stories').select('*').eq('id', story_id).single(),
  ])

  if (connErr || !conn) return Response.json({ error: 'Connection not found' }, { status: 404 })
  if (storyErr || !story) return Response.json({ error: 'Story not found' }, { status: 404 })

  const priorityMap: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }

  const fields: Record<string, unknown> = {
    project: { key: project_key },
    summary: story.title,
    issuetype: { name: conn.default_issue_type },
    description: buildAdfDescription({
      persona: story.persona,
      action: story.action,
      benefit: story.benefit,
      acceptance_criteria: story.acceptance_criteria ?? [],
      flagged_gaps: story.flagged_gaps ?? [],
    }),
    priority: { name: priorityMap[story.priority] ?? 'Medium' },
    labels: (story.labels ?? []).map((l: string) => l.replace(/\s+/g, '-')),
  }

  if (story.story_points && conn.story_points_field) {
    fields[conn.story_points_field] = story.story_points
  }

  const jiraRes = await fetch(`https://${conn.jira_domain}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: jiraAuthHeader(conn.jira_email, conn.jira_api_token),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!jiraRes.ok) {
    const err = await jiraRes.json().catch(() => ({}))
    const msg = err.errorMessages?.[0] ?? (err.errors ? JSON.stringify(err.errors) : `JIRA ${jiraRes.status}`)
    return Response.json({ error: msg }, { status: 502 })
  }

  const jiraData = await jiraRes.json()
  const issueUrl = `https://${conn.jira_domain}/browse/${jiraData.key}`

  return Response.json({ key: jiraData.key, url: issueUrl })
}
