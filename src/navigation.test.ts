import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSelection, writeSelection } from './navigation'

describe('page navigation in the URL hash', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('reads the page id from a goal link', () => {
    expect(readSelection('#/goal/launch-blog')).toBe('launch-blog')
    expect(readSelection('#/goal/two%20words')).toBe('two words')
  })

  it('treats anything else as the overview', () => {
    expect(readSelection('')).toBeNull()
    expect(readSelection('#/other/launch-blog')).toBeNull()
    expect(readSelection('#/goal/')).toBeNull()
    expect(readSelection('#/goal/soul')).toBeNull()
    expect(readSelection('#/goal/%E0%A4%A')).toBeNull()
  })

  it('reads the live location by default', () => {
    window.history.replaceState(null, '', '/#/goal/create')
    expect(readSelection()).toBe('create')
  })

  it('pushes or replaces a history entry for a page', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')
    writeSelection('two words')
    expect(push).toHaveBeenCalledWith(null, '', '#/goal/two%20words')
    writeSelection('create', 'replace')
    expect(replace).toHaveBeenCalledWith(null, '', '#/goal/create')
  })

  it('returns to the overview without a hash and keeps the path', () => {
    window.history.replaceState(null, '', '/soul/?x=1#/goal/create')
    writeSelection(null)
    expect(window.location.pathname).toBe('/soul/')
    expect(window.location.search).toBe('?x=1')
    expect(window.location.hash).toBe('')
  })
})
