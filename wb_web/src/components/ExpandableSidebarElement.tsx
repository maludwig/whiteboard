import type { ReactNode } from 'react'
import { ChevronIcon } from './icons'

/**
 * A sidebar section that can show more: its content in one column, and a
 * chevron that toggles it in a second column, vertically centred on the
 * content however tall it grows.
 */
export function ExpandableSidebarElement(props: {
  expanded: boolean
  onToggle: () => void
  /** The chevron's accessible name, e.g. "More palettes". */
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={['expandable', props.className].filter(Boolean).join(' ')}>
      <Column grow>{props.children}</Column>
      <Column centered>
        <ToggleChevron expanded={props.expanded} label={props.label} onToggle={props.onToggle} />
      </Column>
    </section>
  )
}

function Column(props: { grow?: boolean; centered?: boolean; children: ReactNode }) {
  const classes = ['column', props.grow && 'grow', props.centered && 'centered'].filter(Boolean).join(' ')
  return <div className={classes}>{props.children}</div>
}

function ToggleChevron(props: { expanded: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="toggle-chevron" aria-label={props.label} aria-expanded={props.expanded} onClick={props.onToggle}>
      <ChevronIcon open={props.expanded} />
    </button>
  )
}
