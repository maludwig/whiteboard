import type { ReactNode } from 'react'

/** Inline SVG stand-ins for the Font Awesome 3 icons the old page loaded from a CDN. */
function Icon({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PencilIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 20l1-4L16 5l3 3L8 19z" />
    <path d="M14 7l3 3" />
  </Icon>
)

/** Ten triangular rays, one every 36° starting straight up, around the sun's ring. */
const SUN_RAYS = Array.from({ length: 10 }, (_, i) => {
  const angle = ((i * 36 - 90) * Math.PI) / 180
  const halfBase = (12 * Math.PI) / 180
  const at = (r: number, a: number) => `${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`
  return `${at(7.3, angle - halfBase)} ${at(11.6, angle)} ${at(7.3, angle + halfBase)}`
})

/** The highlighter's icon is a sun, as on the original page. */
export const SunIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.9" fill="none" stroke="currentColor" strokeWidth="2.2" />
    {SUN_RAYS.map((points) => (
      <polygon key={points} points={points} fill="currentColor" />
    ))}
  </svg>
)

export const EraserIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M7 20h13" />
    <path d="M4 15l9-9 6 6-8 8H8z" />
    {/* The upper-right end, filled in; its lower edge is the divider. */}
    <path d="M9 10l4-4 6 6-4 4z" fill="currentColor" />
  </Icon>
)

export const ClearIcon = () => (
  <Icon>
    <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
  </Icon>
)

export const ShareIcon = () => (
  <Icon>
    <path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.5 4.3 4.3 0 0 0 7 18z" />
  </Icon>
)

export const SaveIcon = () => (
  <Icon>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v5h7V4" />
    <path d="M8 20v-6h8v6" />
  </Icon>
)

export const UndoIcon = () => (
  <Icon>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h10a6 6 0 0 1 6 6" />
  </Icon>
)

export const RedoIcon = () => (
  <Icon>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12H10a6 6 0 0 0-6 6" />
  </Icon>
)

export const ChevronIcon = ({ open }: { open: boolean }) => (
  <Icon size={20}>
    <path d={open ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </Icon>
)
