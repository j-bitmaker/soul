import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedMap } from '../domain/seed'
import type { GoalMap } from '../domain/types'
import { CompassView, type CompassViewProps } from './CompassView'
import { warmthColor } from './warmth'

function props(map: GoalMap = createSeedMap()): CompassViewProps {
  return {
    map, selectedId: null, canEdit: true,
    onSelect: vi.fn(), onOpenEditor: vi.fn(),
    onPlace: vi.fn(), onShift: vi.fn(), onEditNode: vi.fn(async () => true), onAddGoal: vi.fn(async () => true),
    onArchive: vi.fn(), onRestore: vi.fn(), onOpenMerge: vi.fn(), onDelete: vi.fn(),
    onExport: vi.fn(), onImport: vi.fn(), onSignIn: vi.fn(), onSignOut: vi.fn(),
  }
}

function mapWithHiddenAndArchived(): GoalMap {
  const map = structuredClone(createSeedMap())
  map.nodes.understand.childrenIds.push('extra-goal', 'old-goal')
  map.nodes.understand.visibleChildIds = map.nodes.understand.visibleChildIds.slice(0, 4)
  map.nodes['extra-goal'] = { id: 'extra-goal', title: 'Another thought', parentId: 'understand', childrenIds: [], visibleChildIds: [], secondaryIds: [] }
  map.nodes['old-goal'] = { id: 'old-goal', title: 'Former focus', parentId: 'understand', childrenIds: [], visibleChildIds: [], secondaryIds: [], archived: true }
  return map
}

describe('CompassView', () => {
  it('keeps the overview to Soul and the three directions, without Active Frontier or Queue sections', () => {
    const view = props()
    render(<CompassView {...view} />)
    expect(screen.getByRole('heading', { name: 'Soul' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Understand & Express' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Practical Agency' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Self-Mastery' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Three directions' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: /Active Frontier|Queue/ })).not.toBeInTheDocument()
    expect(document.querySelector('.frontier-section, .queue-section, .frontier-lead')).toBeNull()
    expect(screen.queryByText(/0[1-3] \/ 03/)).not.toBeInTheDocument()
    expect(document.querySelector('.frontier-status')).toBeNull()
    expect(screen.queryByText(/^(primary|active|maintain)$/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Practical Agency' }))
    expect(view.onSelect).toHaveBeenCalledWith('create')
  })

  it('states what Soul means and gives each direction its own description', () => {
    const rendered = render(<CompassView {...props()} />)
    expect(screen.getByText('Unity with God. Life in the Holy Spirit, truth and conscience.')).toBeVisible()
    expect(screen.getByText('Create useful things, sustain yourself, and preserve freedom of choice.')).toBeVisible()
    const map = createSeedMap()
    delete map.nodes.soul.description
    rendered.rerender(<CompassView {...props(map)} />)
    expect(screen.getByText('The orientation above every goal.')).toBeVisible()
  })

  it('offers the owner an explicit Delete on goal pages and archived rows, and visitors none', () => {
    const view = { ...props(mapWithHiddenAndArchived()), selectedId: 'understand' }
    const rendered = render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Former focus' }))
    expect(view.onDelete).toHaveBeenCalledWith('old-goal')
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} selectedId="launch-blog" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(view.onDelete).toHaveBeenCalledWith('launch-blog')
    rendered.rerender(<CompassView {...view} selectedId={null} />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} selectedId="understand" canEdit={false} />)
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} selectedId="launch-blog" canEdit={false} />)
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} selectedId="create" />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('lets the owner delete a goal with one tap on its row on the overview, and shows visitors nothing', () => {
    const view = props()
    const rendered = render(<CompassView {...view} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    const rows = [...card.querySelectorAll('.cluster-goals li')]
    expect(rows).toHaveLength(4)
    for (const row of rows) expect(row.querySelectorAll('.cluster-goal-delete')).toHaveLength(1)
    fireEvent.click(within(card).getByRole('button', { name: 'Delete Launch Blog' }))
    expect(view.onDelete).toHaveBeenCalledWith('launch-blog')
    fireEvent.click(within(card).getByRole('button', { name: 'Delete Philosophy / humanities' }))
    expect(view.onDelete).toHaveBeenLastCalledWith('philosophy-humanities')
    expect(view.onSelect).not.toHaveBeenCalled()
    // directions themselves cannot be deleted
    expect(screen.queryByRole('button', { name: /^Delete (Understand|Practical|Self)/ })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    expect(document.querySelector('.cluster-goals.owner')).toBeNull()
  })

  it('does not delete while a save is in progress', () => {
    const view = { ...props(), busy: true }
    render(<CompassView {...view} />)
    expect(screen.getByRole('button', { name: 'Delete Launch Blog' })).toBeDisabled()
  })

  it('marks goals in focus on direction cards and leaves queued goals off the overview', () => {
    const rendered = render(<CompassView {...props()} canEdit={false} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    const launch = within(card).getByRole('button', { name: /^Launch Blog/ })
    expect(launch.querySelector('.lane-mark')).toHaveAttribute('data-lane', 'active')
    expect(launch).toHaveTextContent('In focus')
    expect(within(card).queryByRole('button', { name: /^Theology/ })).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /^Philosophy/ }).querySelector('.lane-mark')).toBeNull()
    expect(document.querySelector('.lane-mark[data-lane="queue"]')).toBeNull()
    expect(screen.queryByText('Theology / Scripture')).not.toBeInTheDocument()
    expect(screen.queryByText('Software / AI Engineering')).not.toBeInTheDocument()
    // the owner gets the same marker as a button that opens the priority menu
    rendered.rerender(<CompassView {...props()} />)
    expect(within(card).getByRole('button', { name: 'Priority of Launch Blog' }).querySelector('.lane-mark')).toHaveAttribute('data-lane', 'active')
    expect(within(card).getByRole('button', { name: 'Priority of Philosophy / humanities' }).querySelector('.lane-mark')).not.toHaveAttribute('data-lane')
  })

  it('lets the owner change a goal\'s priority from the menu on its row', () => {
    const view = props()
    render(<CompassView {...view} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    const open = (title: string) => fireEvent.click(within(card).getByRole('button', { name: `Priority of ${title}` }))

    open('Clear speech / writing')
    fireEvent.click(screen.getByRole('menuitem', { name: /Put in focus/ }))
    expect(view.onPlace).toHaveBeenLastCalledWith('clear-speech-writing', 'active')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    open('Launch Blog')
    fireEvent.click(screen.getByRole('menuitem', { name: /Take out of focus/ }))
    expect(view.onPlace).toHaveBeenLastCalledWith('launch-blog', null)

    open('Launch Blog')
    expect(screen.getByRole('menuitem', { name: /Move up/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('menuitem', { name: /Move down/ }))
    expect(view.onShift).toHaveBeenLastCalledWith('launch-blog', 1)

    open('English C1')
    expect(screen.getByRole('menuitem', { name: /Move down/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('menuitem', { name: /Move up/ }))
    expect(view.onShift).toHaveBeenLastCalledWith('english-c1', -1)

    open('Philosophy / humanities')
    fireEvent.click(screen.getByRole('menuitem', { name: /Move to the Queue/ }))
    expect(view.onPlace).toHaveBeenLastCalledWith('philosophy-humanities', 'queue')
    expect(view.onSelect).not.toHaveBeenCalled()
  })

  it('does not offer to put a goal in focus when focus is full, and offers visitors no menu', () => {
    const map = structuredClone(createSeedMap())
    map.frontier = ['professional-autonomy', 'launch-blog', 'english-c1', 'own-products', 'attention-focus']
      .map((nodeId) => ({ nodeId, status: 'active' as const }))
    const rendered = render(<CompassView {...props(map)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Priority of Clear speech / writing' }))
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toHaveTextContent('Focus holds 5 at most')
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    rendered.rerender(<CompassView {...props(map)} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /^Priority of/ })).not.toBeInTheDocument()
  })

  it('shows Soul\'s labels as pills to visitors and lets the owner edit them in the hero', () => {
    const map = structuredClone(createSeedMap())
    map.nodes.soul.labels = [{ id: 'a', text: 'Seek first' }, { id: 'b', text: 'Daily' }]
    const view = props(map)
    const rendered = render(<CompassView {...view} canEdit={false} />)
    const hero = document.querySelector('.orientation') as HTMLElement
    expect(hero.querySelector('.soul-labels')).toHaveTextContent('Seek firstDaily')
    expect(within(hero).queryByRole('button')).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} />)
    fireEvent.click(within(hero).getByRole('button', { name: 'Remove label Daily from Soul' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('soul', { labels: [{ id: 'a', text: 'Seek first' }] })
    fireEvent.click(within(hero).getByRole('button', { name: 'Add label to Soul' }))
    fireEvent.change(screen.getByLabelText('New label for Soul'), { target: { value: 'Begin' } })
    fireEvent.keyDown(screen.getByLabelText('New label for Soul'), { key: 'Enter' })
    expect(view.onEditNode).toHaveBeenLastCalledWith('soul', { labels: [
      { id: 'a', text: 'Seek first' }, { id: 'b', text: 'Daily' }, { id: expect.any(String), text: 'Begin' },
    ] })
  })

  it('keeps the hero quiet for visitors when Soul has no labels, and invites the owner to add one', () => {
    const rendered = render(<CompassView {...props()} canEdit={false} />)
    expect(document.querySelector('.soul-labels')).toBeNull()
    rendered.rerender(<CompassView {...props()} />)
    expect(screen.getByRole('button', { name: 'Add label to Soul' })).toBeVisible()
  })

  it('never offers an Edit switch: the owner\'s tools are simply there', () => {
    const view = { ...props(), selectedId: 'english-c1' }
    render(<CompassView {...view} />)
    expect(screen.queryByRole('button', { name: /^(Edit|Done)$/ })).not.toBeInTheDocument()
    for (const name of ['Edit goal', 'Merge', 'Archive', 'Delete']) expect(screen.getByRole('button', { name })).toBeVisible()
    expect(screen.getByLabelText('Priority')).toBeVisible()
  })

  it('gives a direction with a warmth value its palette, and leaves the others as they were', () => {
    const map = structuredClone(createSeedMap())
    map.nodes.create.warmth = 9
    render(<CompassView {...props(map)} canEdit={false} />)
    const hot = document.querySelector('.cluster-card[data-tone="freedom"]') as HTMLElement
    const plain = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    expect(hot).toHaveAttribute('data-warm')
    expect(hot.style.getPropertyValue('--tone')).toBe(warmthColor(9))
    expect(hot.style.getPropertyValue('--heat')).toBe('0.90')
    expect(hot.style.getPropertyValue('--tone-glow')).toContain('rgba(')
    expect(plain).not.toHaveAttribute('data-warm')
    expect(plain.style.getPropertyValue('--tone')).toBe('')
    // visitors see the value as a picture with a text alternative, and nothing for a direction with no value
    expect(within(hot).getByRole('img', { name: 'Warmth of Practical Agency: 9 of 10, Hot' })).toBeVisible()
    expect(within(plain).queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('lets the owner set the warmth of a direction with one tap on its card, and clear it', () => {
    const map = structuredClone(createSeedMap())
    map.nodes.mastery.warmth = 3
    const view = props(map)
    render(<CompassView {...view} />)
    const mastery = document.querySelector('.cluster-card[data-tone="mastery"]') as HTMLElement
    const understand = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    expect(within(mastery).getByRole('radio', { name: '3, Cool' })).toBeChecked()
    fireEvent.click(within(mastery).getByRole('radio', { name: '8, Hot' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('mastery', { warmth: 8 })
    fireEvent.click(within(mastery).getByRole('radio', { name: '3, Cool' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('mastery', { warmth: null })
    expect(within(understand).getByText('Not set')).toBeVisible()
    fireEvent.click(within(understand).getByRole('radio', { name: '0, Cold' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('understand', { warmth: 0 })
    expect(screen.getAllByRole('group', { name: /Warmth of/ })).toHaveLength(3)
  })

  it('stacks the directions cooler first and the hottest last in one column, and keeps their places side by side', () => {
    const map = structuredClone(createSeedMap())
    map.nodes.understand.warmth = 9
    map.nodes.create.warmth = 1
    map.nodes.mastery.warmth = 5
    const titles = () => [...document.querySelectorAll('.cluster-open')].map((button) => button.textContent)
    const query = (matches: boolean) => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    query(true)
    const stacked = render(<CompassView {...props(map)} />)
    expect(titles()).toEqual(['Practical Agency', 'Self-Mastery', 'Understand & Express'])
    stacked.unmount()
    query(false)
    render(<CompassView {...props(map)} />)
    expect(titles()).toEqual(['Understand & Express', 'Practical Agency', 'Self-Mastery'])
    vi.unstubAllGlobals()
  })

  it('keeps the usual order in one column while no direction has a value', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    render(<CompassView {...props()} />)
    expect([...document.querySelectorAll('.cluster-open')].map((button) => button.textContent))
      .toEqual(['Understand & Express', 'Practical Agency', 'Self-Mastery'])
    vi.unstubAllGlobals()
  })

  it('carries a direction\'s palette onto its page and its goals\' pages, and puts the meter on the direction page', () => {
    const map = structuredClone(createSeedMap())
    map.nodes.create.warmth = 6
    const view = props(map)
    const rendered = render(<CompassView {...view} selectedId="create" />)
    const page = document.querySelector('main.page') as HTMLElement
    expect(page.style.getPropertyValue('--tone')).toBe(warmthColor(6))
    expect(document.querySelector('.focus-kicker')).not.toHaveAttribute('data-tone')
    expect(document.querySelector('.content-section')).not.toHaveAttribute('data-tone')
    fireEvent.click(within(page).getByRole('radio', { name: '10, Burning' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('create', { warmth: 10 })
    rendered.rerender(<CompassView {...view} selectedId="professional-autonomy" />)
    expect((document.querySelector('main.page') as HTMLElement).style.getPropertyValue('--tone')).toBe(warmthColor(6))
    expect(screen.queryAllByRole('radio')).toHaveLength(0) // goals have no warmth of their own
    rendered.rerender(<CompassView {...view} selectedId="understand" canEdit={false} />)
    expect(document.querySelector('.focus-kicker')).toHaveAttribute('data-tone', 'expression')
    expect((document.querySelector('main.page') as HTMLElement).style.getPropertyValue('--tone')).toBe('')
    expect(screen.queryByRole('img', { name: /Warmth of/ })).not.toBeInTheDocument()
  })

  it('says so when every goal of a direction is queued', () => {
    const map = structuredClone(createSeedMap())
    map.nodes.mastery.childrenIds = ['attention-focus']
    map.frontier = [{ nodeId: 'attention-focus', status: 'queued' }]
    render(<CompassView {...props(map)} />)
    const card = document.querySelector('.cluster-card[data-tone="mastery"]') as HTMLElement
    expect(card).toHaveTextContent('Nothing active right now')
    expect(within(card).queryByRole('button', { name: /^Attention/ })).not.toBeInTheDocument()
  })

  it('previews the direct goals that are neither archived nor queued: Active first, then the rest', () => {
    const map = mapWithHiddenAndArchived()
    map.nodes.understand.childrenIds = ['clear-speech-writing', 'extra-goal', 'english-c1', 'launch-blog', 'theology-scripture', 'philosophy-humanities', 'old-goal']
    map.frontier = [
      { nodeId: 'theology-scripture', status: 'active' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'active' },
      { nodeId: 'philosophy-humanities', status: 'queued' },
    ]
    map.nodes['nested-goal'] = { id: 'nested-goal', title: 'Nested goal', parentId: 'launch-blog', childrenIds: [], visibleChildIds: [], secondaryIds: [] }
    map.nodes['launch-blog'].childrenIds = ['nested-goal']
    const view = props(map)
    render(<CompassView {...view} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    const goalButtons = [...card.querySelectorAll<HTMLButtonElement>('.cluster-goal')]
    expect(goalButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining('Theology / Scripture'),
      expect.stringContaining('Launch Blog'),
      expect.stringContaining('English C1'),
      expect.stringContaining('Clear speech / writing'),
      expect.stringContaining('Another thought'),
    ])
    expect(card).not.toHaveTextContent('Philosophy / humanities')
    expect(card).not.toHaveTextContent('Former focus')
    expect(card).not.toHaveTextContent('Nested goal')
    fireEvent.click(goalButtons[4])
    expect(view.onSelect).toHaveBeenCalledWith('extra-goal')
  })

  it('lists every goal of a page in one scrolling list: the rest first, then the Queue, then the Archive for the owner', () => {
    const map = mapWithHiddenAndArchived()
    map.frontier.push({ nodeId: 'extra-goal', status: 'queued' })
    const rendered = render(<CompassView {...props(map)} selectedId="understand" />)
    expect(screen.getByRole('heading', { name: 'Understand & Express', level: 1 })).toBeVisible()
    expect(screen.queryByRole('button', { name: /All goals/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next page|Previous page/ })).not.toBeInTheDocument()
    expect(document.querySelector('.pagination')).toBeNull()
    const titles = (selector: string) => [...document.querySelectorAll(`${selector} .goal-row-title`)].map((node) => node.textContent)
    expect(titles('.content-section > .goal-list')).toEqual([
      'Launch Blog', 'English C1', 'Clear speech / writing', 'Philosophy / humanities',
    ])
    expect(titles('.goal-queue')).toEqual(['Theology / Scripture', 'Another thought'])
    const section = document.querySelector('[aria-labelledby="goals-title"]') as HTMLElement
    const order = [...section.children].map((child) => child.className || child.tagName)
    expect(order.indexOf('goal-queue')).toBeGreaterThan(order.indexOf('goal-list'))
    expect(order.indexOf('archived-section')).toBeGreaterThan(order.indexOf('goal-queue'))
    expect(within(section.querySelector('.archived-section') as HTMLElement).getByText('Former focus')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Move .* (up|down)$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /(Hide|Show) .* (from|in) view/ })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...props(map)} selectedId="understand" canEdit={false} />)
    expect(screen.queryByText('Former focus')).not.toBeInTheDocument()
    expect(document.querySelector('.archived-section')).toBeNull()
    expect(titles('.goal-queue')).toEqual(['Theology / Scripture', 'Another thought'])
  })

  it('lets the owner restore or delete an archived goal right from the list', () => {
    const view = { ...props(mapWithHiddenAndArchived()), selectedId: 'understand' }
    render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Restore Former focus' }))
    expect(view.onRestore).toHaveBeenCalledWith('old-goal')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Former focus' }))
    expect(view.onDelete).toHaveBeenCalledWith('old-goal')
  })

  it('changes a goal\'s priority from the goal page', () => {
    const view = { ...props(), selectedId: 'english-c1' }
    render(<CompassView {...view} />)
    expect(screen.getByLabelText('Priority')).toHaveValue('active')
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '' } })
    expect(view.onPlace).toHaveBeenCalledWith('english-c1', null)
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'queue' } })
    expect(view.onPlace).toHaveBeenCalledWith('english-c1', 'queue')
  })

  it('does not offer Active when it is full', () => {
    const map = structuredClone(createSeedMap())
    map.frontier = ['professional-autonomy', 'launch-blog', 'english-c1', 'own-products', 'attention-focus']
      .map((nodeId) => ({ nodeId, status: 'active' as const }))
    const rendered = render(<CompassView {...props(map)} selectedId="habits-self-control" />)
    expect(screen.getByRole('option', { name: 'Active (full)' })).toBeDisabled()
    rendered.rerender(<CompassView {...props(map)} selectedId="own-products" />)
    expect(screen.getByRole('option', { name: 'Active' })).toBeEnabled()
  })

  it('shows every goal\'s labels on the overview, as plain pills for visitors', () => {
    const map = structuredClone(createSeedMap())
    map.nodes['english-c1'].labels = [{ id: 'speak', text: 'Speaking practice' }, { id: 'write', text: 'Weekly writing' }]
    render(<CompassView {...props(map)} canEdit={false} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    expect(card.querySelector('.cluster-labels')).toHaveTextContent('Read Bible · Daily')
    expect(card.querySelector('.cluster-goals li:has(.cluster-goal-labels)')).toHaveTextContent('English C1In focusSpeaking practiceWeekly writing')
    expect(document.body).not.toHaveTextContent('Routine')
    expect(screen.queryByRole('button', { name: /label/i })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Add a goal…')).not.toBeInTheDocument()
  })

  it('lets the owner edit the labels of goals and directions right on the overview', () => {
    const map = structuredClone(createSeedMap())
    map.nodes['english-c1'].labels = [{ id: 'speak', text: 'Speaking practice' }, { id: 'write', text: 'Weekly writing' }]
    const view = props(map)
    render(<CompassView {...view} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement

    fireEvent.click(within(card).getByRole('button', { name: 'Remove label Weekly writing from English C1' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { labels: [{ id: 'speak', text: 'Speaking practice' }] })

    fireEvent.click(within(card).getByRole('button', { name: 'Edit label Speaking practice of English C1' }))
    fireEvent.change(screen.getByLabelText('Rename label Speaking practice of English C1'), { target: { value: '  Speaking  ' } })
    fireEvent.keyDown(screen.getByLabelText('Rename label Speaking practice of English C1'), { key: 'Enter' })
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { labels: [{ id: 'speak', text: 'Speaking' }, { id: 'write', text: 'Weekly writing' }] })

    // a goal without labels gets a small "+", and the new label is saved at once
    fireEvent.click(within(card).getByRole('button', { name: 'Add label to Launch Blog' }))
    fireEvent.change(screen.getByLabelText('New label for Launch Blog'), { target: { value: 'Ship weekly' } })
    fireEvent.keyDown(screen.getByLabelText('New label for Launch Blog'), { key: 'Enter' })
    expect(view.onEditNode).toHaveBeenLastCalledWith('launch-blog', { labels: [{ id: expect.any(String), text: 'Ship weekly' }] })
    fireEvent.keyDown(screen.getByLabelText('New label for Launch Blog'), { key: 'Escape' })

    // the direction's own labels
    fireEvent.click(within(card).getByRole('button', { name: 'Remove label Read Bible · Daily from Understand & Express' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('understand', { labels: [] })
    fireEvent.click(within(card).getByRole('button', { name: 'Add label to Understand & Express' }))
    expect(screen.getByLabelText('New label for Understand & Express')).toHaveFocus()
  })

  it('lets the owner add a goal to a direction right on its card, and offers nothing to visitors', () => {
    const view = props()
    const rendered = render(<CompassView {...view} />)
    const card = document.querySelector('.cluster-card[data-tone="freedom"]') as HTMLElement
    fireEvent.change(within(card).getByLabelText('New goal in Practical Agency'), { target: { value: 'Learn welding' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Add goal to Practical Agency' }))
    expect(view.onAddGoal).toHaveBeenCalledWith('create', 'Learn welding')
    rendered.rerender(<CompassView {...view} canEdit={false} />)
    expect(screen.queryByLabelText('New goal in Practical Agency')).not.toBeInTheDocument()
  })

  it('edits the labels of the goal being viewed', () => {
    const map = structuredClone(createSeedMap())
    map.nodes['english-c1'].labels = [{ id: 'speak', text: 'Speaking practice' }, { id: 'write', text: 'Weekly writing' }]
    const view = props(map)
    render(<CompassView {...view} selectedId="english-c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove label Weekly writing' }))
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { labels: [{ id: 'speak', text: 'Speaking practice' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Edit label Speaking practice' }))
    fireEvent.change(screen.getByLabelText('Rename label Speaking practice'), { target: { value: '  Speaking  ' } })
    fireEvent.keyDown(screen.getByLabelText('Rename label Speaking practice'), { key: 'Enter' })
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { labels: [{ id: 'speak', text: 'Speaking' }, { id: 'write', text: 'Weekly writing' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
    fireEvent.change(screen.getByLabelText('New label'), { target: { value: 'Reading' } })
    fireEvent.keyDown(screen.getByLabelText('New label'), { key: 'Enter' })
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { labels: [
      { id: 'speak', text: 'Speaking practice' }, { id: 'write', text: 'Weekly writing' }, { id: expect.any(String), text: 'Reading' },
    ] })
    expect(screen.getByLabelText('New label')).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText('New label'), { key: 'Escape' })
    expect(screen.queryByLabelText('New label')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit labels' })).not.toBeInTheDocument()
  })

  it('lets the owner label a direction on its page, and shows visitors plain pills', () => {
    const view = { ...props(), selectedId: 'understand' }
    const rendered = render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove label Read Bible · Daily' }))
    expect(view.onEditNode).toHaveBeenCalledWith('understand', { labels: [] })
    rendered.rerender(<CompassView {...view} canEdit={false} />)
    expect(document.querySelector('.focus-meta')).toHaveTextContent('Read Bible · Daily')
    expect(screen.queryByRole('button', { name: /label/i })).not.toBeInTheDocument()
  })

  it('lets the owner add goals, milestones, and reminders in place, and tick a milestone', () => {
    const view = { ...props(), selectedId: 'english-c1' }
    render(<CompassView {...view} />)
    fireEvent.change(screen.getByLabelText('New goal'), { target: { value: '  Vocabulary  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
    expect(view.onAddGoal).toHaveBeenCalledWith('english-c1', 'Vocabulary')
    fireEvent.change(screen.getByLabelText('New milestone'), { target: { value: 'Read a novel' } })
    fireEvent.keyDown(screen.getByLabelText('New milestone'), { key: 'Enter' })
    fireEvent.submit(screen.getByLabelText('New milestone').closest('form') as HTMLFormElement)
    expect(view.onEditNode).toHaveBeenCalledWith('english-c1', { milestones: [
      { id: 'fluent-conversation', title: 'Discuss complex topics fluently', done: false },
      { id: expect.any(String), title: 'Read a novel', done: false },
    ] })
    fireEvent.click(screen.getByRole('button', { name: 'Discuss complex topics fluently: mark done' }))
    expect(view.onEditNode).toHaveBeenCalledWith('english-c1', { milestones: [{ id: 'fluent-conversation', title: 'Discuss complex topics fluently', done: true }] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove milestone Discuss complex topics fluently' }))
    expect(view.onEditNode).toHaveBeenCalledWith('english-c1', { milestones: [] })
    fireEvent.change(screen.getByLabelText('New reminder'), { target: { value: 'Listen daily' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add reminder' }))
    expect(view.onEditNode).toHaveBeenCalledWith('english-c1', { reminders: ['Speaking practice', 'Writing', 'Grammar', 'Reading', 'Listen daily'] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove reminder Writing' }))
    expect(view.onEditNode).toHaveBeenCalledWith('english-c1', { reminders: ['Speaking practice', 'Grammar', 'Reading'] })
  })

  it('lets the owner edit the name, meaning, current state, target, and note where they are shown', () => {
    const view = { ...props(), selectedId: 'english-c1' }
    render(<CompassView {...view} />)
    fireEvent.click(within(screen.getByRole('heading', { level: 1 })).getByRole('button'))
    fireEvent.change(screen.getByLabelText('Edit name'), { target: { value: '  English C2  ' } })
    fireEvent.keyDown(screen.getByLabelText('Edit name'), { key: 'Enter' })
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { title: 'English C2' })
    fireEvent.click(screen.getByRole('button', { name: /Add a meaning/ }))
    fireEvent.change(screen.getByLabelText('Edit meaning'), { target: { value: 'Talk with anyone' } })
    fireEvent.blur(screen.getByLabelText('Edit meaning'))
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { description: 'Talk with anyone' })
    fireEvent.click(screen.getByRole('button', { name: 'B2-ish' }))
    fireEvent.change(screen.getByLabelText('Edit current state'), { target: { value: '' } })
    fireEvent.blur(screen.getByLabelText('Edit current state'))
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { current: '' })
    fireEvent.click(screen.getByRole('button', { name: 'C1' }))
    fireEvent.change(screen.getByLabelText('Edit target'), { target: { value: 'C2' } })
    fireEvent.keyDown(screen.getByLabelText('Edit target'), { key: 'Enter', ctrlKey: true })
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { target: 'C2' })
    fireEvent.click(screen.getByRole('button', { name: /A thought worth keeping/ }))
    fireEvent.change(screen.getByLabelText('Edit note'), { target: { value: 'Practise aloud' } })
    fireEvent.blur(screen.getByLabelText('Edit note'))
    expect(view.onEditNode).toHaveBeenLastCalledWith('english-c1', { note: 'Practise aloud' })
  })

  it('does not save unchanged text, cancels on Escape, and never blanks the name', () => {
    const view = { ...props(), selectedId: 'english-c1' }
    render(<CompassView {...view} />)
    const name = () => within(screen.getByRole('heading', { level: 1 })).getByRole('button')
    fireEvent.click(name())
    fireEvent.keyDown(screen.getByLabelText('Edit name'), { key: 'Enter' })
    fireEvent.click(name())
    fireEvent.change(screen.getByLabelText('Edit name'), { target: { value: '   ' } })
    fireEvent.blur(screen.getByLabelText('Edit name'))
    fireEvent.click(name())
    fireEvent.change(screen.getByLabelText('Edit name'), { target: { value: 'Something else' } })
    fireEvent.keyDown(screen.getByLabelText('Edit name'), { key: 'Escape' })
    expect(view.onEditNode).not.toHaveBeenCalled()
    expect(name()).toHaveTextContent('English C1')
  })

  it('gives visitors plain text and no inline controls on a goal page', () => {
    render(<CompassView {...props()} selectedId="english-c1" canEdit={false} />)
    expect(screen.getByRole('heading', { name: 'English C1', level: 1 })).toBeVisible()
    expect(within(screen.getByRole('heading', { level: 1 })).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('New goal')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add (label|milestone|reminder)/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark (done|not done)/ })).not.toBeInTheDocument()
    expect(screen.getByText('B2-ish')).toBeVisible()
    expect(screen.queryByText(/Add a meaning/)).not.toBeInTheDocument()
  })

  it('keeps a goal page without sub-goals quiet for readers and inviting for the owner', () => {
    const view = { ...props(), selectedId: 'launch-blog' }
    const rendered = render(<CompassView {...view} canEdit={false} />)
    expect(screen.queryByText(/Nothing here yet/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Goals' })).not.toBeInTheDocument()
    expect(document.querySelector('.focus-layout')).toHaveClass('leaf')
    rendered.rerender(<CompassView {...view} />)
    expect(screen.getByText(/Nothing here yet/)).toBeVisible()
    expect(screen.getByLabelText('New goal')).toBeVisible()
    expect(document.querySelector('.focus-layout')).not.toHaveClass('leaf')
  })

  it('prints no placeholder under goals that have no description or current state', () => {
    render(<CompassView {...props()} selectedId="create" />)
    expect(screen.queryByText('Open goal')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.goal-list .goal-row')).toHaveLength(5)
    expect(document.querySelectorAll('.goal-row-detail')).toHaveLength(0)
  })

  it('exposes goal editing, merging, archiving, relations, and return navigation', () => {
    const view = { ...props(), selectedId: 'english-c1' }
    render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    expect(view.onOpenEditor).toHaveBeenCalledWith('english-c1')
    expect(screen.queryByRole('button', { name: /Add within|Edit labels/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    expect(view.onOpenMerge).toHaveBeenCalledWith('english-c1')
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(view.onArchive).toHaveBeenCalledWith('english-c1')
    fireEvent.click(screen.getByRole('button', { name: 'Also Practical Agency' }))
    expect(view.onSelect).toHaveBeenCalledWith('create')
    fireEvent.click(screen.getByRole('button', { name: 'Soul' }))
    expect(view.onSelect).toHaveBeenCalledWith(null)
  })

  it('keeps export and owner access in the secondary menu', () => {
    const view = props()
    render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    expect(view.onExport).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    const file = new File(['{}'], 'map.json', { type: 'application/json' })
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } })
    expect(view.onImport).toHaveBeenCalledWith(file)
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(view.onSignOut).toHaveBeenCalledOnce()
  })

  it('offers sign in without editing controls to public visitors', () => {
    const view = { ...props(), canEdit: false }
    render(<CompassView {...view} />)
    expect(screen.queryByRole('button', { name: /^(Edit|Done)/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Owner sign in' }))
    expect(view.onSignIn).toHaveBeenCalledOnce()
  })

  it('does not offer owner authentication in local preview mode', () => {
    render(<CompassView {...props()} authEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Owner sign in' })).not.toBeInTheDocument()
  })

  it('shows the directions as cards by default and switches to the orbit, remembering the choice', () => {
    window.localStorage.clear()
    const view = props()
    const rendered = render(<CompassView {...view} />)
    expect(document.querySelector('.cluster-grid')).not.toBeNull()
    expect(document.querySelector('.orbit')).toBeNull()
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Orbit' }))
    expect(document.querySelector('.cluster-grid')).toBeNull()
    expect(document.querySelector('.orbit')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(document.querySelector('.orbit') as HTMLElement).getByRole('button', { name: 'Self-Mastery' }))
    expect(view.onSelect).toHaveBeenCalledWith('mastery')

    rendered.unmount()
    render(<CompassView {...props()} />)
    expect(document.querySelector('.orbit')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }))
    expect(document.querySelector('.cluster-grid')).not.toBeNull()
    window.localStorage.clear()
  })
})
