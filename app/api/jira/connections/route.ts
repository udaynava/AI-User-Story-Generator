import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('jira_connections')
    .select('id, name, jira_domain, jira_email, default_issue_type, story_points_field, created_at')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, jira_domain, jira_email, jira_api_token, default_issue_type, story_points_field } = body

  if (!name || !jira_domain || !jira_email || !jira_api_token) {
    return Response.json(
      { error: 'name, jira_domain, jira_email and jira_api_token are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('jira_connections')
    .insert({
      name,
      jira_domain: jira_domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      jira_email,
      jira_api_token,
      default_issue_type: default_issue_type || 'Story',
      story_points_field: story_points_field || 'customfield_10016',
    })
    .select('id, name, jira_domain, jira_email, default_issue_type, story_points_field, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
