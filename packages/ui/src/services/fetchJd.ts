import { supabase } from '@odie/db'

export function isUrl(input: string): boolean {
  const trimmed = input.trim()
  return (
    (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
    !trimmed.includes('\n')
  )
}

export async function fetchJdText(url: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('fetch-jd', {
    body: { url },
  })
  if (error) throw new Error(error.message ?? 'Failed to fetch job description')
  if (data?.error) throw new Error(data.error)
  return data.text as string
}
