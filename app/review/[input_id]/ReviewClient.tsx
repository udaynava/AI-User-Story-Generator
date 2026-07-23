'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import StoryCard, { type Story, type JiraConnectionSummary } from '@/components/StoryCard'
// Story type no longer includes jira_issues — removed from DB schema

type PageStatus = 'loading' | 'processing' | 'completed' | 'error'

export default function ReviewClient({
  inputId,
  defaultConnectionId,
  defaultProjectKey,
}: {
  inputId: string
  defaultConnectionId?: string
  defaultProjectKey?: string
}) {
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading')
  const [stories, setStories] = useState<Story[]>([])
  const [connections, setConnections] = useState<JiraConnectionSummary[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [rawText, setRawText] = useState('')
  const [showInput, setShowInput] = useState(false)

  // Fetch JIRA connections once on mount
  useEffect(() => {
    fetch('/api/jira/connections')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConnections(data)
      })
      .catch(() => {})
  }, [])

  // Fetch current status on mount, then subscribe to Realtime if still processing
  useEffect(() => {
    // `cancelled` guards against the StrictMode double-invoke race: the cleanup
    // runs before the async init() resolves, leaving channel=null and nothing to
    // remove. The second invocation then conflicts with the still-subscribed first
    // channel. Setting cancelled=true in cleanup causes the first async callback
    // to bail out before it ever creates the channel.
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: req, error } = await supabase
        .from('requirement_inputs')
        .select('status, raw_text')
        .eq('id', inputId)
        .single()

      if (cancelled) return

      if (error || !req) { setErrorMsg('Requirement not found.'); setPageStatus('error'); return }

      setRawText(req.raw_text ?? '')

      if (req.status === 'completed') { await loadStories(); return }
      if (req.status === 'error') {
        setErrorMsg('Story generation failed. Check n8n execution logs.')
        setPageStatus('error')
        return
      }

      setPageStatus('processing')
      channel = supabase
        .channel(`review-${inputId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'requirement_inputs', filter: `id=eq.${inputId}` },
          async (payload) => {
            const s = (payload.new as { status: string }).status
            if (s === 'completed') { await loadStories(); if (channel) supabase.removeChannel(channel) }
            if (s === 'error') {
              setErrorMsg('Story generation failed. Check n8n execution logs.')
              setPageStatus('error')
              if (channel) supabase.removeChannel(channel)
            }
          }
        )
        .subscribe()
    }

    init()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputId])

  async function loadStories() {
    const { data, error } = await supabase
      .from('generated_stories')
      .select('*')
      .eq('input_id', inputId)
      .order('created_at', { ascending: true })

    if (error) { setErrorMsg(error.message); setPageStatus('error'); return }
    setStories((data as Story[]) ?? [])
    setPageStatus('completed')
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Review User Stories</h1>
            {pageStatus === 'completed' && (
              <p className="mt-1 text-sm text-zinc-500">
                {stories.length} {stories.length === 1 ? 'story' : 'stories'} generated — review and push to JIRA.
              </p>
            )}
          </div>
          <a href="/" className="text-sm text-zinc-400 hover:text-foreground underline underline-offset-4">
            ← New requirement
          </a>
        </div>

        {/* Original requirement — collapsible */}
        {rawText && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <button
              onClick={() => setShowInput((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm text-zinc-500 hover:text-foreground transition-colors"
            >
              <span className="font-medium">Original Requirement</span>
              <span className="text-xs">{showInput ? '↑ Hide' : '↓ Show'}</span>
            </button>
            {showInput && (
              <div className="px-5 pb-4 border-t border-zinc-100 dark:border-zinc-800">
                <pre className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed max-h-52 overflow-y-auto">
                  {rawText}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Processing */}
        {pageStatus === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-24">
            <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-foreground animate-spin" />
            <p className="text-sm text-zinc-500">Generating user stories…</p>
          </div>
        )}

        {/* Initial load */}
        {pageStatus === 'loading' && (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 rounded-full border-2 border-zinc-200 border-t-foreground animate-spin" />
          </div>
        )}

        {/* Error */}
        {pageStatus === 'error' && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4">
            <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
          </div>
        )}

        {/* Stories */}
        {pageStatus === 'completed' && (
          <>
            {connections.length === 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-5 py-4 flex items-center justify-between">
                <p className="text-sm text-zinc-500">No JIRA connections configured yet.</p>
                <a href="/jira" className="text-sm font-medium text-foreground underline underline-offset-4">
                  Add connection →
                </a>
              </div>
            )}

            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                connections={connections}
                defaultConnectionId={defaultConnectionId}
                defaultProjectKey={defaultProjectKey}
              />
            ))}
          </>
        )}

      </div>
    </div>
  )
}
