export function normalizeExternalUrl(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return '#'

  // decode a few common HTML encodings first
  const decoded = value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .trim()

  // protocol-relative URL
  if (decoded.startsWith('//')) return `https:${decoded}`

  try {
    const url = new URL(decoded)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
    return '#'
  } catch {
    // tolerate naked domains like example.com/path
    try {
      const url = new URL(`https://${decoded.replace(/^\/+/, '')}`)
      return url.toString()
    } catch {
      return '#'
    }
  }
}
