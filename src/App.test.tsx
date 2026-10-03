import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedMap } from './domain/seed'
import App from './App'
import { warmthColor } from './components/warmth'

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

/** Open a direction or goal from its card (the cards also hold the owner's small label buttons). */
function clickOverviewGoal(name: RegExp): void {
  const buttons = within(document.querySelector('.cluster-grid') as HTMLElement).getAllByRole('button', { name })
  fireEvent.click(buttons.find((button) => button.matches('.cluster-goal, .cluster-open')) as HTMLElement)
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

  it('shows the orientation and the three directions immediately, and no Frontier or Queue sections', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Soul' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Understand & Express/ })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Practical Agency/ })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Self-Mastery/ })[0]).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Three directions' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: /Active Frontier|Queue/ })).not.toBeInTheDocument()
    const create = document.querySelector('.cluster-card[data-tone="freedom"]') as HTMLElement
    expect(within(create).getByRole('button', { name: /^Professional autonomy/ })).toBeVisible()
    expect(screen.queryByText('Software / AI Engineering')).not.toBeInTheDocument()
  })

  it('zooms from a cluster into a goal without requiring extra fields', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Practical Agency/)
    fireEvent.click(screen.getByRole('button', { name: /Professional autonomy/ }))
    expect(screen.getByRole('heading', { name: 'Professional autonomy' })).toBeVisible()
    expect(screen.getByText(/stable professional and economic position/)).toBeVisible()
  })

  it('gives each page a history entry so the back gesture steps back one level', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Practical Agency/)
    expect(window.location.hash).toBe('#/goal/create')
    fireEvent.click(screen.getByRole('button', { name: /Professional autonomy/ }))
    expect(window.location.hash).toBe('#/goal/professional-autonomy')
    act(() => window.history.back())
    expect(await screen.findByRole('heading', { name: 'Practical Agency', level: 1 })).toBeVisible()
    act(() => window.history.back())
    expect(await screen.findByRole('heading', { name: 'Three directions' })).toBeVisible()
    expect(window.location.hash).toBe('')
    act(() => window.history.forward())
    expect(await screen.findByRole('heading', { name: 'Practical Agency', level: 1 })).toBeVisible()
  })

  it('keeps the page you left one step back after returning to the overview', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Practical Agency/)
    fireEvent.click(screen.getByRole('button', { name: 'Soul, return to overview' }))
    expect(window.location.hash).toBe('')
    expect(screen.getByRole('heading', { name: 'Three directions' })).toBeVisible()
    act(() => window.history.back())
    expect(await screen.findByRole('heading', { name: 'Practical Agency', level: 1 })).toBeVisible()
  })

  it('opens the page named by a link and treats unknown links as the overview', async () => {
    window.history.replaceState(null, '', '/#/goal/launch-blog')
    const first = render(<App />)
    expect(await screen.findByRole('heading', { name: 'Launch Blog', level: 1 })).toBeVisible()
    first.unmount()
    window.history.replaceState(null, '', '/#/goal/does-not-exist')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Soul', level: 1 })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Three directions' })).toBeVisible()
  })

  it('does not leave an archived goal behind in the history', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')
    clickOverviewGoal(/^Launch Blog/)
    expect(push).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: 'Three directions' })).toBeVisible()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('')
  })

  it('saves an edited goal through the explicit edit mode', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Write publicly' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: 'Write publicly' })).toBeVisible()
  })

  it('edits a direction\'s labels in place, without edit mode, keeping its protected identity', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Understand & Express' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
    fireEvent.change(screen.getByLabelText('New label'), { target: { value: '  Pray for others  ' } })
    fireEvent.keyDown(screen.getByLabelText('New label'), { key: 'Enter' })
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes.understand.title).toBe('Understand & Express')
    expect(saved.nodes.understand.parentId).toBe('soul')
    expect(saved.nodes.understand.labels).toEqual([
      { id: 'read-bible', text: 'Read Bible · Daily' },
      expect.objectContaining({ text: 'Pray for others' }),
    ])
  })

  it('edits a goal\'s own text, steps, and reminders in place with one save each', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^English C1/)
    fireEvent.click(within(screen.getByRole('heading', { level: 1 })).getByRole('button'))
    fireEvent.change(screen.getByLabelText('Edit name'), { target: { value: 'English C2' } })
    fireEvent.keyDown(screen.getByLabelText('Edit name'), { key: 'Enter' })
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(mocks.saveMap.mock.calls[0][0].nodes['english-c1'].title).toBe('English C2')
    expect(await screen.findByRole('heading', { name: 'English C2', level: 1 })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Discuss complex topics fluently: mark done' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(2))
    expect(mocks.saveMap.mock.calls[1][0].nodes['english-c1'].milestones[0].done).toBe(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove reminder Writing' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(3))
    expect(mocks.saveMap.mock.calls[2][0].nodes['english-c1'].reminders).toEqual(['Speaking practice', 'Grammar', 'Reading'])
  })

  it('adds a goal to a page with one line and clears the field', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Practical Agency' }))
    fireEvent.change(screen.getByLabelText('New goal'), { target: { value: 'Learn to sell' } })
    fireEvent.keyDown(screen.getByLabelText('New goal'), { key: 'Enter' })
    fireEvent.submit(screen.getByLabelText('New goal').closest('form') as HTMLFormElement)
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    const added = Object.values(saved.nodes as Record<string, { id: string; title: string; parentId: string }>).find((node) => node.title === 'Learn to sell')
    expect(added).toMatchObject({ parentId: 'create' })
    expect(saved.nodes.create.childrenIds).toContain(added?.id)
    expect(saved.frontier.some((entry: { nodeId: string }) => entry.nodeId === added?.id)).toBe(false)
    await waitFor(() => expect(screen.getByLabelText('New goal')).toHaveValue(''))
    expect(await screen.findByText('Learn to sell')).toBeVisible()
  })

  it('keeps what was typed and shows the error when an inline save fails', async () => {
    mocks.saveMap.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Practical Agency' }))
    fireEvent.change(screen.getByLabelText('New goal'), { target: { value: 'Learn to sell' } })
    fireEvent.submit(screen.getByLabelText('New goal').closest('form') as HTMLFormElement)
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(screen.getByLabelText('New goal')).toHaveValue('Learn to sell')
  })

  it('keeps the editor open and reports a failed save', async () => {
    mocks.saveMap.mockRejectedValueOnce(new Error('Map changed on another device'))
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Launch Blog/)
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
    clickOverviewGoal(/^Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(screen.getByRole('heading', { name: 'Launch Blog' })).toBeVisible()
  })

  it('prevents editing an offline copy', async () => {
    mocks.cached = true
    render(<App />)
    expect(await screen.findByText(/Offline copy/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Delete Launch Blog' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Priority of Launch Blog' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('New goal in Practical Agency')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add label to Soul' })).not.toBeInTheDocument()
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
    clickOverviewGoal(/^Launch Blog/)
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
    clickOverviewGoal(/^Launch Blog/)
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

  it('deletes an archived goal from its direction\'s Archive and stays on that page', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const map = createSeedMap()
    map.nodes['launch-blog'].archived = true
    map.frontier = map.frontier.filter((entry) => entry.nodeId !== 'launch-blog')
    act(() => { mocks.emitMap?.(map, false) })
    clickOverviewGoal(/^Understand & Express/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Launch Blog' }))
    expect(screen.getByRole('dialog', { name: 'Delete goal' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(mocks.saveMap.mock.calls[0][0].nodes['launch-blog']).toBeUndefined()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete goal' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Understand & Express', level: 1 })).toBeVisible()
    expect(window.location.hash).toBe('#/goal/understand')
  })

  it('keeps the delete dialog open and reports a failed delete', async () => {
    mocks.saveMap.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(screen.getByRole('dialog', { name: 'Delete goal' })).toBeVisible()
  })

  it('adds a goal right on a direction card in one save and clears the field', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    fireEvent.change(screen.getByLabelText('New goal in Practical Agency'), { target: { value: 'Learn welding' } })
    fireEvent.submit(screen.getByLabelText('New goal in Practical Agency').closest('form') as HTMLFormElement)
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    const added = Object.values(saved.nodes as Record<string, { id: string; title: string; parentId: string }>).find((node) => node.title === 'Learn welding')
    expect(added).toMatchObject({ parentId: 'create' })
    expect(saved.frontier.some((entry: { nodeId: string }) => entry.nodeId === added?.id)).toBe(false)
    await waitFor(() => expect(screen.getByLabelText('New goal in Practical Agency')).toHaveValue(''))
    expect(await screen.findByRole('button', { name: /^Learn welding/ })).toBeVisible()
  })

  it('labels a goal right on its card with one save', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    fireEvent.click(screen.getByRole('button', { name: 'Add label to Clear speech / writing' }))
    fireEvent.change(screen.getByLabelText('New label for Clear speech / writing'), { target: { value: '  Speak aloud · Daily  ' } })
    fireEvent.keyDown(screen.getByLabelText('New label for Clear speech / writing'), { key: 'Enter' })
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(mocks.saveMap.mock.calls[0][0].nodes['clear-speech-writing'].labels).toEqual([
      expect.objectContaining({ text: 'Speak aloud · Daily' }),
    ])
    expect(await screen.findByText('Speak aloud · Daily')).toBeVisible()
  })

  it('deletes a goal with one tap on its row on the overview, after a confirmation, and stays there', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Launch Blog' }))
    expect(screen.getByRole('dialog', { name: 'Delete goal' })).toHaveTextContent('Launch Blog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mocks.saveMap).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^Launch Blog/ })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Launch Blog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes['launch-blog']).toBeUndefined()
    expect(saved.nodes.understand.childrenIds).not.toContain('launch-blog')
    expect(saved.frontier.some((entry: { nodeId: string }) => entry.nodeId === 'launch-blog')).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete goal' })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^Launch Blog/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Three directions' })).toBeVisible()
    expect(window.location.hash).toBe('')
  })

  it('changes priority from the menu on a card, one save each: reorder, put in focus, send to the Queue', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const card = () => document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    const titles = () => [...card().querySelectorAll('.cluster-goal > span:first-child')].map((node) => node.textContent)
    expect(titles()).toEqual(['Launch Blog', 'English C1', 'Clear speech / writing', 'Philosophy / humanities'])

    fireEvent.click(within(card()).getByRole('button', { name: 'Priority of English C1' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Move up/ }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    expect(mocks.saveMap.mock.calls[0][0].frontier.map((entry: { nodeId: string }) => entry.nodeId).slice(0, 3))
      .toEqual(['professional-autonomy', 'english-c1', 'launch-blog'])
    await waitFor(() => expect(titles().slice(0, 2)).toEqual(['English C1', 'Launch Blog']))

    fireEvent.click(within(card()).getByRole('button', { name: 'Priority of Philosophy / humanities' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Move up/ }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(titles().slice(2)).toEqual(['Philosophy / humanities', 'Clear speech / writing']))

    fireEvent.click(within(card()).getByRole('button', { name: 'Priority of Philosophy / humanities' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Put in focus/ }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(3))
    expect(mocks.saveMap.mock.calls[2][0].frontier.find((entry: { nodeId: string }) => entry.nodeId === 'philosophy-humanities'))
      .toEqual({ nodeId: 'philosophy-humanities', status: 'active' })
    await waitFor(() => expect(titles()[2]).toBe('Philosophy / humanities'))

    fireEvent.click(within(card()).getByRole('button', { name: 'Priority of Clear speech / writing' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Move to the Queue/ }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(4))
    expect(mocks.saveMap.mock.calls[3][0].frontier.at(-1)).toEqual({ nodeId: 'clear-speech-writing', status: 'queued' })
    await waitFor(() => expect(titles()).not.toContain('Clear speech / writing'))
    expect(window.location.hash).toBe('')
  })

  it('refuses a sixth goal in focus with a message and changes nothing', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const map = createSeedMap()
    map.frontier = ['professional-autonomy', 'launch-blog', 'english-c1', 'own-products', 'attention-focus']
      .map((nodeId) => ({ nodeId, status: 'active' as const }))
    act(() => { mocks.emitMap?.(map, false) })
    fireEvent.click(screen.getByRole('button', { name: 'Priority of Clear speech / writing' }))
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toBeDisabled()
    expect(mocks.saveMap).not.toHaveBeenCalled()
  })

  it('adds a label to Soul right in the hero with one save', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    fireEvent.click(screen.getByRole('button', { name: 'Add label to Soul' }))
    fireEvent.change(screen.getByLabelText('New label for Soul'), { target: { value: '  Seek first  ' } })
    fireEvent.keyDown(screen.getByLabelText('New label for Soul'), { key: 'Enter' })
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes.soul.labels).toEqual([expect.objectContaining({ text: 'Seek first' })])
    expect(saved.nodes.soul.title).toBe('Soul')
    expect(saved.nodes.soul.childrenIds).toEqual(['understand', 'create', 'mastery'])
    expect(await screen.findByText('Seek first')).toBeVisible()
  })

  it('saves a direction\'s warmth with one tap and recolours its card, and clears it with a second tap', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const card = () => document.querySelector('.cluster-card[data-tone="freedom"]') as HTMLElement
    expect(card()).not.toHaveAttribute('data-warm')
    fireEvent.click(within(card()).getByRole('radio', { name: '8, Very Warm' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes.create.warmth).toBe(8)
    expect(saved.nodes.create.title).toBe('Practical Agency')
    expect(saved.nodes.understand.warmth).toBeUndefined()
    await waitFor(() => expect(card()).toHaveAttribute('data-warm'))
    expect(card().style.getPropertyValue('--tone')).toBe(warmthColor(8))
    expect(within(card()).getByRole('radio', { name: '8, Very Warm' })).toBeChecked()

    fireEvent.click(within(card()).getByRole('radio', { name: '8, Very Warm' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(2))
    expect('warmth' in mocks.saveMap.mock.calls[1][0].nodes.create).toBe(false)
    await waitFor(() => expect(card()).not.toHaveAttribute('data-warm'))
  })

  it('never moves a direction card when its warmth changes, in one column or side by side', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const titles = () => [...document.querySelectorAll('.cluster-open')].map((button) => button.textContent)
    const original = ['Self-Mastery', 'Practical Agency', 'Understand & Express']
    expect(titles()).toEqual(original)
    fireEvent.click(within(document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement).getByRole('radio', { name: '10, Very Warm' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    fireEvent.click(within(document.querySelector('.cluster-card[data-tone="freedom"]') as HTMLElement).getByRole('radio', { name: '0, Cold' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.querySelector('.cluster-card[data-tone="freedom"]')).toHaveAttribute('data-warm'))
    expect(titles()).toEqual(original)
    vi.unstubAllGlobals()
  })

  it('saves a goal\'s colour with two taps right on the overview, shows it, and clears it with a third', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    const dot = () => screen.getByRole('button', { name: 'Color of Launch Blog' }).querySelector('.goal-dot') as HTMLElement
    expect(dot()).toHaveAttribute('data-empty')
    fireEvent.click(screen.getByRole('button', { name: 'Color of Launch Blog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Teal' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    const saved = mocks.saveMap.mock.calls[0][0]
    expect(saved.nodes['launch-blog'].color).toBe('teal')
    expect(saved.nodes['launch-blog'].title).toBe('Launch Blog')
    expect(saved.nodes['english-c1'].color).toBeUndefined()
    await waitFor(() => expect(dot()).not.toHaveAttribute('data-empty'))
    expect(dot().style.getPropertyValue('--goal')).toBe('#1f9a98')

    fireEvent.click(screen.getByRole('button', { name: 'Color of Launch Blog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Teal' })) // the chosen colour again clears it
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(2))
    expect('color' in mocks.saveMap.mock.calls[1][0].nodes['launch-blog']).toBe(false)
    await waitFor(() => expect(dot()).toHaveAttribute('data-empty'))
  })

  it('keeps a goal\'s colour when the goal is merged away or archived', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    fireEvent.click(screen.getByRole('button', { name: 'Color of English C1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gold' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(1))
    clickOverviewGoal(/^English C1/)
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(mocks.saveMap).toHaveBeenCalledTimes(2))
    expect(mocks.saveMap.mock.calls[1][0].nodes['english-c1']).toMatchObject({ archived: true, color: 'gold' })
  })

  it('rejects a stale editor draft after a remote map revision arrives', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Launch Blog/)
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
    await screen.findByRole('heading', { name: 'Soul' })
    clickOverviewGoal(/^Launch Blog/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    act(() => { mocks.emitMap?.(createSeedMap(), true) })
    expect(await screen.findByText(/Offline copy/)).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })
})
