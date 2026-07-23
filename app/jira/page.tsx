'use client'

import { useState, useEffect } from 'react'

type JiraConnection = {
  id: string
  name: string
  jira_domain: string
  jira_email: string
  default_issue_type: string
  story_points_field: string
  created_at: string
}

const EMPTY_FORM = {
  name: '',
  jira_domain: '',
  jira_email: '',
  jira_api_token: '',
  default_issue_type: 'Story',
  story_points_field: 'customfield_10016',
}

export default function JiraSettingsPage() {
  const [connections, setConnections] = useState<JiraConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/jira/connections')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConnections(data) })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')

    const res = await fetch('/api/jira/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) { setSaveError(data.error || 'Failed to save'); setSaving(false); return }

    setConnections((prev) => [data, ...prev])
    setForm(EMPTY_FORM)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/jira/connections/${id}`, { method: 'DELETE' })
    setConnections((prev) => prev.filter((c) => c.id !== id))
    setDeletingId(null)
  }

  function field(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl flex flex-col gap-10">

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">JIRA Connections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connect to JIRA workspaces so you can push generated stories directly to a project.
          </p>
        </div>

        {/* Existing connections */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Configured</h2>
          {loading && <p className="text-sm text-zinc-400">Loading…</p>}
          {!loading && connections.length === 0 && (
            <p className="text-sm text-zinc-400">No connections yet.</p>
          )}
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 flex items-start justify-between gap-4"
            >
              <div className="flex flex-col gap-0.5">
                <p className="font-medium text-foreground">{conn.name}</p>
                <p className="text-sm text-zinc-500">{conn.jira_domain}</p>
                <p className="text-xs text-zinc-400">
                  {conn.jira_email} · {conn.default_issue_type} · SP field: {conn.story_points_field}
                </p>
              </div>
              <button
                onClick={() => handleDelete(conn.id)}
                disabled={deletingId === conn.id}
                className="text-xs text-red-500 hover:text-red-600 disabled:opacity-40 shrink-0 mt-0.5"
              >
                {deletingId === conn.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>

        {/* Add new connection form */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Add Connection</h2>
          <p className="text-xs text-zinc-400">
            API tokens can be generated at{' '}
            <span className="font-mono">id.atlassian.com → Security → API tokens</span>.
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Display name"
                placeholder="Platform Team"
                value={form.name}
                onChange={(v) => field('name', v)}
                required
              />
              <FormField
                label="JIRA domain"
                placeholder="mycompany.atlassian.net"
                value={form.jira_domain}
                onChange={(v) => field('jira_domain', v)}
                required
              />
              <FormField
                label="Atlassian email"
                type="email"
                placeholder="you@company.com"
                value={form.jira_email}
                onChange={(v) => field('jira_email', v)}
                required
              />
              <FormField
                label="API token"
                type="password"
                placeholder="••••••••••••"
                value={form.jira_api_token}
                onChange={(v) => field('jira_api_token', v)}
                required
              />
              <FormField
                label="Default issue type"
                placeholder="Story"
                value={form.default_issue_type}
                onChange={(v) => field('default_issue_type', v)}
              />
              <FormField
                label="Story points field ID"
                placeholder="customfield_10016"
                value={form.story_points_field}
                onChange={(v) => field('story_points_field', v)}
              />
            </div>

            <p className="text-xs text-zinc-400">
              The story points field ID varies by JIRA instance. Common values:{' '}
              <span className="font-mono">customfield_10016</span>,{' '}
              <span className="font-mono">customfield_10028</span>. Check your JIRA project's field configuration to confirm.
            </p>

            {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

            <button
              type="submit"
              disabled={saving}
              className="self-start h-10 px-6 rounded-full bg-foreground text-background text-sm font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save Connection'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
      />
    </div>
  )
}
