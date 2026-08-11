import { useState } from "react";
import Icon from "./Icon";
import Sheet from "./Sheet";
import { PRESETS, type ReferencePoint } from "../lib/location";

/**
 * The location control, once, in chrome — design spec v2 §2, §8.2.
 *
 * Replaces the full-width "Distances from" card that used to sit at the top
 * of every screen, pushing the actual answer below the fold. Here it is a
 * chip: always reachable, never in the way, opening a sheet with the presets,
 * the device option, and (later) an address field.
 */
export default function LocationChip({
  reference,
  /** Sidebar variant: full width, left-aligned, no pill. */
  block = false,
}: {
  reference: ReferencePoint;
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { status, presetId, selectPreset, useDeviceLocation } = reference;
  const usingDevice = status === "active";
  const label = usingDevice ? "My location" : reference.label;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={
          block
            ? "flex min-h-[44px] w-full items-center gap-2 rounded-md px-2 text-left text-body text-ink-2 hover:text-ink"
            : // Capped and truncated for the same reason as the tab bar: this
              // is chrome on a fixed row, and a 200% text setting must not
              // push it off screen (§12).
              "flex min-h-[44px] max-w-[55vw] items-center gap-1.5 rounded-full border border-line bg-surface px-3 font-medium text-ink-2 hover:text-ink"
        }
      >
        <Icon name="map-pin" size={block ? 20 : 16} />
        <span
          className="min-w-0 flex-1 truncate"
          style={block ? undefined : { fontSize: "min(var(--t--1), 3.4vw)" }}
        >
          {label}
        </span>
        <Icon name="chevron-down" size={16} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Distances from">
        <ul className="space-y-1">
          {usingDevice && (
            <Option
              label="My location"
              selected
              onClick={() => setOpen(false)}
              hint="Using your device"
            />
          )}
          {PRESETS.map((preset) => (
            <Option
              key={preset.id}
              label={preset.label}
              selected={!usingDevice && preset.id === presetId}
              onClick={() => {
                selectPreset(preset.id);
                setOpen(false);
              }}
            />
          ))}
        </ul>

        {!usingDevice && (
          <button
            type="button"
            onClick={() => {
              useDeviceLocation();
              setOpen(false);
            }}
            disabled={status === "locating"}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-medium text-brand-ink disabled:opacity-60"
          >
            <Icon name="crosshair" size={18} />
            {status === "locating" ? "Locating…" : "Use my location"}
          </button>
        )}
      </Sheet>
    </>
  );
}

function Option({
  label,
  selected,
  onClick,
  hint,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={
          "flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-left " +
          (selected ? "bg-brand-wash text-brand" : "text-ink-2 hover:text-ink")
        }
      >
        <span className="flex-1">
          {label}
          {hint && <span className="block text-meta text-ink-3">{hint}</span>}
        </span>
        {selected && <Icon name="check" size={18} />}
      </button>
    </li>
  );
}
