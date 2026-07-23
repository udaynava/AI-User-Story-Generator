import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const { story_id, input_id, review_comment } = await request.json()

  if (!story_id || !input_id || !review_comment?.trim()) {
    return Response.json(
      { error: 'story_id, input_id, and review_comment are required' },
      { status: 400 }
    )
  }

  const webhookUrl = process.env.N8N_REGENERATE_STORY_URL
  if (!webhookUrl) {
    return Response.json({ error: 'N8N_REGENERATE_STORY_URL is not configured' }, { status: 500 })
  }

  const [reqResult, storiesResult] = await Promise.all([
    supabase.from('requirement_inputs').select('raw_text').eq('id', input_id).single(),
    supabase.from('generated_stories').select('*').eq('input_id', input_id).order('created_at', { ascending: true }),
  ])

  if (reqResult.error || !reqResult.data) {
    return Response.json({ error: 'Requirement input not found' }, { status: 404 })
  }

  const allStories = storiesResult.data ?? []
  const targetStory = allStories.find((s) => s.id === story_id)
  if (!targetStory) {
    return Response.json({ error: 'Story not found' }, { status: 404 })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story_id,
        input_id,
        raw_text: reqResult.data.raw_text,
        story: targetStory,
        all_stories: allStories,
        review_comment: review_comment.trim(),
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        requesty_api_key: process.env.REQUESTY_API_KEY,
      }),
      signal: AbortSignal.timeout(90_000),
    })

    const data = await res.json()
    if (!res.ok) {
      return Response.json({ error: data.error || 'Workflow failed' }, { status: 500 })
    }

    return Response.json({ story: data.story })
  } catch {
    return Response.json({ error: 'Failed to reach regenerate-story workflow' }, { status: 500 })
  }
}
