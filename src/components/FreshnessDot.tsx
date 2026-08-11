import { freshness, type FreshnessLevel } from "../lib/trust";
import type { Masjid } from "../lib/types";

/**
 * Four states, one of which is always shown — design spec v2 §5.
 *
 * "Absence of a chip must never be a state." That was the old bug: a grey
 * `Checked today` on some cards and nothing on others, leaving the reader
 * unable to tell stale from unlabelled. Every card and detail view renders
 * exactly one of these, including the reassuring ones.
 *
 * Colour is never the only signal (§12), so the dot always travels with its
 * label unless the caller is showing the label itself elsewhere.
 */
const DOT: Record<FreshnessLevel, string> = {
  verified: "bg-ok",
  recent: "bg-ok opacity-50",
  stale: "bg-caution",
  none: "border border-line-strong",
};

export default function FreshnessDot({
  masjid,
  today,
  showLabel = true,
}: {
  masjid: Masjid;
  today: Date;
  showLabel?: boolean;
}) {
  const state = freshness(masjid, today);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[state.level]}`}
        aria-hidden="true"
      />
      {showLabel ? (
        <span
          className={
            "text-meta " + (state.level === "stale" ? "text-caution" : "text-ink-3")
          }
        >
          {state.label}
        </span>
      ) : (
        // The dot alone would be colour-as-only-signal; name it for AT.
        <span className="sr-only">{state.label}</span>
      )}
    </span>
  );
}
