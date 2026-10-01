import { useId, type CSSProperties } from 'react'
import { WARMTH_MAX } from '../domain/types'
import { needsAttention, warmthColor, warmthWord } from './warmth'

const VALUES = Array.from({ length: WARMTH_MAX + 1 }, (_, value) => value)

/**
 * How alive a direction is, 0 (cold) to 10 (very warm), as a row of eleven steps. The cold end asks for attention and
 * says so with a small flag. The steps up to the value take the direction's colour; the rest hint at the scale. The
 * owner taps a step to set the value (tapping the chosen step clears it); there is nothing to drag, so scrolling is
 * never in the way. Everyone else just sees where it stands.
 */
export function WarmthMeter({ title, value, editable, disabled, onChange }: {
  title: string
  value?: number
  editable: boolean
  disabled?: boolean
  onChange?: (value: number | null) => void
}) {
  const group = useId()
  if (!editable && value === undefined) return null
  const word = value === undefined ? undefined : warmthWord(value)
  const cold = value !== undefined && needsAttention(value)
  const summary = value === undefined ? 'not set' : `${value} of ${WARMTH_MAX}, ${word}${cold ? ', needs attention' : ''}`
  const steps = VALUES.map((step) => {
    const style = { '--step': warmthColor(step) } as CSSProperties
    const className = `warmth-step${value !== undefined && step <= value ? ' on' : ''}${step === value ? ' current' : ''}`
    return editable
      ? <label key={step} className={className} style={style} title={`${step} · ${warmthWord(step)}`}>
        <input type="radio" name={group} value={step} checked={step === value} disabled={disabled}
          aria-label={`${step}, ${warmthWord(step)}`}
          onChange={() => onChange?.(step)}
          onClick={() => { if (step === value) onChange?.(null) }} />
        <span aria-hidden="true" />
      </label>
      : <span key={step} className={className} style={style} />
  })
  return <div className={`warmth${editable ? ' editable' : ''}`} data-set={value === undefined ? undefined : ''}>
    <div className="warmth-head">
      <span className="warmth-title"><span className="warmth-name">Warmth</span>{cold && <span className="warmth-flag">Needs attention</span>}</span>
      <span className="warmth-value">{value === undefined ? 'Not set' : <><strong>{value}</strong><span className="warmth-of">/{WARMTH_MAX}</span> · {word}</>}</span>
    </div>
    {editable
      ? <fieldset className="warmth-scale" disabled={disabled}>
        <legend className="visually-hidden">Warmth of {title}, 0 to {WARMTH_MAX}: how alive it is; the colder, the more it needs attention</legend>
        {steps}
      </fieldset>
      : <div className="warmth-scale" role="img" aria-label={`Warmth of ${title}: ${summary}`}>{steps}</div>}
    {editable && <div className="warmth-ends" aria-hidden="true"><span>Cold</span><span>Very warm</span></div>}
  </div>
}
