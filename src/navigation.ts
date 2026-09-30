/**
 * The open page lives in the URL hash (`#/goal/<id>`), so the system back gesture
 * steps back one page instead of leaving the app, and a goal can be linked to.
 * The overview has no hash. A hash works on GitHub Pages and with the PWA's
 * service worker because the server never sees it.
 */
import { ROOT_ID } from './domain/types'

const PREFIX = '#/goal/'

export type NavigationMode = 'push' | 'replace'

export function readSelection(hash: string = window.location.hash): string | null {
  if (!hash.startsWith(PREFIX)) return null
  try {
    const id = decodeURIComponent(hash.slice(PREFIX.length))
    return id && id !== ROOT_ID ? id : null
  } catch {
    return null
  }
}

export function writeSelection(id: string | null, mode: NavigationMode = 'push'): void {
  const url = id ? `${PREFIX}${encodeURIComponent(id)}` : `${window.location.pathname}${window.location.search}`
  if (mode === 'replace') window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
}
