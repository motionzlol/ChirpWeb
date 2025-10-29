import { useState } from 'react'

export default function TsMeta({ ts }) {
  const [open, setOpen] = useState(false)
  if (!ts) return <div className="list__meta" />
  try {
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
    const day = d.toLocaleDateString(undefined, { weekday: 'short' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const full = d.toLocaleString()
    return (
      <div
        className={`list__meta tip ${open ? 'is-open' : ''}`}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span>{day} · {time}</span>
        <div className="tip__bubble" role="tooltip">{full}</div>
      </div>
    )
  } catch {
    return <div className="list__meta" />
  }
}
