import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedMap } from '../domain/seed'
import { MergeDialog } from './MergeDialog'

describe('MergeDialog', () => {
  it('shows the survivor and retained content before merging', () => {
    const map = createSeedMap()
    const onMerge = vi.fn()
    render(<MergeDialog map={map} sourceId="launch-blog" onClose={vi.fn()} onMerge={onMerge} />)
    expect(screen.getByRole('button', { name: 'Merge goals' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Into'), { target: { value: 'english-c1' } })
    expect(screen.getByText(/keeps both sets of text, milestones, reminders, children, and connections/)).toBeVisible()
    expect(screen.getByText(/4 milestones/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Merge goals' }))
    expect(onMerge).toHaveBeenCalledWith('english-c1')
  })

  it('excludes related ancestors and permanent directions from targets', () => {
    const map = createSeedMap()
    map.nodes['launch-blog'].childrenIds.push('first-post')
    map.nodes['launch-blog'].visibleChildIds.push('first-post')
    map.nodes['first-post'] = { id: 'first-post', title: 'First post', parentId: 'launch-blog', childrenIds: [], visibleChildIds: [], secondaryIds: [] }
    render(<MergeDialog map={map} sourceId="first-post" onClose={vi.fn()} onMerge={vi.fn()} />)
    expect(screen.queryByRole('option', { name: 'Launch Blog' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Understand & Express' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Merge goals' })).toBeDisabled()
  })

  it('shows a merge failure inside the open dialog', () => {
    render(<MergeDialog map={createSeedMap()} sourceId="launch-blog" error="The map changed on another device." onClose={vi.fn()} onMerge={vi.fn()} />)
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('alert'))
    expect(screen.getByRole('alert')).toHaveTextContent('another device')
  })
})
