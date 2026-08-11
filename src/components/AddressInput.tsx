import { useEffect, useId, useRef, useState } from "react";

import type { Point } from "../lib/distance";
import {
  newPlacesSession,
  placeSuggestions,
  resolveSuggestion,
  type GeocodeResult,
  type PlaceSuggestion,
} from "../lib/travel";

/** Long enough that a fast typist doesn't pay for a request per letter. */
const DEBOUNCE_MS = 250;
/** Below this, suggestions are noise. */
const MIN_QUERY = 3;

export default function AddressInput({
  value,
  onChange,
  onResolved,
  bias,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  /**
   * A picked place, already resolved to coordinates — or null when the text
   * is edited afterwards, since it no longer describes that place.
   */
  onResolved: (result: GeocodeResult | null) => void;
  bias?: Point;
  placeholder?: string;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const session = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  // Suppresses the lookup that the input change from choosing an item
  // would otherwise trigger.
  const justPicked = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < MIN_QUERY) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        session.current ??= await newPlacesSession();
        if (cancelled) return;
        const found = await placeSuggestions(query, session.current, bias);
        if (cancelled) return;
        setSuggestions(found);
        setActive(-1);
        setOpen(found.length > 0);
      } catch {
        // Places may be unavailable on this key. Typed addresses still work —
        // the form geocodes whatever is in the box on submit.
        if (!cancelled) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, bias]);

  // A click anywhere else is a dismissal.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function pick(suggestion: PlaceSuggestion) {
    justPicked.current = true;
    const label = [suggestion.primary, suggestion.secondary]
      .filter(Boolean)
      .join(", ");
    onChange(label);
    setOpen(false);
    setSuggestions([]);

    try {
      const resolved = await resolveSuggestion(suggestion);
      onResolved(resolved);
    } catch {
      // Fall back to geocoding the text on submit.
      onResolved(null);
    } finally {
      // fetchFields closed this session; the next search needs a fresh token.
      session.current = null;
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      // Only swallow Enter when a suggestion is highlighted, so typing an
      // address and hitting Enter still submits the form.
      event.preventDefault();
      void pick(suggestions[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={box} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Edited text no longer describes the place that was picked.
          onResolved(null);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 ? `${listId}-${active}` : undefined
        }
        className="w-full rounded-lg bg-surface px-3 py-2 text-sm text-ink ring-1 ring-line placeholder:text-ink-3"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
            >
              <button
                type="button"
                // mousedown, not click: the input's blur would otherwise close
                // the list before the click landed.
                onMouseDown={(e) => {
                  e.preventDefault();
                  void pick(suggestion);
                }}
                onMouseEnter={() => setActive(index)}
                className={
                  "block w-full px-3 py-2 text-left text-sm " +
                  (index === active ? "bg-surface-2" : "hover:bg-surface-2")
                }
              >
                <span className="block truncate font-medium text-ink">
                  {suggestion.primary}
                </span>
                {suggestion.secondary && (
                  <span className="block truncate text-xs text-ink-3">
                    {suggestion.secondary}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
