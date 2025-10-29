import { useState } from 'react';

export default function User({ id, name, username }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`tip ${open ? 'is-open' : ''}`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {name || id || 'unknown'}
      <div className="tip__bubble" role="tooltip">{`@${username}`}</div>
    </span>
  );
}
