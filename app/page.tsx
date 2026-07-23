'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type ConnectionOption = { id: string; name: string; jira_domain: string }
type ProjectOption = { key: string; name: string }
type EpicOption = { key: string; summary: string }
type SprintInfo = { name: string; startDate?: string; endDate?: string }

const PERSONAS = ['End user', 'Admin', 'Guest', 'API client', 'DevOps']
const PRIORITIES = ['Must have', 'Should have', 'Could have']
const ACCEPTED_EXTS = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.xml', '.rst'])

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-violet-600' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">{children}</span>
    </div>
  )
}

export default function Home() {
  const router = useRouter()

  const [mode, setMode] = useState<'paste' | 'form'>('form')

  // Paste mode
  const [input, setInput] = useState('')
  const [fileChips, setFileChips] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Structured form mode
  const [formFeature, setFormFeature] = useState('')
  const [formGoal, setFormGoal] = useState('')
  const [formContext, setFormContext] = useState('')

  // Shared
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [error, setError] = useState('')

  // Jira
  const [jiraEnabled, setJiraEnabled] = useState(false)
  const [connections, setConnections] = useState<ConnectionOption[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProjectKey, setSelectedProjectKey] = useState('')
  const [epics, setEpics] = useState<EpicOption[]>([])
  const [loadingEpics, setLoadingEpics] = useState(false)
  const [selectedEpicKey, setSelectedEpicKey] = useState('')
  const [activeSprint, setActiveSprint] = useState<SprintInfo | null>(null)

  // Context (shared)
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>(['End user'])
  const [selectedPriority, setSelectedPriority] = useState('Must have')
  const [complexity, setComplexity] = useState(50)
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(true)
  const [bddFormat, setBddFormat] = useState(false)
  const [edgeCases, setEdgeCases] = useState(true)
  const [storyPointEstimate, setStoryPointEstimate] = useState(true)

  useEffect(() => {
    if (!jiraEnabled || connections.length > 0) return
    setLoadingConnections(true)
    fetch('/api/jira/connections')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConnections(data) })
      .finally(() => setLoadingConnections(false))
  }, [jiraEnabled, connections.length])

  useEffect(() => {
    if (jiraEnabled && connections.length === 1 && !selectedConnectionId)
      setSelectedConnectionId(connections[0].id)
  }, [jiraEnabled, connections, selectedConnectionId])

  useEffect(() => {
    if (!selectedConnectionId) { setProjects([]); setSelectedProjectKey(''); return }
    setLoadingProjects(true)
    fetch(`/api/jira/projects?connectionId=${selectedConnectionId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProjects(data) })
      .finally(() => setLoadingProjects(false))
  }, [selectedConnectionId])

  useEffect(() => {
    if (!selectedConnectionId || !selectedProjectKey) {
      setEpics([]); setSelectedEpicKey(''); setActiveSprint(null); return
    }
    setLoadingEpics(true)
    const qs = `connectionId=${selectedConnectionId}&projectKey=${selectedProjectKey}`
    Promise.all([
      fetch(`/api/jira/epics?${qs}`).then((r) => r.json()),
      fetch(`/api/jira/sprint?${qs}`).then((r) => r.json()),
    ]).then(([epicsData, sprintData]) => {
      if (Array.isArray(epicsData)) setEpics(epicsData)
      setActiveSprint(sprintData?.name ? sprintData : null)
    }).finally(() => setLoadingEpics(false))
  }, [selectedConnectionId, selectedProjectKey])

  function togglePersona(p: string) {
    setSelectedPersonas((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  function handleJiraToggle() {
    setJiraEnabled((v) => {
      if (v) { setSelectedConnectionId(''); setSelectedProjectKey(''); setSelectedEpicKey(''); setActiveSprint(null) }
      return !v
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
      if (!ACCEPTED_EXTS.has(ext)) continue
      const text = await file.text()
      setInput((prev) => {
        const trimmed = prev.trimEnd()
        return trimmed ? `${trimmed}\n\n--- ${file.name} ---\n${text}` : text
      })
      setFileChips((prev) => [...prev, file.name])
    }
    e.target.value = ''
  }

  async function handleGenerate() {
    const resolvedInput =
      mode === 'paste'
        ? input.trim()
        : [
            formFeature && `Feature: ${formFeature}`,
            formGoal && `Goal:\n${formGoal}`,
            formContext && `Additional context:\n${formContext}`,
          ].filter(Boolean).join('\n\n')

    if (!resolvedInput) return
    setStatus('submitting')
    setError('')

    try {
      const body: Record<string, unknown> = {
        input: resolvedInput,
        personas: selectedPersonas,
        priority: selectedPriority,
        complexity,
        story_options: {
          acceptance_criteria: acceptanceCriteria,
          bdd_format: bddFormat,
          edge_cases: edgeCases,
          story_point_estimate: storyPointEstimate,
        },
      }

      if (jiraEnabled && selectedConnectionId && selectedProjectKey) {
        body.jira_connection_id = selectedConnectionId
        body.jira_project_key = selectedProjectKey
        if (selectedEpicKey) body.jira_epic_key = selectedEpicKey
        if (activeSprint) body.sprint_name = activeSprint.name
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setStatus('error'); return }
      const qs = jiraEnabled && selectedConnectionId && selectedProjectKey
        ? `?connectionId=${encodeURIComponent(selectedConnectionId)}&projectKey=${encodeURIComponent(selectedProjectKey)}`
        : ''
      router.push(`/review/${data.input_id}${qs}`)
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  const canGenerate =
    status !== 'submitting' &&
    selectedPersonas.length > 0 &&
    (mode === 'paste' ? !!input.trim() : !!formGoal.trim())

  const storyOptionRows = [
    { label: 'Acceptance criteria', value: acceptanceCriteria, set: setAcceptanceCriteria },
    { label: 'BDD format (Given/When/Then)', value: bddFormat, set: setBddFormat },
    { label: 'Edge cases', value: edgeCases, set: setEdgeCases },
    { label: 'Story point estimate', value: storyPointEstimate, set: setStoryPointEstimate },
  ] as const

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-950">
      <div className="max-w-3xl mx-auto px-10 py-10 flex flex-col gap-6">

        {/* Page header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white">Story Forge</h1>
          <p className="mt-2 text-base text-zinc-400 leading-relaxed">
            Paste your technical requirements or brain-dump below. Our AI will forge
            structured, production-ready user stories.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 self-start p-1 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
          {(['paste', 'form'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setStatus('idle'); setError('') }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === m ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m === 'paste' ? 'Paste text / Upload file' : 'Structured form'}
            </button>
          ))}
        </div>

        {/* ── Paste / Upload input ── */}
        {mode === 'paste' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,.csv,.json,.yaml,.yml,.xml,.rst"
              onChange={handleFileChange}
              className="sr-only"
            />
            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Users should be able to log in with OAuth. We need validation for email format and a 'forgot password' flow…"
                rows={8}
                className="w-full bg-transparent px-5 py-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none"
              />

              {fileChips.length > 0 && (
                <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-zinc-800">
                  {fileChips.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                      <svg className="h-3 w-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      {name}
                    </span>
                  ))}
                </div>
              )}

              <div className="border-t border-zinc-800 px-4 py-3 flex items-center gap-4">
                <button type="button" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4l3 3" />
                  </svg>
                  Recent
                </button>
                <button type="button" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.5 5h5.5l-4.5 4 1.5 5.5L12 14.5 7 17.5l1.5-5.5L4 8h5.5z" />
                  </svg>
                  Templates
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  Attach
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Structured form inputs ── */}
        {mode === 'form' && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Feature name</label>
              <input
                value={formFeature}
                onChange={(e) => setFormFeature(e.target.value)}
                placeholder="e.g. OAuth login, Password reset flow…"
                className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Goal / requirements <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formGoal}
                onChange={(e) => setFormGoal(e.target.value)}
                placeholder="Describe what needs to be built and why. What should a user be able to do?"
                rows={5}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Additional context{' '}
                <span className="text-zinc-600 normal-case font-normal tracking-normal">— optional</span>
              </label>
              <textarea
                value={formContext}
                onChange={(e) => setFormContext(e.target.value)}
                placeholder="Constraints, existing systems, edge cases to consider…"
                rows={3}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              />
            </div>
          </div>
        )}

        {/* ── Context grid (always visible) ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Persona */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <SectionLabel icon={
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            }>Persona</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map((p) => (
                <button key={p} type="button" onClick={() => togglePersona(p)} className={pillClass(selectedPersonas.includes(p))}>{p}</button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <SectionLabel icon={
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M10 18h4" />
              </svg>
            }>Priority</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button key={p} type="button" onClick={() => setSelectedPriority(p)} className={pillClass(selectedPriority === p)}>{p}</button>
              ))}
            </div>
          </div>

          {/* Complexity */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <SectionLabel icon={
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              }>Complexity</SectionLabel>
              <span className="text-xs font-semibold text-violet-400">{complexity}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={complexity}
              onChange={(e) => setComplexity(Number(e.target.value))}
              className="w-full accent-violet-600 h-1.5 cursor-pointer"
            />
            <div className="flex justify-between -mt-1">
              <span className="text-[10px] text-zinc-600">SIMPLE</span>
              <span className="text-[10px] text-zinc-600">COMPLEX</span>
            </div>
          </div>

          {/* Story Options */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <SectionLabel icon={
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4l3 3" />
              </svg>
            }>Story Options</SectionLabel>
            {storyOptionRows.map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">{label}</span>
                <Toggle checked={value} onChange={set} />
              </div>
            ))}
          </div>
        </div>

        {/* Jira (shown when enabled, below context grid) */}
        {jiraEnabled && (
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Project</span>
              {loadingConnections ? (
                <p className="text-xs text-zinc-500">Loading…</p>
              ) : connections.length === 0 ? (
                <p className="text-xs text-zinc-500">No connections. <a href="/jira" className="underline underline-offset-2 hover:text-zinc-200">Add one →</a></p>
              ) : (
                <div className="flex flex-col gap-2">
                  {connections.length > 1 && (
                    <select value={selectedConnectionId} onChange={(e) => { setSelectedConnectionId(e.target.value); setSelectedProjectKey('') }} className={selectClass}>
                      <option value="">Select connection…</option>
                      {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <select value={selectedProjectKey} onChange={(e) => setSelectedProjectKey(e.target.value)} disabled={!selectedConnectionId || loadingProjects} className={selectClass}>
                    <option value="">{loadingProjects ? 'Loading…' : 'Select project…'}</option>
                    {projects.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {selectedProjectKey && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Epic</span>
                {loadingEpics ? <p className="text-xs text-zinc-500">Loading…</p> : epics.length === 0 ? (
                  <p className="text-xs text-zinc-500">No epics found</p>
                ) : (
                  <select value={selectedEpicKey} onChange={(e) => setSelectedEpicKey(e.target.value)} className={selectClass}>
                    <option value="">No epic</option>
                    {epics.map((e) => <option key={e.key} value={e.key}>{e.summary}</option>)}
                  </select>
                )}
              </div>
            )}
            {activeSprint && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Sprint</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 text-xs font-medium">
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 4a.75.75 0 0 1 .75.75v3.5l2.25 1.3a.75.75 0 1 1-.75 1.3L7.625 9.34A.75.75 0 0 1 7.25 8.75v-4A.75.75 0 0 1 8 4z" />
                    </svg>
                    {activeSprint.name}
                  </span>
                  {activeSprint.startDate && activeSprint.endDate && (
                    <span className="text-xs text-zinc-500">{formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom bar: Jira toggle + Generate */}
        <div className="flex items-center justify-between pb-6">
          <button
            onClick={handleJiraToggle}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              jiraEnabled
                ? 'border-violet-500 text-violet-400 bg-violet-500/10'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35H17.5v1.61c0 2.4 1.94 4.34 4.35 4.35V2.92a.92.92 0 0 0-.92-.92H11.53zM6.77 6.8a4.362 4.362 0 0 0 4.35 4.35h1.6v1.62a4.362 4.362 0 0 0 4.35 4.35V7.72a.92.92 0 0 0-.92-.92H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.61v1.61C7.96 19.97 9.9 21.9 12.32 22v-9.1a.92.92 0 0 0-.92-.92L2 11.6z" />
            </svg>
            Jira
          </button>

          <div className="flex items-center gap-3">
            {status === 'error' && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex items-center gap-2 h-10 px-6 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'submitting' ? 'Generating…' : 'Generate'}
              {status !== 'submitting' && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}

const selectClass =
  'h-9 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50'

function pillClass(active: boolean) {
  return `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
    active
      ? 'bg-violet-600 border-violet-600 text-white'
      : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
  }`
}
