import ReviewClient from './ReviewClient'

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ input_id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { input_id } = await params
  const sp = await searchParams
  const connectionId = typeof sp.connectionId === 'string' ? sp.connectionId : undefined
  const projectKey = typeof sp.projectKey === 'string' ? sp.projectKey : undefined
  return <ReviewClient inputId={input_id} defaultConnectionId={connectionId} defaultProjectKey={projectKey} />
}
