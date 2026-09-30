import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedMap } from './domain/seed'
import App from './App'

const mocks = vi.hoisted(() => ({
  saveMap: vi.fn(),
  signInOwner: vi.fn(),
  signOutOwner: vi.fn(),
  cached: false,
  owner: true,
  emitMap: null as null | ((map: ReturnType<typeof createSeedMap>, fromCache: boolean) => void),
}))

vi.mock('./data/firebase', () => ({
  firebaseConfigured: true,
  subscribeToMap: (onMap: (map: ReturnType<typeof createSeedMap>, fromCache: boolean) => void) => {
    mocks.emitMap = onMap
    onMap(createSeedMap(), mocks.cached)
    return () => undefined
  },
  subscribeToOwner: (onUser: (user: { uid: string } | null) => void) => {
    onUser(mocks.owner ? { uid: 'owner' } : null)
    return () => undefined
  },
  isOwner: () => mocks.owner,
  saveMap: mocks.saveMap,
  signInOwner: mocks.signInOwner,
  signOutOwner: mocks.signOutOwner,
  MapConflictError: class extends Error {},
}))

function clickOverviewGoal(name: RegExp): void {
  fireEvent.click(within(document.querySelector('.cluster-grid') as HTMLElement).getByRole('button', { name }))
}

describe('Soul compass', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    mocks.cached = false
    mocks.owner = true
    mocks.emitMap = null
    mocks.saveMap.mockReset()
    mocks.saveMap.mockImplementation(async (map) => ({ ...map, revision: map.revision + 1 }))
    mocks.signInOwner.mockReset()
    mocks.signOutOwner.mockReset()
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('shows the orientation, three clusters, and active frontier immediately', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Soul' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Understand & Express/ })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Create & Be Free/ })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Self-Mastery/ })[0]).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    expect(within(document.querySelector('.frontier-section') as HTMLElement).getByRole('button', { name: /Lead focus.*Professional autonomy/ })).toBeVisible()
  })

  it('zooms from a cluster into a goal without requiring extra fields', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Create & Be Free/)
    fireEvent.click(screen.getByRole('button', { name: /Professional autonomy/ }))
    expect(screen.getByRole('heading', { name: 'Professional autonomy' })).toBeVisible()
    expect(screen.getByText(/stable professional and economic position/)).toBeVisible()
  })

  it('gives each page a history entry so the back gesture steps back one level', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Create & Be Free/)
    expect(window.location.hash).toBe('#/goal/create')
    fireEvent.click(screen.getByRole('button', { name: /Professional autonomy/ }))
    expect(window.location.hash).toBe('#/goal/professional-autonomy')
    act(() => window.history.back())
    expect(await screen.findByRole('heading', { name: 'Create & Be Free', level: 1 })).toBeVisible()
    act(() => window.history.back())
    expect(await screen.findByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    expect(window.location.hash).toBe('')
    act(() => window.history.forward())
    expect(await screen.findByRole('heading', { name: 'Create & Be Free', level: 1 })).toBeVisible()
  })

  it('keeps the page you left one step back after returning to the overview', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Create & Be Free/)
    fireEvent.click(screen.getByRole('button', { name: 'Soul, return to overview' }))
    expect(window.location.hash).toBe('')
    expect(screen.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    act(() => window.history.back())
    expect(await screen.findByRole('heading', { name: 'Create & Be Free', level: 1 })).toBeVisible()
  })

  it('opens the page named by a link and treats unknown links as the overview', async () => {
    window.history.replaceState(null, '', '/#/goal/launch-blog')
    const first = render(<App />)
    expect(await screen.findByRole('heading', { name: 'Launch Blog', level: 1 })).toBeVisible()
    first.unmount()
    window.history.replaceState(null, '', '/#/goal/does-not-exist')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Soul', level: 1 })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
  })

  it('does not leave an archived goal behind in the history', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')
    clickOverviewGoal(/Launch Blog/)
    expect(push).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('')
  })

  it('saves an edited goal through the explicit edit mode', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Write publicly' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: 'Write publicly' })).toBeVisible()
  })

  it('edits a direction\'s labels without changing its protected identity', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Understand & Express' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
    fireEvent.change(screen.getByLabelText('Label 2'), { target: { value: '  Pray for others  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save labels' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes.understand.title).toBe('Understand & Express')
    expect(saved.nodes.understand.parentId).toBe('soul')
    expect(saved.nodes.understand.labels).toEqual([
      { id: 'read-bible', text: 'Read Bible · Daily' },
      expect.objectContaining({ text: 'Pray for others' }),
    ])
  })

  it('keeps the editor open and reports a failed save', async () => {
    mocks.saveMap.mockRejectedValueOnce(new Error('Map changed on another device'))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Write publicly' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Launch Blog' })).toBeVisible()
  })

  it('preserves focus when archiving fails', async () => {
    mocks.saveMap.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(screen.getByRole('heading', { name: 'Launch Blog' })).toBeVisible()
  })

  it('prevents editing an offline copy', async () => {
    mocks.cached = true
    render(<App />)
    expect(await screen.findByText(/Offline copy/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows a sign-in error inside the owner dialog', async () => {
    mocks.owner = false
    mocks.signInOwner.mockRejectedValueOnce(new Error('Wrong credentials'))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Owner sign in' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'incorrect' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(screen.getByRole('dialog')).toHaveTextContent('Wrong credentials')
  })

  it('moves a goal to the Queue through a revision-checked save', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'queue' } })
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(mocks.saveMap.mock.calls[0][0].frontier).toEqual([
      { nodeId: 'professional-autonomy', status: 'active' },
      { nodeId: 'english-c1', status: 'active' },
      { nodeId: 'theology-scripture', status: 'queued' },
      { nodeId: 'software-ai', status: 'queued' },
      { nodeId: 'launch-blog', status: 'queued' },
    ])
  })

  it('deletes a goal only after confirmation and returns to its direction', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mocks.saveMap).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Launch Blog', level: 1 })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes['launch-blog']).toBeUndefined()
    expect(saved.nodes.understand.childrenIds).not.toContain('launch-blog')
    expect(saved.frontier.some((entry: { nodeId: string }) => entry.nodeId === 'launch-blog')).toBe(false)
    expect(await screen.findByRole('heading', { name: 'Understand & Express', level: 1 })).toBeVisible()
    expect(window.location.hash).toBe('#/goal/understand')
  })

  it('deletes a queued goal from the overview and stays there', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Theology / Scripture' }))
    expect(screen.getByRole('dialog', { name: 'Delete goal' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(mocks.saveMap.mock.calls[0][0].nodes['theology-scripture']).toBeUndefined()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete goal' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    expect(window.location.hash).toBe('')
  })

  it('keeps the delete dialog open and reports a failed delete', async () => {
    mocks.saveMap.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Software / AI Engineering' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(screen.getByRole('dialog', { name: 'Delete goal' })).toBeVisible()
  })

  it('adds a new goal to the Queue under a chosen direction in one save', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Add to the queue'), { target: { value: 'Read more' } })
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'create' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    const added = saved.frontier.at(-1)
    expect(added.status).toBe('queued')
    expect(saved.nodes[added.nodeId]).toMatchObject({ title: 'Read more', parentId: 'create' })
    expect(saved.nodes.create.childrenIds).toContain(added.nodeId)
    await waitFor(() => expect(screen.getByLabelText('Add to the queue')).toHaveValue(''))
  })

  it('rejects a stale editor draft after a remote map revision arrives', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Write publicly' } })
    const remote = createSeedMap()
    remote.revision = 1
    remote.nodes['launch-blog'] = { ...remote.nodes['launch-blog'], note: 'Changed on another device' }
    act(() => { mocks.emitMap?.(remote, false) })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(await screen.findByText(/map changed while this editor was open/i)).toBeVisible()
    expect(mocks.saveMap).not.toHaveBeenCalled()
  })

  it('closes editing controls when the map switches to an offline copy', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    act(() => { mocks.emitMap?.(createSeedMap(), true) })
    expect(await screen.findByText(/Offline copy/)).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })
})
