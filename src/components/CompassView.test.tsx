import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedMap } from '../domain/seed'
import type { GoalMap } from '../domain/types'
import { CompassView, type CompassViewProps } from './CompassView'

function props(map: GoalMap = createSeedMap()): CompassViewProps {
  return {
    map, selectedId: null, editMode: false, canEdit: true,
    onSelect: vi.fn(), onToggleEdit: vi.fn(), onOpenEditor: vi.fn(),
    onSetFrontier: vi.fn(), onReorder: vi.fn(), onToggleVisible: vi.fn(),
    onArchive: vi.fn(), onRestore: vi.fn(), onOpenMerge: vi.fn(),
    onOpenRoutineEditor: vi.fn(), onExport: vi.fn(), onImport: vi.fn(), onSignIn: vi.fn(), onSignOut: vi.fn(),
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
  it('keeps Soul, the Frontier, and three directions scannable in overview', () => {
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
    expect(screen.getByRole('heading', { name: 'Active Frontier' }).compareDocumentPosition(
      screen.getByRole('heading', { name: 'Three directions' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const frontier = within(document.querySelector('.frontier-section') as HTMLElement)
    expect(frontier.getByRole('button', { name: /primary.*Professional autonomy/i })).toBeVisible()
    expect(frontier.getByRole('button', { name: /Launch Blog.*active/i })).toBeVisible()
    expect(frontier.getByRole('button', { name: /English C1.*maintain/i })).toBeVisible()
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
    const lead = within(frontier).getByRole('button', { name: /primary.*Professional autonomy/i })
    expect(lead).toHaveClass('frontier-lead')
    expect(lead).toHaveTextContent('Create & Be Free')
    expect(lead).toHaveTextContent('Target: A stable professional and economic position for the next several years.')
    expect(within(frontier).getByRole('button', { name: /Launch Blog/ })).toHaveTextContent('Next: Publish the first working version')
    expect(within(frontier).getByRole('button', { name: /English C1/ })).toHaveTextContent('B2-ish → C1')
    expect(frontier.querySelectorAll('.frontier-lead')).toHaveLength(1)
  })

  it('falls back through milestone, target, current, and description for the orientation line', () => {
    const map = structuredClone(createSeedMap())
    map.frontier = [
      { nodeId: 'theology-scripture', status: 'primary' },
      { nodeId: 'clear-speech-writing', status: 'active' },
      { nodeId: 'attention-focus', status: 'active' },
      { nodeId: 'habits-self-control', status: 'maintain' },
    ]
    map.nodes['theology-scripture'].description = 'Read the Gospel with the Fathers.'
    map.nodes['clear-speech-writing'].current = 'Rambling drafts'
    map.nodes['attention-focus'].milestones = [{ id: 'm1', title: 'Done already', done: true }]
    render(<CompassView {...props(map)} />)
    const frontier = within(document.querySelector('.frontier-section') as HTMLElement)
    expect(frontier.getByRole('button', { name: /Theology/ })).toHaveTextContent('Read the Gospel with the Fathers.')
    expect(frontier.getByRole('button', { name: /Clear speech/ })).toHaveTextContent('Now: Rambling drafts')
    expect(frontier.getByRole('button', { name: /Attention/ }).querySelector('.frontier-detail')).toBeNull()
    expect(frontier.getByRole('button', { name: /Habits/ }).querySelector('.frontier-detail')).toBeNull()
  })

  it('lists the Frontier without a lead card when nothing is Primary, and hides an empty Frontier from visitors', () => {
    const map = structuredClone(createSeedMap())
    map.frontier = [{ nodeId: 'launch-blog', status: 'active' }]
    const rendered = render(<CompassView {...props(map)} />)
    expect(document.querySelector('.frontier-lead')).toBeNull()
    expect(within(document.querySelector('.frontier-section') as HTMLElement).getByRole('button', { name: /Launch Blog/ })).toBeVisible()
    map.frontier = []
    rendered.rerender(<CompassView {...props(map)} />)
    expect(screen.getByText(/No current focus/)).toBeVisible()
    rendered.rerender(<CompassView {...props(map)} canEdit={false} />)
    expect(screen.queryByRole('heading', { name: 'Active Frontier' })).not.toBeInTheDocument()
    expect(screen.queryByText(/No current focus/)).not.toBeInTheDocument()
  })

  it('previews every direct nonarchived goal by status, then manual order', () => {
    const map = mapWithHiddenAndArchived()
    map.nodes.understand.childrenIds = ['clear-speech-writing', 'extra-goal', 'english-c1', 'launch-blog', 'theology-scripture', 'philosophy-humanities', 'old-goal']
    map.frontier = [
      { nodeId: 'theology-scripture', status: 'primary' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'maintain' },
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

  it('reveals hidden goals only through All goals while normal focus shows five or fewer', () => {
    const view = { ...props(mapWithHiddenAndArchived()), selectedId: 'understand' }
    render(<CompassView {...view} />)
    expect(screen.getByRole('heading', { name: 'Understand & Express' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Another thought/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Former focus')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.goal-list .goal-row')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /All goals/ }))
    expect(document.querySelectorAll('.goal-list .goal-row')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /Another thought/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(document.querySelectorAll('.goal-list .goal-row')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Another thought/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(document.querySelectorAll('.goal-list .goal-row')).toHaveLength(5)
    expect(screen.queryByText('Former focus')).not.toBeInTheDocument()
  })

  it('offers view, order, and restore controls only in edit mode', () => {
    const view = { ...props(mapWithHiddenAndArchived()), selectedId: 'understand', editMode: true }
    render(<CompassView {...view} />)
    expect(document.querySelectorAll('.goal-list .goal-row')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: /Show Another thought in view/ }))
    expect(view.onToggleVisible).toHaveBeenCalledWith('understand', 'extra-goal')
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(view.onRestore).toHaveBeenCalledWith('old-goal')
    fireEvent.click(screen.getByRole('button', { name: /Move Another thought up/ }))
    expect(view.onReorder).toHaveBeenCalledWith('extra-goal', -1)
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    fireEvent.click(screen.getByRole('button', { name: /Hide Theology \/ Scripture from view/ }))
    expect(view.onToggleVisible).toHaveBeenCalledWith('understand', 'theology-scripture')
  })

  it('can remove a goal from the Frontier in edit mode', () => {
    const view = { ...props(), selectedId: 'english-c1', editMode: true }
    render(<CompassView {...view} />)
    fireEvent.change(screen.getByLabelText('Frontier status'), { target: { value: '' } })
    expect(view.onSetFrontier).toHaveBeenCalledWith('english-c1', null)
  })

  it('shows direction Routine in overview and focus with a protected edit action', () => {
    const view = props()
    const rendered = render(<CompassView {...view} />)
    const card = document.querySelector('.cluster-card[data-tone="expression"]') as HTMLElement
    expect(within(card).getByRole('region', { name: 'Routine for Understand & Express' })).toHaveTextContent('Read Bible')
    rendered.rerender(<CompassView {...view} selectedId="understand" editMode />)
    expect(screen.getByRole('region', { name: 'Routine for Understand & Express' })).toHaveTextContent('Daily')
    fireEvent.click(screen.getByRole('button', { name: 'Edit routine' }))
    expect(view.onOpenRoutineEditor).toHaveBeenCalledWith('understand')
    expect(screen.queryByRole('button', { name: 'Edit goal' })).not.toBeInTheDocument()
  })

  it('keeps a goal page without sub-goals quiet for readers and inviting for the owner', () => {
    const view = { ...props(), selectedId: 'launch-blog' }
    const rendered = render(<CompassView {...view} />)
    expect(screen.queryByText(/Nothing here yet/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Goals in view' })).not.toBeInTheDocument()
    expect(document.querySelector('.focus-layout')).toHaveClass('leaf')
    rendered.rerender(<CompassView {...view} editMode />)
    expect(screen.getByText(/Nothing here yet/)).toBeVisible()
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
    fireEvent.click(screen.getByRole('button', { name: 'Add within' }))
    expect(view.onOpenEditor).toHaveBeenCalledWith()
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
