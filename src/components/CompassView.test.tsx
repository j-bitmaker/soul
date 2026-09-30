import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedMap } from '../domain/seed'
import type { GoalMap } from '../domain/types'
import { CompassView, type CompassViewProps } from './CompassView'

function props(map: GoalMap = createSeedMap()): CompassViewProps {
  return {
    map, selectedId: null, editMode: false, canEdit: true,
    onSelect: vi.fn(), onToggleEdit: vi.fn(), onOpenEditor: vi.fn(),
    onPlace: vi.fn(), onAddToQueue: vi.fn(async () => true), onEditNode: vi.fn(async () => true), onAddGoal: vi.fn(async () => true),
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
  it('keeps Soul, three directions, and the complete Frontier scannable in overview', () => {
    const view = props()
    render(<CompassView {...view} />)
    expect(screen.getByRole('heading', { name: 'Soul' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Understand & Express' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Create & Be Free' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Self-Mastery' })).toBeVisible()
    expect(screen.queryByText('In focus now')).not.toBeInTheDocument()
    expect(screen.queryByText(/0[1-3] \/ 03/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    expect(screen.getAllByRole('heading', { name: 'Active Frontier' })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Three directions' }).compareDocumentPosition(
      screen.getByRole('heading', { name: 'Active Frontier' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const frontier = within(document.querySelector('.frontier-section') as HTMLElement)
    expect(frontier.getByRole('button', { name: /Lead focus.*Professional autonomy/i })).toBeVisible()
    expect(frontier.getByRole('button', { name: /^Launch Blog/ })).toBeVisible()
    expect(frontier.getByRole('button', { name: /^English C1/ })).toBeVisible()
    expect(document.querySelector('.frontier-status')).toBeNull()
    expect(screen.queryByText(/^(primary|active|maintain)$/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create & Be Free' }))
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

  it('leads with the Primary goal and shows one orientation line per Frontier goal', () => {
    render(<CompassView {...props()} />)
    const frontier = document.querySelector('.frontier-section') as HTMLElement
    const lead = within(frontier).getByRole('button', { name: /Lead focus.*Professional autonomy/i })
    expect(lead).toHaveClass('frontier-lead')
    expect(lead).toHaveTextContent('Create & Be Free')
    expect(lead).toHaveTextContent('Target: A stable professional and economic position for the next several years.')
    expect(within(frontier).getByRole('button', { name: /^Launch Blog/ })).toHaveTextContent('Next: Publish the first working version')
    expect(within(frontier).getByRole('button', { name: /^English C1/ })).toHaveTextContent('B2-ish → C1')
    expect(frontier.querySelectorAll('.frontier-lead')).toHaveLength(1)
  })

  it('falls back through milestone, target, current, and description for the orientation line', () => {
    const map = structuredClone(createSeedMap())
    map.frontier = [
      { nodeId: 'theology-scripture', status: 'active' },
      { nodeId: 'clear-speech-writing', status: 'active' },
      { nodeId: 'attention-focus', status: 'active' },
      { nodeId: 'habits-self-control', status: 'active' },
    ]
    map.nodes['theology-scripture'].description = 'Read the Gospel with the Fathers.'
    map.nodes['clear-speech-writing'].current = 'Rambling drafts'
    map.nodes['attention-focus'].milestones = [{ id: 'm1', title: 'Done already', done: true }]
    render(<CompassView {...props(map)} />)
    const frontier = within(document.querySelector('.frontier-section') as HTMLElement)
    expect(frontier.getByRole('button', { name: /Lead focus.*Theology/ })).toHaveTextContent('Read the Gospel with the Fathers.')
    expect(frontier.getByRole('button', { name: /^Clear speech/ })).toHaveTextContent('Now: Rambling drafts')
    expect(frontier.getByRole('button', { name: /^Attention/ }).querySelector('.frontier-detail')).toBeNull()
    expect(frontier.getByRole('button', { name: /^Habits/ }).querySelector('.frontier-detail')).toBeNull()
  })

  it('shows the Queue under Active with each goal tinted by its direction', () => {
    render(<CompassView {...props()} />)
    const queue = within(document.querySelector('.queue-section') as HTMLElement)
    expect(queue.getByRole('heading', { name: 'Queue' })).toBeVisible()
    const rows = [...document.querySelectorAll<HTMLElement>('.queue-section .frontier-open')]
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Theology / Scripture'),
      expect.stringContaining('Software / AI Engineering'),
    ])
    expect(rows[0].dataset.tone).toBe('expression')
    expect(rows[1].dataset.tone).toBe('freedom')
    expect(queue.queryByRole('button', { name: /Professional autonomy/ })).not.toBeInTheDocument()
  })

  it('hides empty lanes from visitors and explains them to the owner', () => {
    const map = structuredClone(createSeedMap())
    map.frontier = [{ nodeId: 'launch-blog', status: 'queued' }]
    const rendered = render(<CompassView {...props(map)} />)
    expect(document.querySelector('.frontier-lead')).toBeNull()
    expect(screen.getByText(/No current focus/)).toBeVisible()
    expect(within(document.querySelector('.queue-section') as HTMLElement).getByRole('button', { name: /^Launch Blog/ })).toBeVisible()
    map.frontier = []
    rendered.rerender(<CompassView {...props(map)} />)
    expect(screen.getByText(/No current focus/)).toBeVisible()
    expect(screen.getByText('Drag a goal here to queue it')).toBeVisible()
    rendered.rerender(<CompassView {...props(map)} canEdit={false} />)
    expect(screen.queryByRole('heading', { name: 'Active Frontier' })).not.toBeInTheDocument()
    expect(screen.queryByText(/No current focus/)).not.toBeInTheDocument()
    expect(document.querySelector('.queue-section')).toBeNull()
  })

  it('reorders Active and Queue goals and adds to the Queue in edit mode', async () => {
    const view = { ...props(), editMode: true }
    render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move Launch Blog down in Active' }))
    expect(view.onPlace).toHaveBeenCalledWith('launch-blog', 'active', 2)
    fireEvent.click(screen.getByRole('button', { name: 'Move Launch Blog up in Active' }))
    expect(view.onPlace).toHaveBeenCalledWith('launch-blog', 'active', 0)
    expect(screen.getByRole('button', { name: 'Move Professional autonomy up in Active' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Software / AI Engineering down in the Queue' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Move Software / AI Engineering up in the Queue' }))
    expect(view.onPlace).toHaveBeenCalledWith('software-ai', 'queue', 0)
    fireEvent.change(screen.getByLabelText('Add to the queue'), { target: { value: '  Read more  ' } })
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'create' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(view.onAddToQueue).toHaveBeenCalledWith('Read more', 'create')
    await waitFor(() => expect(screen.getByLabelText('Add to the queue')).toHaveValue(''))
  })

  it('offers an explicit Delete on goal pages, archived rows, and Active and Queue rows in edit mode only', () => {
    const view = { ...props(mapWithHiddenAndArchived()), selectedId: 'understand', editMode: true }
    const rendered = render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Former focus' }))
    expect(view.onDelete).toHaveBeenCalledWith('old-goal')
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} selectedId="launch-blog" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(view.onDelete).toHaveBeenCalledWith('launch-blog')
    rendered.rerender(<CompassView {...view} selectedId={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Professional autonomy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Theology / Scripture' }))
    expect(view.onDelete).toHaveBeenCalledWith('professional-autonomy')
    expect(view.onDelete).toHaveBeenCalledWith('theology-scripture')
    rendered.rerender(<CompassView {...view} selectedId={null} editMode={false} />)
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    rendered.rerender(<CompassView {...view} selectedId="create" />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('gives the signed-in owner a drag handle on every Active and Queue goal, without edit mode', () => {
    render(<CompassView {...props()} />)
    const handles = screen.getAllByRole('button', { name: /^Drag / })
    expect(handles.map((handle) => handle.getAttribute('aria-label'))).toEqual([
      'Drag Professional autonomy', 'Drag Launch Blog', 'Drag English C1', 'Drag Theology / Scripture', 'Drag Software / AI Engineering',
    ])
  })

  it('shows visitors no drag handles and no empty drop hints', () => {
    const map = structuredClone(createSeedMap())
    map.frontier = [{ nodeId: 'launch-blog', status: 'active' }]
    render(<CompassView {...props(map)} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /^Drag / })).not.toBeInTheDocument()
    expect(screen.queryByText('Drag a goal here to queue it')).not.toBeInTheDocument()
    expect(document.querySelector('.queue-section')).toBeNull()
  })

  it('hides reorder and queue controls outside edit mode', () => {
    render(<CompassView {...props()} />)
    expect(screen.queryByRole('button', { name: /Move .* in Active/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Add to the queue')).not.toBeInTheDocument()
  })

  it('hints at Active and Queued goals on direction cards without text labels', () => {
    render(<CompassView {...props()} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    const launch = within(card).getByRole('button', { name: /Launch Blog/ })
    expect(launch.querySelector('.lane-mark')).toHaveAttribute('data-lane', 'active')
    expect(launch).toHaveTextContent('In focus')
    const theology = within(card).getByRole('button', { name: /Theology/ })
    expect(theology.querySelector('.lane-mark')).toHaveAttribute('data-lane', 'queue')
    expect(within(card).getByRole('button', { name: /Philosophy/ }).querySelector('.lane-mark')).toBeNull()
  })

  it('previews every direct nonarchived goal: Active first, then the rest, then the Queue', () => {
    const map = mapWithHiddenAndArchived()
    map.nodes.understand.childrenIds = ['clear-speech-writing', 'extra-goal', 'english-c1', 'launch-blog', 'theology-scripture', 'philosophy-humanities', 'old-goal']
    map.frontier = [
      { nodeId: 'theology-scripture', status: 'active' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'active' },
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
      expect.stringContaining('Philosophy / humanities'),
    ])
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

  it('changes a goal\'s priority from the goal page in edit mode', () => {
    const view = { ...props(), selectedId: 'english-c1', editMode: true }
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
    const rendered = render(<CompassView {...props(map)} selectedId="habits-self-control" editMode />)
    expect(screen.getByRole('option', { name: 'Active (full)' })).toBeDisabled()
    rendered.rerender(<CompassView {...props(map)} selectedId="own-products" editMode />)
    expect(screen.getByRole('option', { name: 'Active' })).toBeEnabled()
  })

  it('shows labels as pills in the overview and lets the owner edit them right on the page', () => {
    const map = structuredClone(createSeedMap())
    map.nodes['english-c1'].labels = [{ id: 'speak', text: 'Speaking practice' }, { id: 'write', text: 'Weekly writing' }]
    const view = props(map)
    const rendered = render(<CompassView {...view} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    expect(card.querySelector('.cluster-labels')).toHaveTextContent('Read Bible · Daily')
    expect(within(document.querySelector('.frontier-section') as HTMLElement).getByRole('button', { name: /^English C1/ }))
      .toHaveTextContent('Speaking practiceWeekly writing')
    expect(document.body).not.toHaveTextContent('Routine')
    rendered.rerender(<CompassView {...view} selectedId="english-c1" />)
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
    const view = { ...props(), selectedId: 'english-c1', editMode: true }
    render(<CompassView {...view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
    expect(view.onOpenEditor).toHaveBeenCalledWith('english-c1')
    expect(screen.queryByRole('button', { name: /Add within|Edit labels/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    expect(view.onOpenMerge).toHaveBeenCalledWith('english-c1')
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(view.onArchive).toHaveBeenCalledWith('english-c1')
    fireEvent.click(screen.getByRole('button', { name: 'Also Create & Be Free' }))
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
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
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
})
