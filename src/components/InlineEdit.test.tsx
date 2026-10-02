import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditableLabels, InlineAdd, InlineText } from './InlineEdit'

describe('InlineAdd', () => {
  it('adds a trimmed line on Enter or the button and clears the field', async () => {
    const onAdd = vi.fn(async () => true)
    render(<InlineAdd label="New step" action="Add step" placeholder="Add a step…" onAdd={onAdd} />)
    expect(screen.getByRole('button', { name: 'Add step' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('New step'), { target: { value: '  Read  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }))
    expect(onAdd).toHaveBeenCalledWith('Read')
    await waitFor(() => expect(screen.getByLabelText('New step')).toHaveValue(''))
  })

  it('keeps the text when the save fails and ignores blank lines', async () => {
    const onAdd = vi.fn(async () => false)
    render(<InlineAdd label="New step" action="Add step" placeholder="" onAdd={onAdd} />)
    fireEvent.submit(screen.getByLabelText('New step').closest('form') as HTMLFormElement)
    expect(onAdd).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('New step'), { target: { value: 'Read' } })
    fireEvent.submit(screen.getByLabelText('New step').closest('form') as HTMLFormElement)
    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('New step')).toHaveValue('Read')
  })

  it('does nothing while disabled', () => {
    const onAdd = vi.fn()
    render(<InlineAdd label="New step" action="Add step" placeholder="" disabled onAdd={onAdd} />)
    expect(screen.getByLabelText('New step')).toBeDisabled()
    fireEvent.submit(screen.getByLabelText('New step').closest('form') as HTMLFormElement)
    expect(onAdd).not.toHaveBeenCalled()
  })
})

describe('EditableLabels', () => {
  const labels = [{ id: 'a', text: 'Speak' }, { id: 'b', text: 'Read' }]

  it('adds several labels in a row with Enter, and closes on blur or Escape', () => {
    const onChange = vi.fn()
    render(<EditableLabels labels={labels} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
    fireEvent.change(screen.getByLabelText('New label'), { target: { value: 'Write' } })
    fireEvent.keyDown(screen.getByLabelText('New label'), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith([...labels, { id: expect.any(String), text: 'Write' }])
    expect(screen.getByLabelText('New label')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('New label'), { target: { value: 'Listen' } })
    fireEvent.blur(screen.getByLabelText('New label'))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(screen.queryByLabelText('New label')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
    fireEvent.blur(screen.getByLabelText('New label'))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('shows the word "Label" on the add button, unless asked for the icon alone, and tight spots drop it too', () => {
    const view = render(<EditableLabels labels={labels} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add label' })).toHaveTextContent('Label')
    view.rerender(<EditableLabels labels={labels} compact onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add label' })).toHaveTextContent(/^$/)
    expect(screen.getByRole('button', { name: 'Add label' })).toHaveClass('compact')
    view.rerender(<EditableLabels labels={labels} iconOnly onChange={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Add label' })
    expect(button).toHaveTextContent(/^$/)
    expect(button).toHaveClass('label-add', 'icon')
    expect(button).not.toHaveClass('compact')
    expect(button).toHaveAttribute('title', 'Add label')
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('still adds a label from the icon-only button, under the name of its subject', () => {
    const onChange = vi.fn()
    render(<EditableLabels labels={labels} iconOnly subject="Understand & Express" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add label to Understand & Express' }))
    fireEvent.change(screen.getByLabelText('New label for Understand & Express'), { target: { value: 'Pray' } })
    fireEvent.keyDown(screen.getByLabelText('New label for Understand & Express'), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith([...labels, { id: expect.any(String), text: 'Pray' }])
  })

  it('renames on Enter, removes a label emptied by renaming, and leaves unchanged text alone', () => {
    const onChange = vi.fn()
    render(<EditableLabels labels={labels} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit label Speak' }))
    fireEvent.blur(screen.getByLabelText('Rename label Speak'))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit label Speak' }))
    fireEvent.change(screen.getByLabelText('Rename label Speak'), { target: { value: 'Talk' } })
    fireEvent.keyDown(screen.getByLabelText('Rename label Speak'), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'a', text: 'Talk' }, labels[1]])
    fireEvent.click(screen.getByRole('button', { name: 'Edit label Read' }))
    fireEvent.change(screen.getByLabelText('Rename label Read'), { target: { value: '  ' } })
    fireEvent.keyDown(screen.getByLabelText('Rename label Read'), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith([labels[0]])
  })

  it('cancels a rename on Escape and disables every control while saving', () => {
    const onChange = vi.fn()
    const { rerender } = render(<EditableLabels labels={labels} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit label Speak' }))
    fireEvent.change(screen.getByLabelText('Rename label Speak'), { target: { value: 'Nope' } })
    fireEvent.keyDown(screen.getByLabelText('Rename label Speak'), { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Edit label Speak' })).toBeVisible()
    rerender(<EditableLabels labels={labels} disabled onChange={onChange} />)
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })
})

describe('InlineText', () => {
  it('shows plain text, or nothing when empty, to readers', () => {
    const { container, rerender } = render(<InlineText editable={false} label="note" placeholder="Add a note" value="Hello" onSave={vi.fn()} />)
    expect(container).toHaveTextContent('Hello')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    rerender(<InlineText editable={false} label="note" placeholder="Add a note" value="" onSave={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('saves on Enter or blur when changed, and a multi-line field saves on Ctrl+Enter', () => {
    const onSave = vi.fn()
    render(<InlineText editable multiline label="note" placeholder="Add a note" value="" onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add a note' }))
    fireEvent.change(screen.getByLabelText('Edit note'), { target: { value: 'line one\nline two' } })
    fireEvent.keyDown(screen.getByLabelText('Edit note'), { key: 'Enter' })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByLabelText('Edit note'), { key: 'Enter', metaKey: true })
    expect(onSave).toHaveBeenCalledWith('line one\nline two')
  })

  it('does not save unchanged or cancelled text, and keeps a required value when emptied', () => {
    const onSave = vi.fn()
    render(<InlineText editable required label="name" placeholder="Name" value="Goal" onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal' }))
    fireEvent.blur(screen.getByLabelText('Edit name'))
    fireEvent.click(screen.getByRole('button', { name: 'Goal' }))
    fireEvent.change(screen.getByLabelText('Edit name'), { target: { value: '' } })
    fireEvent.blur(screen.getByLabelText('Edit name'))
    fireEvent.click(screen.getByRole('button', { name: 'Goal' }))
    fireEvent.change(screen.getByLabelText('Edit name'), { target: { value: 'Other' } })
    fireEvent.keyDown(screen.getByLabelText('Edit name'), { key: 'Escape' })
    expect(onSave).not.toHaveBeenCalled()
  })
})
