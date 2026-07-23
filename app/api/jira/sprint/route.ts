import { supabase } from '@/lib/supabase'
import { fetchJiraActiveSprint } from '@/lib/jira'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const connectionId = url.searchParams.get('connectionId')
  const projectKey = url.searchParams.get('projectKey')

  if (!connectionId || !projectKey) {
    return Response.json({ error: 'connectionId and projectKey are required' }, { status: 400 })
  }

  const { data: conn, error } = await supabase
    .from('jira_connections')
    .select('jira_domain, jira_email, jira_api_token')
    .eq('id', connectionId)
    .single()

  if (error || !conn) return Response.json({ error: 'Connection not found' }, { status: 404 })

  try {
    const sprint = await fetchJiraActiveSprint(
      conn.jira_domain,
      conn.jira_email,
      conn.jira_api_token,
      projectKey
    )
    return Response.json(sprint ?? null)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
