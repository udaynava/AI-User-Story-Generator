'use client'

import { useState, useEffect } from 'react'
import type { JiraProject } from '@/lib/jira'

type AcceptanceCriterion = { given: string; when: string; then: string } | string

export type JiraConnectionSummary = {
  id: string
  name: string
  jira_domain: string
}

export type Story = {
  id: string
  input_id: string
  title: string
  persona: string
  action: string
  benefit: string
  acceptance_criteria: AcceptanceCriterion[]
  priority: 'high' | 'medium' | 'low'
  story_points: number | null
  labels: string[]
  source_excerpt: string | null
  confidence: number
  flagged_gaps: string[]
}

const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  medium: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
  low:    'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
}

export default function StoryCard({
  story,
  connections,
  defaultConnectionId = '',
  defaultProjectKey = '',
}: {
  story: Story
  connections: JiraConnectionSummary[]
  defaultConnectionId?: string
  defaultProjectKey?: string
}) {
  const [localStory, setLocalStory] = useState(story)

  // JIRA state
  const [jiraOpen, setJiraOpen] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState(defaultConnectionId)
  const [projects, setProjects] = useState<JiraProject[] | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProjectKey, setSelectedProjectKey] = useState(defaultProjectKey)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ key: string; url: string } | null>(null)
  const [jiraError, setJiraError] = useState('')

  // Revision state
  const [reviseOpen, setReviseOpen] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [revising, setRevising] = useState(false)
  const [reviseError, setReviseError] = useState('')
  const [revised, setRevised] = useState(false)

  useEffect(() => {
    if (!selectedConnectionId) { setProjects(null); return }
    setLoadingProjects(true)
    setProjects(null)
    setJiraError('')
    fetch(`/api/jira/projects?connectionId=${selectedConnectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setJiraError(data.error); return }
        setProjects(data)
      })
      .catch(() => setJiraError('Failed to load projects'))
      .finally(() => setLoadingProjects(false))
  }, [selectedConnectionId])

  async function handleCreate() {
    if (!selectedConnectionId || !selectedProjectKey) return
    setCreating(true)
    setJiraError('')
    try {
      const res = await fetch('/api/jira/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_id: localStory.id, connection_id: selectedConnectionId, project_key: selectedProjectKey }),
      })
      const data = await res.json()
      if (!res.ok) { setJiraError(data.error || 'Failed to create issue'); return }
      setCreated({ key: data.key, url: data.url })
      setJiraOpen(false)
    } catch {
      setJiraError('Network error')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevise() {
    if (!reviewComment.trim()) return
    setRevising(true)
    setReviseError('')
    try {
      const res = await fetch('/api/regenerate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: localStory.id,
          input_id: localStory.input_id,
          review_comment: reviewComment.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setReviseError(data.error || 'Failed to revise story'); return }
      setLocalStory((prev) => ({ ...prev, ...data.story }))
      setRevised(true)
      setReviseOpen(false)
      setReviewComment('')
    } catch {
      setReviseError('Network error')
    } finally {
      setRevising(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-4">

      {/* Title + meta */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{localStory.title}</h2>
        <div className="flex items-center gap-2 shrink-0">
          {revised && (
            <span className="text-xs text-violet-500 font-medium">revised</span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[localStory.priority]}`}>
            {localStory.priority}
          </span>
          {localStory.story_points && (
            <span className="text-xs text-zinc-400">{localStory.story_points} pts</span>
          )}
        </div>
      </div>

      {/* Story sentence */}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        As a <strong className="text-zinc-900 dark:text-zinc-100">{localStory.persona}</strong>, I want to{' '}
        <strong className="text-zinc-900 dark:text-zinc-100">{localStory.action}</strong> so that{' '}
        <strong className="text-zinc-900 dark:text-zinc-100">{localStory.benefit}</strong>.
      </p>

      {/* Acceptance criteria */}
      {localStory.acceptance_criteria?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Acceptance Criteria</p>
          {localStory.acceptance_criteria.map((ac, i) => (
            <div key={i} className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2.5 leading-relaxed">
              {typeof ac === 'string' ? ac : (
                <>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Given</span> {ac.given}{' '}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">When</span> {ac.when}{' '}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Then</span> {ac.then}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Flagged gaps */}
      {localStory.flagged_gaps?.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-amber-500 uppercase tracking-widest">Gaps</p>
          {localStory.flagged_gaps.map((gap, i) => (
            <p key={i} className="text-xs text-zinc-500">· {gap}</p>
          ))}
        </div>
      )}

      {/* Labels */}
      {localStory.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {localStory.labels.map((label) => (
            <span key={label} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Footer: confidence + source + action buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800 gap-4">
        <p className="text-xs text-zinc-400 shrink-0">
          {Math.round((localStory.confidence ?? 0) * 100)}% confidence
        </p>
        {localStory.source_excerpt && (
          <p className="text-xs text-zinc-400 italic truncate min-w-0">"{localStory.source_excerpt}"</p>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {/* Revise button */}
          <button
            onClick={() => { setReviseOpen((o) => !o); setReviseError(''); setJiraOpen(false) }}
            className="text-xs font-medium text-zinc-500 hover:text-foreground border border-zinc-200 dark:border-zinc-700 rounded-full px-3 py-1.5 transition-colors"
          >
            {reviseOpen ? 'Cancel' : revised ? 'Revise again' : 'Revise'}
          </button>

          {/* JIRA button or created badge */}
          {created ? (
            <a
              href={created.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
            >
              ✓ {created.key} ↗
            </a>
          ) : connections.length === 0 ? (
            <a href="/jira" className="text-xs text-zinc-400 hover:text-foreground underline underline-offset-2">
              + Configure JIRA
            </a>
          ) : (
            <button
              onClick={() => { setJiraOpen((o) => !o); setReviseOpen(false) }}
              className="text-xs font-medium text-zinc-500 hover:text-foreground border border-zinc-200 dark:border-zinc-700 rounded-full px-3 py-1.5 transition-colors"
            >
              {jiraOpen ? 'Cancel' : '+ Create in JIRA'}
            </button>
          )}
        </div>
      </div>

      {/* Revise panel */}
      {reviseOpen && (
        <div className="flex flex-col gap-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="What should change? e.g. 'Add error state acceptance criteria' or 'Persona should be Admin'"
            rows={3}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-ring resize-none"
          />
          {reviseError && <p className="text-xs text-red-600 dark:text-red-400">{reviseError}</p>}
          <button
            onClick={handleRevise}
            disabled={!reviewComment.trim() || revising}
            className="self-start h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
          >
            {revising ? 'Revising…' : 'Submit revision'}
          </button>
        </div>
      )}

      {/* JIRA panel */}
      {jiraOpen && !created && connections.length > 0 && (
        <div className="flex flex-col gap-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">JIRA Connection</label>
            <select
              value={selectedConnectionId}
              onChange={(e) => { setSelectedConnectionId(e.target.value); setSelectedProjectKey('') }}
              className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:outline-none focus:ring-ring"
            >
              <option value="">Select connection…</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.jira_domain})</option>
              ))}
            </select>
          </div>

          {selectedConnectionId && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Project</label>
              {loadingProjects ? (
                <p className="text-xs text-zinc-400">Loading projects…</p>
              ) : (
                <select
                  value={selectedProjectKey}
                  onChange={(e) => setSelectedProjectKey(e.target.value)}
                  className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:outline-none focus:ring-ring"
                >
                  <option value="">Select project…</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {jiraError && <p className="text-xs text-red-600 dark:text-red-400">{jiraError}</p>}

          <button
            onClick={handleCreate}
            disabled={!selectedConnectionId || !selectedProjectKey || creating}
            className="self-start h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
          >
            {creating ? 'Creating…' : 'Create Issue'}
          </button>
        </div>
      )}
    </div>
  )
}
