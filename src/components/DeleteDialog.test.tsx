import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { addGoal } from '../domain/map'
import { createSeedMap } from '../domain/seed'
import { DeleteDialog } from './DeleteDialog'

describe('DeleteDialog', () => {
  it('names the goal, says it is permanent, and offers archiving instead', () => {
    render(<DeleteDialog map={createSeedMap()} goalId="launch-blog" onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Delete goal' })).toBeInTheDocument()
    expect(screen.getByText('Launch Blog')).toBeVisible()
    expect(screen.getByText(/cannot be undone/i)).toBeVisible()
    expect(screen.getByText(/archive it instead/i)).toBeVisible()
    expect(screen.queryByText(/nested/)).not.toBeInTheDocument()
  })

  it('counts the nested goals that go with it', () => {
    let map = addGoal(createSeedMap(), { id: 'child', title: 'Child', parentId: 'launch-blog' })
    const { rerender } = render(<DeleteDialog map={map} goalId="launch-blog" onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/and 1 nested goal with/)).toBeVisible()
    map = addGoal(map, { id: 'second', title: 'Second', parentId: 'launch-blog' })
    rerender(<DeleteDialog map={map} goalId="launch-blog" onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/and 2 nested goals with/)).toBeVisible()
  })

  it('confirms only on purpose and can be cancelled or closed', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<DeleteDialog map={createSeedMap()} goalId="launch-blog" onClose={onClose} onConfirm={onConfirm} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close delete dialog' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows progress and errors, and renders nothing without a goal', () => {
    const { rerender, container } = render(<DeleteDialog map={createSeedMap()} goalId="launch-blog" busy error="Network unavailable" onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable')
    rerender(<DeleteDialog map={createSeedMap()} goalId={null} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<DeleteDialog map={createSeedMap()} goalId="missing" onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
