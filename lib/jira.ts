export type JiraIssue = {
  key: string
  summary: string
  issueType: string
  status: string
}

export type JiraProject = {
  id: string
  key: string
  name: string
}

export type JiraEpic = {
  key: string
  summary: string
}

export type JiraSprint = {
  id: number
  name: string
  startDate?: string
  endDate?: string
}

export function jiraAuthHeader(email: string, token: string) {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')
}

// Returns a compact plain-text summary of existing issues for use as LLM context
export async function fetchJiraHistory(
  domain: string,
  email: string,
  token: string,
  projectKey: string,
  maxResults = 50
): Promise<string> {
  const jql = encodeURIComponent(`project="${projectKey}" ORDER BY created DESC`)
  const res = await fetch(
    `https://${domain}/rest/api/3/search?jql=${jql}&fields=summary,issuetype,status&maxResults=${maxResults}`,
    { headers: { Authorization: jiraAuthHeader(email, token), Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`JIRA history fetch failed: ${res.status}`)
  const data = await res.json()
  return (data.issues ?? [])
    .map(
      (i: { key: string; fields: { summary: string; issuetype: { name: string }; status: { name: string } } }) =>
        `${i.key}: ${i.fields.summary} [${i.fields.issuetype.name}, ${i.fields.status.name}]`
    )
    .join('\n')
}

export async function fetchJiraEpics(
  domain: string,
  email: string,
  token: string,
  projectKey: string
): Promise<JiraEpic[]> {
  const jql = encodeURIComponent(`project="${projectKey}" AND issuetype=Epic ORDER BY created DESC`)
  const res = await fetch(
    `https://${domain}/rest/api/3/search?jql=${jql}&fields=summary&maxResults=50`,
    { headers: { Authorization: jiraAuthHeader(email, token), Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`JIRA epics fetch failed: ${res.status}`)
  const data = await res.json()
  return (data.issues ?? []).map((i: { key: string; fields: { summary: string } }) => ({
    key: i.key,
    summary: i.fields.summary,
  }))
}

export async function fetchJiraActiveSprint(
  domain: string,
  email: string,
  token: string,
  projectKey: string
): Promise<JiraSprint | null> {
  const boardsRes = await fetch(
    `https://${domain}/rest/agile/1.0/board?projectKeyOrId=${projectKey}&maxResults=1`,
    { headers: { Authorization: jiraAuthHeader(email, token), Accept: 'application/json' } }
  )
  if (!boardsRes.ok) return null
  const boardsData = await boardsRes.json()
  const boardId = boardsData.values?.[0]?.id
  if (!boardId) return null

  const sprintsRes = await fetch(
    `https://${domain}/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=1`,
    { headers: { Authorization: jiraAuthHeader(email, token), Accept: 'application/json' } }
  )
  if (!sprintsRes.ok) return null
  const sprintsData = await sprintsRes.json()
  const sprint = sprintsData.values?.[0]
  if (!sprint) return null

  return { id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate }
}

export async function fetchJiraProjects(
  domain: string,
  email: string,
  token: string
): Promise<JiraProject[]> {
  const res = await fetch(
    `https://${domain}/rest/api/3/project/search?maxResults=50&orderBy=NAME`,
    {
      headers: {
        Authorization: jiraAuthHeader(email, token),
        Accept: 'application/json',
      },
    }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `JIRA responded ${res.status}`)
  }
  const data = await res.json()
  return (data.values ?? []).map((p: { id: string; key: string; name: string }) => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }))
}

// Builds an Atlassian Document Format body from a generated story
export function buildAdfDescription(story: {
  persona: string
  action: string
  benefit: string
  acceptance_criteria: Array<{ given: string; when: string; then: string }>
  flagged_gaps: string[]
}) {
  const bold = (text: string) => ({ type: 'text', text, marks: [{ type: 'strong' }] })
  const text = (t: string) => ({ type: 'text', text: t })

  const acItems = story.acceptance_criteria.map((ac, i) => ({
    type: 'paragraph',
    content: [
      bold(`${i + 1}. Given `), text(ac.given + ' '),
      bold('When '), text(ac.when + ' '),
      bold('Then '), text(ac.then),
    ],
  }))

  const gapItems = story.flagged_gaps.map((gap) => ({
    type: 'paragraph',
    content: [text(`• ${gap}`)],
  }))

  const content = [
    {
      type: 'paragraph',
      content: [
        text('As a '), bold(story.persona),
        text(', I want to '), bold(story.action),
        text(' so that '), bold(story.benefit), text('.'),
      ],
    },
    ...(acItems.length > 0
      ? [
          { type: 'heading', attrs: { level: 3 }, content: [text('Acceptance Criteria')] },
          ...acItems,
        ]
      : []),
    ...(gapItems.length > 0
      ? [
          { type: 'heading', attrs: { level: 3 }, content: [text('Open Questions / Gaps')] },
          ...gapItems,
        ]
      : []),
  ]

  return { type: 'doc', version: 1, content }
}
