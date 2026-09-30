import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    mocks.cached = false
    mocks.owner = true
    mocks.emitMap = null
    mocks.saveMap.mockReset()
    mocks.saveMap.mockImplementation(async (map) => ({ ...map, revision: map.revision + 1 }))
    mocks.signInOwner.mockReset()
    mocks.signOutOwner.mockReset()
  })

  it('shows the orientation, three clusters, and active frontier immediately', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Soul' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Understand & Express/ })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Create & Be Free/ })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Self-Mastery/ })[0]).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    expect(within(document.querySelector('.frontier-section') as HTMLElement).getByRole('button', { name: /Professional autonomy/ })).toBeVisible()
  })

  it('zooms from a cluster into a goal without requiring extra fields', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Create & Be Free/)
    fireEvent.click(screen.getByRole('button', { name: /Professional autonomy/ }))
    expect(screen.getByRole('heading', { name: 'Professional autonomy' })).toBeVisible()
    expect(screen.getByText(/stable professional and economic position/)).toBeVisible()
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

  it('edits a direction Routine without changing its protected identity', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Understand & Express' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit routine' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add routine' }))
    fireEvent.change(screen.getByLabelText('Routine title 2'), { target: { value: '  Pray for others  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes.understand.title).toBe('Understand & Express')
    expect(saved.nodes.understand.parentId).toBe('soul')
    expect(saved.nodes.understand.routines).toEqual([
      { id: 'read-bible', title: 'Read Bible', cadence: 'Daily' },
      expect.objectContaining({ title: 'Pray for others', cadence: undefined }),
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

  it('updates Frontier status through a revision-checked save', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Frontier status'), { target: { value: '' } })
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(mocks.saveMap.mock.calls[0][0].frontier.some((entry: { nodeId: string }) => entry.nodeId === 'launch-blog')).toBe(false)
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
