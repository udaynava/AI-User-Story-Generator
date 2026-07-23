import { supabase } from '@/lib/supabase'
import { fetchJiraProjects } from '@/lib/jira'

export async function GET(request: Request) {
  const connectionId = new URL(request.url).searchParams.get('connectionId')
  if (!connectionId) {
    return Response.json({ error: 'connectionId query param required' }, { status: 400 })
  }

  const { data: conn, error } = await supabase
    .from('jira_connections')
    .select('jira_domain, jira_email, jira_api_token')
    .eq('id', connectionId)
    .single()

  if (error || !conn) return Response.json({ error: 'Connection not found' }, { status: 404 })

  try {
    const projects = await fetchJiraProjects(conn.jira_domain, conn.jira_email, conn.jira_api_token)
    return Response.json(projects)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
