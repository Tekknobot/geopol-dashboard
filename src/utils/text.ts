export function decodeHtmlEntities(value?: string | null): string {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanTextFields<T extends Record<string, any>>(item: T, fields: Array<keyof T>): T {
  const next = { ...item }
  for (const field of fields) {
    if (typeof next[field] === 'string') {
      next[field] = decodeHtmlEntities(next[field]) as T[keyof T]
    }
  }
  return next
}
