import React, { useEffect, useRef, useState } from "react"
import { CityEntry, loadCityCatalogue, searchCities } from "../utils/cityCatalogue"

/**
 * Text input with city suggestions from the static India catalogue. Picking a
 * suggestion writes "City, State" into the field; typing anything else is
 * still allowed (the field is free text — the list only nudges consistent
 * spellings). No library: a small listbox with arrow-key / Enter / Escape
 * support, rendered under the input.
 */
type Props = {
  id?: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  style?: React.CSSProperties
  className?: string
}

const CityTypeahead: React.FC<Props> = ({ id, value, placeholder, onChange, onBlur, invalid, style, className }) => {
  const [entries, setEntries] = useState<CityEntry[] | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  // Fetch the catalogue on first focus (not on mount) so pages that never
  // touch the field pay nothing.
  const ensureLoaded = () => {
    if (entries) return
    loadCityCatalogue().then(setEntries).catch(() => setEntries([]))
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const matches = open && entries && value.trim().length >= 2 ? searchCities(entries, value) : []

  const pick = (e: CityEntry) => {
    onChange(e.label)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) return
    if (ev.key === "ArrowDown") {
      ev.preventDefault()
      setActive((a) => (a + 1) % matches.length)
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault()
      setActive((a) => (a <= 0 ? matches.length - 1 : a - 1))
    } else if (ev.key === "Enter") {
      if (active >= 0) {
        ev.preventDefault()
        pick(matches[active])
      }
    } else if (ev.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          ensureLoaded()
          setOpen(true)
        }}
        onChange={(e) => {
          ensureLoaded()
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Delay so a click on a suggestion registers before the list closes.
          closeTimer.current = window.setTimeout(() => {
            setOpen(false)
            onBlur?.()
          }, 150)
        }}
        style={style}
      />
      {matches.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 20,
            margin: 0, padding: 4, listStyle: "none",
            background: "#fff", border: `2px solid ${invalid ? "#e53e3e" : "#e2e8f0"}`, borderRadius: 10,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)", maxHeight: 264, overflowY: "auto",
          }}
        >
          {matches.map((m, i) => (
            <li
              key={m.label}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault() /* keep input focus; blur would close the list first */}
              onClick={() => pick(m)}
              onMouseEnter={() => setActive(i)}
              style={{
                padding: "0.55rem 0.75rem", borderRadius: 8, cursor: "pointer", fontSize: "0.92rem", color: "#2d3748",
                background: i === active ? "#ECFDF5" : "transparent",
              }}
            >
              {m.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CityTypeahead
