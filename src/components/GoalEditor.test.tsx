import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedMap } from '../domain/seed'
import { GoalEditor } from './GoalEditor'

describe('GoalEditor', () => {
  it('accepts a title-only goal and defaults a Soul-level add to a permanent direction', () => {
    const onSave = vi.fn()
    render(<GoalEditor map={createSeedMap()} parentId="soul" open onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  A simple goal  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'A simple goal', parentId: 'understand', secondaryIds: [],
      description: '', current: '', target: '', milestones: [], reminders: [], note: '',
    }))
  })

  it('preserves rich goal fields and updates progress, reminders, and connections', () => {
    const map = createSeedMap()
    const onSave = vi.fn()
    render(<GoalEditor map={map} node={map.nodes['english-c1']} parentId="understand" open onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'English fluency' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Completed: Discuss complex topics fluently/ }))
    fireEvent.change(screen.getByLabelText('Reminders'), { target: { value: 'Speaking practice\nWrite an essay\n' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  Use it daily.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'English fluency', parentId: 'understand', secondaryIds: ['create'],
      current: 'B2-ish', target: 'C1', reminders: ['Speaking practice', 'Write an essay'], note: 'Use it daily.',
      milestones: [{ id: 'fluent-conversation', title: 'Discuss complex topics fluently', done: true }],
    }))
  })

  it('does not submit an empty title', () => {
    const onSave = vi.fn()
    render(<GoalEditor map={createSeedMap()} parentId="understand" open onClose={vi.fn()} onSave={onSave} />)
    fireEvent.submit(screen.getByRole('button', { name: 'Save goal' }).closest('form') as HTMLFormElement)
    expect(screen.getByRole('alert')).toHaveTextContent('Give this goal a name.')
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Revised goal' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('adds optional milestones and connections without making Soul a parent', () => {
    const onSave = vi.fn()
    render(<GoalEditor map={createSeedMap()} parentId="create" open onClose={vi.fn()} onSave={onSave} />)
    expect(screen.queryByRole('option', { name: 'Soul' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A useful product' } })
    fireEvent.change(screen.getByLabelText('Place under'), { target: { value: 'own-products' } })
    fireEvent.change(screen.getByLabelText('Also supports'), { target: { value: 'understand' } })
    expect(screen.getByRole('button', { name: 'Remove link to Understand & Express' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }))
    fireEvent.change(screen.getByLabelText('Milestone title'), { target: { value: 'First release' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      parentId: 'own-products', secondaryIds: ['understand'],
      milestones: [expect.objectContaining({ title: 'First release', done: false })],
    }))
  })

  it('adds free-form labels to a goal and drops empty ones', () => {
    const onSave = vi.fn()
    render(<GoalEditor map={createSeedMap()} parentId="understand" open onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Read deeply' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
    fireEvent.change(screen.getByLabelText('Label 1'), { target: { value: '  Read for 20 minutes · weekdays  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      labels: [expect.objectContaining({ text: 'Read for 20 minutes · weekdays' })],
    }))
  })

  it('edits and removes the labels of an existing goal', () => {
    const map = createSeedMap()
    const onSave = vi.fn()
    render(<GoalEditor map={map} node={map.nodes.understand} parentId="soul" open onClose={vi.fn()} onSave={onSave} />)
    expect(screen.getByLabelText('Label 1')).toHaveValue('Read Bible · Daily')
    fireEvent.click(screen.getByRole('button', { name: 'Remove label Read Bible · Daily' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ labels: [] }))
  })

  it('removes optional milestones and closes without saving', () => {
    const map = createSeedMap()
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(<GoalEditor map={map} node={map.nodes['english-c1']} parentId="understand" open onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Discuss complex topics fluently' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows a save failure inside the open dialog', () => {
    render(<GoalEditor map={createSeedMap()} parentId="understand" open error="A newer map is available. Reload before saving." onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('alert'))
    expect(screen.getByRole('alert')).toHaveTextContent('A newer map is available')
  })
})
