import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByRole('button', { name: /01 \/ 03.*Understand & Express/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /02 \/ 03.*Create & Be Free/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /03 \/ 03.*Self-Mastery/ })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Professional autonomy.*primary/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /Launch Blog.*active/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /English C1.*maintain/i })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /02 \/ 03.*Create & Be Free/ }))
    expect(view.onSelect).toHaveBeenCalledWith('create')
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
